// Tahap 2 — aturan kelayakan & blokir Surat Jalan (rancangan 3.5) + peringatan jam kerja sopir (1.3b).
// Semua keputusan oleh kode; AI hanya boleh menjelaskan.
import { prisma } from "@/lib/prisma";
import { addDays, daysBetween, driverFlags, qualifiesFor, today, wibDate } from "./lib";
import { ACTIVE_TRIP_STATUSES } from "./trackingLib";

export type OverrideLevel = "none" | "fleet" | "ops" | "director";
/** key = kode stabil untuk mencocokkan override (mis. "5:STNK"); code = nomor kondisi 3.5. */
export type Condition = { key: string; code: string; text: string; level: OverrideLevel; subject: "vehicle" | "driver" | "order" | "crew"; needsEvidence?: boolean };

export const LEVEL_LABEL: Record<OverrideLevel, string> = {
  none: "Tidak bisa di-override", fleet: "Override Fleet Manager", ops: "Override Operations Manager", director: "Override Direktur Operasional",
};
export const CONTROL_ACTIONS = [
  "Servis/perbaikan dijadwalkan sepulang trip",
  "Perpanjangan dokumen dikawal Fleet Manager, bukti dibawa sopir",
  "Muatan diperiksa ulang & diikat ekstra",
  "Sopir didampingi / dipantau ketat lewat Fleet Tracking",
  "Saldo uang jalan diselesaikan saat trip selesai",
  "Kenek disusulkan / dijemput di titik muat",
];

export const CRITICAL_SYSTEMS = ["rem", "kemudi", "ban", "lampu"];

type VehicleInput = {
  id: string; status: string; odometerKm: number; stnkExpiry: string | null; kirExpiry: string | null; pkbExpiry: string | null; insuranceExpiry: string | null;
  nextServiceDate: string | null; nextServiceKm: number | null;
  services: { kind: string; status: string; system: string | null; items: string }[];
  preTripChecks: { id?: string; at: string; criticalFails: string | null; otherFails: string | null }[];
};

/** Kondisi kendaraan (#1, #2, #5, #6, #7, #10). preTripChecks: terbaru dulu. */
export function vehicleConditions(v: VehicleInput, now = today()): Condition[] {
  const out: Condition[] = [];
  const openRepairs = v.services.filter(s => s.kind === "Perbaikan" && s.status === "Open");
  const critical = openRepairs.filter(s => CRITICAL_SYSTEMS.includes(s.system ?? ""));
  if (critical.length) out.push({ key: "1:repair", code: "1", subject: "vehicle", level: "none", text: `Perbaikan sistem ${critical.map(s => s.system).join(", ")} belum selesai` });
  if (v.status !== "Ready") out.push({ key: "1:status", code: "1", subject: "vehicle", level: "none", text: v.status === "In Repair" ? "Truk sedang dalam perbaikan" : `Status truk ${v.status}` });
  const nonCritical = openRepairs.filter(s => !CRITICAL_SYSTEMS.includes(s.system ?? ""));
  if (nonCritical.length && v.status === "Ready") out.push({ key: "10:repair", code: "10", subject: "vehicle", level: "director", text: `Perbaikan belum selesai: ${nonCritical.map(s => s.items).join("; ")}` });

  const p2h = v.preTripChecks[0];
  // P2H terakhir berlaku sampai ada P2H baru (setelah perbaikan, Fleet Manager mencatat P2H ulang).
  if (p2h) {
    if (p2h.criticalFails) out.push({ key: "2:p2h", code: "2", subject: "vehicle", level: "none", text: `P2H gagal pada item kritis: ${p2h.criticalFails}` });
    // Kunci memuat id P2H: override berlaku untuk hasil pemeriksaan ITU saja. P2H ulang yang gagal
    // (item lain atau item sama) adalah kondisi baru dan butuh persetujuan baru.
    else if (p2h.otherFails) out.push({ key: `7:p2h${p2h.id ? `:${p2h.id}` : ""}`, code: "7", subject: "vehicle", level: "fleet", text: `P2H gagal pada item non-kritis: ${p2h.otherFails}` });
  }

  const docs: [string, string | null][] = [["STNK", v.stnkExpiry], ["Pajak kendaraan (PKB)", v.pkbExpiry], ["KIR", v.kirExpiry]];
  for (const [label, d] of docs) {
    if (d && d < now) out.push({ key: `5:${label}`, code: "5", subject: "vehicle", level: "fleet", needsEvidence: true, text: `${label} kedaluwarsa sejak ${d}` });
    // Truk baru yang datanya belum dilengkapi: anggap belum terbukti sah.
    else if (!d) out.push({ key: `5:${label}`, code: "5", subject: "vehicle", level: "fleet", needsEvidence: true, text: `${label} belum dicatat (lengkapi di tab Documents)` });
  }

  const daysOver = v.nextServiceDate && v.nextServiceDate < now ? daysBetween(v.nextServiceDate, now) : 0;
  const kmOver = v.nextServiceKm != null && v.odometerKm > v.nextServiceKm ? Math.round(v.odometerKm - v.nextServiceKm) : 0;
  if (daysOver > 0 || kmOver > 0) {
    const detail = [daysOver ? `${daysOver} hari` : "", kmOver ? `${kmOver.toLocaleString("id-ID")} km` : ""].filter(Boolean).join(" / ");
    if (daysOver <= 14 && kmOver <= 1000) out.push({ key: "6:service", code: "6", subject: "vehicle", level: "fleet", text: `Servis berkala overdue ${detail}` });
    else out.push({ key: "10:service", code: "10", subject: "vehicle", level: "director", text: `Servis berkala overdue ${detail} (> 14 hari / > 1.000 km)` });
  }
  return out;
}

