"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface WorkOrder {
  id: string;
  productName: string;
  targetQuantity: number;
  actualQuantity?: number;
  startDate: string;
  endDate: string;
  status: "Scheduled" | "In Progress" | "Completed" | "On Hold";
  operator: string;
  machineId: string;
  notes: string;
  qcRequested?: boolean;
}

export async function getWorkOrders(): Promise<WorkOrder[]> {
  const wos = await prisma.workOrder.findMany({
    orderBy: { startDate: 'desc' }
  });
  
  return wos.map(w => ({
    id: w.id,
    productName: w.productName,
    targetQuantity: w.targetQuantity,
    actualQuantity: w.actualQuantity || undefined,
    startDate: w.startDate,
    endDate: w.endDate,
    status: w.status as any,
    operator: w.operator,
    machineId: w.machineId,
    notes: w.notes,
    qcRequested: w.qcRequested
  }));
}

export async function getWorkOrder(id: string): Promise<WorkOrder | null> {
  const w = await prisma.workOrder.findUnique({ where: { id } });
  if (!w) return null;
  return {
    id: w.id,
    productName: w.productName,
    targetQuantity: w.targetQuantity,
    actualQuantity: w.actualQuantity || undefined,
    startDate: w.startDate,
    endDate: w.endDate,
    status: w.status as any,
    operator: w.operator,
    machineId: w.machineId,
    notes: w.notes,
    qcRequested: w.qcRequested
  };
}

export async function addWorkOrder(data: Omit<WorkOrder, "id" | "status" | "actualQuantity" | "qcRequested">) {
  const id = `WO-${Date.now().toString().slice(-5)}`;
  
  await prisma.workOrder.create({
    data: {
      id,
      productName: data.productName,
      targetQuantity: data.targetQuantity,
      startDate: data.startDate,
      endDate: data.endDate,
      status: "Scheduled",
      operator: data.operator,
      machineId: data.machineId,
      notes: data.notes || "",
      qcRequested: false
    }
  });
  
  revalidatePath("/modules/ppc");
  return { success: true, id };
}

export async function updateWorkOrderStatus(
  id: string, 
  status: string, 
  actualQuantity?: number
) {
  const dataToUpdate: any = { status };
  if (actualQuantity !== undefined) {
    dataToUpdate.actualQuantity = actualQuantity;
  }
  
  await prisma.workOrder.update({
    where: { id },
    data: dataToUpdate
  });
  
  revalidatePath("/modules/ppc");
  revalidatePath(`/modules/ppc/${id}`);
  return { success: true };
}

export async function markQCRequested(id: string) {
  await prisma.workOrder.update({
    where: { id },
    data: { qcRequested: true }
  });
  
  revalidatePath(`/modules/ppc/${id}`);
  return { success: true };
}

export async function deleteWorkOrder(id: string) {
  await prisma.workOrder.delete({ where: { id } });
  revalidatePath("/modules/ppc");
  return { success: true };
}
