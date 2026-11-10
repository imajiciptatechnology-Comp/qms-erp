"use server";

// Nota kredit (pengurang tagihan) & target penjualan.
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { money, roundMoney, today } from "./lib";
import { addHistory } from "./server";
import { guardAny, run } from "./serverGuard";

/**
 * Terbitkan nota kredit atas invoice: DPP + PPN proporsional sesuai tarif invoice.
 * Dicatat juga sebagai Payment bermetode "Nota Kredit" agar sisa tagihan, status lunas,
 * dan gerbang pelunasan pengiriman otomatis ikut berkurang.
 */
export async function createCreditNote(invoiceId: string, data: { date: string; subtotal: number; reason: string }) {
  return run(async () => {
    const user = await guardAny("canFinance");
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (["Paid", "Cancelled"].includes(inv.status)) throw new Error("Nota kredit hanya untuk invoice yang belum lunas.");
    if (!data.reason?.trim()) throw new Error("Alasan nota kredit wajib diisi.");
    if (!data.date) throw new Error("Tanggal wajib diisi.");
    const subtotal = roundMoney(Number(data.subtotal), inv.currency);
    if (!(subtotal > 0)) throw new Error("Nilai nota kredit tidak valid.");
    const taxAmount = roundMoney(subtotal * inv.taxPercent / 100, inv.currency);
    const total = roundMoney(subtotal + taxAmount, inv.currency);
    const remaining = roundMoney(inv.total - inv.paidAmount, inv.currency);
    if (total > remaining + (inv.currency === "IDR" ? 0.5 : 0.005)) throw new Error(`Nota kredit (${money(total, inv.currency)} termasuk PPN) melebihi sisa tagihan ${money(remaining, inv.currency)}.`);

    // Nomor urut per tahun: LPI/CN/2026/11/0001.
    const year = data.date.slice(0, 4);
    const existing = await prisma.creditNote.findMany({ where: { creditNoteNo: { startsWith: `LPI/CN/${year}/` } }, select: { creditNoteNo: true } });
    const seq = existing.reduce((m, r) => Math.max(m, Number(r.creditNoteNo.split("/").pop()) || 0), 0) + 1;
    const no = `LPI/CN/${year}/${data.date.slice(5, 7)}/${String(seq).padStart(4, "0")}`;

    const paidAmount = roundMoney(inv.paidAmount + total, inv.currency);
    const status = paidAmount >= inv.total - (inv.currency === "IDR" ? 0.5 : 0.005) ? "Paid" : "Partial";
    // Transaksi batch (bukan interactive): interactive transaction sering lewat batas 5 detik di pooler Supabase.
    const paymentId = randomUUID();
    const cnId = randomUUID();
    await prisma.$transaction([
      prisma.payment.create({ data: { id: paymentId, invoiceId, paymentDate: data.date, amount: total, method: "Nota Kredit", reference: no, receivedBy: user.name, createdAt: today() } }),
      prisma.creditNote.create({ data: {
        id: cnId, creditNoteNo: no, invoiceId, customerId: inv.customerId, date: data.date, reason: data.reason.trim(), subtotal, taxAmount, total,
        currency: inv.currency, paymentId, createdBy: user.name, createdAt: today(),
      } }),
      prisma.invoice.update({ where: { id: invoiceId }, data: { paidAmount, status, historyJson: addHistory(inv.historyJson, user.name, `Nota kredit ${no}: ${money(total, inv.currency)} (${data.reason.trim()})`) } }),
    ]);
    return cnId;
  });
}

/** Simpan target bulanan (Rupiah) satu tahun untuk tim ("") atau satu sales. */
export async function saveSalesTargets(year: number, salesName: string, amounts: number[]) {
  return run(async () => {
    const user = await guardAny("canApprove");
    if (!(year >= 2020 && year <= 2100) || amounts.length !== 12) throw new Error("Data target tidak valid.");
    if (amounts.some(a => !(a >= 0))) throw new Error("Target tidak boleh negatif.");
    await prisma.$transaction(amounts.map((amount, i) => prisma.salesTarget.upsert({
      where: { year_month_salesName: { year, month: i + 1, salesName } },
      update: { amount, updatedBy: user.name, updatedAt: today() },
      create: { year, month: i + 1, salesName, amount, updatedBy: user.name, updatedAt: today() },
    })));
  });
}
