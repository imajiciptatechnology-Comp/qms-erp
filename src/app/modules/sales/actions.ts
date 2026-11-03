"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getRolesConfig, type CurrentUser } from "@/app/actions/auth";
import { createNotificationForPermission } from "@/app/actions/notifications";
import { uploadToStorage } from "@/lib/uploadFile";
import { AiError } from "@/lib/ai";
import { generateQuotationDraft } from "./ai/draftQuotation";
import { CONTRACT_REVIEW_ITEMS, PAYMENT_SCHEDULES, PERM, STAGE_PROBABILITY, TAX_PERCENT, addDays, needsApproval, salesAccess, today } from "./lib";
import { addHistory, firstHistory, insertDraftQuotation, nextDocNo, quotationData, type QuotationInput } from "./server";

export type { QuotationInput } from "./server";

type Result = { success: true; id?: string } | { success: false; message: string };

// ---------------------------------------------------------
// Akses & utilitas
// ---------------------------------------------------------

/** Server action tidak terlindungi middleware: cek login & permission di setiap aksi. */
async function guard(need: "view" | "manage" | "approve" | "finance" = "view"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Silakan login terlebih dahulu.");
  const access = salesAccess(user, await getRolesConfig());
  const ok = { view: access.canView, manage: access.canManage, approve: access.canApprove, finance: access.canFinance }[need];
  if (!ok) throw new Error("Anda tidak punya akses untuk aksi ini.");
  return user;
}

async function run(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const id = await fn();
    revalidatePath("/modules/sales", "layout");
    return { success: true, id: id || undefined };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Terjadi kesalahan." };
  }
}

const termDays = (terms: string) => Number(terms.match(/\d+/)?.[0]) || 30;

// ---------------------------------------------------------
// Query
// ---------------------------------------------------------

