// Helper server untuk modul Sales yang dipakai server actions DAN AI Assistant.
// Sengaja bukan file "use server": fungsi di sini tidak boleh bisa dipanggil langsung dari browser.
import { prisma } from "@/lib/prisma";
import { DEFAULT_TEXT, STAGE_PROBABILITY, TAX_PERCENT, computeTotals, lineTotal, today, type LineInput } from "./lib";

export function addHistory(json: string, userName: string, action: string) {
  const list = JSON.parse(json || "[]");
  list.push({ id: String(list.length + 1), date: new Date().toISOString(), userName, action });
  return JSON.stringify(list);
}
export const firstHistory = (userName: string, action: string) => addHistory("[]", userName, action);

/** Nomor berikutnya: LPI/QUO/2026/11/0009 — urut per tahun per jenis dokumen. */
export async function nextDocNo(kind: "QUO" | "SO" | "INV" | "CTR" | "KWT" | "SPP", date: string) {
  const prefix = `LPI/${kind}/${date.slice(0, 4)}/`;
  const where = { startsWith: prefix };
  const rows: { no: string }[] =
    kind === "KWT" ? (await prisma.payment.findMany({ where: { receiptNo: where }, select: { receiptNo: true } })).map(r => ({ no: r.receiptNo ?? "" }))
    : kind === "SPP" ? (await prisma.paymentReminder.findMany({ where: { letterNo: where }, select: { letterNo: true } })).map(r => ({ no: r.letterNo }))
    : kind === "QUO" ? (await prisma.quotation.findMany({ where: { quotationNo: where }, select: { quotationNo: true } })).map(r => ({ no: r.quotationNo }))
    : kind === "SO" ? (await prisma.salesOrder.findMany({ where: { soNo: where }, select: { soNo: true } })).map(r => ({ no: r.soNo }))
    : kind === "INV" ? (await prisma.invoice.findMany({ where: { invoiceNo: where }, select: { invoiceNo: true } })).map(r => ({ no: r.invoiceNo }))
    : (await prisma.contract.findMany({ where: { contractNo: where }, select: { contractNo: true } })).map(r => ({ no: r.contractNo }));
  const max = rows.reduce((m, r) => Math.max(m, Number(r.no.split("/").pop()) || 0), 0);
  return `${prefix}${date.slice(5, 7)}/${String(max + 1).padStart(4, "0")}`;
}

export type QuotationInput = {
  customerId: string; opportunityId?: string | null; date: string; validUntil: string; subject: string; attention?: string;
  introText?: string; closingText?: string; discountPercent: number; paymentTerms?: string; deliveryTerms?: string;
  warrantyTerms?: string; notes?: string; items: LineInput[];
};

export function quotationData(data: QuotationInput) {
  if (!data.customerId) throw new Error("Pilih customer.");
  if (!data.subject?.trim()) throw new Error("Perihal penawaran wajib diisi.");
  const items = data.items.filter(i => i.description?.trim());
  if (items.length === 0) throw new Error("Tambahkan minimal satu item.");
  if (items.some(i => !(i.qty > 0) || !(i.unitPrice >= 0))) throw new Error("Jumlah dan harga item harus valid.");
  const { items: _items, ...rest } = data; // eslint-disable-line @typescript-eslint/no-unused-vars
  return {
    fields: { ...rest, opportunityId: data.opportunityId || null, taxPercent: TAX_PERCENT, ...computeTotals(items, data.discountPercent) },
    items: items.map((i, idx) => ({
      productId: i.productId || null, description: i.description, specs: i.specs || null, qty: i.qty, unit: i.unit,
      unitPrice: i.unitPrice, discountPercent: i.discountPercent || 0, lineTotal: lineTotal(i), sortOrder: idx + 1,
    })),
  };
}

/**
 * Kolom teks surat yang dibiarkan kosong di form diisi teks baku yang sesuai konteks:
 * pembuka menyebut alat yang ditawarkan, syarat bayar mengikuti termin customer.
 */
export async function fillQuotationDefaults(data: QuotationInput): Promise<QuotationInput> {
  const blank = (v?: string | null) => !v || !v.trim();
  if (![data.introText, data.closingText, data.paymentTerms, data.deliveryTerms, data.warrantyTerms].some(blank)) return data;
  const customer = await prisma.customer.findUnique({ where: { id: data.customerId }, select: { paymentTerms: true } });
  const names = [...new Set(data.items.filter(i => i.description?.trim() && !/^(Jasa|Instalasi|Kontrak)/i.test(i.description)).map(i => i.description.split(" — ")[0].trim()))];
  const topic = names.length > 1 ? `${names.slice(0, -1).join(", ")} dan ${names[names.length - 1]}` : names[0] ?? "";
  const terms = customer?.paymentTerms ?? "30 hari";
  return {
    ...data,
    introText: blank(data.introText) ? DEFAULT_TEXT.intro(topic) : data.introText,
    closingText: blank(data.closingText) ? DEFAULT_TEXT.closing : data.closingText,
    paymentTerms: blank(data.paymentTerms)
      ? (/\d/.test(terms) ? `DP 30% setelah PO diterima; 70% setelah BAST instalasi. Pembayaran ${terms} setelah invoice diterima.` : `${terms}.`)
      : data.paymentTerms,
    deliveryTerms: blank(data.deliveryTerms) ? DEFAULT_TEXT.delivery : data.deliveryTerms,
    warrantyTerms: blank(data.warrantyTerms) ? DEFAULT_TEXT.warranty : data.warrantyTerms,
  };
}

/** Simpan penawaran baru berstatus Draft (+ majukan opportunity Lead/Qualified ke tahap Quotation). */
export async function insertDraftQuotation(userName: string, data: QuotationInput, historyAction = "Penawaran dibuat") {
  const { fields, items } = quotationData(await fillQuotationDefaults(data));
  const created = await prisma.quotation.create({ data: {
    ...fields, quotationNo: await nextDocNo("QUO", data.date), revision: 0, status: "Draft",
    salesName: userName, createdBy: userName, createdAt: today(), historyJson: firstHistory(userName, historyAction),
    items: { create: items },
  } });
  if (data.opportunityId) {
    const opp = await prisma.opportunity.findUnique({ where: { id: data.opportunityId } });
    if (opp && ["Lead", "Qualified"].includes(opp.stage)) {
      await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: "Quotation", probability: STAGE_PROBABILITY.Quotation, historyJson: addHistory(opp.historyJson, userName, `Tahap: ${opp.stage} → Quotation (penawaran ${created.quotationNo})`) } });
    }
  }
  return created;
}
