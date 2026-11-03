// Helper bersama modul Sales (aman dipakai di server & client).

export const TAX_PERCENT = 11;
/** Diskon di atas batas ini wajib disetujui Sales Manager. */
export const DISCOUNT_APPROVAL_LIMIT = 10;

export const PERM = {
  view: "sales",
  manage: "sales_manage",
  approve: "sales_approve",
  finance: "finance",
} as const;

export type SalesAccess = { canView: boolean; canManage: boolean; canApprove: boolean; canFinance: boolean };

export function salesAccess(user: { role: string } | null, rolesConfig: { name: string; permissions: string[] }[]): SalesAccess {
  const perms = rolesConfig.find(r => r.name === user?.role)?.permissions ?? [];
  const has = (p: string) => user?.role === "Super Admin" || perms.includes("all") || perms.includes(p);
  return { canView: has(PERM.view) || has(PERM.finance), canManage: has(PERM.manage), canApprove: has(PERM.approve), canFinance: has(PERM.finance) };
}

export const rupiah = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
/** Ringkas untuk kartu statistik: 1,25 M / 404,6 jt. */
export function rupiahShort(n: number) {
  if (Math.abs(n) >= 1e9) return `Rp ${(n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  if (Math.abs(n) >= 1e6) return `Rp ${(n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  return rupiah(n);
}

export const today = () => new Date().toISOString().split("T")[0];
export const addDays = (date: string, n: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};
export const daysBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 864e5);

/** Tambah n hari kerja (Senin-Jumat; hari libur nasional belum diperhitungkan). */
export function addBusinessDays(date: string, n: number) {
  const d = new Date(date + "T00:00:00Z");
  while (n > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) n--;
  }
  return d.toISOString().split("T")[0];
}

/** Batas waktu keputusan approval kontrak. */
export const CONTRACT_APPROVAL_BUSINESS_DAYS = 7;

/** Periode tagih kontrak: Upfront = 1x 100% di awal; Quarterly = 4x 25% per triwulan. */
export function contractBillingPeriods(c: { startDate: string; endDate: string; billingSchedule: string }) {
  if (c.billingSchedule !== "Quarterly") return [{ index: 0, label: `Periode ${c.startDate} s/d ${c.endDate}`, percent: 100, start: c.startDate }];
  const start = new Date(c.startDate).getTime();
  const span = new Date(c.endDate).getTime() - start;
  return [0, 1, 2, 3].map(i => {
    const s = new Date(start + (span * i) / 4).toISOString().split("T")[0];
    const e = new Date(start + (span * (i + 1)) / 4 - 864e5).toISOString().split("T")[0];
    return { index: i, label: `Triwulan ${i + 1} (${s} s/d ${e})`, percent: 25, start: s };
  });
}

export type LineInput = { productId?: string | null; description: string; specs?: string | null; qty: number; unit: string; unitPrice: number; discountPercent?: number };

export function lineTotal(l: LineInput) {
  return Math.round(l.qty * l.unitPrice * (1 - (l.discountPercent || 0) / 100));
}

export function computeTotals(lines: LineInput[], discountPercent = 0, taxPercent = TAX_PERCENT) {
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const discountAmount = Math.round(subtotal * discountPercent / 100);
  const taxAmount = Math.round((subtotal - discountAmount) * taxPercent / 100);
  return { subtotal, discountAmount, taxAmount, total: subtotal - discountAmount + taxAmount };
}

export function needsApproval(discountPercent: number, lines: { discountPercent?: number }[]) {
  return discountPercent > DISCOUNT_APPROVAL_LIMIT || lines.some(l => (l.discountPercent || 0) > DISCOUNT_APPROVAL_LIMIT);
}

/** Status turunan dari tanggal — tidak disimpan di database. */
export function invoiceState(inv: { status: string; dueDate: string }) {
  if (inv.status === "Paid" || inv.status === "Cancelled") return inv.status;
  return inv.dueDate < today() ? "Overdue" : inv.status;
}
export function contractState(c: { status: string; endDate: string }) {
  if (c.status !== "Active") return c.status;
  if (c.endDate < today()) return "Expired";
  return daysBetween(today(), c.endDate) <= 60 ? "Expiring" : "Active";
}

