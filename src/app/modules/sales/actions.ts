"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type CurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { notifyPermission as createNotificationForPermission } from "@/lib/notificationStore";
import { uploadToStorage } from "@/lib/uploadFile";
import { AiError } from "@/lib/ai";
import { generateQuotationDraft } from "./ai/draftQuotation";
import { generateContractDraft } from "./ai/draftContract";
import { REMINDER_LEVELS, generateReminderLetter } from "./ai/reminderLetter";
import { CONTRACT_REVIEW_ITEMS, CURRENCIES, PAYMENT_SCHEDULES, PERM, STAGE_PROBABILITY, CONTRACT_APPROVAL_BUSINESS_DAYS, addBusinessDays, addDays, computeTotals, contractBillingPeriods, defaultTaxFor, defaultTenderChecklist, lineTotal, money, needsApproval, roundMoney, salesAccess, today, type LineInput } from "./lib";
import { buildClauses, type Clause } from "./documents/contractTemplates";
import { addHistory, fillQuotationDefaults, firstHistory, insertDraftQuotation, nextDocNo, quotationData, type QuotationInput } from "./server";

export type { QuotationInput } from "./server";

type Result = { success: true; id?: string } | { success: false; message: string };

// ---------------------------------------------------------
// Akses & utilitas
// ---------------------------------------------------------

/** Server action tidak terlindungi middleware: cek login & permission di setiap aksi. */
async function guard(need: "view" | "manage" | "approve" | "finance" | "shipping" | "any" = "view"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Silakan login terlebih dahulu.");
  const access = salesAccess(user, await getRolesConfig());
  const ok = {
    view: access.canView, manage: access.canManage, approve: access.canApprove, finance: access.canFinance,
    // Kontrak dikelola di modul Contract & Shipping.
    shipping: access.canShipping,
    // Data bersama (kontrak, customer) juga dibaca modul Contract & Shipping dan Training & CS.
    any: access.canView || access.canShipping || access.canService || access.canApprove,
  }[need];
  if (!ok) throw new Error("Anda tidak punya akses untuk aksi ini.");
  return user;
}

