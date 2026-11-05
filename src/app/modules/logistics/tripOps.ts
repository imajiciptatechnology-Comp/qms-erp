// Operasi trip nyata (bukan simulasi): pembuatan trip lewat aturan 3.5, Surat Jalan, transisi status dari
// tombol bot sopir, P2H, dan tindak lanjut override. Dipakai papan Dispatch, bot Telegram, dan Driver simulator.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { today } from "./lib";
import { withLock, type Tx } from "./dbUtil";
import { ACTIVE_TRIP_STATUSES, TRIP_STATUSES, firstUnloadMin, parsePlan } from "./trackingLib";
import { buildPlan } from "./tracking";
import { driverConditions, dutyWarnings, evaluateTrip, orderConditions, vehicleConditions, vehicleRuleInclude, type Condition } from "./dispatchRules";

export type TripAction = { to: string; label: string };

/** Tombol status berikutnya untuk sopir (urut sesuai alur 3.2). */
export function nextActions(t: { status: string; stopsDone: number }, stopsTotal: number): TripAction[] {
  switch (t.status) {
    case "Scheduled": return [{ to: "ToLoad", label: "🚚 Berangkat ke lokasi muat" }];
    case "ToLoad": return [{ to: "Loading", label: "📦 Tiba di lokasi muat" }];
    case "Loading": return [{ to: "InTransit", label: "🛣️ Selesai muat, berangkat kirim" }];
    case "InTransit": return [{ to: "Unloading", label: `🏁 Tiba di titik bongkar ${Math.min(t.stopsDone + 1, stopsTotal)}` }];
    case "Unloading": return t.stopsDone + 1 < stopsTotal
      ? [{ to: "InTransit", label: "➡️ Selesai bongkar, ke titik berikutnya" }]
      : [{ to: "Returning", label: "✅ Selesai bongkar terakhir" }];
    case "Returning": return [{ to: "Completed", label: "🏠 Tiba di pool" }];
  }
  return [];
}

const EVENT_LABEL: Record<string, string> = {
  ToLoad: "Berangkat ke lokasi muat", Loading: "Tiba di lokasi muat", InTransit: "Berangkat kirim", Unloading: "Tiba di titik bongkar",
  Returning: "Selesai bongkar, kembali ke pool", Completed: "Tiba di pool — trip selesai",
};

export async function stopsTotalOf(tripId: string) {
  const t = await prisma.trip.findUniqueOrThrow({ where: { id: tripId }, select: { planJson: true, order: { select: { _count: { select: { stops: true } } } } } });
  return t.order?._count.stops ?? parsePlan(t.planJson).phases.filter(p => p.status === "Unloading").length;
}

/** Ubah status trip (dicek urutannya). Berangkat hanya bila P2H lolos, Surat Jalan terbit, dan tidak ada blokir baru. */
export async function applyTripStatus(tripId: string, to: string, by: string, source: "Telegram" | "Kantor") {
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
  if (trip.isSimulated) throw new Error("Trip simulasi bergerak otomatis.");
  const total = await stopsTotalOf(tripId);
  const allowed = nextActions(trip, total).map(a => a.to);
  if (!allowed.includes(to)) throw new Error(`Status sekarang ${TRIP_STATUSES[trip.status]?.label ?? trip.status}; tombol ini sudah tidak berlaku.`);
  if (to === "ToLoad") {
    if (!trip.p2hDoneAt) throw new Error("Isi P2H dulu sebelum berangkat (tekan ✅ P2H).");
    if (!trip.suratJalanNo) throw new Error("Surat Jalan belum terbit. Hubungi dispatcher.");
    const ev = await evaluateTrip(tripId);
    if (ev.blocked.length || ev.pending.length) throw new Error(`Trip diblokir: ${[...ev.blocked, ...ev.pending].map(c => c.text).join("; ")}. Hubungi dispatcher.`);
  }
  const now = new Date().toISOString();
  const leavingStop = trip.status === "Unloading";
  const stopsDone = leavingStop ? trip.stopsDone + 1 : trip.stopsDone;
  const label = to === "Unloading" ? `Tiba di titik bongkar ${trip.stopsDone + 1}` : to === "InTransit" && leavingStop ? `Selesai bongkar titik ${trip.stopsDone + 1}, menuju titik berikutnya` : EVENT_LABEL[to];
  // Bersyarat pada status & stopsDone yang dibaca tadi: tombol yang ditekan dua kali (atau dari dua perangkat)
  // hanya tercatat sekali, dan stopsDone tidak naik dua kali.
  const applied = await prisma.$transaction(async tx => {
    const res = await tx.trip.updateMany({
      where: { id: tripId, status: trip.status, stopsDone: trip.stopsDone },
      data: { status: to, stopsDone, ...(to === "ToLoad" ? { startedAt: now } : {}), ...(to === "Completed" ? { completedAt: now } : {}) },
    });
    if (res.count === 0) return false;
    await tx.tripEvent.create({ data: { tripId, status: to, label, at: now, lat: trip.lastLat, lng: trip.lastLng, source, by } });
    return true;
  });
  if (!applied) throw new Error("Status trip baru saja berubah (tombol ditekan dua kali?). Buka 📋 Tugas saya untuk tombol terbaru.");
  if (to === "Completed") await afterTripCompleted(tripId);
  return label;
}

