// Fleet Tracking (rancangan 10.2) — sisi server: rencana rute, mode simulasi, snapshot unit + peringatan berbasis kode.
// Bukan "use server": dipanggil dari server actions, halaman, dan webhook bot.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { qualifiesFor, driverFlags, today } from "./lib";
import { readiness, vehicleConditions, vehicleRuleInclude } from "./dispatchRules";
import { tryWithLock } from "./dbUtil";
import {
  ACTIVE_TRIP_STATUSES, DRIVING_STATUSES, TRIP_STATUSES, firstUnloadMin, fullPath, haversineKm, parsePlan, pathKm, phaseStarts, planTotal,
  positionAt, splitPath, type LatLng, type Phase, type TripPlan,
} from "./trackingLib";

export const POOL: LatLng = [-6.3008, 107.153];

/** Titik antara (jalan tol/pantura, disederhanakan) per rute dari Cikarang. Peta memakai garis lurus antar titik. */
const WAYPOINTS: Record<string, LatLng[]> = {
  JKT: [[-6.2416, 107.0], [-6.2246, 106.9]],
  BDG: [[-6.4106, 107.4566], [-6.5569, 107.4433], [-6.8427, 107.4816]],
  MRK: [[-6.2416, 107.0], [-6.1862, 106.8227], [-6.1781, 106.6300], [-6.1200, 106.1503], [-6.0025, 106.0506]],
  CRB: [[-6.4106, 107.4566], [-6.4718, 107.7637], [-6.6484, 108.1678]],
  SMG: [[-6.4106, 107.4566], [-6.6484, 108.1678], [-6.7320, 108.5523], [-6.8721, 109.0434], [-6.8694, 109.1402], [-6.8898, 109.3806], [-6.8886, 109.6753], [-6.9238, 110.2028]],
  YOG: [[-6.4106, 107.4566], [-6.6484, 108.1678], [-6.7320, 108.5523], [-6.8721, 109.0434], [-7.2470, 109.0110], [-7.4243, 109.2396], [-7.6681, 109.6525], [-7.7130, 110.0089]],
  SBY: [[-6.4106, 107.4566], [-6.6484, 108.1678], [-6.7320, 108.5523], [-6.8694, 109.1402], [-6.8886, 109.6753], [-6.9238, 110.2028], [-6.9667, 110.4167], [-6.8948, 110.6383], [-6.8048, 110.8405], [-6.7559, 111.0380], [-6.7073, 111.3415], [-6.8976, 112.0509], [-7.1197, 112.4140], [-7.1566, 112.6555]],
};

export type PlanInput = {
  routeCode: string; routeDurationH: number; destLatLng: LatLng | null; originName: string; stopNames: string[]; sizeClass: string;
};

async function locationIndex() {
  const locs = await prisma.logisticsLocation.findMany({ where: { lat: { not: null }, lng: { not: null } } });
  const pool = locs.find(l => l.kind === "Pool");
  return {
    pool: pool ? ([pool.lat!, pool.lng!] as LatLng) : POOL,
    find: (name: string): LatLng | null => {
      const n = name.trim().toLowerCase();
      const l = locs.find(x => x.name.toLowerCase() === n) ?? locs.find(x => n.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(n));
      return l ? [l.lat!, l.lng!] : null;
    },
  };
}

