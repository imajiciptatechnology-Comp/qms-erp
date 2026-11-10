"use server";

// Tender (checklist dokumen, syarat TKDN) & jaminan bank/asuransi.
import { prisma } from "@/lib/prisma";
import { uploadToStorage } from "@/lib/uploadFile";
import { CURRENCIES, GUARANTEE_TYPES, defaultTenderChecklist, today, weightedTkdn, type ChecklistItem } from "./lib";
import { addHistory, firstHistory } from "./server";
import { guardAny, run } from "./serverGuard";

// ---------------------------------------------------------
// Tender
// ---------------------------------------------------------

export async function getTender(id: string) {
  await guardAny("canView");
  const o = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, country: true, type: true } },
      quotations: { include: { items: { select: { lineTotal: true, productId: true } } }, orderBy: [{ date: "desc" }, { revision: "desc" }] },
      guarantees: { orderBy: { expiryDate: "asc" } },
    },
  });
  if (!o) return null;
  const productIds = [...new Set(o.quotations.flatMap(q => q.items.map(i => i.productId)).filter((x): x is string => !!x))];
  const products = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, tkdnPercent: true } }) : [];
  const tkdnOf = new Map(products.map(p => [p.id, p.tkdnPercent]));
  return {
    ...o,
    quotations: o.quotations.map(({ items, ...q }) => ({ ...q, tkdn: weightedTkdn(items.map(i => ({ lineTotal: i.lineTotal, tkdn: i.productId ? tkdnOf.get(i.productId) ?? null : null }))) })),
  };
}

const readList = (json: string) => JSON.parse(json || "[]") as ChecklistItem[];

export async function saveTenderInfo(id: string, data: { tenderNo?: string; tenderDeadline?: string; tkdnRequired?: number | null }) {
  return run(async () => {
    const user = await guardAny("canManage");
    const o = await prisma.opportunity.findUniqueOrThrow({ where: { id } });
    if (data.tkdnRequired != null && !(data.tkdnRequired >= 0 && data.tkdnRequired <= 100)) throw new Error("Syarat TKDN harus 0–100%.");
    await prisma.opportunity.update({ where: { id }, data: {
      tenderNo: data.tenderNo?.trim() || null, tenderDeadline: data.tenderDeadline || null, tkdnRequired: data.tkdnRequired ?? null,
      historyJson: addHistory(o.historyJson, user.name, "Data tender diperbarui"),
    } });
  });
}

/** Isi checklist baku sesuai sumber tender (pemerintah / internasional) bila masih kosong. */
export async function initTenderChecklist(id: string) {
  return run(async () => {
    const user = await guardAny("canManage");
    const o = await prisma.opportunity.findUniqueOrThrow({ where: { id } });
    if (readList(o.tenderChecklistJson).length) throw new Error("Checklist sudah ada.");
    await prisma.opportunity.update({ where: { id }, data: { tenderChecklistJson: JSON.stringify(defaultTenderChecklist(o.source)), historyJson: addHistory(o.historyJson, user.name, "Checklist dokumen tender dibuat") } });
  });
}

export async function updateTenderChecklist(id: string, op: { kind: "toggle" | "remove"; index: number } | { kind: "add"; name: string }) {
  return run(async () => {
    await guardAny("canManage");
    const o = await prisma.opportunity.findUniqueOrThrow({ where: { id } });
    const list = readList(o.tenderChecklistJson);
    if (op.kind === "add") {
      if (!op.name.trim()) throw new Error("Nama dokumen wajib diisi.");
      list.push({ name: op.name.trim(), done: false });
    } else {
      if (!list[op.index]) throw new Error("Item tidak ditemukan.");
      if (op.kind === "toggle") list[op.index] = { ...list[op.index], done: !list[op.index].done };
      else list.splice(op.index, 1);
    }
    await prisma.opportunity.update({ where: { id }, data: { tenderChecklistJson: JSON.stringify(list) } });
  });
}

// ---------------------------------------------------------
// Jaminan
// ---------------------------------------------------------

