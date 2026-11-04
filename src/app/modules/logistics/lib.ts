// Helper bersama modul Logistik (aman dipakai di server & client).

export const TAX_PERCENT = 11; // dummy — cek konsultan pajak sebelum dipakai sungguhan

/** Izin modul Logistik (Settings → Roles). Super Admin / "all" selalu boleh. */
export const LOG_PERM = {
  view: "logistics",
  order: "logistics_order",
  dispatch: "logistics_dispatch",
  fleet: "logistics_fleet",
  rates: "logistics_rates",
  finance: "logistics_finance",
  overrideFleet: "logistics_override_fleet",
  overrideOps: "logistics_override_ops",
  overrideDirector: "logistics_override_director",
  driver: "logistics_driver",
} as const;

export const LOG_PRIVILEGES: { id: string; label: string }[] = [
  { id: LOG_PERM.order, label: "Logistics: Create & Edit Charter Orders" },
  { id: LOG_PERM.dispatch, label: "Logistics: Dispatch Trucks & Drivers" },
  { id: LOG_PERM.fleet, label: "Logistics: Manage Fleet & Driver Qualifications" },
  { id: LOG_PERM.rates, label: "Logistics: Change Rates & Routes" },
  { id: LOG_PERM.finance, label: "Logistics: Trip Allowance Payout & Invoicing" },
  { id: LOG_PERM.overrideFleet, label: "Logistics: Override Block (Fleet level)" },
  { id: LOG_PERM.overrideOps, label: "Logistics: Override Block (Ops level)" },
  { id: LOG_PERM.overrideDirector, label: "Logistics: Override Block (Director level)" },
  { id: LOG_PERM.driver, label: "Logistics: Driver Mobile Page" },
];

export type LogisticsAccess = {
  canView: boolean; canOrder: boolean; canDispatch: boolean; canFleet: boolean; canRates: boolean; canFinance: boolean;
  overrideFleet: boolean; overrideOps: boolean; overrideDirector: boolean; isDriver: boolean; isSuperAdmin: boolean;
};

export function logisticsAccess(user: { role: string } | null, rolesConfig: { name: string; permissions: string[] }[]): LogisticsAccess {
  const perms = rolesConfig.find(r => r.name === user?.role)?.permissions ?? [];
  const isSuperAdmin = user?.role === "Super Admin" || perms.includes("all");
  const has = (p: string) => isSuperAdmin || perms.includes(p);
  const roleOnlyDriver = !isSuperAdmin && perms.includes(LOG_PERM.driver) && !perms.includes(LOG_PERM.view);
  return {
    canView: has(LOG_PERM.view), canOrder: has(LOG_PERM.order), canDispatch: has(LOG_PERM.dispatch), canFleet: has(LOG_PERM.fleet),
    canRates: has(LOG_PERM.rates), canFinance: has(LOG_PERM.finance),
    overrideFleet: has(LOG_PERM.overrideFleet), overrideOps: has(LOG_PERM.overrideOps), overrideDirector: has(LOG_PERM.overrideDirector),
    isDriver: roleOnlyDriver, isSuperAdmin,
  };
}

export const rupiah = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
export const today = () => new Date().toISOString().split("T")[0];
export const addDays = (date: string, n: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
};

// ---------------------------------------------------------
// Harga otomatis
// ---------------------------------------------------------

export type RateTable = {
  truckTypes: { id: string; code: string; name: string; sizeClass: string; capacityTon: number; volumeM3: number; tollClass: number; requiresHelper: boolean }[];
  routes: { id: string; code: string; origin: string; destination: string; distanceKm: number; durationHours: number }[];
  rates: { routeId: string; truckTypeId: string; price: number }[];
  surcharges: { code: string; name: string; unit: string; kind: string; smallAmount: number | null; largeAmount: number | null; percent: number | null; minAmount: number | null }[];
};

export type PriceInput = {
  routeId: string; truckTypeId: string; stopCount: number; overnightDays: number;
  tkbm: boolean; escort: boolean; insurance: boolean; returnLoad: boolean; cargoValue: number; discountPercent: number;
};

export type PriceLine = { code: string; label: string; detail: string; amount: number };