/** Rencana trip: pool → lokasi muat → titik antara → titik bongkar → kembali ke pool. Durasi dari tabel rute (bagian 1.5). */
export async function buildPlan(p: PlanInput, scenario = "normal"): Promise<TripPlan> {
  const idx = await locationIndex();
  const origin = idx.find(p.originName) ?? idx.pool;
  const dest = p.destLatLng ?? idx.pool;
  const stops = p.stopNames.map((n, i) => idx.find(n) ?? ([dest[0] + i * 0.02, dest[1] + i * 0.03] as LatLng));
  const way = WAYPOINTS[p.routeCode] ?? [];
  const small = p.sizeClass === "small";
  const phases: Phase[] = [];
  if (scenario === "noP2H") phases.push({ status: "Scheduled", label: "Menunggu berangkat di pool", minutes: 600, path: [idx.pool] });
  const toLoad: LatLng[] = [idx.pool, origin];
  phases.push({ status: "ToLoad", label: "Menuju lokasi muat", minutes: Math.max(20, Math.round((haversineKm(idx.pool, origin) / 35) * 60)), path: toLoad });
  phases.push({ status: "Loading", label: "Muat barang", minutes: small ? 60 : 90, path: [origin] });
  const transit: LatLng[] = [origin, ...way, stops[0]];
  const transitMin = Math.round(p.routeDurationH * 60);
  if (scenario === "stalled") {
    const [a, b] = splitPath(transit, 0.45);
    phases.push({ status: "InTransit", label: "Dalam perjalanan", minutes: Math.round(transitMin * 0.45), path: a });
    phases.push({ status: "InTransit", label: "Truk berhenti di jalan", minutes: 180, path: [a[a.length - 1]], stall: true });
    phases.push({ status: "InTransit", label: "Lanjut perjalanan", minutes: Math.round(transitMin * 0.55), path: b });
  } else {
    phases.push({ status: "InTransit", label: "Dalam perjalanan", minutes: transitMin, path: transit });
  }
  stops.forEach((s, i) => {
    if (i > 0) phases.push({ status: "InTransit", label: `Menuju titik bongkar ${i + 1}`, minutes: Math.max(20, Math.round((haversineKm(stops[i - 1], s) / 40) * 60)), path: [stops[i - 1], s] });
    phases.push({ status: "Unloading", label: `Bongkar di ${p.stopNames[i] ?? `titik ${i + 1}`}`, minutes: small ? 45 : 60, path: [s], stopSeq: i + 1 });
  });
  const back: LatLng[] = [stops[stops.length - 1], ...[...way].reverse(), idx.pool];
  phases.push({ status: "Returning", label: "Kembali ke pool", minutes: Math.round(transitMin * 0.9), path: back });
  const plan: TripPlan = { phases };
  const arrive = firstUnloadMin(plan);
  // Janji ke klien: estimasi tiba normal (tanpa waktu berhenti tak terduga) + 1 jam cadangan.
  plan.promiseMin = arrive - phases.filter(x => x.stall).reduce((s, x) => s + x.minutes, 0) + 60;
  return plan;
}

// ---------------------------------------------------------
// Waktu: trip simulasi berjalan `simSpeed` kali lebih cepat dari jam nyata.
// ---------------------------------------------------------

type TripTime = { isSimulated: boolean; simStartedAt: string | null; simSpeed: number; simOffsetMin: number; plannedStart: string };
const minutes = (ms: number) => ms / 60_000;
export const tripScale = (t: TripTime) => (t.isSimulated ? t.simSpeed : 1);
/** Menit rencana yang sudah berjalan. Trip nyata: sejak plannedStart. */
export function elapsedPlanMin(t: TripTime, now = Date.now()) {
  if (t.isSimulated && t.simStartedAt) return t.simOffsetMin + minutes(now - Date.parse(t.simStartedAt)) * t.simSpeed;
  return minutes(now - Date.parse(t.plannedStart));
}
/** Menit rencana → waktu nyata (epoch ms). */
export function realAt(t: TripTime, planMin: number) {
  if (t.isSimulated && t.simStartedAt) return Date.parse(t.simStartedAt) + ((planMin - t.simOffsetMin) / t.simSpeed) * 60_000;
  return Date.parse(t.plannedStart) + planMin * 60_000;
}

// ---------------------------------------------------------
// Mode simulasi
// ---------------------------------------------------------

const SIM_PREFIX = "DEMO-LOG-SIM-";

type SimSpec = { orderId?: string; typeCode: string; routeCode: string; clientCode?: string; scenario: string; at: "transit40" | "unloading" | "stall" | "late" | "silent" | "scheduled" };

