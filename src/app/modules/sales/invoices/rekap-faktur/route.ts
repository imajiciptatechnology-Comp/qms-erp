import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { salesAccess } from "../../lib";

export const runtime = "nodejs";

/**
 * GET /modules/sales/invoices/rekap-faktur?month=2026-11 — rekap invoice ber-PPN + nota kredit satu bulan (CSV, pemisah ";")
 * sebagai bahan input faktur pajak di Coretax. BUKAN file impor resmi Coretax/e-Faktur: kolom disusun untuk
 * dicek & disalin bagian pajak. Nilai valuta asing dikonversi ke Rupiah dengan kurs pada invoice.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Tidak ada akses.", { status: 403 });
  const access = salesAccess(user, await getRolesConfig());
  if (!access.canFinance) return new Response("Tidak ada akses.", { status: 403 });

  const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Format bulan: YYYY-MM.", { status: 400 });

  const [invoices, notes] = await Promise.all([
    prisma.invoice.findMany({
      where: { invoiceDate: { startsWith: month }, status: { not: "Cancelled" } },
      include: { customer: true, salesOrder: { select: { soNo: true, customerPoNo: true } } },
      orderBy: { invoiceDate: "asc" },
    }),
    prisma.creditNote.findMany({ where: { date: { startsWith: month } }, include: { customer: true, invoice: true }, orderBy: { date: "asc" } }),
  ]);

  const head = ["Jenis", "No. dokumen", "Tanggal", "No. faktur pajak", "NPWP pembeli", "Nama pembeli", "Alamat pembeli", "Negara", "Referensi", "Mata uang", "Kurs", "DPP", "PPN %", "PPN", "Total", "DPP (Rp)", "PPN (Rp)", "Keterangan"];
  const idr = (n: number, rate: number, cur: string) => Math.round(cur === "IDR" ? n : n * rate);
  const rows: (string | number)[][] = [
    ...invoices.map(i => [
      i.taxPercent > 0 ? "Faktur keluaran" : "Ekspor (PPN 0%)", i.invoiceNo, i.invoiceDate, i.fakturPajakNo ?? "", i.customer.npwp ?? "", i.customer.name, i.customer.address ?? "", i.customer.country,
      i.salesOrder ? `PO ${i.salesOrder.customerPoNo} / ${i.salesOrder.soNo}` : i.termLabel, i.currency, i.exchangeRate, i.subtotal, i.taxPercent, i.taxAmount, i.total,
      idr(i.subtotal, i.exchangeRate, i.currency), idr(i.taxAmount, i.exchangeRate, i.currency), i.termLabel,
    ]),
    ...notes.map(n => [
      "Nota kredit / retur", n.creditNoteNo, n.date, n.invoice.fakturPajakNo ?? "", n.customer.npwp ?? "", n.customer.name, n.customer.address ?? "", n.customer.country,
      `Atas ${n.invoice.invoiceNo}`, n.currency, n.invoice.exchangeRate, -n.subtotal, n.invoice.taxPercent, -n.taxAmount, -n.total,
      -idr(n.subtotal, n.invoice.exchangeRate, n.currency), -idr(n.taxAmount, n.invoice.exchangeRate, n.currency), n.reason,
    ]),
  ];
  const cell = (v: string | number) => {
    const s = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM + ";" agar langsung terbaca benar di Excel berlocale Indonesia.
  const csv = "﻿" + [head, ...rows].map(r => r.map(cell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Rekap-Faktur-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
