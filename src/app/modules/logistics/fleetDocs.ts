// Dokumen armada & sopir (rancangan 10.1): sinkron masa berlaku ke Vehicle/Driver, kualifikasi, dan pengingat.
// Sengaja bukan "use server": dipanggil dari server actions, halaman, dan webhook bot.
import { prisma } from "@/lib/prisma";
import { getJson, setJson } from "@/lib/kvStore";
import { claimInterval } from "./dbUtil";
import { notifyPermission as notifyUsers } from "@/lib/notificationStore";
import { DRIVER_DOC_TYPES, VEHICLE_DOC_TYPES, addDays, expiryState, qualifiesFor, today } from "./lib";

/** Dokumen Verified dengan masa berlaku paling akhir per jenis. */
function latestByType<T extends { docType: string; validUntil: string | null; status: string }>(docs: T[]) {
  const map = new Map<string, T>();
  for (const d of docs) {
    if (d.status !== "Verified" || !d.validUntil) continue;
    const cur = map.get(d.docType);
    if (!cur || d.validUntil > cur.validUntil!) map.set(d.docType, d);
  }
  return map;
}

/** Isi kolom masa berlaku & jadwal servis Vehicle dari dokumen/servis terbaru. Jenis tanpa dokumen Verified tidak diubah. */
export async function syncVehicleFromDocs(vehicleId: string) {
  const [docs, lastService] = await Promise.all([
    prisma.vehicleDocument.findMany({ where: { vehicleId } }),
    prisma.vehicleServiceRecord.findFirst({ where: { vehicleId, kind: "Berkala" }, orderBy: [{ serviceDate: "desc" }, { odometerKm: "desc" }] }),
  ]);
  const latest = latestByType(docs);
  const data: Record<string, string | number | null> = {};
  for (const [type, spec] of Object.entries(VEHICLE_DOC_TYPES)) {
    const d = latest.get(type);
    if (d) data[spec.field] = d.validUntil;
  }
  if (lastService) {
    data.nextServiceDate = lastService.nextServiceDate;
    data.nextServiceKm = lastService.nextServiceKm;
  }
  const maxKm = await prisma.vehicleServiceRecord.aggregate({ where: { vehicleId }, _max: { odometerKm: true } });
  const v = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId }, select: { odometerKm: true } });
  if ((maxKm._max.odometerKm ?? 0) > v.odometerKm) data.odometerKm = maxKm._max.odometerKm!;
  if (Object.keys(data).length) await prisma.vehicle.update({ where: { id: vehicleId }, data });
}

/** SIM terbaru → simExpiry/simClass/simNo; training → flag; lalu hitung ulang kualifikasi otomatis. */
export async function syncDriverFromDocs(driverId: string) {
  const docs = await prisma.driverDocument.findMany({ where: { driverId } });
  const latest = latestByType(docs);
  const now = today();
  const data: Record<string, string | boolean | null> = {};
  const sim = latest.get("SIM");
  if (sim) {
    data.simExpiry = sim.validUntil;
    if (sim.simClass) data.simClass = sim.simClass;
    if (sim.docNo) data.simNo = sim.docNo;
  }
  const def = latest.get("TRAINING_DEFENSIVE");
  if (def) data.defensiveTraining = def.validUntil! >= now;
  const trl = latest.get("TRAINING_TRAILER");
  if (trl) data.trailerCertified = trl.validUntil! >= now;
  const driver = Object.keys(data).length
    ? await prisma.driver.update({ where: { id: driverId }, data })
    : await prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
  await syncAutoQualifications(driver);
}

/** Baris kualifikasi basis "auto" mengikuti aturan 1.3; baris manual tidak disentuh. */
export async function syncAutoQualifications(d: { id: string; simClass: string; experienceYears: number; defensiveTraining: boolean; trailerCertified: boolean }) {
  const [types, quals] = await Promise.all([
    prisma.truckType.findMany(),
    prisma.driverQualification.findMany({ where: { driverId: d.id } }),
  ]);
  for (const t of types) {
    const q = quals.find(x => x.truckTypeId === t.id);
    const ok = qualifiesFor(d, t.code);
    if (ok && !q) await prisma.driverQualification.create({ data: { driverId: d.id, truckTypeId: t.id, basis: "auto" } });
    if (!ok && q?.basis === "auto") await prisma.driverQualification.delete({ where: { id: q.id } });
  }
}

// ---------------------------------------------------------
// Tolak dokumen Verified → kembalikan masa berlaku sebelumnya
// ---------------------------------------------------------

const DRIVER_DOC_FIELDS: Record<string, ("simExpiry" | "simClass" | "simNo" | "defensiveTraining" | "trailerCertified")[]> = {
  SIM: ["simExpiry", "simClass", "simNo"], TRAINING_DEFENSIVE: ["defensiveTraining"], TRAINING_TRAILER: ["trailerCertified"],
};
const fieldsOf = (kind: "vehicle" | "driver", docType: string): string[] =>
  kind === "vehicle" ? (VEHICLE_DOC_TYPES[docType] ? [VEHICLE_DOC_TYPES[docType].field] : []) : DRIVER_DOC_FIELDS[docType] ?? [];
