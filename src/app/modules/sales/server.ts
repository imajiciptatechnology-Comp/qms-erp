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
export async function nextDocNo(kind: "QUO" | "SO" | "INV" | "CTR" | "KWT" | "SPP" | "SHP" | "SVC" | "TKT", date: string) {
  const prefix = `LPI/${kind}/${date.slice(0, 4)}/`;
  const where = { startsWith: prefix };
  const rows: { no: string }[] =
    kind === "KWT" ? (await prisma.payment.findMany({ where: { receiptNo: where }, select: { receiptNo: true } })).map(r => ({ no: r.receiptNo ?? "" }))
    : kind === "SPP" ? (await prisma.paymentReminder.findMany({ where: { letterNo: where }, select: { letterNo: true } })).map(r => ({ no: r.letterNo }))
    : kind === "QUO" ? (await prisma.quotation.findMany({ where: { quotationNo: where }, select: { quotationNo: true } })).map(r => ({ no: r.quotationNo }))
    : kind === "SO" ? (await prisma.salesOrder.findMany({ where: { soNo: where }, select: { soNo: true } })).map(r => ({ no: r.soNo }))
    : kind === "INV" ? (await prisma.invoice.findMany({ where: { invoiceNo: where }, select: { invoiceNo: true } })).map(r => ({ no: r.invoiceNo }))
    : kind === "SHP" ? (await prisma.salesShipment.findMany({ where: { shipmentNo: where }, select: { shipmentNo: true } })).map(r => ({ no: r.shipmentNo }))
    : kind === "SVC" ? (await prisma.serviceJob.findMany({ where: { jobNo: where }, select: { jobNo: true } })).map(r => ({ no: r.jobNo }))
    : kind === "TKT" ? (await prisma.serviceTicket.findMany({ where: { ticketNo: where }, select: { ticketNo: true } })).map(r => ({ no: r.ticketNo }))
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

/**
 * BAST instalasi & training: SO In Delivery → Installed, simpan nomor seri, lalu buat kontrak
 * garansi otomatis untuk alat yang bergaransi. Dipanggil dari modul Training & Customer Service.
 */
export async function completeInstallation(userName: string, salesOrderId: string, data: { bastNo: string; bastDate: string; serials: Record<string, string> }) {
  if (!data.bastNo?.trim() || !data.bastDate) throw new Error("Nomor dan tanggal BAST wajib diisi.");
  const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId }, include: { items: true } });
  if (so.status !== "In Delivery") throw new Error(`BAST hanya untuk order yang sudah dikirim (status sekarang: ${so.status}).`);

  const ops = so.items
    .filter(it => data.serials[it.id] !== undefined)
    .map(it => prisma.salesOrderItem.update({ where: { id: it.id }, data: { serialNumbers: data.serials[it.id] || null } }));
  ops.push(prisma.salesOrder.update({ where: { id: so.id }, data: {
    status: "Installed", bastNo: data.bastNo, bastDate: data.bastDate, installationDate: data.bastDate,
    historyJson: addHistory(so.historyJson, userName, `Status: In Delivery → Installed (BAST ${data.bastNo})`),
  } }) as never);
  await prisma.$transaction(ops);

  const productIds = so.items.map(i => i.productId).filter(Boolean) as string[];
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, warrantyMonths: { gt: 0 } } });
  if (!products.length) return;
  const months = Math.max(...products.map(p => p.warrantyMonths));
  const end = new Date(data.bastDate);
  end.setMonth(end.getMonth() + months);
  const covered = so.items
    .filter(i => products.some(p => p.id === i.productId))
    .map(i => ({ product: i.description, serialNumber: data.serials[i.id] || i.serialNumbers || "-" }));
  await prisma.contract.create({ data: {
    contractNo: await nextDocNo("CTR", data.bastDate), customerId: so.customerId, salesOrderId: so.id, type: "Garansi",
    title: `Garansi ${so.soNo}`, startDate: data.bastDate, endDate: end.toISOString().split("T")[0], value: 0, status: "Active",
    coveredItemsJson: JSON.stringify(covered), createdAt: today(), historyJson: firstHistory(userName, `Dibuat otomatis dari BAST ${data.bastNo}`),
  } });
}

// ---------------------------------------------------------
// Dashboard Persetujuan (semua persetujuan Labtech di satu tempat)
// ---------------------------------------------------------

export type ApprovalItem = {
  kind: "quotation" | "contract" | "shipment" | "service-job" | "sales-order";
  id: string; ref: string; customer: string; title: string; detail: string; requestedBy: string | null;
  /** Tanggal pengajuan / batas keputusan (YYYY-MM-DD). */
  date: string | null; dueDate?: string | null; amount?: number | null; href: string;
  /** false = cukup dibuka (mis. contract review SO), tidak diputuskan dari dashboard. */
  decidable: boolean;
};