/** Peringatan saja (tidak memblokir). */
export function vehicleWarnings(v: { insuranceExpiry: string | null }, now = today()) {
  return v.insuranceExpiry && v.insuranceExpiry < now ? [`Asuransi kendaraan habis sejak ${v.insuranceExpiry}`] : [];
}

export function readiness(conds: Condition[]): "ready" | "attention" | "unfit" {
  if (conds.some(c => c.level === "none")) return "unfit";
  return conds.length ? "attention" : "ready";
}

type DriverInput = {
  status?: string; simExpiry: string; simClass: string; experienceYears: number; defensiveTraining: boolean; trailerCertified: boolean; unsettledAdvance: number;
  qualifications: { truckTypeId: string; basis: string }[];
};

/** Kondisi sopir untuk jenis truk tertentu (#3, #3a, #9). */
export function driverConditions(d: DriverInput, type: { id: string; code: string; name: string }): Condition[] {
  const out: Condition[] = [];
  if (d.status && d.status !== "Active") out.push({ key: "3:inactive", code: "3", subject: "driver", level: "none", text: `Sopir berstatus ${d.status}` });
  if (driverFlags(d).some(f => f.level === "red")) out.push({ key: "3:sim", code: "3", subject: "driver", level: "none", text: `SIM kedaluwarsa (${d.simExpiry})` });
  const q = d.qualifications.find(x => x.truckTypeId === type.id);
  const ok = q?.basis === "manual-revoke" ? false : q?.basis === "manual-add" ? true : qualifiesFor(d, type.code);
  if (!ok) {
    const why = type.code === "TRAILER" && d.simClass !== "B2 Umum" ? "butuh SIM B2 Umum" : type.code === "TRAILER" || type.code === "TRONTON" ? (!d.defensiveTraining ? "belum training defensive driving" : type.code === "TRAILER" && !d.trailerCertified ? "belum sertifikat trailer" : "pengalaman kurang") : "pengalaman kurang";
    out.push({ key: "3a:qual", code: "3a", subject: "driver", level: "none", text: `Tidak qualified untuk ${type.name} (${why})` });
  }
  if (d.unsettledAdvance > 0) out.push({ key: "9:advance", code: "9", subject: "driver", level: "ops", text: `Uang jalan belum di-settle Rp ${Math.round(d.unsettledAdvance).toLocaleString("id-ID")}` });
  return out;
}

/** Kondisi muatan (#4, #8) & kru (#3b). */
export function orderConditions(cargoTon: number | null, type: { capacityTon: number; name: string; requiresHelper: boolean }, hasHelper: boolean): Condition[] {
  const out: Condition[] = [];
  if (cargoTon && cargoTon > type.capacityTon * 1.1) out.push({ key: "4:load", code: "4", subject: "order", level: "none", text: `Muatan ${cargoTon} ton > 110% kapasitas ${type.name} (${type.capacityTon} ton)` });
  else if (cargoTon && cargoTon > type.capacityTon) out.push({ key: "8:load", code: "8", subject: "order", level: "ops", text: `Muatan ${cargoTon} ton = ${Math.round((cargoTon / type.capacityTon) * 100)}% kapasitas ${type.name}` });
  if (type.requiresHelper && !hasHelper) out.push({ key: "3b:helper", code: "3b", subject: "crew", level: "ops", text: `${type.name} wajib kenek` });
  return out;
}

type DutyTrip = { driverId: string; plannedStart: string; startedAt: string | null; completedAt: string | null; status: string };