/** Unit dummy di luar order Confirmed supaya peta ramai dan setiap jenis peringatan terlihat. */
const EXTRA_SPECS: SimSpec[] = [
  { typeCode: "TRAILER", routeCode: "MRK", clientCode: "BKU", scenario: "stalled", at: "stall" },
  { typeCode: "CDE", routeCode: "JKT", clientCode: "KPI", scenario: "late", at: "late" },
  { typeCode: "FUSO", routeCode: "YOG", clientCode: "ATM", scenario: "silent", at: "silent" },
  { typeCode: "TRONTON", routeCode: "SBY", clientCode: "SPL", scenario: "noP2H", at: "scheduled" },
];

export async function startSimulation(userName: string, speed: number) {
  await resetSimulation();
  const [orders, vehicles, drivers, helpers, routes, clients, active] = await Promise.all([
    prisma.charterOrder.findMany({ where: { status: "Confirmed" }, include: { route: true, truckType: true, stops: { orderBy: { seq: "asc" } } }, orderBy: { loadDate: "asc" } }),
    prisma.vehicle.findMany({ include: vehicleRuleInclude }),
    prisma.driver.findMany({ where: { status: "Active" }, include: { qualifications: { include: { truckType: true } } } }),
    prisma.helper.findMany({ where: { status: "Active" } }),
    prisma.logisticsRoute.findMany(),
    prisma.logisticsClient.findMany(),
    prisma.trip.findMany({ where: { status: { in: ACTIVE_TRIP_STATUSES } }, select: { vehicleId: true, driverId: true, helperId: true, orderId: true } }),
  ]);
  const busyV = new Set(active.map(a => a.vehicleId));
  const busyD = new Set(active.map(a => a.driverId));
  const busyH = new Set(active.map(a => a.helperId).filter(Boolean) as string[]);
  const busyO = new Set(active.map(a => a.orderId).filter(Boolean) as string[]);

  const specs: SimSpec[] = orders.filter(o => !busyO.has(o.id)).slice(0, 2).map((o, i) => ({ orderId: o.id, typeCode: o.truckType.code, routeCode: o.route.code, scenario: "normal", at: i === 0 ? "transit40" : "unloading" }));
  specs.push(...EXTRA_SPECS);

  // Truk: tidak "tidak layak" (3.5) dan tidak sedang jalan.
  const vehicleOk = (v: (typeof vehicles)[number]) => !busyV.has(v.id) && readiness(vehicleConditions(v)) !== "unfit";
  // Sopir yang punya akun/bot (mis. Slamet, HP presenter) disisakan untuk trip nyata lewat Telegram.
  const driverOk = (d: (typeof drivers)[number], code: string) => !busyD.has(d.id) && !d.userEmail && !driverFlags(d).some(f => f.level === "red")
    && qualifiesFor(d, code) && d.qualifications.some(q => q.truckType.code === code && q.basis !== "manual-revoke");

  const now = Date.now();
  const created: string[] = [];
  const order = ["TRAILER", "TRONTON", "FUSO", "CDD", "CDE"];
  const sorted = [...specs].sort((a, b) => order.indexOf(a.typeCode) - order.indexOf(b.typeCode));
  for (const [n, spec] of sorted.entries()) {
    const candidates = vehicles.filter(v => v.truckType.code === spec.typeCode && vehicleOk(v)).sort((a, b) => vehicleConditions(a).length - vehicleConditions(b).length);
    const v = candidates[0];
    const d = drivers.filter(x => driverOk(x, spec.typeCode)).sort((a, b) => driverFlags(a).length - driverFlags(b).length || a.experienceYears - b.experienceYears)[0];
    if (!v || !d) continue;
    busyV.add(v.id);
    busyD.add(d.id);
    let helperId: string | null = null;
    if (v.truckType.requiresHelper) {
      const h = helpers.find(x => !busyH.has(x.id) && x.preferredDriverId === d.id) ?? helpers.find(x => !busyH.has(x.id));
      if (h) { helperId = h.id; busyH.add(h.id); }
    }
    const o = spec.orderId ? orders.find(x => x.id === spec.orderId)! : null;
    const route = o?.route ?? routes.find(r => r.code === spec.routeCode)!;
    const client = o ? clients.find(c => c.id === o.clientId) : clients.find(c => c.code === spec.clientCode);
    const originName = o?.originName ?? (await prisma.logisticsLocation.findFirst({ where: { clientId: client?.id, kind: "Muat" } }))?.name ?? "Pool Arunika Cikarang";
    const stopNames = o ? o.stops.map(s => s.name) : (await prisma.logisticsLocation.findMany({ where: { clientId: client?.id, kind: "Bongkar", city: { contains: route.destination.split(" ")[0] } }, take: 1 })).map(l => l.name);
    const plan = await buildPlan({ routeCode: route.code, routeDurationH: route.durationHours, destLatLng: route.destLat != null && route.destLng != null ? [route.destLat, route.destLng] : null, originName, stopNames: stopNames.length ? stopNames : [`Tujuan ${route.destination}`], sizeClass: v.truckType.sizeClass }, spec.scenario);

    const starts = phaseStarts(plan);
    const idxOf = (pred: (p: Phase) => boolean) => plan.phases.findIndex(pred);
    const transitI = idxOf(p => p.status === "InTransit");
    const transitStart = starts[transitI];
    const transitMin = plan.phases[transitI].minutes;
    let offset = 0;
    switch (spec.at) {
      case "transit40": offset = transitStart + transitMin * 0.4; break;
      case "unloading": offset = starts[idxOf(p => p.status === "Unloading")] + 10; break;
      case "stall": offset = starts[idxOf(p => !!p.stall)] + 70; break;
      case "late": offset = transitStart + transitMin * 0.7; plan.promiseMin = transitStart + transitMin * 0.5; break;
      case "silent": plan.silentAfterMin = transitStart + transitMin * 0.3; offset = plan.silentAfterMin + 40; break;
      case "scheduled": offset = 40; break;
    }
    const simStartedAt = new Date(now).toISOString();
    const t = { isSimulated: true, simStartedAt, simSpeed: speed, simOffsetMin: offset, plannedStart: "" };
    const plannedStart = new Date(realAt(t, spec.scenario === "noP2H" ? 0 : starts[idxOf(p => p.status === "ToLoad")])).toISOString();
    const id = SIM_PREFIX + crypto.randomBytes(5).toString("hex");
    // Riwayat ping 60 menit terakhir (waktu simulasi) supaya jejak, "truk diam", dan "GPS hilang" langsung terlihat.
    const history = [60, 45, 30, 15].map(back => offset - back).filter(m => m >= 0 && (plan.silentAfterMin == null || m <= plan.silentAfterMin));
    if (plan.silentAfterMin != null && !history.includes(plan.silentAfterMin)) history.push(plan.silentAfterMin);
    const pings = history.map(m => { const pos = positionAt(plan, m); return { lat: pos.lat, lng: pos.lng, speedKmh: pos.speedKmh, at: new Date(realAt({ ...t, plannedStart: "" }, m)).toISOString() }; });
    const lastP = pings[pings.length - 1];
    await prisma.trip.create({ data: {
      id, tripNo: `SIM-${today().slice(2).replace(/-/g, "")}-${String(n + 1).padStart(2, "0")}-${id.slice(-4).toUpperCase()}`,
      orderId: o?.id ?? null, routeId: route.id, clientId: client?.id ?? null, vehicleId: v.id, driverId: d.id, helperId,
      status: "Scheduled", plannedStart, promisedArrival: new Date(realAt({ ...t, plannedStart }, plan.promiseMin!)).toISOString(),
      p2hDoneAt: spec.scenario === "noP2H" ? null : plannedStart, planJson: JSON.stringify(plan),
      isSimulated: true, simScenario: spec.scenario, simStartedAt, simSpeed: speed, simOffsetMin: offset,
      notes: spec.orderId ? "Trip simulasi dari order Confirmed" : "Trip simulasi (unit dummy)", createdBy: userName, createdAt: new Date().toISOString(),
      ...(lastP ? { lastLat: lastP.lat, lastLng: lastP.lng, lastPingAt: lastP.at, lastSpeedKmh: lastP.speedKmh } : {}),
    } });
    if (pings.length) await prisma.locationPing.createMany({ data: pings.map(p => ({ ...p, tripId: id, vehicleId: v.id, driverId: d.id, source: "Simulasi" })) });
    created.push(id);
  }
  // Isi timeline & posisi awal.
  for (const id of created) await advanceTrip(await loadTrip(id));
  return created.length;
}