/** Sesudah trip: maintenance request otomatis untuk kondisi kendaraan yang di-override (3.5), order → Completed. */
async function afterTripCompleted(tripId: string) {
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId }, include: { overrides: true, vehicle: true } });
  for (const o of trip.overrides) {
    if (o.followUpId || !["5", "6", "7", "10"].includes(o.condition.split(":")[0])) continue;
    const rec = await prisma.vehicleServiceRecord.create({ data: {
      vehicleId: trip.vehicleId, serviceDate: today(), odometerKm: trip.vehicle.odometerKm, workshop: "-", kind: "Request", status: "Open",
      items: `Maintenance request: ${o.conditionText} (override trip ${trip.tripNo})`, notes: `Tindakan: ${o.controlAction}`, createdBy: "Sistem", createdAt: new Date().toISOString(),
    } });
    await prisma.dispatchOverride.update({ where: { id: o.id }, data: { followUpId: rec.id } });
  }
  if (trip.orderId) {
    const order = await prisma.charterOrder.findUnique({ where: { id: trip.orderId } });
    if (order && order.status === "Scheduled") {
      const list = JSON.parse(order.historyJson || "[]");
      list.push({ id: String(list.length + 1), date: new Date().toISOString(), userName: "Sistem", action: `Trip ${trip.tripNo} selesai` });
      await prisma.charterOrder.update({ where: { id: order.id }, data: { status: "Completed", historyJson: JSON.stringify(list) } });
    }
  }
}

// ---------------------------------------------------------
// P2H (pemeriksaan harian)
// ---------------------------------------------------------

export const P2H_ITEMS = [
  { key: "rem", label: "Rem", critical: true },
  { key: "kemudi", label: "Kemudi", critical: true },
  { key: "ban", label: "Ban", critical: true },
  { key: "lampu", label: "Lampu utama", critical: true },
  { key: "apar", label: "APAR", critical: true },
  { key: "wiper", label: "Wiper", critical: false },
  { key: "klakson", label: "Klakson", critical: false },
  { key: "kabin", label: "Kebersihan kabin", critical: false },
] as const;

export type P2HResult = Record<string, "ok" | "fail" | "unknown">;

