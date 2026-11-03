import { prisma } from "@/lib/prisma";
import { rupiah } from "../lib";

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

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const tanggal = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
};

/** Data siap cetak — dipakai bersama oleh renderer PDF dan Word. */
export async function loadQuotationDoc(id: string) {
  const q = await prisma.quotation.findUnique({ where: { id }, include: { customer: true, items: { orderBy: { sortOrder: "asc" } } } });
  if (!q) return null;
  const sales = await prisma.user.findFirst({ where: { name: q.salesName }, select: { phone: true, email: true } });
  const draft = ["Draft", "Waiting Approval"].includes(q.status);
  return {
    draft,
    number: q.revision ? `${q.quotationNo} Rev.${q.revision}` : q.quotationNo,
    fileName: `Penawaran ${q.quotationNo.replace(/\//g, "-")}${q.revision ? ` Rev${q.revision}` : ""} - ${q.customer.name}`.replace(/[\\/:*?"<>|]/g, ""),
    date: tanggal(q.date),
    validUntil: tanggal(q.validUntil),
    subject: q.subject,
    customer: { name: q.customer.name, address: q.customer.address, city: q.customer.city },
    attention: q.attention,
    intro: q.introText ?? "",
    closing: q.closingText ?? "",
    items: q.items.map((it, i) => ({
      no: i + 1, description: it.description, specs: it.specs, qty: `${it.qty.toLocaleString("id-ID")} ${it.unit}`,
      unitPrice: rupiah(it.unitPrice), discount: it.discountPercent > 0 ? `Diskon ${it.discountPercent}%` : null, lineTotal: rupiah(it.lineTotal),
    })),
    totals: [
      ["Subtotal", rupiah(q.subtotal)],
      ...(q.discountAmount > 0 ? [[`Diskon ${q.discountPercent}%`, `− ${rupiah(q.discountAmount)}`]] : []),
      [`PPN ${q.taxPercent}%`, rupiah(q.taxAmount)],
    ] as [string, string][],
    total: rupiah(q.total),
    totalWords: `${terbilang(q.total)} rupiah`.replace(/^./, c => c.toUpperCase()),
    terms: [
      ["Pembayaran", q.paymentTerms],
      ["Pengiriman", q.deliveryTerms],
      ["Garansi", q.warrantyTerms],
      ["Masa berlaku", `Penawaran berlaku sampai ${tanggal(q.validUntil)}.`],
    ].filter((t): t is [string, string] => !!t[1]),
    signer: { name: q.salesName, title: "Sales Engineer", contact: [sales?.phone, sales?.email].filter(Boolean).join(" · ") },
    approver: q.approvedBy ? { name: q.approvedBy, title: "Sales Manager" } : null,
  };
}

export type QuotationDoc = NonNullable<Awaited<ReturnType<typeof loadQuotationDoc>>>;
