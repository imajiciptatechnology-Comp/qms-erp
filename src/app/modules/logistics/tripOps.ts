// Operasi trip nyata (bukan simulasi): transisi status dari tombol bot sopir, P2H, dan trip live untuk demo.
// Papan dispatch + blokir/override lengkap menyusul di Tahap 2; aturan dasar kelayakan tetap dicek di sini.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { driverFlags, qualifiesFor, today, vehicleFlags } from "./lib";
import { ACTIVE_TRIP_STATUSES, TRIP_STATUSES, firstUnloadMin, parsePlan } from "./trackingLib";
import { buildPlan } from "./tracking";

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

/** Ubah status trip (dicek urutannya). Mengembalikan pesan untuk sopir. */
export async function applyTripStatus(tripId: string, to: string, by: string, source: "Telegram" | "Kantor") {
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
  if (trip.isSimulated) throw new Error("Trip simulasi bergerak otomatis.");
  const total = await stopsTotalOf(tripId);
  const allowed = nextActions(trip, total).map(a => a.to);
  if (!allowed.includes(to)) throw new Error(`Status sekarang ${TRIP_STATUSES[trip.status]?.label ?? trip.status}; tombol ini sudah tidak berlaku.`);
  if (to === "ToLoad" && !trip.p2hDoneAt) throw new Error("Isi P2H dulu sebelum berangkat (tekan ✅ P2H).");
  const now = new Date().toISOString();
  const leavingStop = trip.status === "Unloading";
  const stopsDone = leavingStop ? trip.stopsDone + 1 : trip.stopsDone;
  const label = to === "Unloading" ? `Tiba di titik bongkar ${trip.stopsDone + 1}` : to === "InTransit" && leavingStop ? `Selesai bongkar titik ${trip.stopsDone + 1}, menuju titik berikutnya` : EVENT_LABEL[to];
  await prisma.$transaction([
    prisma.trip.update({ where: { id: tripId }, data: { status: to, stopsDone, ...(to === "ToLoad" ? { startedAt: now } : {}), ...(to === "Completed" ? { completedAt: now } : {}) } }),
    prisma.tripEvent.create({ data: { tripId, status: to, label, at: now, lat: trip.lastLat, lng: trip.lastLng, source, by } }),
  ]);
  return label;
}

// ---------------------------------------------------------
// P2H (pemeriksaan harian) — disederhanakan sampai tabel PreTripCheck dibuat di Tahap 2
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

/** Simpan hasil P2H. Item kritis gagal → trip tidak boleh berangkat (blokir #2, tanpa override). */
export async function recordP2H(tripId: string, result: P2HResult, notes: string, by: string) {
  const current = await prisma.trip.findUniqueOrThrow({ where: { id: tripId }, select: { status: true } });
  if (current.status !== "Scheduled") return { status: "late" as const, unknown: [] as string[], fails: [] as string[] };
  const fails = P2H_ITEMS.filter(i => result[i.key] === "fail");
  const critical = fails.filter(i => i.critical);
  const unknown = P2H_ITEMS.filter(i => i.critical && result[i.key] !== "ok" && result[i.key] !== "fail");
  if (unknown.length) return { status: "incomplete" as const, unknown: unknown.map(i => i.label), fails: [] as string[] };
  const now = new Date().toISOString();
  const passed = critical.length === 0;
  const detail = fails.length ? `gagal: ${fails.map(i => i.label + (i.critical ? " (kritis)" : "")).join(", ")}` : "semua item OK";
  await prisma.$transaction([
    prisma.trip.update({ where: { id: tripId }, data: { p2hDoneAt: passed ? now : null } }),
    prisma.tripEvent.create({ data: { tripId, status: "P2H", label: passed ? `P2H lolos (${detail})` : `P2H GAGAL — ${detail}. Truk tidak boleh berangkat.`, at: now, note: notes || null, source: "Telegram", by } }),
  ]);
  return { status: passed ? ("passed" as const) : ("failed" as const), unknown: [] as string[], fails: fails.map(i => i.label), critical: critical.map(i => i.label) };
}

// ---------------------------------------------------------
// Trip live (demo bot Telegram) — sementara sebelum papan dispatch Tahap 2
// ---------------------------------------------------------