const prevKey = (docId: string) => `logistics_doc_prev:${docId}`;

/** Ambil nilai kolom Vehicle/Driver yang akan ditimpa oleh dokumen jenis ini (dipanggil SEBELUM verifikasi). */
export async function ownerFieldsBefore(kind: "vehicle" | "driver", ownerId: string, docType: string): Promise<Record<string, unknown>> {
  const fields = fieldsOf(kind, docType);
  if (!fields.length) return {};
  const select = Object.fromEntries(fields.map(f => [f, true]));
  const row = kind === "vehicle"
    ? await prisma.vehicle.findUnique({ where: { id: ownerId }, select })
    : await prisma.driver.findUnique({ where: { id: ownerId }, select });
  return (row ?? {}) as Record<string, unknown>;
}

/** Simpan nilai sebelum verifikasi untuk dokumen ini (hanya sekali — verifikasi ulang tidak menimpa nilai asal). */
export async function rememberBeforeVerify(docId: string, before: Record<string, unknown>) {
  if (!Object.keys(before).length) return;
  if ((await getJson<Record<string, unknown> | null>(prevKey(docId), null)) != null) return;
  await setJson(prevKey(docId), before);
}

/** Sebelum menolak dokumen Verified: pastikan ada nilai pengganti (dokumen Verified lain atau nilai sebelum verifikasi). */
export async function assertRejectable(kind: "vehicle" | "driver", doc: { id: string; docType: string; ownerId: string; status: string }) {
  if (doc.status !== "Verified") return;
  const otherVerified = kind === "vehicle"
    ? await prisma.vehicleDocument.count({ where: { vehicleId: doc.ownerId, docType: doc.docType, status: "Verified", validUntil: { not: null }, id: { not: doc.id } } })
    : await prisma.driverDocument.count({ where: { driverId: doc.ownerId, docType: doc.docType, status: "Verified", validUntil: { not: null }, id: { not: doc.id } } });
  if (otherVerified) return;
  if ((await getJson<Record<string, unknown> | null>(prevKey(doc.id), null)) != null) return;
  throw new Error("Masa berlaku sebelum dokumen ini tidak tercatat (dokumen lama/data demo). Tambahkan dokumen pengganti yang benar dulu, lalu tolak dokumen ini.");
}

/**
 * Sesudah dokumen ditolak: bila masih ada dokumen Verified lain sejenis, sync sudah memakai yang terbaru.
 * Bila tidak ada, kolom dikembalikan ke nilai sebelum dokumen ini diverifikasi. Mengembalikan true bila dipulihkan.
 */
export async function restoreAfterReject(kind: "vehicle" | "driver", doc: { id: string; docType: string; ownerId: string }) {
  const before = await getJson<Record<string, unknown> | null>(prevKey(doc.id), null);
  if (!before) return false;
  const otherVerified = kind === "vehicle"
    ? await prisma.vehicleDocument.count({ where: { vehicleId: doc.ownerId, docType: doc.docType, status: "Verified", validUntil: { not: null }, id: { not: doc.id } } })
    : await prisma.driverDocument.count({ where: { driverId: doc.ownerId, docType: doc.docType, status: "Verified", validUntil: { not: null }, id: { not: doc.id } } });
  if (otherVerified) return false;
  const data = Object.fromEntries(fieldsOf(kind, doc.docType).filter(f => f in before).map(f => [f, before[f]]));
  if (!Object.keys(data).length) return false;
  if (kind === "vehicle") await prisma.vehicle.update({ where: { id: doc.ownerId }, data });
  else await syncAutoQualifications(await prisma.driver.update({ where: { id: doc.ownerId }, data }));
  return true;
}

export type ExpiringItem = {
  key: string; owner: "vehicle" | "driver"; ownerId: string; ownerLabel: string; ownerSub: string;
  docType: string; docLabel: string; docNo: string | null; validUntil: string; daysLeft: number; level: "expired" | "remind";
  remindDays: number[]; driverId?: string;
};