export async function resetSimulation() {
  const sims = await prisma.trip.findMany({ where: { isSimulated: true }, select: { id: true } });
  if (sims.length) await prisma.trip.deleteMany({ where: { id: { in: sims.map(s => s.id) } } }); // events & pings ikut terhapus (cascade)
  return sims.length;
}

// ---------------------------------------------------------
// Snapshot untuk dashboard
// ---------------------------------------------------------

const tripInclude = {
  vehicle: { include: { truckType: true } }, driver: true, helper: true, route: true, client: true,
  order: { select: { id: true, orderNo: true, stops: { select: { id: true } } } },
  events: { orderBy: { at: "asc" as const } },
  pings: { orderBy: { at: "desc" as const }, take: 40 },
};
async function loadTrip(id: string) {
  return prisma.trip.findUniqueOrThrow({ where: { id }, include: tripInclude });
}
type LoadedTrip = Awaited<ReturnType<typeof loadTrip>>;

/**
 * Trip simulasi: catat fase yang sudah dimulai sebagai TripEvent, perbarui status, dan kirim ping posisi.
 * Dipanggil tiap polling dashboard & link publik; beberapa request bisa datang bersamaan, jadi penulisan
 * dilakukan di bawah advisory lock per trip dan jumlah event dihitung ulang di dalamnya (tanpa event ganda).
 */
