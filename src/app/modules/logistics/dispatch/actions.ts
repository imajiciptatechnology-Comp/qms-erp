"use server";

import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { AiError, aiComplete, isAiConfigured } from "@/lib/ai";
import { uploadToStorage } from "@/lib/uploadFile";
import { guardAccess as guard, runAction as run } from "../server";
import { consumeDailyQuota } from "../dbUtil";
import { canOverride, evaluateTrip, LEVEL_LABEL } from "../dispatchRules";
import { createTrip, issueSuratJalan } from "../tripOps";
import { notifyPermission } from "../fleetDocs";

/** Dispatcher: assign truk + sopir (+ kenek) ke order Confirmed. */
export async function assignTrip(input: { orderId: string; vehicleId: string; driverId: string; helperId: string | null; dutyAck: boolean }) {
  return run(async () => {
    const { user } = await guard(a => a.canDispatch);
    const { trip, driver, conditions } = await createTrip(input, user.name, { mode: "dispatch", dutyAck: input.dutyAck });
    const pending = conditions.filter(c => c.level !== "none");
    for (const level of ["fleet", "ops", "director"] as const) {
      const list = pending.filter(c => c.level === level);
      if (!list.length) continue;
      const perm = { fleet: "logistics_override_fleet", ops: "logistics_override_ops", director: "logistics_override_director" }[level];
      await notifyPermission(perm, [`Trip ${trip.tripNo} (${driver.name}) butuh ${LEVEL_LABEL[level]}: ${list.map(c => c.text).join("; ")}`], `/modules/logistics/trips/${trip.id}`);
    }
    // Tanpa kondisi blokir → Surat Jalan langsung terbit.
    if (!conditions.length) await issueSuratJalan(trip.id, user.name);
    // Sopir langsung dikabari tugas baru lewat bot (setelah respons, supaya papan Dispatch tidak menunggu Telegram).
    after(async () => {
      const { notifyDriverNewTrip } = await import("../bot/driverNotify");
      await notifyDriverNewTrip(trip.id, user.name).catch(err => console.error("[dispatch] notify driver", err));
    });
    return trip.id;
  });
}

/** Override satu kondisi untuk satu trip (alasan + tindakan pengendalian wajib; bukti wajib untuk #5). */
export async function overrideCondition(fd: FormData) {
  return run(async () => {
    const { user, access } = await guard(a => a.canView);
    const tripId = String(fd.get("tripId") ?? "");
    const key = String(fd.get("key") ?? "");
    const reason = String(fd.get("reason") ?? "").trim().slice(0, 1000);
    const controlAction = String(fd.get("controlAction") ?? "").trim().slice(0, 300);
    if (reason.length < 10) throw new Error("Alasan override wajib diisi (min. 10 karakter).");
    if (!controlAction) throw new Error("Pilih tindakan pengendalian.");
    const ev = await evaluateTrip(tripId);
    if (ev.trip.status !== "Scheduled") throw new Error("Override hanya sebelum trip berangkat.");
    const cond = ev.items.find(i => i.key === key);
    if (!cond) throw new Error("Kondisi ini sudah tidak berlaku.");
    if (cond.override) throw new Error("Kondisi ini sudah di-override.");
    if (cond.level === "none") throw new Error("Kondisi ini tidak bisa di-override (keselamatan/hukum).");
    if (!canOverride(cond.level, access)) throw new Error(`Butuh ${LEVEL_LABEL[cond.level]}. Role Anda (${user.role}) tidak berwenang.`);
    let evidenceUrl: string | null = null;
    let evidenceName: string | null = null;
    const file = fd.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > 4 * 1024 * 1024) throw new Error("Bukti maks. 4 MB.");
      if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) throw new Error("Bukti harus foto atau PDF.");
      evidenceUrl = await uploadToStorage(`logistics/overrides/${tripId}`, file);
      evidenceName = file.name.slice(0, 120);
    }
    if (cond.needsEvidence && !evidenceUrl) throw new Error("Kondisi ini wajib melampirkan bukti (mis. tanda terima perpanjangan).");
    const now = new Date().toISOString();
    await prisma.$transaction([
      prisma.dispatchOverride.create({ data: { tripId, condition: key, conditionText: cond.text, level: cond.level, reason, controlAction, evidenceUrl, evidenceName, byName: user.name, byRole: user.role, at: now } }),
      prisma.tripEvent.create({ data: { tripId, status: "Override", label: `Override #${cond.code} oleh ${user.name} (${user.role}): ${cond.text}`, note: reason, at: now, source: "Kantor", by: user.name } }),
    ]);
    // Atasan diberi tahu (jejak audit ISO).
    await notifyPermission("logistics_override_director", [`Override #${cond.code} trip ${ev.trip.tripNo} oleh ${user.name}: ${cond.text}. Alasan: ${reason}`], `/modules/logistics/trips/${tripId}`);
    return tripId;
  });
}