/** Simpan hasil P2H (PreTripCheck + timeline). Item kritis gagal → blokir #2 tanpa override; non-kritis → #7 (override Fleet). */
export async function recordP2H(tripId: string, result: P2HResult, notes: string, by: string, source = "Telegram") {
  const current = await prisma.trip.findUniqueOrThrow({ where: { id: tripId }, select: { status: true, vehicleId: true, driverId: true } });
  if (current.status !== "Scheduled") return { status: "late" as const, unknown: [] as string[], fails: [] as string[] };
  const fails = P2H_ITEMS.filter(i => result[i.key] === "fail");
  const critical = fails.filter(i => i.critical);
  const other = fails.filter(i => !i.critical);
  const unknown = P2H_ITEMS.filter(i => i.critical && result[i.key] !== "ok" && result[i.key] !== "fail");
  if (unknown.length) return { status: "incomplete" as const, unknown: unknown.map(i => i.label), fails: [] as string[] };
  const now = new Date().toISOString();
  const passed = critical.length === 0;
  const detail = fails.length ? `gagal: ${fails.map(i => i.label + (i.critical ? " (kritis)" : "")).join(", ")}` : "semua item OK";
  await prisma.$transaction([
    prisma.trip.update({ where: { id: tripId }, data: { p2hDoneAt: passed ? now : null } }),
    prisma.tripEvent.create({ data: { tripId, status: "P2H", label: passed ? `P2H lolos (${detail})` : `P2H GAGAL — ${detail}. Truk tidak boleh berangkat.`, at: now, note: notes || null, source, by } }),
    prisma.preTripCheck.create({ data: {
      vehicleId: current.vehicleId, tripId, driverId: current.driverId, at: now, resultJson: JSON.stringify(result),
      criticalFails: critical.map(i => i.label).join(", ") || null, otherFails: other.map(i => i.label).join(", ") || null, notes: notes || null, source,
    } }),
  ]);
  return { status: passed ? ("passed" as const) : ("failed" as const), unknown: [] as string[], fails: fails.map(i => i.label), critical: critical.map(i => i.label), other: other.map(i => i.label) };
}

// ---------------------------------------------------------
// Membuat trip (papan Dispatch & demo) — aturan 3.5 dicek di sini
// ---------------------------------------------------------

export type TripInput = { driverId: string; vehicleId: string; helperId?: string | null; orderId?: string | null; routeId?: string | null };

/** Kondisi blokir untuk kombinasi order + truk + sopir + kenek (sebelum trip dibuat). */
export async function checkAssignment(input: TripInput) {
  const [vehicle, driver, order] = await Promise.all([
    prisma.vehicle.findUniqueOrThrow({ where: { id: input.vehicleId }, include: vehicleRuleInclude }),
    prisma.driver.findUniqueOrThrow({ where: { id: input.driverId }, include: { qualifications: true } }),
    input.orderId ? prisma.charterOrder.findUnique({ where: { id: input.orderId }, include: { route: true, stops: { orderBy: { seq: "asc" } } } }) : null,
  ]);
  const conditions: Condition[] = [
    ...vehicleConditions(vehicle),
    ...driverConditions(driver, vehicle.truckType),
    ...orderConditions(order?.cargoWeightTon ?? null, vehicle.truckType, !!input.helperId),
  ];
  return { vehicle, driver, order, conditions };
}