async function advanceTrip(trip: LoadedTrip): Promise<LoadedTrip> {
  if (!trip.isSimulated) return trip;
  const plan = parsePlan(trip.planJson);
  const now = Date.now();
  const elapsed = elapsedPlanMin(trip, now);
  const pos = positionAt(plan, elapsed);
  const starts = phaseStarts(plan);
  const wrote = await tryWithLock(`logistics:sim-trip:${trip.id}`, async tx => {
    const cur = await tx.trip.findUnique({ where: { id: trip.id }, select: { status: true, stopsDone: true, startedAt: true, completedAt: true, lastPingAt: true } });
    if (!cur) return false; // simulasi baru saja di-reset
    let n = 0;
    const phaseEvents = await tx.tripEvent.count({ where: { tripId: trip.id, source: "Simulasi" } });
    const upto = Math.min(pos.phaseIndex, plan.phases.length - 1);
    const events: { tripId: string; status: string; label: string; at: string; lat: number; lng: number; source: string }[] = [];
    for (let i = phaseEvents; i <= upto; i++) {
      const ph = plan.phases[i];
      events.push({ tripId: trip.id, status: ph.status, label: ph.label, at: new Date(realAt(trip, starts[i])).toISOString(), lat: ph.path[0][0], lng: ph.path[0][1], source: "Simulasi" });
    }
    if (pos.done && phaseEvents <= plan.phases.length) {
      events.push({ tripId: trip.id, status: "Completed", label: "Tiba di pool — trip selesai", at: new Date(realAt(trip, planTotal(plan))).toISOString(), lat: pos.lat, lng: pos.lng, source: "Simulasi" });
    }
    if (events.length) { n += events.length; await tx.tripEvent.createMany({ data: events }); }
    const silent = plan.silentAfterMin != null && elapsed >= plan.silentAfterMin;
    const lastPing = cur.lastPingAt ? Date.parse(cur.lastPingAt) : 0;
    const ping = !silent && !pos.done && now - lastPing > 40_000;
    if (ping) {
      n++;
      await tx.locationPing.create({ data: { tripId: trip.id, vehicleId: trip.vehicleId, driverId: trip.driverId, lat: pos.lat, lng: pos.lng, speedKmh: pos.speedKmh, at: new Date(now).toISOString(), source: "Simulasi" } });
    }
    const status = pos.done ? "Completed" : pos.status;
    const data: Record<string, unknown> = {};
    if (status !== cur.status) data.status = status;
    if (pos.stopsDone !== cur.stopsDone) data.stopsDone = pos.stopsDone;
    if (!cur.startedAt && status !== "Scheduled") data.startedAt = new Date(realAt(trip, starts[plan.phases.findIndex(p => p.status === "ToLoad")])).toISOString();
    if (pos.done && !cur.completedAt) data.completedAt = new Date(realAt(trip, planTotal(plan))).toISOString();
    if (ping) Object.assign(data, { lastLat: pos.lat, lastLng: pos.lng, lastPingAt: new Date(now).toISOString(), lastSpeedKmh: pos.speedKmh });
    if (Object.keys(data).length) { n++; await tx.trip.update({ where: { id: trip.id }, data }); }
    return n > 0;
  }).catch(err => { console.error("[tracking] advance", err); return false; });
  // Kunci dipegang request lain / tidak ada perubahan: pakai data terakhir dari DB.
  if (wrote === false) return trip;
  return (await prisma.trip.findUnique({ where: { id: trip.id }, include: tripInclude })) ?? trip;
}