export async function getSalesOverview() {
  await guard();
  const [opportunities, quotations, invoices, contracts, orders] = await Promise.all([
    prisma.opportunity.findMany({ include: { customer: { select: { name: true } } } }),
    prisma.quotation.findMany({ where: { status: "Waiting Approval" }, include: { customer: { select: { name: true } } }, orderBy: { date: "desc" } }),
    prisma.invoice.findMany({ where: { status: { in: ["Unpaid", "Partial"] } }, include: { customer: { select: { name: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.contract.findMany({ where: { status: "Active" }, include: { customer: { select: { name: true } } }, orderBy: { endDate: "asc" } }),
    prisma.salesOrder.findMany({ where: { status: { notIn: ["Completed", "Cancelled"] } }, include: { customer: { select: { name: true } } }, orderBy: { orderDate: "desc" } }),
  ]);
  return { opportunities, waitingApproval: quotations, openInvoices: invoices, activeContracts: contracts, openOrders: orders };
}

export async function getOpportunities() {
  await guard();
  return prisma.opportunity.findMany({ include: { customer: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } });
}

export async function getCustomers() {
  await guard();
  return prisma.customer.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { quotations: true, salesOrders: true, contracts: true } } } });
}

export async function getCustomer(id: string) {
  await guard();
  return prisma.customer.findUnique({
    where: { id },
    include: {
      opportunities: { orderBy: { createdAt: "desc" } },
      quotations: { orderBy: [{ date: "desc" }, { revision: "desc" }] },
      salesOrders: { orderBy: { orderDate: "desc" } },
      invoices: { orderBy: { invoiceDate: "desc" } },
      contracts: { orderBy: { endDate: "desc" } },
    },
  });
}

export async function getProducts() {
  await guard();
  return prisma.product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
}

export async function getQuotations() {
  await guard();
  return prisma.quotation.findMany({ include: { customer: { select: { name: true } } }, orderBy: [{ date: "desc" }, { revision: "desc" }] });
}

export async function getQuotation(id: string) {
  await guard();
  const q = await prisma.quotation.findUnique({
    where: { id },
    include: { customer: true, opportunity: true, items: { orderBy: { sortOrder: "asc" } }, salesOrders: { select: { id: true, soNo: true } } },
  });
  if (!q) return null;
  const revisions = await prisma.quotation.findMany({ where: { quotationNo: q.quotationNo }, select: { id: true, revision: true, status: true, date: true, total: true }, orderBy: { revision: "asc" } });
  return { ...q, revisions };
}

export async function getQuotationFormData() {
  await guard();
  const [customers, products, opportunities] = await Promise.all([
    prisma.customer.findMany({ where: { status: "Active" }, orderBy: { name: "asc" }, select: { id: true, name: true, contactName: true, paymentTerms: true, type: true } }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.opportunity.findMany({ where: { stage: { notIn: ["Won", "Lost"] } }, select: { id: true, opportunityNo: true, title: true, customerId: true } }),
  ]);
  return { customers, products, opportunities };
}

export async function getSalesOrders() {
  await guard();
  return prisma.salesOrder.findMany({ include: { customer: { select: { name: true } }, invoices: { select: { total: true, paidAmount: true, status: true } } }, orderBy: { orderDate: "desc" } });
}

export async function getSalesOrder(id: string) {
  await guard();
  return prisma.salesOrder.findUnique({
    where: { id },
    include: { customer: true, quotation: { select: { id: true, quotationNo: true, revision: true } }, items: { orderBy: { sortOrder: "asc" } }, invoices: { orderBy: { invoiceDate: "asc" } }, contracts: true },
  });
}

export async function getInvoices() {
  await guard();
  return prisma.invoice.findMany({ include: { customer: { select: { name: true } }, salesOrder: { select: { soNo: true } } }, orderBy: { invoiceDate: "desc" } });
}

export async function getInvoice(id: string) {
  await guard();
  return prisma.invoice.findUnique({ where: { id }, include: { customer: true, salesOrder: { select: { id: true, soNo: true, customerPoNo: true } }, payments: { orderBy: { paymentDate: "asc" } } } });
}

export async function getContracts() {
  await guard();
  return prisma.contract.findMany({ include: { customer: { select: { name: true } }, salesOrder: { select: { id: true, soNo: true } } }, orderBy: { endDate: "asc" } });
}

// ---------------------------------------------------------
// Customer & produk
// ---------------------------------------------------------

export type CustomerInput = {
  name: string; type: string; npwp?: string; address?: string; city?: string;
  contactName?: string; contactTitle?: string; contactEmail?: string; contactPhone?: string; paymentTerms: string; notes?: string;
};

export async function saveCustomer(id: string | null, data: CustomerInput) {
  return run(async () => {
    const user = await guard("manage");
    if (!data.name?.trim()) throw new Error("Nama customer wajib diisi.");
    if (id) {
      const old = await prisma.customer.findUniqueOrThrow({ where: { id } });
      await prisma.customer.update({ where: { id }, data: { ...data, historyJson: addHistory(old.historyJson, user.name, "Data customer diperbarui") } });
      return id;
    }
    const count = await prisma.customer.count();
    const created = await prisma.customer.create({ data: { ...data, customerNo: `CUS-${String(count + 1).padStart(4, "0")}-${Date.now().toString().slice(-3)}`, createdAt: today(), historyJson: firstHistory(user.name, "Customer didaftarkan") } });
    return created.id;
  });
}

export type ProductInput = {
  sku: string; name: string; category: string; brand: string; model?: string; unit: string; price: number;
  availability: string; leadTimeWeeks?: number | null; warrantyMonths: number; requiresCalibration: boolean;
  calibrationIntervalMonths?: number | null; specs?: string; isActive: boolean;
};

export async function saveProduct(id: string | null, data: ProductInput) {
  return run(async () => {
    await guard("manage");
    if (!data.sku?.trim() || !data.name?.trim()) throw new Error("Kode dan nama produk wajib diisi.");
    if (!(data.price >= 0)) throw new Error("Harga tidak valid.");
    if (id) {
      await prisma.product.update({ where: { id }, data });
      return id;
    }
    const created = await prisma.product.create({ data: { ...data, createdAt: today() } });
    return created.id;
  });
}

// ---------------------------------------------------------
// Pipeline
// ---------------------------------------------------------

export type OpportunityInput = { title: string; customerId: string; source: string; estimatedValue: number; expectedCloseDate?: string; notes?: string };

export async function createOpportunity(data: OpportunityInput) {
  return run(async () => {
    const user = await guard("manage");
    if (!data.title?.trim() || !data.customerId) throw new Error("Judul dan customer wajib diisi.");
    const year = today().slice(0, 4);
    const rows = await prisma.opportunity.findMany({ where: { opportunityNo: { startsWith: `OPP-${year}-` } }, select: { opportunityNo: true } });
    const max = rows.reduce((m, r) => Math.max(m, Number(r.opportunityNo.split("-").pop()) || 0), 0);
    const created = await prisma.opportunity.create({ data: {
      ...data, opportunityNo: `OPP-${year}-${String(max + 1).padStart(3, "0")}`, stage: "Lead", probability: STAGE_PROBABILITY.Lead,
      salesName: user.name, createdAt: today(), historyJson: firstHistory(user.name, "Opportunity dibuat"),
    } });
    return created.id;
  });
}

export async function moveOpportunity(id: string, stage: string, lostReason?: string) {
  return run(async () => {
    const user = await guard("manage");
    if (!(stage in STAGE_PROBABILITY)) throw new Error("Tahap tidak dikenal.");
    if (stage === "Lost" && !lostReason?.trim()) throw new Error("Alasan Lost wajib diisi.");
    const old = await prisma.opportunity.findUniqueOrThrow({ where: { id } });
    await prisma.opportunity.update({ where: { id }, data: {
      stage, probability: STAGE_PROBABILITY[stage], lostReason: stage === "Lost" ? lostReason : null,
      historyJson: addHistory(old.historyJson, user.name, `Tahap: ${old.stage} → ${stage}${stage === "Lost" ? ` (${lostReason})` : ""}`),
    } });
  });
}

// ---------------------------------------------------------
// Penawaran
// ---------------------------------------------------------

export async function createQuotation(data: QuotationInput, aiNote?: string) {
  return run(async () => {
    const user = await guard("manage");
    const created = await insertDraftQuotation(user.name, data, aiNote ? `Penawaran dibuat dari draft AI (${aiNote})` : "Penawaran dibuat");
    return created.id;
  });
}

export async function updateQuotation(id: string, data: QuotationInput) {
  return run(async () => {
    const user = await guard("manage");
    const old = await prisma.quotation.findUniqueOrThrow({ where: { id } });
    if (old.status !== "Draft") throw new Error("Hanya penawaran berstatus Draft yang bisa diedit. Buat revisi untuk mengubah.");
    const { fields, items } = quotationData(data);
    await prisma.$transaction([
      prisma.quotationItem.deleteMany({ where: { quotationId: id } }),
      prisma.quotation.update({ where: { id }, data: { ...fields, historyJson: addHistory(old.historyJson, user.name, "Penawaran diedit"), items: { create: items } } }),
    ]);
    return id;
  });
}

/** Draft → Approved (diskon ≤ batas) atau Waiting Approval (diskon di atas batas). */
export async function submitQuotation(id: string) {
  return run(async () => {
    const user = await guard("manage");
    const q = await prisma.quotation.findUniqueOrThrow({ where: { id }, include: { items: true } });
    if (q.status !== "Draft") throw new Error("Penawaran ini sudah diajukan.");
    if (needsApproval(q.discountPercent, q.items)) {
      await prisma.quotation.update({ where: { id }, data: { status: "Waiting Approval", historyJson: addHistory(q.historyJson, user.name, "Diajukan untuk persetujuan diskon") } });
      await createNotificationForPermission(PERM.approve, `Penawaran ${q.quotationNo} Rev.${q.revision} menunggu persetujuan diskon`, `/modules/sales/quotations/${id}`);
    } else {
      await prisma.quotation.update({ where: { id }, data: { status: "Approved", approvedBy: user.name, approvedAt: today(), historyJson: addHistory(q.historyJson, user.name, "Disetujui otomatis (diskon dalam batas)") } });
    }
  });
}

export async function decideQuotation(id: string, decision: "approve" | "reject", note?: string) {
  return run(async () => {
    const user = await guard("approve");
    const q = await prisma.quotation.findUniqueOrThrow({ where: { id } });
    if (q.status !== "Waiting Approval") throw new Error("Penawaran ini tidak sedang menunggu persetujuan.");
    if (decision === "approve") {
      await prisma.quotation.update({ where: { id }, data: { status: "Approved", approvedBy: user.name, approvedAt: today(), historyJson: addHistory(q.historyJson, user.name, `Disetujui${note ? `: ${note}` : ""}`) } });
    } else {
      if (!note?.trim()) throw new Error("Tulis alasan penolakan.");
      await prisma.quotation.update({ where: { id }, data: { status: "Draft", historyJson: addHistory(q.historyJson, user.name, `Dikembalikan ke Draft: ${note}`) } });
    }
  });
}

export async function setQuotationStatus(id: string, status: "Sent" | "Accepted" | "Rejected") {
  return run(async () => {
    const user = await guard("manage");
    const q = await prisma.quotation.findUniqueOrThrow({ where: { id } });
    const allowed: Record<string, string[]> = { Sent: ["Approved"], Accepted: ["Sent"], Rejected: ["Sent"] };
    if (!allowed[status].includes(q.status)) throw new Error(`Tidak bisa mengubah status ${q.status} menjadi ${status}.`);
    await prisma.quotation.update({ where: { id }, data: { status, historyJson: addHistory(q.historyJson, user.name, `Status: ${q.status} → ${status}`) } });
    if (q.opportunityId && status === "Sent") {
      const opp = await prisma.opportunity.findUnique({ where: { id: q.opportunityId } });
      if (opp && ["Lead", "Qualified", "Quotation"].includes(opp.stage)) {
        await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: "Negotiation", probability: STAGE_PROBABILITY.Negotiation, historyJson: addHistory(opp.historyJson, user.name, `Tahap: ${opp.stage} → Negotiation (penawaran dikirim)`) } });
      }
    }
  });
}