export async function createLiveTrip(input: { driverId: string; vehicleId: string; orderId?: string | null; routeId?: string | null }, by: string) {
  const [driver, vehicle] = await Promise.all([
    prisma.driver.findUniqueOrThrow({ where: { id: input.driverId }, include: { qualifications: true } }),
    prisma.vehicle.findUniqueOrThrow({ where: { id: input.vehicleId }, include: { truckType: true } }),
  ]);
  // Kondisi yang tidak bisa di-override (3.5): truk tidak layak, SIM habis, tidak qualified.
  const red = vehicleFlags(vehicle).filter(f => f.level === "red").map(f => f.text);
  if (vehicle.status !== "Ready") red.push(vehicle.status);
  if (/P2H gagal/i.test(vehicle.notes ?? "")) red.push("P2H gagal (rem)");
  if (red.length) throw new Error(`Truk ${vehicle.plateNo} tidak layak jalan: ${red.join(", ")}.`);
  const dRed = driverFlags(driver).filter(f => f.level === "red");
  if (dRed.length) throw new Error(`${driver.name}: ${dRed.map(f => f.text).join(", ")} — tidak bisa ditugaskan.`);
  const qualified = qualifiesFor(driver, vehicle.truckType.code) || driver.qualifications.some(q => q.truckTypeId === vehicle.truckTypeId && q.basis === "manual-add");
  if (!qualified || driver.qualifications.some(q => q.truckTypeId === vehicle.truckTypeId && q.basis === "manual-revoke")) throw new Error(`${driver.name} tidak qualified untuk ${vehicle.truckType.name}.`);

  const busy = await prisma.trip.findMany({ where: { status: { in: ACTIVE_TRIP_STATUSES }, OR: [{ vehicleId: vehicle.id }, { driverId: driver.id }] } });
  if (busy.some(t => !t.isSimulated)) throw new Error("Truk atau sopir ini masih punya trip aktif.");
  // Unit yang sedang dipakai simulasi diambil alih untuk trip nyata.
  if (busy.length) await prisma.trip.deleteMany({ where: { id: { in: busy.map(t => t.id) }, isSimulated: true } });

  const order = input.orderId ? await prisma.charterOrder.findUnique({ where: { id: input.orderId }, include: { route: true, stops: { orderBy: { seq: "asc" } } } }) : null;
  if (order && order.truckTypeId !== vehicle.truckTypeId) throw new Error("Jenis truk tidak sesuai order.");
  const route = order?.route ?? (input.routeId ? await prisma.logisticsRoute.findUnique({ where: { id: input.routeId } }) : null);
  if (!route) throw new Error("Pilih order atau rute.");
  let helperId: string | null = null;
  if (vehicle.truckType.requiresHelper) {
    const busyH = new Set((await prisma.trip.findMany({ where: { status: { in: ACTIVE_TRIP_STATUSES }, helperId: { not: null } }, select: { helperId: true } })).map(t => t.helperId));
    const helpers = await prisma.helper.findMany({ where: { status: "Active" } });
    helperId = (helpers.find(h => h.preferredDriverId === driver.id && !busyH.has(h.id)) ?? helpers.find(h => !busyH.has(h.id)))?.id ?? null;
    if (!helperId) throw new Error(`${vehicle.truckType.name} wajib kenek, tapi semua kenek sedang bertugas.`);
  }
  const stopNames = order?.stops.map(s => s.name) ?? [`Tujuan ${route.destination}`];
  const plan = await buildPlan({ routeCode: route.code, routeDurationH: route.durationHours, destLatLng: route.destLat != null && route.destLng != null ? [route.destLat, route.destLng] : null, originName: order?.originName ?? "Pool Arunika Cikarang", stopNames, sizeClass: vehicle.truckType.sizeClass });
  const start = Date.now();
  const id = crypto.randomUUID();
  const trip = await prisma.trip.create({ data: {
    id, tripNo: `TRP-${today().slice(2).replace(/-/g, "")}-${id.slice(0, 4).toUpperCase()}`,
    orderId: order?.id ?? null, routeId: route.id, clientId: order?.clientId ?? null, vehicleId: vehicle.id, driverId: driver.id, helperId,
    status: "Scheduled", plannedStart: new Date(start).toISOString(), promisedArrival: new Date(start + (firstUnloadMin(plan) + 60) * 60_000).toISOString(),
    planJson: JSON.stringify(plan), notes: "Trip live (demo bot Telegram)", createdBy: by, createdAt: new Date().toISOString(),
  } });
  await prisma.tripEvent.create({ data: { tripId: trip.id, status: "Scheduled", label: `Trip dijadwalkan oleh ${by}`, at: trip.createdAt, source: "Kantor", by } });
  return { trip, vehicle, driver, route, order, stopNames };
}