export async function getApprovalQueue(): Promise<ApprovalItem[]> {
  const [quotations, contracts, shipments, jobs, orders] = await Promise.all([
    prisma.quotation.findMany({ where: { status: "Waiting Approval" }, include: { customer: { select: { name: true } } }, orderBy: { date: "asc" } }),
    prisma.contract.findMany({ where: { status: "Waiting Approval" }, include: { customer: { select: { name: true } } }, orderBy: { approvalDueDate: "asc" } }),
    prisma.salesShipment.findMany({ where: { exceptionStatus: "Waiting Approval" }, include: { customer: { select: { name: true } }, salesOrder: { include: { invoices: { select: { status: true, paidAmount: true } } } } }, orderBy: { createdAt: "asc" } }),
    prisma.serviceJob.findMany({ where: { status: "Waiting Approval" }, include: { customer: { select: { name: true } }, salesOrder: { select: { soNo: true } } }, orderBy: { startDate: "asc" } }),
    prisma.salesOrder.findMany({ where: { status: "Contract Review" }, include: { customer: { select: { name: true } } }, orderBy: { orderDate: "asc" } }),
  ]);
  const maxDisc = (q: { discountPercent: number }) => q.discountPercent;
  return [
    ...quotations.map(q => ({
      kind: "quotation" as const, id: q.id, ref: `${q.quotationNo} Rev.${q.revision}`, customer: q.customer.name, title: "Diskon penawaran di atas batas",
      detail: `${q.subject} · diskon ${maxDisc(q)}%`, requestedBy: q.salesName, date: q.date, amount: q.total, href: `/modules/sales/quotations/${q.id}`, decidable: true,
    })),
    ...contracts.map(c => ({
      kind: "contract" as const, id: c.id, ref: c.contractNo, customer: c.customer.name, title: `Kontrak ${c.type}`,
      detail: c.title, requestedBy: null, date: c.createdAt, dueDate: c.approvalDueDate, amount: c.value, href: `/modules/contract-shipping/contracts/${c.id}`, decidable: true,
    })),
    ...shipments.map(s => {
      const paid = s.salesOrder.invoices.filter(i => i.status !== "Cancelled").reduce((t, i) => t + i.paidAmount, 0);
      return {
        kind: "shipment" as const, id: s.id, ref: s.shipmentNo, customer: s.customer.name, title: "Izin kirim sebelum lunas",
        detail: `${s.salesOrder.soNo} · sisa Rp ${Math.max(0, Math.round(s.salesOrder.total - paid)).toLocaleString("id-ID")} · alasan: ${s.exceptionReason ?? "-"}`,
        requestedBy: s.exceptionRequestedBy, date: s.createdAt, amount: s.salesOrder.total, href: `/modules/contract-shipping/shipments/${s.id}`, decidable: true,
      };
    }),
    ...jobs.map(j => ({
      kind: "service-job" as const, id: j.id, ref: j.jobNo, customer: j.customer.name, title: `Jadwal ${j.type.toLowerCase()}`,
      detail: `${j.startDate ?? "?"} s/d ${j.endDate ?? "?"} · ${j.mode}${j.location ? ` · ${j.location}` : ""}${j.trainerName ? ` · trainer ${j.trainerName}` : ""}${j.salesOrder ? ` · ${j.salesOrder.soNo}` : ""}`,
      requestedBy: j.createdBy, date: j.startDate, href: `/modules/customer-service/jobs/${j.id}`, decidable: true,
    })),
    ...orders.map(o => ({
      kind: "sales-order" as const, id: o.id, ref: o.soNo, customer: o.customer.name, title: "PO masuk — contract review & konfirmasi",
      detail: `PO ${o.customerPoNo}`, requestedBy: o.salesName, date: o.orderDate, amount: o.total, href: `/modules/sales/orders/${o.id}`, decidable: false,
    })),
  ];
}

/** Jumlah yang menunggu keputusan (badge tab Approvals). */
export async function countPendingApprovals() {
  const [q, c, s, j] = await Promise.all([
    prisma.quotation.count({ where: { status: "Waiting Approval" } }),
    prisma.contract.count({ where: { status: "Waiting Approval" } }),
    prisma.salesShipment.count({ where: { exceptionStatus: "Waiting Approval" } }),
    prisma.serviceJob.count({ where: { status: "Waiting Approval" } }),
  ]);
  return q + c + s + j;
}
