"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface ShipmentItem {
  id: string;
  productName: string;
  quantity: number;
  lotNumber: string;
  workOrderId?: string;
}

export interface ShipmentRecord {
  id: string;
  customerName: string;
  destination: string;
  shippingDate: string;
  logisticsProvider: string;
  vehicleNumber: string;
  status: "Pending" | "In Transit" | "Delivered" | "Cancelled";
  proofOfDelivery?: string;
  remarks: string;
  items: ShipmentItem[];
}

export async function getShipments(): Promise<ShipmentRecord[]> {
  const shipments = await prisma.shipment.findMany({
    include: { items: true },
    orderBy: { shippingDate: 'desc' }
  });
  
  return shipments.map(s => ({
    id: s.id,
    customerName: s.customerName,
    destination: s.destination,
    shippingDate: s.shippingDate,
    logisticsProvider: s.logisticsProvider,
    vehicleNumber: s.vehicleNumber,
    status: s.status as any,
    proofOfDelivery: s.proofOfDelivery || undefined,
    remarks: s.remarks,
    items: s.items.map(i => ({
      id: i.id,
      productName: i.productName,
      quantity: i.quantity,
      lotNumber: i.lotNumber,
      workOrderId: i.workOrderId || undefined
    }))
  }));
}

export async function getShipment(id: string): Promise<ShipmentRecord | null> {
  const s = await prisma.shipment.findUnique({
    where: { id },
    include: { items: true }
  });
  if (!s) return null;
  
  return {
    id: s.id,
    customerName: s.customerName,
    destination: s.destination,
    shippingDate: s.shippingDate,
    logisticsProvider: s.logisticsProvider,
    vehicleNumber: s.vehicleNumber,
    status: s.status as any,
    proofOfDelivery: s.proofOfDelivery || undefined,
    remarks: s.remarks,
    items: s.items.map(i => ({
      id: i.id,
      productName: i.productName,
      quantity: i.quantity,
      lotNumber: i.lotNumber,
      workOrderId: i.workOrderId || undefined
    }))
  };
}

export async function addShipment(data: Omit<ShipmentRecord, "id" | "status" | "proofOfDelivery" | "items">) {
  const id = `DO-${Date.now().toString().slice(-5)}`;
  
  await prisma.shipment.create({
    data: {
      id,
      customerName: data.customerName,
      destination: data.destination,
      shippingDate: data.shippingDate,
      logisticsProvider: data.logisticsProvider,
      vehicleNumber: data.vehicleNumber,
      status: "Pending",
      remarks: data.remarks || ""
    }
  });
  
  revalidatePath("/modules/shipping");
  return { success: true, id };
}

export async function updateShipmentStatus(
  id: string, 
  status: string, 
  proofOfDelivery?: string
) {
  const dataToUpdate: any = { status };
  if (proofOfDelivery !== undefined) {
    dataToUpdate.proofOfDelivery = proofOfDelivery;
  }
  
  await prisma.shipment.update({
    where: { id },
    data: dataToUpdate
  });
  
  revalidatePath("/modules/shipping");
  revalidatePath(`/modules/shipping/${id}`);
  return { success: true };
}

export async function addShipmentItem(shipmentId: string, item: Omit<ShipmentItem, "id">) {
  await prisma.shipmentItem.create({
    data: {
      id: `ITEM-${Date.now()}`,
      shipmentId,
      productName: item.productName,
      quantity: item.quantity,
      lotNumber: item.lotNumber,
      workOrderId: item.workOrderId
    }
  });
  
  revalidatePath(`/modules/shipping/${shipmentId}`);
  return { success: true };
}

export async function deleteShipmentItem(shipmentId: string, itemId: string) {
  await prisma.shipmentItem.delete({ where: { id: itemId } });
  revalidatePath(`/modules/shipping/${shipmentId}`);
  return { success: true };
}

export async function deleteShipment(id: string) {
  await prisma.shipment.delete({ where: { id } });
  revalidatePath("/modules/shipping");
  return { success: true };
}
