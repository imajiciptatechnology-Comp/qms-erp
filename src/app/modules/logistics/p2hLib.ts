// P2H (Pemeriksaan Harian) — daftar item & format data. Fungsi murni: aman di server dan browser.
//
// Item kritis gagal → blokir #2 (tidak bisa di-override); non-kritis gagal → #7 (override Fleet Manager).

export type P2HItem = { key: string; label: string; hint: string; critical: boolean };

export const P2H_ITEMS: readonly P2HItem[] = [
  { key: "rem", label: "Rem", hint: "rem kaki pakem, rem tangan/parkir menahan", critical: true },
  { key: "kemudi", label: "Kemudi", hint: "setir tidak oblak/berat sebelah", critical: true },
  { key: "ban", label: "Ban & roda", hint: "tekanan angin, alur ban, baut roda lengkap", critical: true },
  { key: "lampu", label: "Lampu", hint: "utama, sein, rem, mundur", critical: true },
  { key: "spion", label: "Spion", hint: "lengkap, tidak retak", critical: true },
  { key: "sabuk", label: "Sabuk pengaman", hint: "terkunci dengan baik", critical: true },
  { key: "apar", label: "APAR", hint: "ada, jarum di hijau, belum kedaluwarsa", critical: true },
  { key: "dokumen", label: "STNK & KIR", hint: "asli/fotokopi sah ada di kabin", critical: true },
  { key: "oli", label: "Oli mesin", hint: "level di antara batas min–maks", critical: false },
  { key: "radiator", label: "Air radiator", hint: "level cukup, tidak bocor", critical: false },
  { key: "wiper", label: "Wiper", hint: "menyapu bersih", critical: false },
  { key: "klakson", label: "Klakson", hint: "berbunyi", critical: false },
  { key: "segitiga", label: "Segitiga/dongkrak", hint: "ada di kendaraan", critical: false },
  { key: "p3k", label: "Kotak P3K", hint: "ada & berisi", critical: false },
  { key: "kabin", label: "Kebersihan kabin", hint: "rapi, tidak ada barang lepas", critical: false },
];

export const p2hItem = (key: string) => P2H_ITEMS.find(i => i.key === key);

export type P2HMark = "ok" | "fail" | "unknown";
export type P2HResult = Record<string, P2HMark>;
export type P2HDetail = { note?: string; photos?: string[] };
export type P2HRecord = { items: P2HResult; details: Record<string, P2HDetail>; odometerKm: number | null };

/** Baca PreTripCheck.resultJson. Format lama = peta item saja; format baru = { items, details, odometerKm }. */
export function parseP2HRecord(json: string | null | undefined): P2HRecord {
  try {
    const v = JSON.parse(json || "{}");
    if (v && typeof v === "object" && v.items && typeof v.items === "object") {
      return { items: v.items, details: v.details && typeof v.details === "object" ? v.details : {}, odometerKm: typeof v.odometerKm === "number" ? v.odometerKm : null };
    }
    return { items: v ?? {}, details: {}, odometerKm: null };
  } catch {
    return { items: {}, details: {}, odometerKm: null };
  }
}

/** Catatan teks dari keterangan per item (untuk kolom notes & timeline). */
export function p2hNotesText(details: Record<string, P2HDetail>, general?: string) {
  const parts = Object.entries(details)
    .filter(([, d]) => d.note || d.photos?.length)
    .map(([k, d]) => `${p2hItem(k)?.label ?? k}: ${d.note ?? "(foto)"}${d.photos?.length ? ` [${d.photos.length} foto]` : ""}`);
  if (general?.trim()) parts.push(general.trim());
  return parts.join(" · ").slice(0, 1000);
}

/** Angka odometer dari teks sopir: "128.450", "128450 km", "128,450". */
export function parseOdometer(text: string): number | null {
  const digits = text.replace(/km/i, "").replace(/[.,\s]/g, "");
  if (!/^\d{1,7}$/.test(digits)) return null;
  return Number(digits);
}