/** Dokumen yang habis dalam `withinDays` hari (atau sudah habis), hanya versi berlaku terakhir per jenis. */
export async function getExpiringDocuments(withinDays = 60): Promise<ExpiringItem[]> {
  const now = today();
  const limit = addDays(now, withinDays);
  const [vehicles, drivers] = await Promise.all([
    prisma.vehicle.findMany({ include: { truckType: { select: { name: true } }, documents: true } }),
    prisma.driver.findMany({ where: { status: "Active" }, include: { documents: true } }),
  ]);
  const items: ExpiringItem[] = [];
  for (const v of vehicles) {
    const latest = latestByType(v.documents);
    for (const [type, spec] of Object.entries(VEHICLE_DOC_TYPES)) {
      const doc = latest.get(type);
      const validUntil = doc?.validUntil ?? v[spec.field];
      if (!validUntil || validUntil > limit) continue;
      const st = expiryState(validUntil, spec.remindDays, now);
      items.push({ key: `v-${v.id}-${type}`, owner: "vehicle", ownerId: v.id, ownerLabel: v.plateNo, ownerSub: v.truckType.name, docType: type, docLabel: spec.label, docNo: doc?.docNo ?? null, validUntil, daysLeft: st.daysLeft!, level: st.level === "expired" ? "expired" : "remind", remindDays: spec.remindDays });
    }
  }
  for (const d of drivers) {
    const latest = latestByType(d.documents);
    for (const [type, spec] of Object.entries(DRIVER_DOC_TYPES)) {
      const doc = latest.get(type);
      const validUntil = doc?.validUntil ?? (type === "SIM" ? d.simExpiry : null);
      if (!validUntil || validUntil > limit) continue;
      const st = expiryState(validUntil, spec.remindDays, now);
      items.push({ key: `d-${d.id}-${type}`, owner: "driver", ownerId: d.id, ownerLabel: d.name, ownerSub: `${d.code} · ${d.simClass}`, docType: type, docLabel: spec.label, docNo: doc?.docNo ?? null, validUntil, daysLeft: st.daysLeft!, level: st.level === "expired" ? "expired" : "remind", remindDays: spec.remindDays, driverId: d.id });
    }
  }
  return items.sort((a, b) => a.validUntil.localeCompare(b.validUntil));
}

/**
 * Pengingat ke notifikasi ERP (izin logistics_fleet) saat dokumen masuk ambang 60/30/7 hari atau habis.
 * Satu notifikasi per dokumen per ambang (dicatat di KvStore). Aman dipanggil berkali-kali.
 * `onDriverReminder` dipakai bot Telegram untuk mengirim pengingat SIM ke sopirnya sendiri.
 */
export async function runFleetReminders(onDriverReminder?: (item: ExpiringItem, text: string) => Promise<void>) {
  const key = "logistics_doc_reminders";
  const sent = await getJson<Record<string, string>>(key, {});
  const items = await getExpiringDocuments(60);
  const fresh: { item: ExpiringItem; text: string }[] = [];
  for (const item of items) {
    const threshold = item.level === "expired" ? "expired" : String(Math.min(...item.remindDays.filter(r => item.daysLeft <= r)));
    const id = `${item.key}:${item.validUntil}:${threshold}`;
    if (sent[id]) continue;
    sent[id] = today();
    const when = item.level === "expired" ? `sudah habis sejak ${item.validUntil}` : `habis ${item.validUntil} (${item.daysLeft} hari lagi)`;
    fresh.push({ item, text: `${item.docLabel} ${item.owner === "vehicle" ? "truk" : "sopir"} ${item.ownerLabel} ${when}.` });
  }
  if (!fresh.length) return 0;
  // Bersihkan catatan lama (> 120 hari) supaya KvStore tidak membengkak.
  const cutoff = addDays(today(), -120);
  for (const [k, d] of Object.entries(sent)) if (d < cutoff) delete sent[k];
  await setJson(key, sent);
  const messages = fresh.length <= 3
    ? fresh.map(f => `Dokumen armada: ${f.text}`)
    : [`Dokumen armada: ${fresh.length} dokumen habis/hampir habis — ${fresh.slice(0, 2).map(f => f.text).join(" ")} …`];
  await notifyPermission("logistics_fleet", messages, "/modules/logistics/fleet/expiring");
  if (onDriverReminder) {
    for (const f of fresh) if (f.item.owner === "driver") await onDriverReminder(f.item, f.text).catch(() => {});
  }
  return fresh.length;
}

/** Notifikasi ERP untuk semua user dengan izin `permission` (+ Super Admin). Aman dari after()/webhook (tanpa revalidatePath). */
export async function notifyPermission(permission: string, messages: string[], link?: string) {
  await notifyUsers(permission, messages, link);
}

/** Dipanggil lewat after() saat halaman logistik dibuka: paling sering sekali per jam. */
export async function maybeRunFleetReminders(onDriverReminder?: Parameters<typeof runFleetReminders>[0]) {
  // Atomik: dua halaman yang dibuka bersamaan tidak mengirim pengingat ganda.
  if (!(await claimInterval("logistics_doc_reminders_last", 60 * 60 * 1000))) return;
  try {
    // Default: pengingat SIM dikirim ke sopirnya sendiri lewat bot Telegram (bila terhubung).
    const toDriver = onDriverReminder ?? (async (item: ExpiringItem, text: string) => {
      const { isTelegramConfigured } = await import("@/lib/telegram");
      if (!isTelegramConfigured() || !item.driverId) return;
      const { sendToDriver } = await import("./bot/telegramBot");
      await sendToDriver(item.driverId, `⏰ Pengingat: ${text} Segera urus perpanjangan dan kirim foto dokumen barunya di chat ini.`);
    });
    await runFleetReminders(toDriver);
  } catch (err) {
    console.error("[fleet reminders]", err);
  }
}