export type UnitAlert = { level: "red" | "amber"; code: string; text: string };

export type DeployedUnit = {
  id: string; tripNo: string; isSimulated: boolean; scenario: string | null; status: string; statusLabel: string; statusSince: string | null;
  plateNo: string; truckType: string; vehicleId: string; driverId: string; driverName: string; driverPhone: string | null; helperName: string | null;
  clientName: string | null; routeLabel: string; orderId: string | null; orderNo: string | null;
  lat: number | null; lng: number | null; lastPingAt: string | null; speedKmh: number | null;
  etaFirstStop: string | null; promisedArrival: string | null; etaEnd: string | null; stopsTotal: number; stopsDone: number;
  path: [number, number][]; alerts: UnitAlert[]; timeline: { status: string; label: string; at: string; source: string }[];
};

export type IdleUnit = { id: string; plateNo: string; truckType: string; state: "ready" | "attention" | "repair" | "unfit"; reasons: string[]; note: string | null };

export type FleetSnapshot = { at: string; units: DeployedUnit[]; idle: IdleUnit[]; simulation: { running: boolean; speed: number | null } };

/** Lama truk diam (menit trip) dari ping terakhir: semua ping dalam radius 300 m dari ping terbaru. */
function stationaryMinutes(pings: { lat: number; lng: number; at: string }[], scale: number, now: number) {
  if (pings.length < 2) return 0;
  const last: LatLng = [pings[0].lat, pings[0].lng];
  let since = pings[0].at;
  for (const p of pings) {
    if (haversineKm(last, [p.lat, p.lng]) > 0.3) break;
    since = p.at;
  }
  return minutes(now - Date.parse(since)) * scale;
}

/** Jam mengemudi (menit trip) dari timeline: total waktu pada status mengemudi. */
function drivingMinutes(events: { status: string; at: string; label: string }[], scale: number, now: number) {
  let total = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!DRIVING_STATUSES.includes(e.status) || /berhenti/i.test(e.label)) continue;
    const end = i + 1 < events.length ? Date.parse(events[i + 1].at) : now;
    total += Math.max(0, minutes(end - Date.parse(e.at)));
  }
  return total * scale;
}

