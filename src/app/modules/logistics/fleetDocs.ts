// Dokumen armada & sopir (rancangan 10.1): sinkron masa berlaku ke Vehicle/Driver, kualifikasi, dan pengingat.
// Sengaja bukan "use server": dipanggil dari server actions, halaman, dan webhook bot.
import { prisma } from "@/lib/prisma";
import { getJson, setJson } from "@/lib/kvStore";
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

/**
 * Tulis notifikasi ERP (KvStore "notifications") untuk semua user yang punya izin `permission` (+ Super Admin).
 * Sekali baca–tulis, tanpa revalidatePath, jadi aman dipanggil dari after()/webhook.
 */
export async function notifyPermission(permission: string, messages: string[], link?: string) {
  const [users, roles, list] = await Promise.all([
    prisma.user.findMany({ select: { id: true, role: true } }),
    getJson<{ name: string; permissions: string[] }[]>("roles", []),
    getJson<{ id: string; userId?: string; message: string; isRead: boolean; createdAt: string; link?: string }[]>("notifications", []),
  ]);
  const targets = users.filter(u => u.role === "Super Admin" || roles.find(r => r.name === u.role)?.permissions?.some(p => p === permission || p === "all"));
  const at = new Date().toISOString();
  let n = 0;
  for (const message of messages) for (const u of targets) {
    list.unshift({ id: `${Date.now()}-${n++}`, userId: u.id, message, isRead: false, createdAt: at, link });
  }
  await setJson("notifications", list.slice(0, 500));
}

/** Dipanggil lewat after() saat halaman logistik dibuka: paling sering sekali per jam. */
export async function maybeRunFleetReminders(onDriverReminder?: Parameters<typeof runFleetReminders>[0]) {
  const key = "logistics_doc_reminders_last";
  const last = await getJson<number>(key, 0);
  if (Date.now() - last < 60 * 60 * 1000) return;
  await setJson(key, Date.now());
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