/** Salin penawaran menjadi revisi berikutnya (Draft); versi lama menjadi Superseded. */
export async function reviseQuotation(id: string) {
  return run(async () => {
    const user = await guard("manage");
    const q = await prisma.quotation.findUniqueOrThrow({ where: { id }, include: { items: true } });
    if (!["Approved", "Sent", "Rejected", "Waiting Approval"].includes(q.status)) throw new Error("Revisi hanya untuk penawaran yang sudah diajukan/dikirim.");
    const latest = await prisma.quotation.findFirst({ where: { quotationNo: q.quotationNo }, orderBy: { revision: "desc" } });
    if (latest && latest.id !== q.id) throw new Error(`Sudah ada revisi yang lebih baru (Rev.${latest.revision}).`);
    const { id: _id, items, historyJson, status, approvedBy, approvedAt, revision, ...copy } = q;
    const created = await prisma.quotation.create({ data: {
      ...copy, revision: revision + 1, status: "Draft", date: today(), validUntil: addDays(today(), 30),
      createdBy: user.name, createdAt: today(), historyJson: firstHistory(user.name, `Revisi ${revision + 1} dibuat dari Rev.${revision}`),
      items: { create: items.map(({ id: _i, quotationId: _q, ...it }) => it) },
    } });
    await prisma.quotation.update({ where: { id }, data: { status: "Superseded", historyJson: addHistory(historyJson, user.name, `Digantikan oleh Rev.${revision + 1}`) } });
    return created.id;
  });
}