export async function issueSj(tripId: string) {
  return run(async () => {
    const { user } = await guard(a => a.canDispatch);
    await issueSuratJalan(tripId, user.name);
    after(async () => {
      const { notifyDriverSuratJalan } = await import("../bot/driverNotify");
      await notifyDriverSuratJalan(tripId, user.name).catch(err => console.error("[dispatch] notify SJ", err));
    });
    return tripId;
  });
}

export async function cancelTrip(tripId: string, reason: string) {
  return run(async () => {
    const { user } = await guard(a => a.canDispatch);
    if (!reason.trim()) throw new Error("Alasan pembatalan wajib diisi.");
    const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
    if (trip.status !== "Scheduled") throw new Error("Hanya trip yang belum berangkat yang bisa dibatalkan.");
    const now = new Date().toISOString();
    // Bersyarat: sopir bisa saja menekan "Berangkat" pada saat yang sama.
    const cancelled = await prisma.$transaction(async tx => {
      const res = await tx.trip.updateMany({ where: { id: tripId, status: "Scheduled" }, data: { status: "Cancelled" } });
      if (res.count === 0) return false;
      await tx.tripEvent.create({ data: { tripId, status: "Cancelled", label: `Trip dibatalkan oleh ${user.name}: ${reason.trim().slice(0, 300)}`, at: now, source: "Kantor", by: user.name } });
      return true;
    });
    if (!cancelled) throw new Error("Trip baru saja berangkat; tidak bisa dibatalkan dari sini.");
    after(async () => {
      const { notifyDriverCancelled } = await import("../bot/driverNotify");
      await notifyDriverCancelled(tripId, reason.trim(), user.name).catch(err => console.error("[dispatch] notify cancel", err));
    });
    if (trip.orderId) {
      const order = await prisma.charterOrder.findUnique({ where: { id: trip.orderId } });
      if (order?.status === "Scheduled") {
        const list = JSON.parse(order.historyJson || "[]");
        list.push({ id: String(list.length + 1), date: now, userName: user.name, action: `Trip ${trip.tripNo} dibatalkan — order kembali menunggu dispatch` });
        await prisma.charterOrder.update({ where: { id: order.id }, data: { status: "Confirmed", historyJson: JSON.stringify(list) } });
      }
    }
    return tripId;
  });
}

/** AI menjelaskan usulan truk & sopir (hitungan & kelayakan tetap dari kode). */
export async function aiExplainDispatch(data: { order: string; truck: string; truckIssues: string[]; driver: string; driverIssues: string[]; dutyWarnings: string[]; alternatives: string[] }) {
  try {
    const { user } = await guard(a => a.canView);
    if (!isAiConfigured()) return { ok: false as const, error: "AI belum dikonfigurasi." };
    if (!(await consumeDailyQuota(`ai_dispatch_explain:${user.id}`, 60))) return { ok: false as const, error: "Batas 60 penjelasan AI per hari sudah tercapai." };
    const { text } = await aiComplete([
      { role: "system", content: "Anda asisten dispatcher truk charter. Jelaskan singkat (maks. 5 kalimat, bahasa Indonesia) kenapa kombinasi truk & sopir ini diusulkan, risiko yang perlu diperhatikan, dan alternatifnya. Pakai hanya data yang diberikan." },
      { role: "user", content: JSON.stringify(data).slice(0, 8000) },
    ], { maxTokens: 500, temperature: 0.3, reasoningEffort: "low" });
    return { ok: true as const, text };
  } catch (err) {
    return { ok: false as const, error: err instanceof AiError || err instanceof Error ? err.message : "Gagal." };
  }
}
