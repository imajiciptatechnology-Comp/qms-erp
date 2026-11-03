/**
 * Pasal baku perjanjian layanan (VERSI CONTOH — wajib direview bagian legal sebelum dipakai).
 * `locked` = pasal hukum yang tidak boleh diubah AI (sengketa, force majeure, pengakhiran, penutup);
 * manusia tetap bisa menyuntingnya di form kontrak.
 */
import { LETTERHEAD as L } from "./letterhead";
import { tanggal, terbilangRupiah } from "./format";

export type Clause = { key: string; title: string; body: string; locked?: boolean };

export type ClauseParams = {
  type: string; // AMC | Kalibrasi | Service
  startDate: string;
  endDate: string;
  visitsPerYear?: number | null;
  responseTime?: string | null;
  value: number;
  paymentTerms?: string | null;
  billingSchedule?: string | null;
  sparePartDiscount?: number | null;
  scope?: string | null;
  itemCount: number;
};

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

export const AGREEMENT_TITLE: Record<string, string> = {
  AMC: "PERJANJIAN KONTRAK PERAWATAN TAHUNAN (AMC)",
  Kalibrasi: "PERJANJIAN LAYANAN KALIBRASI BERKALA",
  Service: "PERJANJIAN LAYANAN SERVIS PERALATAN",
};

const DEFAULT_SCOPE: Record<string, string> = {
  AMC: "Pihak Pertama melaksanakan perawatan preventif (preventive maintenance), pemeriksaan fungsi, pembersihan, penyetelan, serta perbaikan korektif atas peralatan laboratorium milik Pihak Kedua sebagaimana tercantum dalam Lampiran 1.",
  Kalibrasi: "Pihak Pertama melaksanakan kalibrasi berkala on-site atas peralatan laboratorium milik Pihak Kedua sebagaimana tercantum dalam Lampiran 1, menggunakan standar acuan yang tertelusur ke Satuan Internasional (SI), dan menerbitkan sertifikat kalibrasi untuk setiap alat.",
  Service: "Pihak Pertama memberikan layanan servis dan perbaikan atas panggilan (on-call) untuk peralatan laboratorium milik Pihak Kedua sebagaimana tercantum dalam Lampiran 1.",
};
export const defaultScope = (type: string) => DEFAULT_SCOPE[type] ?? DEFAULT_SCOPE.Service;