export async function deleteQuotation(id: string) {
  return run(async () => {
    await guard("manage");
    const q = await prisma.quotation.findUniqueOrThrow({ where: { id } });
    if (q.status !== "Draft" || q.revision > 0) throw new Error("Hanya penawaran Draft Rev.0 yang bisa dihapus.");
    await prisma.quotation.delete({ where: { id } });
  });
}

// ---------------------------------------------------------
// Sales order (dari PO customer)
// ---------------------------------------------------------

export async function createSalesOrderFromQuotation(formData: FormData) {
  return run(async () => {
    const user = await guard("manage");
    const quotationId = String(formData.get("quotationId"));
    const customerPoNo = String(formData.get("customerPoNo") || "").trim();
    const customerPoDate = String(formData.get("customerPoDate") || "");
    const expectedDelivery = String(formData.get("expectedDelivery") || "") || null;
    const scheduleKey = String(formData.get("schedule") || "");
    const file = formData.get("poFile") as File | null;
    if (!customerPoNo || !customerPoDate) throw new Error("Nomor dan tanggal PO wajib diisi.");
    const schedule = PAYMENT_SCHEDULES[scheduleKey];
    if (!schedule) throw new Error("Pilih skema termin pembayaran.");

    const q = await prisma.quotation.findUniqueOrThrow({ where: { id: quotationId }, include: { items: true, customer: true } });
    if (q.status !== "Accepted") throw new Error("Sales Order hanya bisa dibuat dari penawaran yang Accepted.");
    const customerPoFile = file && file.size > 0 ? await uploadToStorage("sales/po", file) : null;

    const so = await prisma.salesOrder.create({ data: {
      soNo: await nextDocNo("SO", today()), customerId: q.customerId, quotationId: q.id, customerPoNo, customerPoDate, customerPoFile,
      orderDate: today(), status: "Contract Review", expectedDelivery, deliveryAddress: q.customer.address,
      contractReviewJson: JSON.stringify(CONTRACT_REVIEW_ITEMS.map(item => ({ item, ok: false }))), paymentScheduleJson: JSON.stringify(schedule),
      subtotal: q.subtotal - q.discountAmount, taxAmount: q.taxAmount, total: q.total, salesName: q.salesName, createdAt: today(),
      historyJson: firstHistory(user.name, `Dibuat dari PO ${customerPoNo} (penawaran ${q.quotationNo} Rev.${q.revision})`),
      items: { create: q.items.map(i => ({ productId: i.productId, description: i.description, qty: i.qty, unit: i.unit, unitPrice: i.unitPrice, lineTotal: i.lineTotal, sortOrder: i.sortOrder })) },
    } });
    if (q.opportunityId) {
      const opp = await prisma.opportunity.findUnique({ where: { id: q.opportunityId } });
      if (opp && opp.stage !== "Won") await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: "Won", probability: 100, historyJson: addHistory(opp.historyJson, user.name, `Won — PO ${customerPoNo} diterima`) } });
    }
    await createNotificationForPermission(PERM.approve, `PO ${customerPoNo} dari ${q.customer.name} perlu contract review (${so.soNo})`, `/modules/sales/orders/${so.id}`);
    return so.id;
  });
}

