// Helper server untuk modul Sales yang dipakai server actions DAN AI Assistant.
// Sengaja bukan file "use server": fungsi di sini tidak boleh bisa dipanggil langsung dari browser.
import { prisma } from "@/lib/prisma";
import { STAGE_PROBABILITY, TAX_PERCENT, computeTotals, lineTotal, today, type LineInput } from "./lib";

export function addHistory(json: string, userName: string, action: string) {
  const list = JSON.parse(json || "[]");
  list.push({ id: String(list.length + 1), date: new Date().toISOString(), userName, action });
  return JSON.stringify(list);
}
export const firstHistory = (userName: string, action: string) => addHistory("[]", userName, action);

/** Nomor berikutnya: LPI/QUO/2026/11/0009 — urut per tahun per jenis dokumen. */
export async function nextDocNo(kind: "QUO" | "SO" | "INV" | "CTR", date: string) {
  const prefix = `LPI/${kind}/${date.slice(0, 4)}/`;
  const where = { startsWith: prefix };
  const rows: { no: string }[] =
    kind === "QUO" ? (await prisma.quotation.findMany({ where: { quotationNo: where }, select: { quotationNo: true } })).map(r => ({ no: r.quotationNo }))
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

/** Simpan penawaran baru berstatus Draft (+ majukan opportunity Lead/Qualified ke tahap Quotation). */
export async function insertDraftQuotation(userName: string, data: QuotationInput, historyAction = "Penawaran dibuat") {
  const { fields, items } = quotationData(data);
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