/** Peringatan jam kerja sopir (1.3b) dari daftar trip sopir itu (14 hari terakhir). Murni — tanpa query. */
export function dutyWarningsFrom(trips: Omit<DutyTrip, "driverId">[], plannedHours: number, startDate = today()): string[] {
  const warnings: string[] = [];
  // Hari kerja dihitung per tanggal WIB (plannedStart disimpan UTC: muat 06:00 WIB = 23:00 UTC hari sebelumnya).
  const days = new Set(trips.map(t => wibDate(t.plannedStart)));
  days.add(startDate);
  let streak = 0;
  for (let d = startDate; days.has(d); d = addDays(d, -1)) streak++;
  if (streak > 6) warnings.push(`Sudah ${streak} hari berturut-turut bertugas (> 6 hari) — sarankan istirahatkan sopir`);
  // Titik acuan = mulai tugas baru (bukan "sekarang") supaya order untuk besok dinilai benar.
  const ref = Math.max(Date.now(), Date.parse(`${startDate}T00:00:00+07:00`));
  const lastDone = trips.filter(t => t.completedAt).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))[0];
  if (lastDone) {
    const rest = (ref - Date.parse(lastDone.completedAt!)) / 3_600_000;
    if (rest < 8) warnings.push(`Jeda istirahat baru ${Math.max(0, rest).toFixed(1)} jam sejak trip terakhir (< 8 jam)`);
  }
  const weekAgo = ref - 7 * 86_400_000;
  const weekHours = trips.filter(t => t.startedAt && t.completedAt && Date.parse(t.completedAt) > weekAgo)
    .reduce((s, t) => s + (Date.parse(t.completedAt!) - Date.parse(t.startedAt!)) / 3_600_000, 0);
  if (weekHours + plannedHours > 60) warnings.push(`Total jam kerja 7 hari ±${Math.round(weekHours + plannedHours)} jam (> 60 jam)`);
  if (plannedHours > 10) warnings.push(`Estimasi mengemudi ±${plannedHours} jam sekali jalan (> 10 jam/hari)`);
  if (trips.some(t => ACTIVE_TRIP_STATUSES.includes(t.status))) warnings.push("Sopir masih punya trip aktif");
  return warnings;
}

const dutyQuery = (driverIds: string[], startDate: string) => prisma.trip.findMany({
  // Batas bawah sehari lebih awal karena plannedStart UTC.
  where: { driverId: { in: driverIds }, isSimulated: false, status: { not: "Cancelled" }, plannedStart: { gte: addDays(startDate, -15) } },
  select: { driverId: true, plannedStart: true, startedAt: true, completedAt: true, status: true },
});

/** Peringatan jam kerja satu sopir. */
export async function dutyWarnings(driverId: string, plannedHours: number, startDate = today()): Promise<string[]> {
  return dutyWarningsFrom(await dutyQuery([driverId], startDate), plannedHours, startDate);
}

/** Peringatan jam kerja banyak sopir sekaligus (satu query, untuk papan Dispatch). */
export async function dutyWarningsMany(driverIds: string[], plannedHours: number, startDate = today()): Promise<Map<string, string[]>> {
  const trips = driverIds.length ? await dutyQuery(driverIds, startDate) : [];
  return new Map(driverIds.map(id => [id, dutyWarningsFrom(trips.filter(t => t.driverId === id), plannedHours, startDate)]));
}

export const vehicleRuleInclude = {
  truckType: true,
  services: { where: { status: "Open" }, select: { kind: true, status: true, system: true, items: true } },
  preTripChecks: { orderBy: { at: "desc" as const }, take: 1, select: { id: true, at: true, criticalFails: true, otherFails: true } },
};

/** Evaluasi trip sekarang: kondisi yang masih berlaku + override yang sudah ada (berlaku untuk trip ini saja). */
export async function evaluateTrip(tripId: string) {
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: { vehicle: { include: vehicleRuleInclude }, driver: { include: { qualifications: true } }, order: true, overrides: { orderBy: { at: "asc" } } },
  });
  const conditions = [
    ...vehicleConditions(trip.vehicle),
    ...driverConditions(trip.driver, trip.vehicle.truckType),
    ...orderConditions(trip.order?.cargoWeightTon ?? null, trip.vehicle.truckType, !!trip.helperId),
  ];
  const overridden = (c: Condition) => trip.overrides.find(o => o.condition === c.key);
  const items = conditions.map(c => ({ ...c, override: overridden(c) ?? null }));
  return {
    trip, items,
    blocked: items.filter(i => i.level === "none"),
    pending: items.filter(i => i.level !== "none" && !i.override),
    clear: items.every(i => i.level !== "none" && i.override),
  };
}

export function canOverride(level: OverrideLevel, a: { overrideFleet: boolean; overrideOps: boolean; overrideDirector: boolean }) {
  if (level === "fleet") return a.overrideFleet || a.overrideDirector;
  if (level === "ops") return a.overrideOps || a.overrideDirector;
  if (level === "director") return a.overrideDirector;
  return false;
}