export async function toggleContractReview(id: string, index: number) {
  return run(async () => {
    const user = await guard("manage");
    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id } });
    if (so.status !== "Contract Review") throw new Error("Contract review sudah selesai.");
    const list = JSON.parse(so.contractReviewJson);
    if (!list[index]) throw new Error("Item tidak ditemukan.");
    list[index] = list[index].ok ? { item: list[index].item, ok: false } : { item: list[index].item, ok: true, reviewedBy: user.name, date: today() };
    await prisma.salesOrder.update({ where: { id }, data: { contractReviewJson: JSON.stringify(list) } });
  });
}

/** Maju satu langkah: Contract Review → Confirmed → In Delivery → Installed → Completed. */
export async function advanceSalesOrder(id: string, extra?: { bastNo?: string; bastDate?: string; serials?: Record<string, string> }) {
  return run(async () => {
    const user = await guard("manage");
    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id }, include: { items: true } });
    const next: Record<string, string> = { "Contract Review": "Confirmed", Confirmed: "In Delivery", "In Delivery": "Installed", Installed: "Completed" };
    const to = next[so.status];
    if (!to) throw new Error("Sales Order ini sudah selesai.");

    if (to === "Confirmed") {
      const review = JSON.parse(so.contractReviewJson) as { ok: boolean }[];
      if (review.some(r => !r.ok)) throw new Error("Lengkapi semua item contract review dulu.");
    }
    if (to === "Installed" && (!extra?.bastNo?.trim() || !extra.bastDate)) throw new Error("Nomor dan tanggal BAST wajib diisi.");

    const ops = [];
    if (extra?.serials) {
      for (const it of so.items) if (extra.serials[it.id] !== undefined) ops.push(prisma.salesOrderItem.update({ where: { id: it.id }, data: { serialNumbers: extra.serials[it.id] || null } }));
    }
    ops.push(prisma.salesOrder.update({ where: { id }, data: {
      status: to,
      ...(to === "Installed" ? { bastNo: extra!.bastNo, bastDate: extra!.bastDate, installationDate: extra!.bastDate } : {}),
      historyJson: addHistory(so.historyJson, user.name, `Status: ${so.status} → ${to}${to === "Installed" ? ` (BAST ${extra!.bastNo})` : ""}`),
    } }));
    await prisma.$transaction(ops);

    // Setelah BAST: buat kontrak garansi otomatis untuk alat yang bergaransi.
    if (to === "Installed") {
      const productIds = so.items.map(i => i.productId).filter(Boolean) as string[];
      const products = await prisma.product.findMany({ where: { id: { in: productIds }, warrantyMonths: { gt: 0 } } });
      if (products.length) {
        const months = Math.max(...products.map(p => p.warrantyMonths));
        const end = new Date(extra!.bastDate!);
        end.setMonth(end.getMonth() + months);
        const covered = so.items.filter(i => products.some(p => p.id === i.productId)).map(i => ({ product: i.description, serialNumber: extra?.serials?.[i.id] || i.serialNumbers || "-" }));
        await prisma.contract.create({ data: {
          contractNo: await nextDocNo("CTR", extra!.bastDate!), customerId: so.customerId, salesOrderId: so.id, type: "Garansi",
          title: `Garansi ${so.soNo}`, startDate: extra!.bastDate!, endDate: end.toISOString().split("T")[0], value: 0, status: "Active",
          coveredItemsJson: JSON.stringify(covered), createdAt: today(), historyJson: firstHistory(user.name, `Dibuat otomatis dari BAST ${extra!.bastNo}`),
        } });
      }
    }
  });
}

