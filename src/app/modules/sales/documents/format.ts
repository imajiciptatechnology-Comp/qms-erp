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

// ---------------------------------------------------------
// Dokumen ekspor (bahasa Inggris)
// ---------------------------------------------------------

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 12345 → "twelve thousand three hundred forty-five". */
export function numberToWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}`;
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${numberToWords(n % 100)}` : ""}`;
  const units: [number, string][] = [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
  for (const [size, name] of units) {
    if (n >= size) return `${numberToWords(Math.floor(n / size))} ${name}${n % size ? ` ${numberToWords(n % size)}` : ""}`;
  }
  return "";
}

const CURRENCY_WORDS: Record<string, [string, string]> = {
  USD: ["US Dollars", "cents"], EUR: ["Euros", "cents"], SGD: ["Singapore Dollars", "cents"], IDR: ["Indonesian Rupiah", ""],
};

/** Terbilang sesuai valuta & bahasa: "Say: US Dollars twelve thousand ... and 50/100 only". */
export function amountInWords(n: number, currency = "IDR", lang: "id" | "en" = "id") {
  if (lang === "id" && currency === "IDR") return `Terbilang: ${terbilangRupiah(n)}`;
  const whole = Math.floor(Math.abs(n));
  const cents = Math.round((Math.abs(n) - whole) * 100);
  if (lang === "id") {
    const name = { USD: "dolar Amerika Serikat", EUR: "euro", SGD: "dolar Singapura" }[currency] ?? currency;
    const text = `${terbilang(whole) || "nol"} ${name}${cents ? ` ${terbilang(cents)} sen` : ""}`;
    return `Terbilang: ${text.replace(/^./, c => c.toUpperCase())}`;
  }
  const [major] = CURRENCY_WORDS[currency] ?? [currency, "cents"];
  const words = numberToWords(whole) || "zero";
  return `Say: ${major} ${words}${currency !== "IDR" ? ` and ${String(cents).padStart(2, "0")}/100` : ""} only`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** 2026-11-10 → "10 November 2026" */
export const dateEn = (iso?: string | null) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