async function nextSuratJalanNo(tx: Tx) {
  const prefix = `ATN/SJ/${today().slice(0, 4)}/`;
  const rows = await tx.trip.findMany({ where: { suratJalanNo: { startsWith: prefix } }, select: { suratJalanNo: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(r.suratJalanNo!.split("/").pop()) || 0), 0);
  return `${prefix}${today().slice(5, 7)}/${String(max + 1).padStart(4, "0")}`;
}

/**
 * Buat trip. mode "dispatch": kondisi yang bisa di-override boleh tertunda (diselesaikan di halaman trip oleh role yang berwenang).
 * mode "demo" (trip live/simulator): hanya boleh bila bersih, lalu Surat Jalan langsung terbit.
 * Kondisi yang tidak bisa di-override selalu menolak.
 */
export async function createTrip(input: TripInput, by: string, opts: { mode: "dispatch" | "demo"; dutyAck?: boolean }) {
  const { vehicle, driver, order, conditions } = await checkAssignment(input);
  const hard = conditions.filter(c => c.level === "none");
  if (hard.length) throw new Error(`Tidak bisa di-assign: ${hard.map(c => c.text).join("; ")}.`);
  if (opts.mode === "demo" && conditions.length) throw new Error(`Perlu override dulu (${conditions.map(c => c.text).join("; ")}). Pakai papan Dispatch.`);
  if (order && order.truckTypeId !== vehicle.truckTypeId) throw new Error("Jenis truk tidak sesuai order.");
  if (order && order.status !== "Confirmed") throw new Error(`Order berstatus ${order.status}; hanya order Confirmed yang bisa di-dispatch.`);
  if (input.helperId) {
    const helper = await prisma.helper.findUnique({ where: { id: input.helperId }, select: { status: true } });
    if (!helper || helper.status !== "Active") throw new Error("Kenek tidak ditemukan atau nonaktif.");
  }

  const busy = await prisma.trip.findMany({ where: { status: { in: ACTIVE_TRIP_STATUSES }, OR: [{ vehicleId: vehicle.id }, { driverId: driver.id }, ...(input.helperId ? [{ helperId: input.helperId }] : []), ...(order ? [{ orderId: order.id }] : [])] } });
  if (busy.some(t => !t.isSimulated)) throw new Error("Truk, sopir, kenek, atau order ini masih terikat trip aktif.");
  if (busy.length) await prisma.trip.deleteMany({ where: { id: { in: busy.map(t => t.id) }, isSimulated: true } }); // unit simulasi diambil alih

  const route = order?.route ?? (input.routeId ? await prisma.logisticsRoute.findUnique({ where: { id: input.routeId } }) : null);
  if (!route) throw new Error("Pilih order atau rute.");
  const warnings = await dutyWarnings(driver.id, route.durationHours);
  if (opts.mode === "dispatch" && warnings.length && !opts.dutyAck) throw new Error(`Centang "saya sudah membaca peringatan jam kerja": ${warnings.join("; ")}.`);

  let helperId = input.helperId ?? null;
  if (opts.mode === "demo" && vehicle.truckType.requiresHelper && !helperId) {
    const busyH = new Set((await prisma.trip.findMany({ where: { status: { in: ACTIVE_TRIP_STATUSES }, helperId: { not: null } }, select: { helperId: true } })).map(t => t.helperId));
    const helpers = await prisma.helper.findMany({ where: { status: "Active" } });
    helperId = (helpers.find(h => h.preferredDriverId === driver.id && !busyH.has(h.id)) ?? helpers.find(h => !busyH.has(h.id)))?.id ?? null;
    if (!helperId) throw new Error(`${vehicle.truckType.name} wajib kenek, tapi semua kenek sedang bertugas.`);
  }

  const stopNames = order?.stops.map(s => s.name) ?? [`Tujuan ${route.destination}`];
  const plan = await buildPlan({ routeCode: route.code, routeDurationH: route.durationHours, destLatLng: route.destLat != null && route.destLng != null ? [route.destLat, route.destLng] : null, originName: order?.originName ?? "Pool Arunika Cikarang", stopNames, sizeClass: vehicle.truckType.sizeClass });
  // Jadwal: tanggal & jam muat order (dikurangi waktu menuju muat); tanpa order = sekarang.
  const loadAt = order ? Date.parse(`${order.loadDate}T${order.loadTime || "06:00"}:00+07:00`) : NaN;
  const toLoadMin = plan.phases.find(p => p.status === "ToLoad")?.minutes ?? 0;
  const start = Number.isFinite(loadAt) && loadAt - toLoadMin * 60_000 > Date.now() ? loadAt - toLoadMin * 60_000 : Date.now();
  const id = crypto.randomUUID();
  const tripNo = `TRP-${today().slice(2).replace(/-/g, "")}-${id.slice(0, 4).toUpperCase()}`;
  const now = new Date().toISOString();
  // Klaim order secara bersyarat (Confirmed → Scheduled) sebelum trip dibuat: dua dispatcher yang
  // meng-assign order yang sama bersamaan tidak menghasilkan dua trip.
  if (order) {
    const list = JSON.parse(order.historyJson || "[]");
    list.push({ id: String(list.length + 1), date: now, userName: by, action: `Dispatch: ${vehicle.plateNo} · ${driver.name} (${tripNo})` });
    const claimed = await prisma.charterOrder.updateMany({ where: { id: order.id, status: "Confirmed" }, data: { status: "Scheduled", historyJson: JSON.stringify(list) } });
    if (claimed.count === 0) throw new Error("Order ini baru saja di-dispatch atau statusnya berubah. Muat ulang papan Dispatch.");
  }
  const trip = await prisma.trip.create({ data: {
    id, tripNo,
    orderId: order?.id ?? null, routeId: route.id, clientId: order?.clientId ?? null, vehicleId: vehicle.id, driverId: driver.id, helperId,
    status: "Scheduled", plannedStart: new Date(start).toISOString(), promisedArrival: new Date(start + (firstUnloadMin(plan) + 60) * 60_000).toISOString(),
    planJson: JSON.stringify(plan), dutyAckJson: warnings.length ? JSON.stringify({ by, at: now, warnings }) : null,
    notes: opts.mode === "demo" ? "Trip live (demo bot Telegram)" : null, createdBy: by, createdAt: now,
  } }).catch(async err => {
    // Trip gagal dibuat → kembalikan order ke antrean dispatch.
    if (order) await prisma.charterOrder.update({ where: { id: order.id }, data: { status: "Confirmed", historyJson: order.historyJson } }).catch(() => {});
    throw err;
  });
  await prisma.tripEvent.create({ data: { tripId: trip.id, status: "Scheduled", label: `Truk ${vehicle.plateNo} + ${driver.name} di-assign oleh ${by}${warnings.length ? ` (peringatan jam kerja dibaca: ${warnings.length})` : ""}`, at: now, source: "Kantor", by } });
  if (opts.mode === "demo") await issueSuratJalan(trip.id, by);
  return { trip, vehicle, driver, route, order, stopNames, conditions, warnings };
}

/** Terbitkan Surat Jalan: hanya bila tidak ada kondisi blokir yang belum di-override. */
export async function issueSuratJalan(tripId: string, by: string) {
  const ev = await evaluateTrip(tripId);
  if (ev.trip.suratJalanNo) return ev.trip.suratJalanNo;
  if (!["Scheduled"].includes(ev.trip.status)) throw new Error("Surat Jalan hanya untuk trip yang belum berangkat.");
  if (ev.blocked.length) throw new Error(`Diblokir (tidak bisa di-override): ${ev.blocked.map(c => c.text).join("; ")}.`);
  if (ev.pending.length) throw new Error(`Masih perlu override: ${ev.pending.map(c => `${c.text} (${c.level})`).join("; ")}.`);
  // suratJalanNo tidak @unique di DB: nomor dibaca & ditulis di bawah satu advisory lock,
  // dan trip yang sudah punya nomor (klik ganda) tidak diberi nomor kedua.
  return withLock("logistics:surat-jalan-no", async tx => {
    const cur = await tx.trip.findUniqueOrThrow({ where: { id: tripId }, select: { suratJalanNo: true, status: true } });
    if (cur.suratJalanNo) return cur.suratJalanNo;
    if (cur.status !== "Scheduled") throw new Error("Surat Jalan hanya untuk trip yang belum berangkat.");
    const no = await nextSuratJalanNo(tx);
    const now = new Date().toISOString();
    await tx.trip.update({ where: { id: tripId }, data: { suratJalanNo: no, suratJalanAt: now, suratJalanBy: by } });
    await tx.tripEvent.create({ data: { tripId, status: "SJ", label: `Surat Jalan ${no} diterbitkan${ev.items.length ? ` (${ev.items.length} kondisi di-override)` : ""}`, at: now, source: "Kantor", by } });
    return no;
  });
}

/** Kompatibel dengan pemanggil lama (trip live dari Fleet Tracking / Driver simulator). */
export async function createLiveTrip(input: { driverId: string; vehicleId: string; orderId?: string | null; routeId?: string | null }, by: string) {
  return createTrip(input, by, { mode: "demo" });
}