export type PriceResult = {
  ok: boolean;
  /** Pesan bila tarif tidak tersedia / opsi tidak berlaku untuk jenis truk ini. */
  issues: string[];
  baseRate: number;
  lines: PriceLine[]; // tarif dasar + biaya tambahan + potongan muatan balik
  surchargeTotal: number;
  discountPercent: number;
  discountAmount: number;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
};

const sizeAmount = (s: RateTable["surcharges"][number], size: string) => (size === "small" ? s.smallAmount : s.largeAmount);

/**
 * Hitung harga charter dari tabel tarif. Satu-satunya sumber harga — AI tidak pernah menentukan angka.
 * Urutan: tarif rute × jenis truk → (muatan balik −20%) → biaya tambahan → diskon kontrak → PPN.
 */
export function computeCharterPrice(t: RateTable, p: PriceInput): PriceResult {
  const issues: string[] = [];
  const type = t.truckTypes.find(x => x.id === p.truckTypeId);
  const route = t.routes.find(x => x.id === p.routeId);
  const rate = t.rates.find(r => r.routeId === p.routeId && r.truckTypeId === p.truckTypeId);
  const empty: PriceResult = { ok: false, issues, baseRate: 0, lines: [], surchargeTotal: 0, discountPercent: 0, discountAmount: 0, subtotal: 0, taxPercent: TAX_PERCENT, taxAmount: 0, total: 0 };
  if (!type || !route) {
    issues.push("Pilih rute dan jenis truk.");
    return empty;
  }
  if (!rate) {
    issues.push(`Tarif ${route.code} untuk ${type.name} belum ada di tabel tarif.`);
    return empty;
  }
  const size = type.sizeClass;
  const sc = (code: string) => t.surcharges.find(s => s.code === code);
  const lines: PriceLine[] = [{ code: "BASE", label: `Tarif charter ${type.name}`, detail: `${route.origin} → ${route.destination} (${route.code}, ±${route.distanceKm} km)`, amount: rate.price }];

  if (p.returnLoad) {
    const s = sc("RETURN_LOAD");
    const pct = s?.percent ?? 20;
    lines.push({ code: "RETURN_LOAD", label: s?.name ?? "Diskon muatan balik", detail: `${pct}% × tarif rute`, amount: -Math.round(rate.price * pct / 100) });
  }

  const extraDrops = Math.max(0, Math.floor(p.stopCount) - 1);
  if (extraDrops > 0) {
    const s = sc("EXTRA_DROP");
    const unit = s ? sizeAmount(s, size) : null;
    if (unit == null) issues.push("Biaya multi-drop belum diatur di tabel biaya tambahan.");
    else lines.push({ code: "EXTRA_DROP", label: s!.name, detail: `${extraDrops} titik × ${rupiah(unit)}`, amount: extraDrops * unit });
  }
  if (p.overnightDays > 0) {
    const s = sc("OVERNIGHT");
    const unit = s ? sizeAmount(s, size) : null;
    if (unit == null) issues.push("Biaya menginap belum diatur.");
    else lines.push({ code: "OVERNIGHT", label: s!.name, detail: `${p.overnightDays} hari × ${rupiah(unit)}`, amount: p.overnightDays * unit });
  }
  if (p.tkbm) {
    const s = sc("TKBM");
    const unit = s ? sizeAmount(s, size) : null;
    if (unit == null) issues.push("Biaya TKBM belum diatur.");
    else lines.push({ code: "TKBM", label: s!.name, detail: "per trip", amount: unit });
  }
  if (p.escort) {
    const s = sc("ESCORT");
    const unit = s ? sizeAmount(s, size) : null;
    if (unit == null) issues.push(`Pengawalan tidak tersedia untuk ${type.name} (hanya Fuso/Tronton/Trailer).`);
    else lines.push({ code: "ESCORT", label: s!.name, detail: "per trip", amount: unit });
  }
  if (p.insurance) {
    const s = sc("INSURANCE");
    const pct = s?.percent ?? 0.1;
    const min = s?.minAmount ?? 100_000;
    const value = Math.max(0, p.cargoValue || 0);
    const amount = Math.max(Math.round(value * pct / 100), min);
    lines.push({ code: "INSURANCE", label: s?.name ?? "Asuransi muatan", detail: `${String(pct).replace(".", ",")}% × nilai barang ${rupiah(value)} (min. ${rupiah(min)})`, amount });
  }

  const gross = lines.reduce((sum, l) => sum + l.amount, 0);
  const surchargeTotal = lines.filter(l => l.code !== "BASE" && l.code !== "RETURN_LOAD").reduce((sum, l) => sum + l.amount, 0);
  const discountPercent = Math.min(Math.max(p.discountPercent || 0, 0), 30);
  const discountAmount = Math.round(gross * discountPercent / 100);
  const subtotal = gross - discountAmount;
  const taxAmount = Math.round(subtotal * TAX_PERCENT / 100);
  return {
    ok: issues.length === 0, issues, baseRate: rate.price, lines, surchargeTotal, discountPercent, discountAmount,
    subtotal, taxPercent: TAX_PERCENT, taxAmount, total: subtotal + taxAmount,
  };
}