export function buildClauses(p: ClauseParams): Clause[] {
  const visits = p.visitsPerYear ? `${p.visitsPerYear} (${["nol", "satu", "dua", "tiga", "empat", "lima", "enam"][p.visitsPerYear] ?? p.visitsPerYear}) kali dalam setahun` : "sesuai kebutuhan";
  const billing = p.billingSchedule === "Quarterly"
    ? "ditagihkan per triwulan (4 termin masing-masing 25%) pada awal setiap triwulan"
    : "ditagihkan 100% (seratus persen) pada awal periode Perjanjian";
  const clauses: Clause[] = [
    { key: "scope", title: "Ruang Lingkup", body: (p.scope?.trim() || defaultScope(p.type)) + ` Jumlah peralatan yang dicakup adalah ${p.itemCount} unit.` },
    { key: "term", title: "Jangka Waktu", body: `Perjanjian ini berlaku sejak tanggal ${tanggal(p.startDate)} sampai dengan ${tanggal(p.endDate)}, dan dapat diperpanjang atas kesepakatan Para Pihak yang dituangkan secara tertulis paling lambat 30 (tiga puluh) hari sebelum Perjanjian berakhir.` },
    { key: "visits", title: p.type === "Service" ? "Pelaksanaan Layanan" : "Jadwal Kunjungan", body: p.type === "Service"
      ? `Pihak Pertama akan menanggapi setiap permintaan servis dari Pihak Kedua dalam waktu ${p.responseTime || "2x24 jam hari kerja"} sejak laporan diterima melalui telepon atau email resmi.`
      : `Kunjungan ${p.type === "Kalibrasi" ? "kalibrasi" : "perawatan preventif"} dilaksanakan ${visits} sesuai jadwal pada Lampiran 2. Jadwal dapat disesuaikan atas kesepakatan Para Pihak paling lambat 7 (tujuh) hari kerja sebelum tanggal kunjungan. Untuk gangguan di luar jadwal, Pihak Pertama menanggapi dalam waktu ${p.responseTime || "2x24 jam hari kerja"}.` },
    { key: "value", title: "Nilai Perjanjian dan Cara Pembayaran", body: `Nilai Perjanjian adalah sebesar ${rp(p.value)} (${terbilangRupiah(p.value).toLowerCase()}), belum termasuk Pajak Pertambahan Nilai (PPN). Nilai Perjanjian ${billing}. ${p.paymentTerms?.trim() || "Pembayaran dilakukan paling lambat 30 (tiga puluh) hari setelah invoice diterima oleh Pihak Kedua"}, melalui transfer ke rekening ${L.bank}.` },
    { key: "obligationsFirst", title: "Kewajiban Pihak Pertama", body: `a. Menyediakan teknisi yang kompeten dan bersertifikat untuk melaksanakan pekerjaan.\nb. Menyerahkan laporan kunjungan${p.type === "Kalibrasi" ? " dan sertifikat kalibrasi" : ""} paling lambat 7 (tujuh) hari kerja setelah kunjungan.\nc. Menjaga kerahasiaan data dan informasi milik Pihak Kedua.\nd. Mematuhi peraturan keselamatan kerja yang berlaku di lokasi Pihak Kedua.` },
    { key: "obligationsSecond", title: "Kewajiban Pihak Kedua", body: "a. Memberikan akses ke lokasi dan peralatan pada jadwal yang disepakati.\nb. Menunjuk penanggung jawab (PIC) yang mendampingi teknisi selama pekerjaan.\nc. Mengoperasikan peralatan sesuai petunjuk penggunaan dari pabrikan.\nd. Melakukan pembayaran sesuai Pasal 4." },
    { key: "exclusions", title: "Pengecualian", body: "Perjanjian ini tidak mencakup: (a) kerusakan akibat kesalahan penggunaan, kelalaian, kecelakaan, atau bencana; (b) perbaikan atau modifikasi oleh pihak selain Pihak Pertama; (c) bahan habis pakai (consumable) seperti lampu, filter, elektroda, dan sejenisnya; (d) relokasi peralatan." },
    { key: "spareparts", title: "Suku Cadang", body: `Suku cadang yang diperlukan untuk perbaikan tidak termasuk dalam Nilai Perjanjian dan akan ditawarkan terlebih dahulu kepada Pihak Kedua${p.sparePartDiscount ? ` dengan potongan harga sebesar ${p.sparePartDiscount}% (persen) dari harga daftar` : ""}. Penggantian suku cadang hanya dilakukan setelah mendapat persetujuan tertulis dari Pihak Kedua.` },
    { key: "forcemajeure", title: "Keadaan Kahar (Force Majeure)", locked: true, body: "Para Pihak dibebaskan dari tanggung jawab atas keterlambatan atau kegagalan pelaksanaan kewajiban yang disebabkan oleh keadaan kahar, antara lain bencana alam, kebakaran, wabah, huru-hara, perang, atau kebijakan pemerintah, dengan ketentuan Pihak yang mengalaminya memberitahukan secara tertulis kepada Pihak lainnya paling lambat 7 (tujuh) hari kalender sejak keadaan kahar terjadi." },
    { key: "termination", title: "Pengakhiran Perjanjian", locked: true, body: "Perjanjian ini dapat diakhiri sebelum jangka waktunya berakhir apabila salah satu Pihak melanggar ketentuan Perjanjian dan tidak memperbaikinya dalam waktu 30 (tiga puluh) hari setelah menerima teguran tertulis dari Pihak lainnya. Pembayaran atas pekerjaan yang telah dilaksanakan sampai tanggal pengakhiran tetap menjadi kewajiban Pihak Kedua." },
    { key: "dispute", title: "Penyelesaian Perselisihan", locked: true, body: `Segala perselisihan yang timbul dari Perjanjian ini akan diselesaikan secara musyawarah untuk mufakat. Apabila musyawarah tidak mencapai mufakat dalam waktu 30 (tiga puluh) hari, Para Pihak sepakat memilih domisili hukum yang tetap di Kepaniteraan ${L.jurisdiction}.` },
    { key: "closing", title: "Penutup", locked: true, body: "Hal-hal yang belum diatur dalam Perjanjian ini akan diatur kemudian dalam addendum yang merupakan bagian tidak terpisahkan dari Perjanjian ini. Perjanjian ini dibuat dalam rangkap 2 (dua) asli, masing-masing bermeterai cukup dan mempunyai kekuatan hukum yang sama." },
  ];
  // Kontrak servis on-call tidak memakai Lampiran jadwal kunjungan.
  return clauses;
}

/** Kunjungan merata dalam periode kontrak, mis. 2×/tahun → bulan ke-6 dan ke-12. */
export function visitSchedule(startDate: string, endDate: string, visitsPerYear?: number | null) {
  if (!visitsPerYear) return [];
  const start = new Date(startDate + "T00:00:00").getTime();
  const end = new Date(endDate + "T00:00:00").getTime();
  const years = Math.max(1, Math.round((end - start) / (365 * 864e5)));
  const n = visitsPerYear * years;
  return Array.from({ length: n }, (_, i) => new Date(start + ((end - start) * (i + 1)) / n - 15 * 864e5).toISOString().split("T")[0]);
}
