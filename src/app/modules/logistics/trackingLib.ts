// Fleet Tracking (rancangan 10.2): rencana perjalanan, posisi di sepanjang jalur, dan status trip.
// Fungsi murni — dipakai server (simulasi, ETA, peringatan) dan browser (peta).

export type LatLng = [number, number];

/** Satu fase trip. Fase perjalanan punya path ≥ 2 titik; fase diam (muat/bongkar/berhenti) 1 titik. */
export type Phase = { status: string; label: string; minutes: number; path: LatLng[]; stall?: boolean; stopSeq?: number };

/** promiseMin = janji tiba di titik bongkar pertama (menit sejak awal rencana); silentAfterMin = simulasi GPS hilang. */
export type TripPlan = { phases: Phase[]; promiseMin?: number; silentAfterMin?: number };

export const TRIP_STATUSES: Record<string, { label: string; color: string; badge: string }> = {
  Scheduled: { label: "Dijadwalkan", color: "#64748b", badge: "bg-slate-100 text-slate-700 border-slate-200" },
  ToLoad: { label: "Menuju muat", color: "#0ea5e9", badge: "bg-sky-100 text-sky-800 border-sky-200" },
  Loading: { label: "Muat", color: "#8b5cf6", badge: "bg-violet-100 text-violet-800 border-violet-200" },
  InTransit: { label: "Dalam perjalanan", color: "#2563eb", badge: "bg-blue-100 text-blue-800 border-blue-200" },
  Unloading: { label: "Bongkar", color: "#f59e0b", badge: "bg-amber-100 text-amber-800 border-amber-200" },
  Returning: { label: "Kembali ke pool", color: "#10b981", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  Completed: { label: "Selesai", color: "#475569", badge: "bg-slate-100 text-slate-600 border-slate-200" },
  Cancelled: { label: "Dibatalkan", color: "#dc2626", badge: "bg-red-100 text-red-700 border-red-200" },
};

export const ACTIVE_TRIP_STATUSES = ["Scheduled", "ToLoad", "Loading", "InTransit", "Unloading", "Returning"];
export const DRIVING_STATUSES = ["ToLoad", "InTransit", "Returning"];

export function parsePlan(json: string | null | undefined): TripPlan {
  try {
    const v = JSON.parse(json || "{}");
    if (Array.isArray(v)) return { phases: v };
    return { phases: Array.isArray(v.phases) ? v.phases : [], promiseMin: v.promiseMin, silentAfterMin: v.silentAfterMin };
  } catch {
    return { phases: [] };
  }
}

export function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const pathKm = (p: LatLng[]) => p.slice(1).reduce((s, pt, i) => s + haversineKm(p[i], pt), 0);

/** Titik pada fraksi f (0–1) panjang jalur. */
export function pointAlong(p: LatLng[], f: number): LatLng {
  if (p.length < 2) return p[0];
  const total = pathKm(p);
  let target = Math.min(Math.max(f, 0), 1) * total;
  for (let i = 1; i < p.length; i++) {
    const seg = haversineKm(p[i - 1], p[i]);
    if (target <= seg || i === p.length - 1) {
      const t = seg ? Math.min(target / seg, 1) : 1;
      return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t];
    }
    target -= seg;
  }
  return p[p.length - 1];
}

/** Potong jalur pada fraksi f → [bagian awal, bagian akhir]. */
export function splitPath(p: LatLng[], f: number): [LatLng[], LatLng[]] {
  const total = pathKm(p);
  const target = f * total;
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const seg = haversineKm(p[i - 1], p[i]);
    if (acc + seg >= target) {
      const mid = pointAlong([p[i - 1], p[i]], seg ? (target - acc) / seg : 0);
      return [[...p.slice(0, i), mid], [mid, ...p.slice(i)]];
    }
    acc += seg;
  }
  return [p, [p[p.length - 1]]];
}

export const phaseStarts = (plan: TripPlan) => plan.phases.reduce<number[]>((acc, ph, i) => (acc.push(i === 0 ? 0 : acc[i - 1] + plan.phases[i - 1].minutes), acc), []);
export const planTotal = (plan: TripPlan) => plan.phases.reduce((s, p) => s + p.minutes, 0);

export type PlanPosition = {
  phaseIndex: number; status: string; label: string; lat: number; lng: number; moving: boolean; speedKmh: number;
  stopsDone: number; done: boolean;
};

/** Posisi pada menit ke-`elapsed` sejak awal rencana. */
export function positionAt(plan: TripPlan, elapsed: number): PlanPosition {
  const starts = phaseStarts(plan);
  const total = planTotal(plan);
  const stopsDoneBefore = (i: number) => plan.phases.slice(0, i).filter(p => p.status === "Unloading").length;
  if (!plan.phases.length) return { phaseIndex: -1, status: "Scheduled", label: "", lat: 0, lng: 0, moving: false, speedKmh: 0, stopsDone: 0, done: false };
  if (elapsed >= total) {
    const last = plan.phases[plan.phases.length - 1];
    const pt = last.path[last.path.length - 1];
    return { phaseIndex: plan.phases.length, status: "Completed", label: "Trip selesai", lat: pt[0], lng: pt[1], moving: false, speedKmh: 0, stopsDone: stopsDoneBefore(plan.phases.length), done: true };
  }
  let i = starts.findIndex((s, k) => elapsed >= s && elapsed < s + plan.phases[k].minutes);
  if (i < 0) i = 0;
  const ph = plan.phases[i];
  const f = ph.minutes ? (elapsed - starts[i]) / ph.minutes : 1;
  const pt = ph.path.length > 1 ? pointAlong(ph.path, f) : ph.path[0];
  const moving = ph.path.length > 1 && !ph.stall;
  return {
    phaseIndex: i, status: ph.status, label: ph.label, lat: pt[0], lng: pt[1], moving,
    speedKmh: moving && ph.minutes ? Math.round((pathKm(ph.path) / ph.minutes) * 60) : 0, stopsDone: stopsDoneBefore(i), done: false,
  };
}

/** Menit (waktu rencana) sejak awal sampai tiba di titik bongkar pertama / sampai trip selesai. */
export function firstUnloadMin(plan: TripPlan) {
  const starts = phaseStarts(plan);
  const i = plan.phases.findIndex(p => p.status === "Unloading");
  return i < 0 ? planTotal(plan) : starts[i];
}

/** Seluruh jalur trip (untuk garis di peta). */
export const fullPath = (plan: TripPlan): LatLng[] => plan.phases.flatMap(p => p.path);

export const minutesText = (m: number) => {
  const a = Math.round(Math.abs(m));
  return a < 60 ? `${a} mnt` : `${Math.floor(a / 60)} j ${a % 60} mnt`;
};
