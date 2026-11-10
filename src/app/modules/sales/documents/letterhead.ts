/**
 * Identitas pada kop & footer dokumen. SEMUA DATA DI SINI MASIH DUMMY —
 * ganti dengan alamat/kontak resmi dan logo di assets/brand/lpi-logo.png.
 */
export const LETTERHEAD = {
  company: "PT LABTECH PENTA INTERNATIONAL",
  tagline: "Technical & Vocational Training Equipment · Manufacturing · Installation · Training",
  address: "Gedung Contoh Lt. 5, Jl. Placeholder Raya No. 10, Jakarta Selatan 12345",
  phone: "(021) 000-0000",
  email: "sales@contoh-labtech.co.id",
  website: "www.contoh-labtech.co.id",
  npwp: "00.000.000.0-000.000",
  city: "Jakarta",
  bank: "Bank Contoh · No. Rek. 000-000-0000 · a.n. PT Labtech Penta International",
  /** Rekening valuta asing untuk pembayaran ekspor / L/C (dummy). */
  bankIntl: "Bank Contoh, Batam Branch · SWIFT CONTIDJA · USD Account 000-000-0001 · Beneficiary: PT Labtech Penta International",
  /** Pabrik & pelabuhan muat untuk dokumen ekspor (dummy). */
  factory: "Kawasan Industri Contoh, Batam, Riau Islands, Indonesia",
  portOfLoading: "Batu Ampar, Batam, Indonesia",
  /** Penandatangan dari pihak Labtech (dummy). */
  signatories: {
    director: { name: "Budi Santoso", title: "Direktur" },
    finance: { name: "Sari Lestari", title: "Finance Manager" },
    service: { name: "Yusuf Maulana", title: "Service Manager" },
    sales: { name: "Hendra Wijaya", title: "Sales Manager" },
    shipping: { name: "Rudi Hartono", title: "Logistics & Export Manager" },
    training: { name: "Yusuf Maulana", title: "Training & Service Manager" },
  },
  /** Domisili hukum pada perjanjian (dummy). */
  jurisdiction: "Pengadilan Negeri Jakarta Selatan",
  colors: { primary: "#0B3B66", accent: "#14B8A6", text: "#1E293B", muted: "#64748B", line: "#CBD5E1", soft: "#F1F5F9" },
};

/** Kop default (Labtech) dalam bentuk DocBrand. */
export const DEFAULT_BRAND = { ...LETTERHEAD, logoFile: "brand/lpi-logo.png" };