export async function getGuarantees() {
  await guardAny("canView", "canShipping");
  return prisma.guarantee.findMany({
    include: { customer: { select: { id: true, name: true } }, opportunity: { select: { id: true, opportunityNo: true, title: true } }, salesOrder: { select: { id: true, soNo: true } } },
    orderBy: [{ status: "asc" }, { expiryDate: "asc" }],
  });
}

export async function getGuaranteeFormData() {
  await guardAny("canView");
  const [customers, opportunities, orders] = await Promise.all([
    prisma.customer.findMany({ where: { status: "Active" }, orderBy: { name: "asc" }, select: { id: true, name: true, currency: true } }),
    prisma.opportunity.findMany({ where: { stage: { notIn: ["Lost"] } }, orderBy: { createdAt: "desc" }, select: { id: true, opportunityNo: true, title: true, customerId: true } }),
    prisma.salesOrder.findMany({ where: { status: { not: "Cancelled" } }, orderBy: { orderDate: "desc" }, select: { id: true, soNo: true, customerId: true } }),
  ]);
  return { customers, opportunities, orders };
}

export async function saveGuarantee(formData: FormData) {
  return run(async () => {
    const user = await guardAny("canManage", "canFinance");
    const s = (k: string) => String(formData.get(k) ?? "").trim();
    const id = s("id") || null;
    const data = {
      guaranteeNo: s("guaranteeNo"), type: s("type"), issuer: s("issuer"), amount: Number(s("amount")), currency: s("currency") || "IDR",
      issueDate: s("issueDate"), expiryDate: s("expiryDate"), customerId: s("customerId"),
      opportunityId: s("opportunityId") || null, salesOrderId: s("salesOrderId") || null, notes: s("notes") || null,
    };
    if (!data.guaranteeNo || !data.issuer || !data.customerId) throw new Error("Nomor jaminan, penerbit, dan customer wajib diisi.");
    if (!GUARANTEE_TYPES.includes(data.type)) throw new Error("Jenis jaminan tidak dikenal.");
    if (!(CURRENCIES as readonly string[]).includes(data.currency)) throw new Error("Mata uang tidak dikenal.");
    if (!(data.amount > 0)) throw new Error("Nilai jaminan tidak valid.");
    if (!data.issueDate || !data.expiryDate || data.expiryDate < data.issueDate) throw new Error("Masa berlaku tidak valid.");
    const file = formData.get("file") as File | null;
    const fileUrl = file && file.size > 0 ? await uploadToStorage("sales/guarantees", file) : undefined;
    if (id) {
      const old = await prisma.guarantee.findUniqueOrThrow({ where: { id } });
      await prisma.guarantee.update({ where: { id }, data: { ...data, ...(fileUrl ? { fileUrl } : {}), historyJson: addHistory(old.historyJson, user.name, "Data jaminan diperbarui") } });
      return id;
    }
    const created = await prisma.guarantee.create({ data: { ...data, fileUrl: fileUrl ?? null, status: "Active", createdBy: user.name, createdAt: today(), historyJson: firstHistory(user.name, `${data.type} dicatat`) } });
    return created.id;
  });
}

/** Jaminan dikembalikan penerbit (selesai) atau dicairkan pemberi kerja (klaim). */
export async function setGuaranteeStatus(id: string, status: "Released" | "Claimed", note?: string) {
  return run(async () => {
    const user = await guardAny("canManage", "canFinance");
    const g = await prisma.guarantee.findUniqueOrThrow({ where: { id } });
    if (g.status !== "Active") throw new Error("Jaminan ini sudah tidak aktif.");
    if (status === "Claimed" && !note?.trim()) throw new Error("Tulis alasan pencairan.");
    await prisma.guarantee.update({ where: { id }, data: { status, historyJson: addHistory(g.historyJson, user.name, `${status === "Released" ? "Dikembalikan / selesai" : "Dicairkan"}${note ? `: ${note}` : ""}`) } });
  });
}
