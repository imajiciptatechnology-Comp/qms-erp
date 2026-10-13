"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface MaintenanceRecord {
  id: string;
  machineId: string;
  type: "Preventive" | "Corrective";
  scheduledDate: string;
  status: "Scheduled" | "In Progress" | "Completed";
  technician: string;
  description: string;
  completionDate?: string;
  resolutionNotes?: string;
  relatedWorkOrder?: string;
  downtimeHours?: number;
  partsReplaced?: string;
}

export async function getMaintenanceRecords(): Promise<MaintenanceRecord[]> {
  const records = await prisma.maintenanceRecord.findMany({
    orderBy: { date: 'desc' }
  });
  
  return records.map(r => ({
    id: r.id,
    machineId: r.assetId,
    type: r.type as any,
    scheduledDate: r.date,
    status: r.status as any,
    technician: r.performedBy,
    description: r.description,
    completionDate: r.status === "Completed" ? r.date : undefined,
    resolutionNotes: r.cost ? `Cost: ${r.cost}` : undefined,
    relatedWorkOrder: undefined,
    downtimeHours: r.downtimeHours || undefined,
    partsReplaced: undefined
  }));
}

export async function getMaintenanceRecord(id: string): Promise<MaintenanceRecord | null> {
  const r = await prisma.maintenanceRecord.findUnique({ where: { id } });
  if (!r) return null;
  
  return {
    id: r.id,
    machineId: r.assetId,
    type: r.type as any,
    scheduledDate: r.date,
    status: r.status as any,
    technician: r.performedBy,
    description: r.description,
    completionDate: r.status === "Completed" ? r.date : undefined,
    resolutionNotes: r.cost ? `Cost: ${r.cost}` : undefined,
    relatedWorkOrder: undefined,
    downtimeHours: r.downtimeHours || undefined,
    partsReplaced: undefined
  };
}

export async function addMaintenanceRecord(data: Omit<MaintenanceRecord, "id" | "status" | "completionDate" | "resolutionNotes">) {
  const id = `MNT-${Date.now().toString().slice(-5)}`;
  
  // Ensure the dummy asset exists before linking
  const asset = await prisma.asset.findUnique({ where: { id: data.machineId } });
  if (!asset) {
    await prisma.asset.create({
      data: {
        id: data.machineId,
        assetName: data.machineId,
        serialNumber: data.machineId,
        category: "Machine",
        location: "Factory",
        status: "Active"
      }
    });
  }
  
  await prisma.maintenanceRecord.create({
    data: {
      id,
      assetId: data.machineId,
      type: data.type,
      date: data.scheduledDate,
      status: "Scheduled",
      performedBy: data.technician,
      description: data.description,
      downtimeHours: 0,
      cost: 0
    }
  });
  
  revalidatePath("/modules/maintenance");
  return { success: true, id };
}

export async function updateMaintenanceStatus(
  id: string, 
  status: string, 
  resolutionNotes?: string
) {
  const dataToUpdate: any = { status };
  
  if (status === "Completed") {
    dataToUpdate.date = new Date().toISOString().split("T")[0]; // Use date as completionDate
  }
  
  await prisma.maintenanceRecord.update({
    where: { id },
    data: dataToUpdate
  });
  
  revalidatePath("/modules/maintenance");
  revalidatePath(`/modules/maintenance/${id}`);
  return { success: true };
}

export async function deleteMaintenanceRecord(id: string) {
  await prisma.maintenanceRecord.delete({ where: { id } });
  revalidatePath("/modules/maintenance");
  return { success: true };
}

export async function exportMaintenanceReport(): Promise<string> {
  const { buildExcel } = await import("@/lib/excel");
  const records = await getMaintenanceRecords();

  const rows = records.map(r => ({
    date: r.scheduledDate,
    machineId: r.machineId,
    type: r.type,
    status: r.status,
    technician: r.technician || "-",
    description: r.description || "-",
    partsReplaced: r.partsReplaced || "-",
    downtime: r.downtimeHours ? `${r.downtimeHours} hours` : "-",
    workOrder: r.relatedWorkOrder || "-"
  }));

  return buildExcel({
    sheetName: "Maintenance Records",
    title: "REKAPITULASI MAINTENANCE MESIN",
    subtitle: `ISO 9001:2015 Clause 7.1.3 — Generated: ${new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}`,
    columns: [
      { header: "Tanggal",       key: "date",          width: 15 },
      { header: "ID Mesin",      key: "machineId",     width: 15 },
      { header: "Tipe",          key: "type",          width: 15 },
      { header: "Status",        key: "status",        width: 15 },
      { header: "Teknisi",       key: "technician",    width: 20 },
      { header: "Deskripsi",     key: "description",   width: 40 },
      { header: "Parts Diganti", key: "partsReplaced", width: 25 },
      { header: "Downtime",      key: "downtime",      width: 12 },
      { header: "No. Work Order",key: "workOrder",     width: 18 }
    ],
    rows,
  });
}
