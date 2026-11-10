"use server";

// Agen / kantor perwakilan per negara & komisi dari Sales Order.
import { prisma } from "@/lib/prisma";
import { commissionAmount, commissionState, orderPaidStatus, today } from "./lib";
import { addHistory } from "./server";
import { guardAny, run } from "./serverGuard";

export async function getAgentsOverview() {
  await guardAny("canView");
  const [agents, orders] = await Promise.all([
    prisma.agent.findMany({ orderBy: { name: "asc" }, include: { customers: { select: { id: true, name: true, country: true } } } }),
    prisma.salesOrder.findMany({
      where: { agentId: { not: null } },
      include: { customer: { select: { name: true, country: true } }, agent: { select: { id: true, name: true } }, invoices: { select: { status: true, paidAmount: true } } },
      orderBy: { orderDate: "desc" },
    }),
  ]);
  const commissions = orders.map(o => {
    const pay = orderPaidStatus(o);
    return {
      id: o.id, soNo: o.soNo, orderDate: o.orderDate, status: o.status, customer: o.customer.name, country: o.customer.country,
      agentId: o.agentId!, agentName: o.agent?.name ?? "-", currency: o.currency, exchangeRate: o.exchangeRate, subtotal: o.subtotal,
      commissionPercent: o.commissionPercent, amount: commissionAmount(o), paidAt: o.commissionPaidAt, paidRef: o.commissionPaidRef,
      state: commissionState({ ...o, fullyPaid: pay.fullyPaid }),
    };
  });
  return { agents, commissions };
}

/** Pilihan agen aktif untuk form customer / Sales Order. */
export async function getAgentOptions() {
  await guardAny("canView");
  return prisma.agent.findMany({ where: { status: "Active" }, orderBy: { name: "asc" }, select: { id: true, name: true, countries: true, commissionPercent: true } });
}

export type AgentInput = { name: string; countries: string; contactName?: string; email?: string; phone?: string; commissionPercent: number; status: string; notes?: string };

export async function saveAgent(id: string | null, data: AgentInput) {
  return run(async () => {
    await guardAny("canApprove");
    if (!data.name?.trim() || !data.countries?.trim()) throw new Error("Nama agen dan negara wajib diisi.");
    if (!(data.commissionPercent >= 0 && data.commissionPercent <= 30)) throw new Error("Komisi harus 0–30%.");
    const fields = {
      name: data.name.trim(), countries: data.countries.split(",").map(c => c.trim()).filter(Boolean).join(", "),
      contactName: data.contactName?.trim() || null, email: data.email?.trim() || null, phone: data.phone?.trim() || null,
      commissionPercent: data.commissionPercent, status: data.status === "Inactive" ? "Inactive" : "Active", notes: data.notes?.trim() || null,
    };
    if (id) {
      await prisma.agent.update({ where: { id }, data: fields });
      return id;
    }
    const count = await prisma.agent.count();
    const created = await prisma.agent.create({ data: { ...fields, agentNo: `AGT-${String(count + 1).padStart(3, "0")}-${Date.now().toString().slice(-3)}`, createdAt: today() } });
    return created.id;
  });
}

/** Ganti agen / persentase komisi pada satu Sales Order (Sales Manager). */
export async function setOrderCommission(salesOrderId: string, agentId: string | null, commissionPercent: number | null) {
  return run(async () => {
    const user = await guardAny("canApprove");
    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId } });
    if (so.commissionPaidAt) throw new Error("Komisi order ini sudah dibayar.");
    if (agentId && !(commissionPercent != null && commissionPercent >= 0 && commissionPercent <= 30)) throw new Error("Komisi harus 0–30%.");
    const agent = agentId ? await prisma.agent.findUniqueOrThrow({ where: { id: agentId } }) : null;
    await prisma.salesOrder.update({ where: { id: salesOrderId }, data: {
      agentId: agent?.id ?? null, commissionPercent: agent ? commissionPercent : null,
      historyJson: addHistory(so.historyJson, user.name, agent ? `Komisi agen ${agent.name}: ${commissionPercent}%` : "Komisi agen dihapus"),
    } });
  });
}

/** Catat pembayaran komisi; hanya setelah Sales Order lunas. */
export async function markCommissionPaid(salesOrderId: string, data: { paidAt: string; reference: string }) {
  return run(async () => {
    const user = await guardAny("canFinance");
    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId }, include: { invoices: { select: { status: true, paidAmount: true } }, agent: true } });
    if (!so.agentId || !so.commissionPercent) throw new Error("Order ini tidak memiliki komisi agen.");
    if (so.commissionPaidAt) throw new Error("Komisi sudah dibayar.");
    if (!orderPaidStatus(so).fullyPaid) throw new Error("Komisi baru bisa dibayar setelah Sales Order lunas.");
    if (!data.paidAt || !data.reference?.trim()) throw new Error("Tanggal dan referensi pembayaran wajib diisi.");
    await prisma.salesOrder.update({ where: { id: salesOrderId }, data: {
      commissionPaidAt: data.paidAt, commissionPaidRef: data.reference.trim(),
      historyJson: addHistory(so.historyJson, user.name, `Komisi ${so.agent?.name ?? "agen"} dibayar (${data.reference.trim()})`),
    } });
  });
}