export const ORDER_STATUSES = ["Draft", "Confirmed", "Scheduled", "Completed", "Cancelled"] as const;

export const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 border-slate-200",
  Confirmed: "bg-sky-100 text-sky-700 border-sky-200",
  Scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  Ready: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "In Repair": "bg-amber-100 text-amber-800 border-amber-200",
  Inactive: "bg-slate-100 text-slate-500 border-slate-200",
  Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

// ---------------------------------------------------------
// Armada & sopir (indikasi awal; aturan blokir lengkap di Tahap 2)
// ---------------------------------------------------------

/** Aturan kualifikasi 1.3 (disederhanakan) — sama dengan qualifies() di scripts/demo-data/seed-logistics.cjs. */
export function qualifiesFor(d: { simClass: string; experienceYears: number; defensiveTraining: boolean; trailerCertified: boolean }, typeCode: string) {
  switch (typeCode) {
    case "CDE": case "CDD": return true;
    case "FUSO": return d.experienceYears >= 1;
    case "TRONTON": return d.defensiveTraining && d.experienceYears >= 2;
    case "TRAILER": return d.simClass === "B2 Umum" && d.defensiveTraining && d.trailerCertified;
  }
  return false;
}

export type Flag = { level: "red" | "amber"; text: string };

type VehicleFlagInput = {
  status: string; stnkExpiry: string | null; kirExpiry: string | null; nextServiceDate: string | null; nextServiceKm: number | null; odometerKm: number;
  pkbExpiry?: string | null; insuranceExpiry?: string | null;
};

/** Selisih hari kalender (b − a), tanggal YYYY-MM-DD. */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);

export function vehicleFlags(v: VehicleFlagInput, now = today()): Flag[] {
  const flags: Flag[] = [];
  if (v.status === "In Repair") flags.push({ level: "red", text: "Dalam perbaikan" });
  if (v.stnkExpiry && v.stnkExpiry < now) flags.push({ level: "red", text: `STNK habis ${v.stnkExpiry}` });
  else if (v.stnkExpiry && v.stnkExpiry <= addDays(now, 30)) flags.push({ level: "amber", text: `STNK habis ${v.stnkExpiry}` });
  // Pajak tahunan telat = STNK tidak sah (blokir #5).
  if (v.pkbExpiry && v.pkbExpiry < now) flags.push({ level: "red", text: `Pajak (PKB) telat ${daysBetween(v.pkbExpiry, now)} hari` });
  else if (v.pkbExpiry && v.pkbExpiry <= addDays(now, 30)) flags.push({ level: "amber", text: `Pajak (PKB) jatuh tempo ${v.pkbExpiry}` });
  if (v.kirExpiry && v.kirExpiry < now) flags.push({ level: "red", text: `KIR habis ${v.kirExpiry}` });
  else if (v.kirExpiry && v.kirExpiry <= addDays(now, 30)) flags.push({ level: "amber", text: `KIR habis ${v.kirExpiry}` });
  // Asuransi kendaraan: peringatan saja.
  if (v.insuranceExpiry && v.insuranceExpiry <= addDays(now, 30)) flags.push({ level: "amber", text: `Asuransi habis ${v.insuranceExpiry}` });
  const overdueDate = v.nextServiceDate && v.nextServiceDate < now;
  const overdueKm = v.nextServiceKm != null && v.odometerKm > v.nextServiceKm;
  if (overdueDate || overdueKm) flags.push({ level: "amber", text: `Servis overdue${overdueKm ? ` ${Math.round(v.odometerKm - v.nextServiceKm!).toLocaleString("id-ID")} km` : ""}` });
  return flags;
}

