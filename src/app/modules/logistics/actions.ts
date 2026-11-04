"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AiError } from "@/lib/ai";
import { generateOrderDraft } from "./ai/draftOrder";
import { addHistory, guardLogistics, insertOrder, orderData, type OrderInput } from "./server";

export type { OrderInput } from "./server";

type Result = { success: true; id?: string } | { success: false; message: string };

async function run(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const id = await fn();
    revalidatePath("/modules/logistics", "layout");
    return { success: true, id: id || undefined };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Terjadi kesalahan." };
  }
}

// ---------------------------------------------------------
// Order charter
// ---------------------------------------------------------

export async function createOrder(input: OrderInput) {
  return run(async () => {
    const user = await guardLogistics("order");
    return (await insertOrder(user, input)).id;
  });
}

export async function updateOrder(id: string, input: OrderInput) {
  return run(async () => {
    const user = await guardLogistics("order");
    const order = await prisma.charterOrder.findUniqueOrThrow({ where: { id } });
    if (!["Draft", "Confirmed"].includes(order.status)) throw new Error(`Order berstatus ${order.status} tidak bisa diedit.`);
    const { fields, stops } = await orderData(input);
    await prisma.$transaction([
      prisma.charterOrderStop.deleteMany({ where: { orderId: id } }),
      prisma.charterOrder.update({ where: { id }, data: {
        ...fields, historyJson: addHistory(order.historyJson, user.name, `Order diedit · total ${Math.round(fields.total).toLocaleString("id-ID")}`),
        stops: { create: stops },
      } }),
    ]);
    return id;
  });
}

const TRANSITIONS: Record<string, string[]> = {
  Draft: ["Confirmed", "Cancelled"],
  Confirmed: ["Draft", "Cancelled"],
};

export async function setOrderStatus(id: string, status: string, reason?: string) {
  return run(async () => {
    const user = await guardLogistics("order");
    const order = await prisma.charterOrder.findUniqueOrThrow({ where: { id } });
    if (!TRANSITIONS[order.status]?.includes(status)) throw new Error(`Status ${order.status} tidak bisa diubah ke ${status}.`);
    if (status === "Cancelled" && !reason?.trim()) throw new Error("Alasan pembatalan wajib diisi.");
    const label = { Confirmed: "Order dikonfirmasi ke klien", Draft: "Dikembalikan ke Draft", Cancelled: `Order dibatalkan: ${reason}` }[status] ?? status;
    await prisma.charterOrder.update({ where: { id }, data: { status, historyJson: addHistory(order.historyJson, user.name, label) } });
  });
}

// ---------------------------------------------------------
// AI: order dari teks/chat atau suara
// ---------------------------------------------------------

export async function aiDraftOrder(input: { text: string; source: "Teks" | "Suara" }) {
  try {
    await guardLogistics("order");
    const result = await generateOrderDraft(input);
    return { success: true as const, ...result };
  } catch (err) {
    const message = err instanceof AiError || err instanceof Error ? err.message : "Gagal menyusun order dengan AI.";
    return { success: false as const, message };
  }
}

// ---------------------------------------------------------
// Tarif & biaya tambahan (Operations Manager / Direktur)
// ---------------------------------------------------------

export async function updateRate(routeId: string, truckTypeId: string, price: number) {
  return run(async () => {
    const user = await guardLogistics("rates");
    if (!(price > 0) || price > 1e9) throw new Error("Tarif harus angka positif.");
    const data = { price: Math.round(price), updatedBy: user.name, updatedAt: new Date().toISOString() };
    await prisma.charterRate.upsert({ where: { routeId_truckTypeId: { routeId, truckTypeId } }, update: data, create: { routeId, truckTypeId, ...data } });
  });
}

export async function updateSurcharge(code: string, values: { smallAmount: number | null; largeAmount: number | null; percent: number | null; minAmount: number | null }) {
  return run(async () => {
    const user = await guardLogistics("rates");
    const bad = (v: number | null) => v != null && (!Number.isFinite(v) || v < 0);
    if (Object.values(values).some(bad)) throw new Error("Nilai biaya tambahan harus angka ≥ 0.");
    await prisma.rateSurcharge.update({ where: { code }, data: { ...values, updatedBy: user.name, updatedAt: new Date().toISOString() } });
  });
}