export async function cancelSalesOrder(id: string, reason: string) {
  return run(async () => {
    const user = await guard("approve");
    if (!reason?.trim()) throw new Error("Alasan pembatalan wajib diisi.");
    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id }, include: { invoices: true } });
    if (so.invoices.some(i => i.status !== "Cancelled")) throw new Error("Batalkan invoice terkait terlebih dahulu.");
    await prisma.salesOrder.update({ where: { id }, data: { status: "Cancelled", historyJson: addHistory(so.historyJson, user.name, `Dibatalkan: ${reason}`) } });
  });
}

// ---------------------------------------------------------
// Invoice & pembayaran
// ---------------------------------------------------------

export async function createInvoiceFromSchedule(salesOrderId: string, termIndex: number) {
  return run(async () => {
    const user = await guard("finance");
    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId }, include: { customer: true, invoices: true } });
    if (["Contract Review", "Cancelled"].includes(so.status)) throw new Error("Invoice baru bisa dibuat setelah order dikonfirmasi.");
    const schedule = JSON.parse(so.paymentScheduleJson) as { label: string; percent: number }[];
    const term = schedule[termIndex];
    if (!term) throw new Error("Termin tidak ditemukan.");
    if (so.invoices.some(i => i.termLabel === term.label && i.status !== "Cancelled")) throw new Error(`Invoice ${term.label} sudah dibuat.`);
    const subtotal = Math.round(so.subtotal * term.percent / 100);
    const taxAmount = Math.round(subtotal * TAX_PERCENT / 100);
    const inv = await prisma.invoice.create({ data: {
      invoiceNo: await nextDocNo("INV", today()), customerId: so.customerId, salesOrderId: so.id, termLabel: term.label, termPercent: term.percent,
      invoiceDate: today(), dueDate: addDays(today(), termDays(so.customer.paymentTerms)), subtotal, taxAmount, total: subtotal + taxAmount,
      status: "Unpaid", createdAt: today(), historyJson: firstHistory(user.name, `Invoice ${term.label} untuk ${so.soNo}`),
    } });
    return inv.id;
  });
}

export async function recordPayment(formData: FormData) {
  return run(async () => {
    const user = await guard("finance");
    const invoiceId = String(formData.get("invoiceId"));
    const amount = Number(formData.get("amount"));
    const paymentDate = String(formData.get("paymentDate") || "");
    const method = String(formData.get("method") || "Transfer");
    const reference = String(formData.get("reference") || "") || null;
    const file = formData.get("proof") as File | null;
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (["Paid", "Cancelled"].includes(inv.status)) throw new Error("Invoice ini sudah lunas/dibatalkan.");
    const remaining = inv.total - inv.paidAmount;
    if (!(amount > 0) || amount > remaining + 0.5) throw new Error(`Nominal harus antara 1 dan sisa tagihan.`);
    if (!paymentDate) throw new Error("Tanggal pembayaran wajib diisi.");
    const proofUrl = file && file.size > 0 ? await uploadToStorage("sales/payments", file) : null;
    const paidAmount = inv.paidAmount + amount;
    const status = paidAmount >= inv.total - 0.5 ? "Paid" : "Partial";
    await prisma.$transaction([
      prisma.payment.create({ data: { invoiceId, amount, paymentDate, method, reference, proofUrl, receivedBy: user.name, createdAt: today() } }),
      prisma.invoice.update({ where: { id: invoiceId }, data: { paidAmount, status, historyJson: addHistory(inv.historyJson, user.name, `Pembayaran Rp ${Math.round(amount).toLocaleString("id-ID")} (${status === "Paid" ? "lunas" : "sebagian"})`) } }),
    ]);
  });
}