async function run(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const id = await fn();
    // Sales, Contract & Shipping, dan Training & CS berbagi data yang sama.
    revalidatePath("/modules", "layout");
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
  const [opportunities, quotations, invoices, contracts, orders, contractApprovals] = await Promise.all([
    prisma.opportunity.findMany({ include: { customer: { select: { name: true } } } }),
    prisma.quotation.findMany({ where: { status: "Waiting Approval" }, include: { customer: { select: { name: true } } }, orderBy: { date: "desc" } }),
    prisma.invoice.findMany({ where: { status: { in: ["Unpaid", "Partial"] } }, include: { customer: { select: { name: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.contract.findMany({ where: { status: "Active" }, include: { customer: { select: { name: true } } }, orderBy: { endDate: "asc" } }),
    prisma.salesOrder.findMany({ where: { status: { notIn: ["Completed", "Cancelled"] } }, include: { customer: { select: { name: true } } }, orderBy: { orderDate: "desc" } }),
    prisma.contract.findMany({ where: { status: "Waiting Approval" }, include: { customer: { select: { name: true } } }, orderBy: { approvalDueDate: "asc" } }),
  ]);
  return { opportunities, waitingApproval: quotations, contractApprovals, openInvoices: invoices, activeContracts: contracts, openOrders: orders };
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
  const revisions = await prisma.quotation.findMany({ where: { quotationNo: q.quotationNo }, select: { id: true, revision: true, status: true, date: true, total: true, currency: true }, orderBy: { revision: "asc" } });
  return { ...q, revisions };
}

export async function getQuotationFormData() {
  await guard();
  const [customers, products, opportunities] = await Promise.all([
    prisma.customer.findMany({ where: { status: "Active" }, orderBy: { name: "asc" }, select: { id: true, name: true, contactName: true, paymentTerms: true, type: true, country: true, currency: true } }),
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
    include: {
      customer: true, agent: { select: { id: true, name: true } }, quotation: { select: { id: true, quotationNo: true, revision: true } }, items: { orderBy: { sortOrder: "asc" } }, invoices: { orderBy: { invoiceDate: "asc" } }, contracts: true,
      salesShipments: { select: { id: true, shipmentNo: true, status: true, mode: true, destination: true, exceptionStatus: true }, orderBy: { createdAt: "asc" } },
      serviceJobs: { select: { id: true, jobNo: true, status: true, type: true, startDate: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export async function getInvoices() {
  await guard();
  return prisma.invoice.findMany({ include: { customer: { select: { name: true } }, salesOrder: { select: { soNo: true } } }, orderBy: { invoiceDate: "desc" } });
}

export async function getInvoice(id: string) {
  await guard();
  return prisma.invoice.findUnique({ where: { id }, include: {
    customer: true, salesOrder: { select: { id: true, soNo: true, customerPoNo: true } }, contract: { select: { id: true, contractNo: true, title: true } },
    payments: { orderBy: { paymentDate: "asc" } }, items: { orderBy: { sortOrder: "asc" } }, reminders: { orderBy: { date: "desc" } }, creditNotes: { orderBy: { date: "asc" } },
  } });
}

/** Data form "Invoice baru": customer, produk, dan kontrak yang bisa ditagih beserta periode tagihnya. */
export async function getInvoiceFormData() {
  await guard("finance");
  const [customers, products, contracts] = await Promise.all([
    prisma.customer.findMany({ where: { status: "Active" }, orderBy: { name: "asc" }, select: { id: true, name: true, paymentTerms: true, country: true, currency: true } }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, sku: true, name: true, brand: true, model: true, unit: true, price: true, category: true } }),
    prisma.contract.findMany({
      where: { type: { not: "Garansi" }, value: { gt: 0 }, status: { in: ["Approved", "Sent", "Active"] } },
      include: { customer: { select: { name: true } }, invoices: { where: { status: { not: "Cancelled" } }, select: { id: true, invoiceNo: true, periodLabel: true } } },
      orderBy: { startDate: "desc" },
    }),
  ]);
  return {
    customers, products,
    contracts: contracts.map(c => ({
      id: c.id, contractNo: c.contractNo, title: c.title, type: c.type, value: c.value, customer: c.customer.name,
      periods: contractBillingPeriods(c).map(p => ({ ...p, amount: Math.round(c.value * p.percent / 100), invoice: c.invoices.find(i => i.periodLabel === p.label) ?? null })),
    })),
  };
}

export async function getContracts() {
  await guard("any");
  return prisma.contract.findMany({ include: { customer: { select: { name: true } }, salesOrder: { select: { id: true, soNo: true } } }, orderBy: { endDate: "asc" } });
}

export async function getContract(id: string) {
  await guard("any");
  const c = await prisma.contract.findUnique({
    where: { id },
    include: { customer: true, salesOrder: { select: { id: true, soNo: true, bastNo: true } }, invoices: { orderBy: { invoiceDate: "asc" }, select: { id: true, invoiceNo: true, periodLabel: true, total: true, paidAmount: true, status: true, dueDate: true } } },
  });
  if (!c) return null;
  const [renewedFrom, renewal] = await Promise.all([
    c.renewedFromId ? prisma.contract.findUnique({ where: { id: c.renewedFromId }, select: { id: true, contractNo: true } }) : null,
    prisma.contract.findFirst({ where: { renewedFromId: c.id }, select: { id: true, contractNo: true, status: true } }),
  ]);
  return { ...c, renewedFrom, renewal };
}

/** Alat terpasang milik customer: dari SO yang sudah BAST (+ nomor seri) dan dari kontrak sebelumnya. */
export async function getInstalledBase(customerId: string): Promise<ContractItem[]> {
  await guard("any");
  const [orders, contracts] = await Promise.all([
    prisma.salesOrder.findMany({ where: { customerId, status: { in: ["Installed", "Completed"] } }, include: { items: true } }),
    prisma.contract.findMany({ where: { customerId }, select: { coveredItemsJson: true } }),
  ]);
  const out = new Map<string, ContractItem>();
  for (const so of orders) for (const it of so.items) {
    if (/^(Jasa|Instalasi|Kontrak)/i.test(it.description)) continue;
    const product = it.description.split(" — ").pop()?.trim() || it.description;
    const serials = (it.serialNumbers || "").split(",").map(x => x.trim()).filter(Boolean);
    const count = Math.max(1, Math.round(it.qty));
    for (let i = 0; i < count; i++) {
      const serialNumber = serials[i] || "-";
      out.set(`${product}|${serialNumber}|${so.id}|${i}`, { product, serialNumber });
    }
  }
  for (const c of contracts) for (const it of JSON.parse(c.coveredItemsJson || "[]") as ContractItem[]) {
    if (![...out.values()].some(o => o.serialNumber !== "-" && o.serialNumber === it.serialNumber)) out.set(`${it.product}|${it.serialNumber}`, it);
  }
  return [...out.values()];
}

export async function getContractFormData() {
  await guard("shipping");
  const [customers, prices] = await Promise.all([
    prisma.customer.findMany({ where: { status: "Active" }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, paymentTerms: true, contactName: true, contactTitle: true, signatoryName: true, signatoryTitle: true } }),
    prisma.product.findMany({ where: { category: "Jasa" }, select: { sku: true, name: true, price: true } }),
  ]);
  return { customers, servicePrices: prices };
}

// ---------------------------------------------------------
// Customer & produk
// ---------------------------------------------------------

export type CustomerInput = {
  name: string; type: string; npwp?: string; address?: string; city?: string;
  contactName?: string; contactTitle?: string; contactEmail?: string; contactPhone?: string; paymentTerms: string; notes?: string;
  signatoryName?: string; signatoryTitle?: string;
  country?: string; currency?: string; agentId?: string | null;
};

export async function saveCustomer(id: string | null, data: CustomerInput) {
  return run(async () => {
    const user = await guard("manage");
    if (!data.name?.trim()) throw new Error("Nama customer wajib diisi.");
    data = { ...data, country: data.country?.trim() || "Indonesia", currency: (CURRENCIES as readonly string[]).includes(data.currency ?? "") ? data.currency : "IDR", agentId: data.agentId || null };
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
  hsCode?: string | null; tkdnPercent?: number | null; tkdnCertNo?: string | null;
};

export async function saveProduct(id: string | null, data: ProductInput) {
  return run(async () => {
    await guard("manage");
    if (!data.sku?.trim() || !data.name?.trim()) throw new Error("Kode dan nama produk wajib diisi.");
    if (!(data.price >= 0)) throw new Error("Harga tidak valid.");
    if (data.tkdnPercent != null && !(data.tkdnPercent >= 0 && data.tkdnPercent <= 100)) throw new Error("TKDN harus 0–100%.");
    data = { ...data, hsCode: data.hsCode?.trim() || null, tkdnPercent: data.tkdnPercent ?? null, tkdnCertNo: data.tkdnCertNo?.trim() || null };
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

export type OpportunityInput = { title: string; customerId: string; source: string; estimatedValue: number; expectedCloseDate?: string; notes?: string; tenderNo?: string; tenderDeadline?: string };

export async function createOpportunity(data: OpportunityInput) {
  return run(async () => {
    const user = await guard("manage");
    if (!data.title?.trim() || !data.customerId) throw new Error("Judul dan customer wajib diisi.");
    const year = today().slice(0, 4);
    const rows = await prisma.opportunity.findMany({ where: { opportunityNo: { startsWith: `OPP-${year}-` } }, select: { opportunityNo: true } });
    const max = rows.reduce((m, r) => Math.max(m, Number(r.opportunityNo.split("-").pop()) || 0), 0);
    const created = await prisma.opportunity.create({ data: {
      ...data, tenderNo: data.tenderNo?.trim() || null, tenderDeadline: data.tenderDeadline || null,
      tenderChecklistJson: /Tender/i.test(data.source) ? JSON.stringify(defaultTenderChecklist(data.source)) : "[]", opportunityNo: `OPP-${year}-${String(max + 1).padStart(3, "0")}`, stage: "Lead", probability: STAGE_PROBABILITY.Lead,
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
    const { fields, items } = quotationData(await fillQuotationDefaults(data));
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

    const q = await prisma.quotation.findUniqueOrThrow({ where: { id: quotationId }, include: { items: true, customer: { include: { agent: true } } } });
    if (q.status !== "Accepted") throw new Error("Sales Order hanya bisa dibuat dari penawaran yang Accepted.");
    const customerPoFile = file && file.size > 0 ? await uploadToStorage("sales/po", file) : null;

    const so = await prisma.salesOrder.create({ data: {
      soNo: await nextDocNo("SO", today()), customerId: q.customerId, quotationId: q.id, customerPoNo, customerPoDate, customerPoFile,
      orderDate: today(), status: "Contract Review", expectedDelivery, deliveryAddress: q.customer.address,
      contractReviewJson: JSON.stringify(CONTRACT_REVIEW_ITEMS.map(item => ({ item, ok: false }))), paymentScheduleJson: JSON.stringify(schedule),
      subtotal: roundMoney(q.subtotal - q.discountAmount, q.currency), taxAmount: q.taxAmount, total: q.total, salesName: q.salesName, createdAt: today(),
      currency: q.currency, exchangeRate: q.exchangeRate, taxPercent: q.taxPercent,
      // Komisi mengikuti agen customer (aktif) saat PO diterima.
      ...(q.customer.agent?.status === "Active" ? { agentId: q.customer.agent.id, commissionPercent: q.customer.agent.commissionPercent } : {}),
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

/**
 * Maju satu langkah: Contract Review → Confirmed, atau Installed → Completed.
 * Confirmed → In Delivery terjadi saat shipment dikirim (modul Contract & Shipping);
 * In Delivery → Installed saat BAST instalasi & training (modul Training & Customer Service).
 */
export async function advanceSalesOrder(id: string) {
  return run(async () => {
    const user = await guard("manage");
    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id }, include: { items: true } });
    const next: Record<string, string> = { "Contract Review": "Confirmed", Installed: "Completed" };
    const to = next[so.status];
    if (so.status === "Confirmed") throw new Error("Pengiriman dicatat di modul Contract & Shipping (setelah pelunasan).");
    if (so.status === "In Delivery") throw new Error("BAST instalasi & training dicatat di modul Training & Customer Service.");
    if (!to) throw new Error("Sales Order ini sudah selesai.");

    if (to === "Confirmed") {
      const review = JSON.parse(so.contractReviewJson) as { ok: boolean }[];
      if (review.some(r => !r.ok)) throw new Error("Lengkapi semua item contract review dulu.");
    }
    await prisma.salesOrder.update({ where: { id }, data: { status: to, historyJson: addHistory(so.historyJson, user.name, `Status: ${so.status} → ${to}`) } });
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

export type LetterOfCreditInput = {
  lcNo: string; lcIssuingBank?: string; lcIssueDate?: string; lcExpiryDate?: string; lcLatestShipment?: string; lcAmount?: number | null; lcNotes?: string;
};

/** Catat / ubah data L/C pada Sales Order (Sales atau Finance). Kosongkan nomor L/C untuk menghapus. */
export async function saveLetterOfCredit(id: string, data: LetterOfCreditInput) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new Error("Silakan login terlebih dahulu.");
    const access = salesAccess(user, await getRolesConfig());
    if (!access.canManage && !access.canFinance) throw new Error("Anda tidak punya akses untuk aksi ini.");
    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id } });
    const lcNo = data.lcNo?.trim() || null;
    if (lcNo) {
      if (data.lcExpiryDate && data.lcLatestShipment && data.lcLatestShipment > data.lcExpiryDate) throw new Error("Batas pengiriman (latest shipment) tidak boleh melewati tanggal kedaluwarsa L/C.");
      if (data.lcAmount != null && !(data.lcAmount > 0)) throw new Error("Nilai L/C tidak valid.");
    }
    const fields = lcNo
      ? { lcNo, lcIssuingBank: data.lcIssuingBank?.trim() || null, lcIssueDate: data.lcIssueDate || null, lcExpiryDate: data.lcExpiryDate || null,
          lcLatestShipment: data.lcLatestShipment || null, lcAmount: data.lcAmount ?? null, lcNotes: data.lcNotes?.trim() || null }
      : { lcNo: null, lcIssuingBank: null, lcIssueDate: null, lcExpiryDate: null, lcLatestShipment: null, lcAmount: null, lcNotes: null };
    const action = !lcNo ? "Data L/C dihapus" : so.lcNo ? `Data L/C ${lcNo} diperbarui` : `L/C ${lcNo} dicatat`;
    await prisma.salesOrder.update({ where: { id }, data: { ...fields, historyJson: addHistory(so.historyJson, user.name, action) } });
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
    // Termin terakhir menutup sisa agar pembulatan tidak membuat total invoice berbeda dari nilai SO.
    const others = so.invoices.filter(i => i.status !== "Cancelled");
    const isLast = others.length === schedule.length - 1;
    const subtotal = isLast ? roundMoney(so.subtotal - others.reduce((t, i) => t + i.subtotal, 0), so.currency) : roundMoney(so.subtotal * term.percent / 100, so.currency);
    const taxAmount = isLast ? roundMoney(so.taxAmount - others.reduce((t, i) => t + i.taxAmount, 0), so.currency) : roundMoney(subtotal * so.taxPercent / 100, so.currency);
    const inv = await prisma.invoice.create({ data: {
      invoiceNo: await nextDocNo("INV", today()), customerId: so.customerId, salesOrderId: so.id, termLabel: term.label, termPercent: term.percent,
      currency: so.currency, exchangeRate: so.exchangeRate, taxPercent: so.taxPercent,
      invoiceDate: today(), dueDate: addDays(today(), termDays(so.customer.paymentTerms)), subtotal, taxAmount, total: roundMoney(subtotal + taxAmount, so.currency),
      status: "Unpaid", createdAt: today(), historyJson: firstHistory(user.name, `Invoice ${term.label} untuk ${so.soNo}`),
    } });
    return inv.id;
  });
}

export type ManualInvoiceInput = { customerId: string; invoiceDate: string; termLabel: string; notes?: string; items: LineInput[]; currency?: string; exchangeRate?: number; taxPercent?: number };

/** Invoice tanpa Sales Order: suku cadang, jasa panggilan, dll. */
export async function createManualInvoice(data: ManualInvoiceInput) {
  return run(async () => {
    const user = await guard("finance");
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new Error("Pilih customer.");
    const items = data.items.filter(i => i.description?.trim());
    if (!items.length) throw new Error("Tambahkan minimal satu item.");
    if (items.some(i => !(i.qty > 0) || !(i.unitPrice >= 0))) throw new Error("Jumlah dan harga item harus valid.");
    if (!data.invoiceDate) throw new Error("Tanggal invoice wajib diisi.");
    const currency = (CURRENCIES as readonly string[]).includes(data.currency ?? "") ? data.currency! : "IDR";
    const exchangeRate = currency === "IDR" ? 1 : Number(data.exchangeRate);
    if (!(exchangeRate > 0)) throw new Error(`Isi kurs (Rp per 1 ${currency}).`);
    const taxPercent = data.taxPercent ?? defaultTaxFor(customer);
    const { subtotal, taxAmount, total } = computeTotals(items, 0, taxPercent, currency);
    const inv = await prisma.invoice.create({ data: {
      invoiceNo: await nextDocNo("INV", data.invoiceDate), customerId: customer.id, termLabel: data.termLabel?.trim() || "Tagihan", termPercent: 100,
      currency, exchangeRate, taxPercent,
      invoiceDate: data.invoiceDate, dueDate: addDays(data.invoiceDate, termDays(customer.paymentTerms)), subtotal, taxAmount, total,
      status: "Unpaid", notes: data.notes || null, createdAt: today(), historyJson: firstHistory(user.name, "Invoice manual diterbitkan"),
      items: { create: items.map((i, idx) => ({ productId: i.productId || null, description: i.description, qty: i.qty, unit: i.unit, unitPrice: i.unitPrice, lineTotal: lineTotal(i, currency), sortOrder: idx + 1 })) },
    } });
    return inv.id;
  });
}

/** Invoice untuk satu periode tagih kontrak (sekali per periode). */
export async function createInvoiceFromContract(contractId: string, periodIndex: number) {
  return run(async () => {
    const user = await guard("finance");
    const c = await prisma.contract.findUniqueOrThrow({ where: { id: contractId }, include: { customer: true, invoices: true } });
    if (c.type === "Garansi" || !(c.value > 0)) throw new Error("Kontrak ini tidak memiliki nilai tagihan.");
    if (!["Approved", "Sent", "Active"].includes(c.status)) throw new Error("Kontrak harus sudah disetujui sebelum ditagih.");
    const period = contractBillingPeriods(c)[periodIndex];
    if (!period) throw new Error("Periode tagih tidak ditemukan.");
    if (c.invoices.some(i => i.periodLabel === period.label && i.status !== "Cancelled")) throw new Error(`Periode "${period.label}" sudah ditagih.`);
    const subtotal = Math.round(c.value * period.percent / 100);
    const taxPercent = defaultTaxFor(c.customer);
    const taxAmount = Math.round(subtotal * taxPercent / 100);
    const invoiceDate = today();
    const inv = await prisma.invoice.create({ data: {
      taxPercent,
      invoiceNo: await nextDocNo("INV", invoiceDate), customerId: c.customerId, contractId: c.id, periodLabel: period.label,
      termLabel: `Kontrak ${c.type}${period.percent < 100 ? ` - Triwulan ${periodIndex + 1}` : ""}`, termPercent: period.percent,
      invoiceDate, dueDate: addDays(invoiceDate, termDays(c.paymentTerms || c.customer.paymentTerms)), subtotal, taxAmount, total: subtotal + taxAmount,
      status: "Unpaid", createdAt: today(), historyJson: firstHistory(user.name, `Invoice kontrak ${c.contractNo}: ${period.label}`),
      items: { create: [{ description: `${c.title} (${c.contractNo}), ${period.label}`, qty: 1, unit: "Periode", unitPrice: subtotal, lineTotal: subtotal, sortOrder: 1 }] },
    } });
    await prisma.contract.update({ where: { id: c.id }, data: { historyJson: addHistory(c.historyJson, user.name, `Ditagih: ${inv.invoiceNo} (${period.label})`) } });
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
    const remaining = roundMoney(inv.total - inv.paidAmount, inv.currency);
    const tol = inv.currency === "IDR" ? 0.5 : 0.005;
    if (!(amount > 0) || amount > remaining + tol) throw new Error(`Nominal harus lebih dari 0 dan tidak melebihi sisa tagihan (${money(remaining, inv.currency)}).`);
    if (!paymentDate) throw new Error("Tanggal pembayaran wajib diisi.");
    const proofUrl = file && file.size > 0 ? await uploadToStorage("sales/payments", file) : null;
    const paidAmount = roundMoney(inv.paidAmount + amount, inv.currency);
    const status = paidAmount >= inv.total - tol ? "Paid" : "Partial";
    await prisma.$transaction([
      prisma.payment.create({ data: { invoiceId, amount, paymentDate, method, reference, proofUrl, receivedBy: user.name, createdAt: today(), receiptNo: await nextDocNo("KWT", paymentDate) } }),
      prisma.invoice.update({ where: { id: invoiceId }, data: { paidAmount, status, historyJson: addHistory(inv.historyJson, user.name, `Pembayaran ${money(amount, inv.currency)} (${status === "Paid" ? "lunas" : "sebagian"})`) } }),
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

export type ContractItem = { product: string; serialNumber: string; location?: string };
export type ContractInput = {
  customerId: string; salesOrderId?: string | null; type: string; title: string; startDate: string; endDate: string;
  value: number; visitsPerYear?: number | null; coveredItems: ContractItem[]; picName?: string; notes?: string;
  scope?: string; responseTime?: string; paymentTerms?: string; billingSchedule?: string; sparePartDiscount?: number | null;
  signatoryName?: string; signatoryTitle?: string; clauses?: Clause[];
};

function contractFields(data: ContractInput) {
  if (!data.customerId || !data.title?.trim()) throw new Error("Customer dan judul kontrak wajib diisi.");
  if (!data.startDate || !data.endDate || data.endDate <= data.startDate) throw new Error("Periode kontrak tidak valid.");
  if (!(data.value >= 0)) throw new Error("Nilai kontrak tidak valid.");
  const items = data.coveredItems.filter(c => c.product?.trim());
  if (data.type !== "Garansi" && items.length === 0) throw new Error("Pilih minimal satu alat yang dicakup.");
  const clauses = data.type === "Garansi" ? [] : (data.clauses?.length ? data.clauses : buildClauses({
    type: data.type, startDate: data.startDate, endDate: data.endDate, visitsPerYear: data.visitsPerYear, responseTime: data.responseTime,
    value: data.value, paymentTerms: data.paymentTerms, billingSchedule: data.billingSchedule, sparePartDiscount: data.sparePartDiscount,
    scope: data.scope, itemCount: items.length,
  }));
  return {
    customerId: data.customerId, salesOrderId: data.salesOrderId || null, type: data.type, title: data.title.trim(),
    startDate: data.startDate, endDate: data.endDate, value: data.value, visitsPerYear: data.visitsPerYear || null,
    coveredItemsJson: JSON.stringify(items), picName: data.picName || null, notes: data.notes || null,
    scope: data.scope || null, responseTime: data.responseTime || null, paymentTerms: data.paymentTerms || null,
    billingSchedule: data.billingSchedule === "Quarterly" ? "Quarterly" : "Upfront", sparePartDiscount: data.sparePartDiscount || null,
    signatoryName: data.signatoryName || null, signatoryTitle: data.signatoryTitle || null, clausesJson: JSON.stringify(clauses),
  };
}

/** Kontrak baru: Garansi langsung Active; AMC/Kalibrasi/Service mulai sebagai Draft dan butuh approval. */
export async function createContract(data: ContractInput, aiNote?: string) {
  return run(async () => {
    const user = await guard("shipping");
    const fields = contractFields(data);
    const created = await prisma.contract.create({ data: {
      ...fields, contractNo: await nextDocNo("CTR", data.startDate), status: data.type === "Garansi" ? "Active" : "Draft", createdAt: today(),
      historyJson: firstHistory(user.name, aiNote ? `Kontrak dibuat dari draft AI (${aiNote})` : "Kontrak dibuat"),
    } });
    return created.id;
  });
}

export async function updateContract(id: string, data: ContractInput) {
  return run(async () => {
    const user = await guard("shipping");
    const old = await prisma.contract.findUniqueOrThrow({ where: { id } });
    if (old.status !== "Draft") throw new Error("Hanya kontrak berstatus Draft yang bisa diedit.");
    await prisma.contract.update({ where: { id }, data: { ...contractFields(data), historyJson: addHistory(old.historyJson, user.name, "Kontrak diedit") } });
    return id;
  });
}

/** Draft → Waiting Approval, dengan batas keputusan 7 hari kerja. */
export async function submitContract(id: string) {
  return run(async () => {
    const user = await guard("shipping");
    const c = await prisma.contract.findUniqueOrThrow({ where: { id }, include: { customer: { select: { name: true } } } });
    if (c.status !== "Draft") throw new Error("Kontrak ini sudah diajukan.");
    const due = addBusinessDays(today(), CONTRACT_APPROVAL_BUSINESS_DAYS);
    await prisma.contract.update({ where: { id }, data: { status: "Waiting Approval", approvalDueDate: due, historyJson: addHistory(c.historyJson, user.name, `Diajukan untuk persetujuan (batas ${due})`) } });
    await createNotificationForPermission(PERM.approve, `Kontrak ${c.contractNo} (${c.customer.name}) menunggu persetujuan, batas ${due}`, `/modules/contract-shipping/contracts/${id}`);
  });
}

export async function decideContract(id: string, decision: "approve" | "reject", note?: string) {
  return run(async () => {
    const user = await guard("approve");
    const c = await prisma.contract.findUniqueOrThrow({ where: { id } });
    if (c.status !== "Waiting Approval") throw new Error("Kontrak ini tidak sedang menunggu persetujuan.");
    if (decision === "approve") {
      const late = c.approvalDueDate && today() > c.approvalDueDate ? ` (melewati batas ${c.approvalDueDate})` : "";
      await prisma.contract.update({ where: { id }, data: { status: "Approved", approvedBy: user.name, approvedAt: today(), historyJson: addHistory(c.historyJson, user.name, `Disetujui${late}${note ? `: ${note}` : ""}`) } });
    } else {
      if (!note?.trim()) throw new Error("Tulis alasan penolakan.");
      await prisma.contract.update({ where: { id }, data: { status: "Draft", approvalDueDate: null, historyJson: addHistory(c.historyJson, user.name, `Dikembalikan ke Draft: ${note}`) } });
    }
  });
}

export async function markContractSent(id: string) {
  return run(async () => {
    const user = await guard("shipping");
    const c = await prisma.contract.findUniqueOrThrow({ where: { id } });
    if (c.status !== "Approved") throw new Error("Hanya kontrak yang sudah disetujui yang bisa dikirim.");
    await prisma.contract.update({ where: { id }, data: { status: "Sent", historyJson: addHistory(c.historyJson, user.name, "Dokumen perjanjian dikirim ke customer") } });
  });
}

/** Upload scan perjanjian yang sudah ditandatangani dua pihak + meterai → kontrak Active. */
export async function uploadSignedContract(formData: FormData) {
  return run(async () => {
    const user = await guard("shipping");
    const id = String(formData.get("contractId"));
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) throw new Error("Pilih file scan perjanjian yang sudah ditandatangani.");
    const c = await prisma.contract.findUniqueOrThrow({ where: { id } });
    if (!["Approved", "Sent"].includes(c.status)) throw new Error("Kontrak harus disetujui sebelum diaktifkan.");
    const url = await uploadToStorage("sales/contracts", file);
    await prisma.contract.update({ where: { id }, data: { status: "Active", signedFileUrl: url, historyJson: addHistory(c.historyJson, user.name, "Scan bertanda tangan diunggah, kontrak aktif") } });
    // Perpanjangan aktif → kontrak sebelumnya selesai.
    if (c.renewedFromId) {
      const prev = await prisma.contract.findUnique({ where: { id: c.renewedFromId } });
      if (prev && !["Renewed", "Terminated"].includes(prev.status)) {
        await prisma.contract.update({ where: { id: prev.id }, data: { status: "Renewed", historyJson: addHistory(prev.historyJson, user.name, `Diperpanjang oleh ${c.contractNo}`) } });
      }
    }
  });
}

/** Perpanjang: salin alat & syarat ke Draft periode berikutnya (Garansi → AMC). Kontrak lama ditutup saat perpanjangan aktif. */
export async function renewContract(id: string) {
  return run(async () => {
    const user = await guard("shipping");
    const c = await prisma.contract.findUniqueOrThrow({ where: { id } });
    if (["Renewed", "Terminated", "Draft", "Waiting Approval"].includes(c.status)) throw new Error("Kontrak ini tidak bisa diperpanjang.");
    const existing = await prisma.contract.findFirst({ where: { renewedFromId: id, status: { notIn: ["Terminated"] } } });
    if (existing) return existing.id;
    const startDate = c.endDate < today() ? today() : addDays(c.endDate, 1);
    const endDate = addDays(startDate, 364);
    const type = c.type === "Garansi" ? "AMC" : c.type;
    const items = JSON.parse(c.coveredItemsJson || "[]") as ContractItem[];
    const amc = await prisma.product.findFirst({ where: { sku: { endsWith: "SRV-002" } } });
    const value = c.value || (type === "AMC" ? (amc?.price ?? 0) * items.length : 0);
    const draft: ContractInput = {
      customerId: c.customerId, salesOrderId: c.salesOrderId, type, title: c.type === "Garansi" ? c.title.replace(/^Garansi/, "Kontrak Perawatan") : c.title,
      startDate, endDate, value, visitsPerYear: c.visitsPerYear ?? 2, coveredItems: items, picName: c.picName ?? undefined,
      scope: c.scope ?? undefined, responseTime: c.responseTime ?? "2x24 jam hari kerja", paymentTerms: c.paymentTerms ?? undefined,
      billingSchedule: c.billingSchedule, sparePartDiscount: c.sparePartDiscount ?? (type === "AMC" ? 15 : null),
      signatoryName: c.signatoryName ?? undefined, signatoryTitle: c.signatoryTitle ?? undefined,
    };
    const created = await prisma.contract.create({ data: {
      ...contractFields(draft), contractNo: await nextDocNo("CTR", startDate), status: "Draft", renewedFromId: c.id, createdAt: today(),
      historyJson: firstHistory(user.name, `Draft perpanjangan dari ${c.contractNo}`),
    } });
    await prisma.contract.update({ where: { id }, data: { historyJson: addHistory(c.historyJson, user.name, `Draft perpanjangan dibuat: ${created.contractNo}`) } });
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

export async function aiDraftContract(input: { customerId: string; type: string; request: string }) {
  try {
    await guard("shipping");
    if (!input.customerId) throw new Error("Pilih customer dulu.");
    const installedBase = await getInstalledBase(input.customerId);
    const result = await generateContractDraft({ ...input, installedBase });
    return { success: true as const, ...result };
  } catch (err) {
    return { success: false as const, message: err instanceof Error ? err.message : "Gagal membuat draft kontrak dengan AI." };
  }
}

/** Susun surat pengingat pembayaran (AI) untuk invoice yang lewat jatuh tempo, simpan, lalu bisa dicetak. */
export async function createPaymentReminder(invoiceId: string) {
  return run(async () => {
    const user = await guard("finance");
    const letter = await generateReminderLetter(invoiceId);
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const date = today();
    const created = await prisma.paymentReminder.create({ data: {
      letterNo: await nextDocNo("SPP", date), invoiceId, level: letter.level, date, subject: letter.subject, body: letter.body,
      createdBy: user.name, createdAt: new Date().toISOString(),
    } });
    await prisma.invoice.update({ where: { id: invoiceId }, data: { historyJson: addHistory(inv.historyJson, user.name, `${REMINDER_LEVELS[letter.level]} pembayaran ${created.letterNo} (disusun AI)`) } });
    return created.id;
  });
}