function toUnit(trip: LoadedTrip, now: number): DeployedUnit {
  const plan = parsePlan(trip.planJson);
  const scale = tripScale(trip);
  const fmt = (ms: number | null) => (ms == null || !Number.isFinite(ms) ? null : new Date(ms).toISOString());
  const st = TRIP_STATUSES[trip.status] ?? { label: trip.status };
  // Event status saja (bukan P2H/foto/laporan sopir) untuk "sejak" dan deteksi diam.
  const lastEvent = [...trip.events].reverse().find(e => TRIP_STATUSES[e.status]);
  const stopsTotal = trip.order?.stops.length ?? plan.phases.filter(p => p.status === "Unloading").length;
  const arrived = trip.stopsDone > 0 || ["Unloading", "Returning"].includes(trip.status);

  // ETA: trip simulasi dari rencana; trip nyata dari jarak sisa ÷ kecepatan rata-rata rute.
  let etaFirst: number | null = null;
  let etaEnd: number | null = null;
  if (plan.phases.length) {
    if (trip.isSimulated) {
      etaFirst = realAt(trip, firstUnloadMin(plan));
      etaEnd = realAt(trip, planTotal(plan));
    } else if (trip.lastLat != null && trip.lastLng != null && trip.route) {
      const avgKmh = trip.route.distanceKm / Math.max(trip.route.durationHours, 0.5);
      const firstStop = plan.phases.find(p => p.status === "Unloading")?.path[0];
      if (firstStop && trip.stopsDone === 0) etaFirst = now + (haversineKm([trip.lastLat, trip.lastLng], firstStop) * 1.25 / avgKmh) * 3_600_000;
      const endPt = plan.phases[plan.phases.length - 1]?.path.slice(-1)[0];
      if (endPt) etaEnd = now + (pathKm([[trip.lastLat, trip.lastLng], ...(firstStop && trip.stopsDone === 0 ? [firstStop] : []), endPt]) * 1.25 / avgKmh) * 3_600_000;
    }
  }

  const alerts: UnitAlert[] = [];
  const active = trip.status !== "Scheduled";
  const lastPing = trip.lastPingAt ? Date.parse(trip.lastPingAt) : null;
  const pingAge = lastPing != null ? minutes(now - lastPing) * scale : null;
  if (active && (pingAge == null || pingAge > 30)) alerts.push({ level: "red", code: "no_ping", text: pingAge == null ? "Belum ada lokasi dari HP sopir" : `Lokasi tidak update ${Math.round(pingAge)} menit` });
  // "Diam" hanya bisa dinilai kalau lokasi masih update (GPS hilang ≠ truk berhenti).
  if (["ToLoad", "InTransit", "Returning"].includes(trip.status) && pingAge != null && pingAge <= 30) {
    // Hanya ping sejak status sekarang dimulai (diam saat muat/bongkar tidak dihitung).
    const since = lastEvent?.at ?? "";
    const still = stationaryMinutes(trip.pings.filter(p => p.at >= since), scale, now);
    if (still > 45) alerts.push({ level: "amber", code: "stationary", text: `Truk diam ${Math.round(still)} menit di luar lokasi muat/bongkar` });
  }
  const promised = trip.promisedArrival ? Date.parse(trip.promisedArrival) : null;
  if (promised && etaFirst && !arrived && etaFirst > promised) {
    alerts.push({ level: "red", code: "late", text: `ETA lewat janji ke klien ${Math.round(minutes(etaFirst - promised) * scale)} menit` });
  }
  if (trip.status === "Scheduled" && !trip.p2hDoneAt && now > Date.parse(trip.plannedStart)) {
    alerts.push({ level: "amber", code: "no_p2h", text: `Sopir belum P2H, jadwal berangkat lewat ${Math.round(minutes(now - Date.parse(trip.plannedStart)) * scale)} menit` });
  }
  const driving = drivingMinutes(trip.events, scale, now);
  if (driving > 600) alerts.push({ level: "amber", code: "duty", text: `Jam mengemudi ${Math.floor(driving / 60)} jam (> 10 jam) — pertimbangkan istirahat` });

  return {
    id: trip.id, tripNo: trip.tripNo, isSimulated: trip.isSimulated, scenario: trip.simScenario, status: trip.status, statusLabel: st.label,
    statusSince: lastEvent?.at ?? trip.startedAt, plateNo: trip.vehicle.plateNo, truckType: trip.vehicle.truckType.name, vehicleId: trip.vehicleId,
    driverId: trip.driverId, driverName: trip.driver.name, driverPhone: trip.driver.phone, helperName: trip.helper?.name ?? null,
    clientName: trip.client?.name ?? null, routeLabel: trip.route ? `${trip.route.code} · ${trip.route.origin} → ${trip.route.destination}` : "—",
    orderId: trip.order?.id ?? null, orderNo: trip.order?.orderNo ?? null, lat: trip.lastLat, lng: trip.lastLng, lastPingAt: trip.lastPingAt, speedKmh: trip.lastSpeedKmh,
    etaFirstStop: arrived ? null : fmt(etaFirst), promisedArrival: trip.promisedArrival, etaEnd: fmt(etaEnd), stopsTotal, stopsDone: trip.stopsDone,
    path: fullPath(plan), alerts, timeline: trip.events.map(e => ({ status: e.status, label: e.label, at: e.at, source: e.source })),
  };
}