export function driverFlags(d: { simExpiry: string }, now = today()): Flag[] {
  if (d.simExpiry < now) return [{ level: "red", text: `SIM habis ${d.simExpiry}` }];
  if (d.simExpiry <= addDays(now, 30)) return [{ level: "amber", text: `SIM habis ${d.simExpiry}` }];
  return [];
}

export const TOLL_METHODS: Record<string, string> = { A: "Kartu e-toll perusahaan", B: "Tunai oleh sopir", C: "Kartu pribadi sopir", D: "Ditagihkan ke klien" };

// ---------------------------------------------------------
// Dokumen armada & sopir (rancangan 10.1)
// ---------------------------------------------------------

export type DocTypeSpec = { label: string; remindDays: number[]; hint: string };

/** field = kolom masa berlaku di Vehicle yang diisi dari dokumen Verified terbaru. */
export const VEHICLE_DOC_TYPES: Record<string, DocTypeSpec & { field: "stnkExpiry" | "pkbExpiry" | "kirExpiry" | "insuranceExpiry" }> = {
  STNK: { label: "STNK", remindDays: [60, 30], field: "stnkExpiry", hint: "5 tahunan · habis → blokir #5" },
  PKB: { label: "Pajak kendaraan (PKB)", remindDays: [30, 7], field: "pkbExpiry", hint: "tahunan · telat = STNK tidak sah → blokir #5" },
  KIR: { label: "KIR", remindDays: [30, 7], field: "kirExpiry", hint: "6 bulanan · habis → blokir #5" },
  INSURANCE: { label: "Asuransi kendaraan", remindDays: [30], field: "insuranceExpiry", hint: "peringatan saja" },
};

export const DRIVER_DOC_TYPES: Record<string, DocTypeSpec> = {
  SIM: { label: "SIM", remindDays: [60, 30], hint: "habis → blokir #3 (tidak bisa override); golongan menentukan jenis truk" },
  TRAINING_DEFENSIVE: { label: "Training defensive driving", remindDays: [30], hint: "syarat Tronton & Trailer" },
  TRAINING_TRAILER: { label: "Sertifikat trailer/kontainer", remindDays: [30], hint: "syarat Trailer" },
};

export const DOC_STATUS_COLORS: Record<string, string> = {
  Verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Draft: "bg-amber-50 text-amber-800 border-amber-200",
  Rejected: "bg-slate-100 text-slate-500 border-slate-200",
};

/** Servis berkala (dummy): tiap 10.000 km atau 90 hari, mana yang lebih dulu. */
export const SERVICE_INTERVAL = { km: 10_000, days: 90 };

/** Status masa berlaku: expired, remind (masuk jendela pengingat terlebar), ok. */
export function expiryState(validUntil: string | null | undefined, remindDays: number[], now = today()) {
  if (!validUntil) return { level: "none" as const, daysLeft: null as number | null };
  const daysLeft = daysBetween(now, validUntil);
  if (daysLeft < 0) return { level: "expired" as const, daysLeft };
  if (daysLeft <= Math.max(...remindDays)) return { level: "remind" as const, daysLeft };
  return { level: "ok" as const, daysLeft };
}

export const daysLeftText = (n: number | null) => n == null ? "—" : n < 0 ? `lewat ${-n} hari` : n === 0 ? "hari ini" : `${n} hari lagi`;

/** Normalisasi nopol untuk membandingkan hasil scan dengan data truk ("B9408FXD"). */
export const normPlate = (p: string) => p.replace(/[^A-Z0-9]/gi, "").toUpperCase();