export async function updateInvoiceTax(id: string, fakturPajakNo: string) {
  return run(async () => {
    const user = await guard("finance");
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    await prisma.invoice.update({ where: { id }, data: { fakturPajakNo: fakturPajakNo || null, historyJson: addHistory(inv.historyJson, user.name, "No. faktur pajak diperbarui") } });
  });
}

export async function cancelInvoice(id: string, reason: string) {
  return run(async () => {
    const user = await guard("finance");
    if (!reason?.trim()) throw new Error("Alasan pembatalan wajib diisi.");
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    if (inv.paidAmount > 0) throw new Error("Invoice yang sudah ada pembayarannya tidak bisa dibatalkan.");
    await prisma.invoice.update({ where: { id }, data: { status: "Cancelled", historyJson: addHistory(inv.historyJson, user.name, `Dibatalkan: ${reason}`) } });
  });
}

// ---------------------------------------------------------
// Kontrak
// ---------------------------------------------------------

export type ContractInput = {
  customerId: string; salesOrderId?: string | null; type: string; title: string; startDate: string; endDate: string;
  value: number; visitsPerYear?: number | null; coveredItems: { product: string; serialNumber: string }[]; picName?: string; notes?: string;
};

export async function createContract(data: ContractInput) {
  return run(async () => {
    const user = await guard("manage");
    if (!data.customerId || !data.title?.trim()) throw new Error("Customer dan judul kontrak wajib diisi.");
    if (!data.startDate || !data.endDate || data.endDate <= data.startDate) throw new Error("Periode kontrak tidak valid.");
    const { coveredItems, ...rest } = data;
    const created = await prisma.contract.create({ data: {
      ...rest, salesOrderId: data.salesOrderId || null, contractNo: await nextDocNo("CTR", data.startDate), status: "Active",
      coveredItemsJson: JSON.stringify(coveredItems.filter(c => c.product.trim())), createdAt: today(), historyJson: firstHistory(user.name, "Kontrak dibuat"),
    } });
    return created.id;
  });
}

/** Perpanjang: buat kontrak baru untuk periode berikutnya, kontrak lama ditandai Renewed. */
export async function renewContract(id: string, data: { startDate: string; endDate: string; value: number }) {
  return run(async () => {
    const user = await guard("manage");
    const c = await prisma.contract.findUniqueOrThrow({ where: { id } });
    if (["Renewed", "Terminated"].includes(c.status)) throw new Error("Kontrak ini sudah diperpanjang/dihentikan.");
    if (!data.startDate || !data.endDate || data.endDate <= data.startDate) throw new Error("Periode kontrak tidak valid.");
    const created = await prisma.contract.create({ data: {
      contractNo: await nextDocNo("CTR", data.startDate), customerId: c.customerId, salesOrderId: c.salesOrderId,
      type: c.type === "Garansi" ? "AMC" : c.type, title: c.type === "Garansi" ? c.title.replace(/^Garansi/, "Kontrak Perawatan") : c.title,
      startDate: data.startDate, endDate: data.endDate, value: data.value, visitsPerYear: c.visitsPerYear ?? (c.type === "Garansi" ? 2 : null),
      coveredItemsJson: c.coveredItemsJson, status: "Active", picName: c.picName, createdAt: today(),
      historyJson: firstHistory(user.name, `Perpanjangan dari ${c.contractNo}`),
    } });
    await prisma.contract.update({ where: { id }, data: { status: "Renewed", historyJson: addHistory(c.historyJson, user.name, `Diperpanjang → ${created.contractNo}`) } });
    return created.id;
  });
}

export async function terminateContract(id: string, reason: string) {
  return run(async () => {
    const user = await guard("approve");
    if (!reason?.trim()) throw new Error("Alasan wajib diisi.");
    const c = await prisma.contract.findUniqueOrThrow({ where: { id } });
    await prisma.contract.update({ where: { id }, data: { status: "Terminated", historyJson: addHistory(c.historyJson, user.name, `Dihentikan: ${reason}`) } });
  });
}

// ---------------------------------------------------------
// AI: draft penawaran dari penawaran sebelumnya
// ---------------------------------------------------------

export async function aiDraftQuotation(input: { customerId: string; request: string; opportunityId?: string | null }) {
  try {
    await guard("manage");
    const result = await generateQuotationDraft(input);
    return { success: true as const, ...result };
  } catch (err) {
    const message = err instanceof AiError || err instanceof Error ? err.message : "Gagal membuat draft dengan AI.";
    return { success: false as const, message };
  }
}