// Gaya bahasa baku penawaran (sama dengan data demo) — titik awal form & contoh untuk AI.
export const DEFAULT_TEXT = {
  intro: (topic: string) => `Dengan hormat,\n\nBersama surat ini, PT Labtech Penta International sebagai distributor resmi peralatan laboratorium dengan pengalaman lebih dari 15 tahun, dengan senang hati mengajukan penawaran harga untuk ${topic || "peralatan laboratorium"} sesuai kebutuhan Bapak/Ibu. Rincian spesifikasi dan harga kami sampaikan sebagai berikut.`,
  closing: "Harga sudah termasuk pengiriman sampai lokasi, instalasi, dan training operator, namun belum termasuk PPN. Kami siap melakukan presentasi teknis atau demo alat sesuai jadwal Bapak/Ibu.\n\nDemikian penawaran ini kami sampaikan. Atas perhatian dan kerja sama yang baik, kami ucapkan terima kasih.",
  payment: "DP 30% setelah PO diterima; 70% setelah BAST instalasi. Pembayaran 30 hari setelah invoice diterima.",
  delivery: "Franco lokasi customer. Barang ready: 2–3 minggu; barang indent: 8–12 minggu setelah PO.",
  warranty: "Garansi 12 bulan suku cadang dan jasa sejak BAST, termasuk 1× kalibrasi gratis pada bulan ke-11.",
};

export const STAGES =["Lead", "Qualified", "Quotation", "Negotiation", "Won", "Lost"] as const;
export const STAGE_PROBABILITY: Record<string, number> = { Lead: 10, Qualified: 25, Quotation: 40, Negotiation: 60, Won: 100, Lost: 0 };
export const CUSTOMER_TYPES = ["Universitas", "Rumah Sakit", "Farmasi", "Lab Pangan", "Pemerintah", "Industri"];
export const SOURCES = ["Tender", "Referensi", "Website", "Pameran", "Repeat Order"];
export const CONTRACT_TYPES = ["Garansi", "Service", "Kalibrasi", "AMC"];

export const PAYMENT_SCHEDULES: Record<string, { label: string; percent: number; trigger: string }[]> = {
  "DP 30% / 70%": [{ label: "DP 30%", percent: 30, trigger: "Setelah PO diterima" }, { label: "Pelunasan 70%", percent: 70, trigger: "Setelah BAST instalasi" }],
  "100% setelah BAST": [{ label: "Pembayaran 100%", percent: 100, trigger: "Setelah BAST" }],
  "30% / 60% / 10%": [{ label: "DP 30%", percent: 30, trigger: "Setelah PO diterima" }, { label: "Termin 60%", percent: 60, trigger: "Setelah barang diterima" }, { label: "Retensi 10%", percent: 10, trigger: "Setelah BAST instalasi" }],
};

export const CONTRACT_REVIEW_ITEMS = [
  "Spesifikasi & jumlah pada PO sesuai penawaran",
  "Harga, diskon, dan termin pembayaran disetujui",
  "Jadwal pengiriman dapat dipenuhi (stok/indent dicek)",
  "Kebutuhan instalasi, utilitas, dan training sudah jelas",
  "Persyaratan khusus (regulasi, kalibrasi, dokumen) teridentifikasi",
];

export const STATUS_COLORS: Record<string, string> = {
  // Penawaran
  Draft: "bg-slate-100 text-slate-700 border-slate-200",
  "Waiting Approval": "bg-amber-100 text-amber-800 border-amber-200",
  Approved: "bg-sky-100 text-sky-700 border-sky-200",
  Sent: "bg-blue-100 text-blue-700 border-blue-200",
  Accepted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-100 text-red-700 border-red-200",
  Superseded: "bg-slate-100 text-slate-500 border-slate-200",
  // Sales order
  "Contract Review": "bg-amber-100 text-amber-800 border-amber-200",
  Confirmed: "bg-sky-100 text-sky-700 border-sky-200",
  "In Delivery": "bg-blue-100 text-blue-700 border-blue-200",
  Installed: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  // Invoice
  Unpaid: "bg-slate-100 text-slate-700 border-slate-200",
  Partial: "bg-amber-100 text-amber-800 border-amber-200",
  Paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Overdue: "bg-red-100 text-red-700 border-red-200",
  // Kontrak
  Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Expiring: "bg-amber-100 text-amber-800 border-amber-200",
  Expired: "bg-red-100 text-red-700 border-red-200",
  Terminated: "bg-slate-100 text-slate-500 border-slate-200",
  Renewed: "bg-sky-100 text-sky-700 border-sky-200",
  // Pipeline
  Lead: "bg-slate-100 text-slate-700 border-slate-200",
  Qualified: "bg-sky-100 text-sky-700 border-sky-200",
  Quotation: "bg-blue-100 text-blue-700 border-blue-200",
  Negotiation: "bg-amber-100 text-amber-800 border-amber-200",
  Won: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Lost: "bg-red-100 text-red-700 border-red-200",
};
