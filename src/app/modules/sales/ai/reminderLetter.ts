// Surat pengingat pembayaran: AI menulis isi surat; nomor, angka & tingkat peringatan dari data.
import { prisma } from "@/lib/prisma";
import { aiComplete, parseAiJson } from "@/lib/ai";
import { daysBetween, rupiah, today } from "../lib";
import { tanggal } from "../documents/format";

export const REMINDER_LEVELS = ["", "Pengingat", "Peringatan", "Peringatan terakhir"];

/** Tingkat 1: ≤30 hari lewat, 2: 31–60 hari, 3: >60 hari — dan selalu naik dari surat sebelumnya (maks. 3). */
export function reminderLevel(daysOverdue: number, previous: number) {
  const byDays = daysOverdue > 60 ? 3 : daysOverdue > 30 ? 2 : 1;
  return Math.min(3, Math.max(byDays, previous + 1));
}

export async function generateReminderLetter(invoiceId: string, deadline?: number) {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true, salesOrder: { select: { customerPoNo: true, soNo: true } }, payments: true, reminders: { orderBy: { date: "asc" } } },
  });
  if (!inv) throw new Error("Invoice tidak ditemukan.");
  if (["Paid", "Cancelled"].includes(inv.status)) throw new Error("Invoice ini sudah lunas/dibatalkan.");
  const overdue = daysBetween(inv.dueDate, today());
  if (overdue <= 0) throw new Error("Invoice ini belum lewat jatuh tempo.");
  const level = reminderLevel(overdue, inv.reminders.length);

  // Riwayat bayar customer membantu menentukan nada (customer yang biasanya tepat waktu → lebih lunak).
  const history = await prisma.invoice.findMany({ where: { customerId: inv.customerId, status: "Paid", id: { not: inv.id } }, include: { payments: true }, take: 10 });
  const lateCount = history.filter(h => h.payments.some(p => p.paymentDate > h.dueDate)).length;

  const system = `Kamu staf Finance PT Labtech Penta International. Tulis ISI surat ${REMINDER_LEVELS[level].toLowerCase()} pembayaran dalam Bahasa Indonesia formal dan sopan untuk customer B2B (instansi/perusahaan).
Tingkat ${level} dari 3: ${level === 1 ? "pengingat ramah, asumsikan kelalaian administratif" : level === 2 ? "lebih tegas, minta konfirmasi tanggal pembayaran dalam 7 hari kerja" : "peringatan terakhir, sebutkan bahwa layanan purna jual/pengiriman berikutnya dapat ditunda dan perkara dapat dibawa ke jalur sesuai perjanjian bila tidak ada pembayaran dalam 7 hari kerja"}.
Aturan: diawali "Dengan hormat,"; sebutkan nomor invoice, jatuh tempo, dan sisa tagihan PERSIS seperti data; jangan mengarang angka, tanggal, atau denda; 2–4 paragraf dipisah baris kosong; tanpa salam penutup/tanda tangan (sudah ada di template); jangan menyebut rekening (sudah ada di template).
Jawab HANYA JSON: {"subject": string, "body": string}`;
  const user = JSON.stringify({
    customer: inv.customer.name, kontak: inv.customer.contactName,
    invoice: { nomor: inv.invoiceNo, keterangan: inv.termLabel, poCustomer: inv.salesOrder?.customerPoNo ?? null, tanggal: tanggal(inv.invoiceDate), jatuhTempo: tanggal(inv.dueDate), total: rupiah(inv.total), sudahDibayar: rupiah(inv.paidAmount), sisa: rupiah(inv.total - inv.paidAmount) },
    hariTerlambat: overdue,
    suratSebelumnya: inv.reminders.map(r => ({ nomor: r.letterNo, tanggal: tanggal(r.date), tingkat: REMINDER_LEVELS[r.level] })),
    riwayatCustomer: `${history.length} invoice lunas sebelumnya, ${lateCount} di antaranya dibayar terlambat`,
  });

  const { text, model } = await aiComplete([{ role: "system", content: system }, { role: "user", content: user }], {
    json: true, maxTokens: 4096, temperature: 0.4, reasoningEffort: "low", deadline: deadline ?? Date.now() + 50_000,
  });
  const ans = parseAiJson<{ subject?: string; body?: string }>(text);
  const body = (ans.body ?? "").trim();
  if (body.length < 80) throw new Error("AI tidak menghasilkan isi surat yang memadai. Coba lagi.");
  return {
    level,
    subject: (ans.subject ?? "").trim() || `${REMINDER_LEVELS[level]} Pembayaran Invoice ${inv.invoiceNo}`,
    body,
    model,
  };
}
