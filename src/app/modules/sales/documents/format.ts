// Format angka & tanggal Bahasa Indonesia untuk dokumen.

const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

/** 1.250.500 → "satu juta dua ratus lima puluh ribu lima ratus". */
export function terbilang(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${terbilang(n - 10)} belas`;
  if (n < 100) return `${terbilang(Math.floor(n / 10))} puluh ${terbilang(n % 10)}`.trim();
  if (n < 200) return `seratus ${terbilang(n - 100)}`.trim();
  if (n < 1000) return `${terbilang(Math.floor(n / 100))} ratus ${terbilang(n % 100)}`.trim();
  if (n < 2000) return `seribu ${terbilang(n - 1000)}`.trim();
  const units: [number, string][] = [[1e12, "triliun"], [1e9, "miliar"], [1e6, "juta"], [1e3, "ribu"]];
  for (const [size, name] of units) {
    if (n >= size) return `${terbilang(Math.floor(n / size))} ${name} ${terbilang(n % size)}`.trim();
  }
  return "";
}
export const terbilangRupiah = (n: number) => `${terbilang(n) || "nol"} rupiah`.replace(/^./, c => c.toUpperCase());

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const tanggal = (iso?: string | null) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
};
export const hari = (iso: string) => HARI[new Date(iso + "T00:00:00").getDay()];
export const bulanTahun = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return `${BULAN[m - 1]} ${y}`;
};

/** Nama file aman untuk Windows. */
export const safeName = (s: string) => s.replace(/\//g, "-").replace(/[\\:*?"<>|]/g, "");
