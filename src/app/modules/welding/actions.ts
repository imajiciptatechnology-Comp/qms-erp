"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface WelderRecord {
  id: string; // Internal ID
  stampNumber: string; // Welder Stamp / ID
  name: string;
  processType: string; // e.g. SMAW, GTAW, FCAW
  position: string; // e.g. 1G, 3G, 6G
  expiryDate: string;
  status: "Active" | "Expired" | "Revoked";
  notes?: string;
}

export interface WPSRecord {
  id: string; // WPS Number
  baseMetal: string;
  fillerMetal: string;
  processType: string;
  status: "Active" | "Obsolete";
  issueDate: string;
}

export async function getWelders(): Promise<WelderRecord[]> {
  const welders = await prisma.welder.findMany({
    orderBy: { name: 'asc' }
  });
  
  const today = new Date().toISOString().split("T")[0];
  let needsRevalidate = false;
  
  const updated = await Promise.all(welders.map(async w => {
    if (w.status === "Active" && w.expiryDate < today) {
      needsRevalidate = true;
      await prisma.welder.update({
        where: { id: w.id },
        data: { status: "Expired" }
      });
      w.status = "Expired";
    }
    return {
      id: w.id,
      stampNumber: w.stampNumber,
      name: w.name,
      processType: w.processType,
      position: w.position,
      expiryDate: w.expiryDate,
      status: w.status as any,
      notes: w.notes || undefined
    };
  }));

  if (needsRevalidate) {
    revalidatePath("/modules/welding");
  }

  return updated;
}

export async function addWelder(welder: Omit<WelderRecord, "id" | "status">) {
  const id = `WQR-${Date.now().toString().slice(-5)}`;
  const today = new Date().toISOString().split("T")[0];
  const status = welder.expiryDate < today ? "Expired" : "Active";

  try {
    await prisma.welder.create({
      data: {
        id,
        stampNumber: welder.stampNumber,
        name: welder.name,
        processType: welder.processType,
        position: welder.position,
        expiryDate: welder.expiryDate,
        status,
        notes: welder.notes || ""
      }
    });
    
    revalidatePath("/modules/welding");
    return { success: true, id };
  } catch (error) {
    console.error("Error adding welder:", error);
    return { success: false, message: "Stamp number might already exist or another error occurred." };
  }
}

export async function revokeWelder(id: string) {
  await prisma.welder.update({
    where: { id },
    data: { status: "Revoked" }
  });
  revalidatePath("/modules/welding");
  return { success: true };
}

export async function deleteWelder(id: string) {
  await prisma.welder.delete({ where: { id } });
  revalidatePath("/modules/welding");
  return { success: true };
}

export async function getWPS(): Promise<WPSRecord[]> {
  const wpsList = await prisma.wPS.findMany({
    orderBy: { id: 'asc' }
  });
  
  return wpsList.map(w => ({
    id: w.id,
    baseMetal: w.baseMetal,
    fillerMetal: w.fillerMetal,
    processType: w.processType,
    status: w.status as any,
    issueDate: w.issueDate
  }));
}

export async function addWPS(wps: Omit<WPSRecord, "status">) {
  try {
    await prisma.wPS.create({
      data: {
        id: wps.id,
        baseMetal: wps.baseMetal,
        fillerMetal: wps.fillerMetal,
        processType: wps.processType,
        status: "Active",
        issueDate: wps.issueDate
      }
    });
    
    revalidatePath("/modules/welding");
    return { success: true, id: wps.id };
  } catch (error) {
    console.error("Error adding WPS:", error);
    return { success: false, message: "WPS Number already exists or another error occurred." };
  }
}

export async function markWPSObsolete(id: string) {
  await prisma.wPS.update({
    where: { id },
    data: { status: "Obsolete" }
  });
  revalidatePath("/modules/welding");
  return { success: true };
}

export async function deleteWPS(id: string) {
  await prisma.wPS.delete({ where: { id } });
  revalidatePath("/modules/welding");
  return { success: true };
}