export async function getFleetSnapshot(): Promise<FleetSnapshot> {
  const now = Date.now();
  const trips = await prisma.trip.findMany({ where: { status: { in: ACTIVE_TRIP_STATUSES } }, include: tripInclude, orderBy: { plannedStart: "asc" } });
  const advanced = await Promise.all(trips.map(t => advanceTrip(t).catch(err => { console.error("[tracking] advance", err); return t; })));
  const units = advanced.filter(t => ACTIVE_TRIP_STATUSES.includes(t.status)).map(t => toUnit(t, now));
  const deployed = new Set(units.map(u => u.vehicleId));
  const vehicles = await prisma.vehicle.findMany({ include: { ...vehicleRuleInclude, services: { where: { status: "Open" }, orderBy: { serviceDate: "desc" as const } } }, orderBy: [{ truckType: { sortOrder: "asc" } }, { plateNo: "asc" }] });
  const idle: IdleUnit[] = vehicles.filter(v => !deployed.has(v.id)).map(v => {
    const conds = vehicleConditions(v);
    const repair = v.status === "In Repair";
    const r = readiness(conds);
    const state: IdleUnit["state"] = repair ? "repair" : r === "unfit" ? "unfit" : r === "attention" ? "attention" : "ready";
    const svc = v.services.find(s => s.kind === "Perbaikan");
    return { id: v.id, plateNo: v.plateNo, truckType: v.truckType.name, state, reasons: conds.map(c => c.text), note: repair && svc ? `${svc.items} · sejak ${svc.serviceDate}${svc.notes ? ` · ${svc.notes}` : ""}` : null };
  });
  const sim = advanced.find(t => t.isSimulated && ACTIVE_TRIP_STATUSES.includes(t.status));
  return { at: new Date(now).toISOString(), units, idle, simulation: { running: !!sim, speed: sim?.simSpeed ?? null } };
}

const PUBLIC_EVENT_STATUSES = ["ToLoad", "Loading", "InTransit", "Unloading", "Returning", "Completed"];

/** Data link tracking publik per order (token acak). Tanpa nomor HP sopir dan tanpa data internal. */
export async function getPublicTracking(token: string) {
  if (!/^[a-f0-9]{16,64}$/.test(token)) return null;
  const order = await prisma.charterOrder.findUnique({
    where: { trackingToken: token },
    include: { client: { select: { name: true } }, route: true, truckType: { select: { name: true } }, stops: { orderBy: { seq: "asc" } } },
  });
  if (!order || order.status === "Cancelled") return null;
  const t = await prisma.trip.findFirst({ where: { orderId: order.id, status: { not: "Cancelled" } }, orderBy: { createdAt: "desc" }, select: { id: true } });
  const unit = t ? toUnit(await advanceTrip(await loadTrip(t.id)), Date.now()) : null;
  return {
    order: { orderNo: order.orderNo, client: order.client.name, route: `${order.route.origin} → ${order.route.destination}`, truckType: order.truckType.name, loadDate: order.loadDate, loadTime: order.loadTime, origin: order.originName, stops: order.stops.map(s => s.name), status: order.status },
    trip: unit && {
      status: unit.status, statusLabel: unit.statusLabel, plateNo: unit.plateNo, driverFirstName: unit.driverName.split(" ")[0], lat: unit.lat, lng: unit.lng, lastPingAt: unit.lastPingAt,
      etaFirstStop: unit.etaFirstStop, promisedArrival: unit.promisedArrival, stopsDone: unit.stopsDone, stopsTotal: unit.stopsTotal, path: unit.path,
      // Hanya event status perjalanan. Event internal (assign + nama dispatcher, override & alasan, P2H, laporan
      // sopir, foto, pembatalan) tidak boleh terlihat oleh klien.
      timeline: unit.timeline.filter(e => PUBLIC_EVENT_STATUSES.includes(e.status) && !/berhenti/i.test(e.label)).map(e => ({ label: e.label, at: e.at, status: e.status })),
    },
  };
}
