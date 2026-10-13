"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface MocRecord {
  id: string; // e.g. MOC-2026-001
  title: string;
  category: "Process" | "Equipment" | "Material" | "Document" | "Organization";
  proposer: string;
  requestDate: string;
  description: string;
  riskAssessment?: string;
  verificationNotes?: string;
  status: "Requested" | "Assessed" | "Approved" | "Rejected" | "Implemented" | "Closed";
}

export async function getMocRecords(): Promise<MocRecord[]> {
  const mocs = await prisma.moc.findMany({
    orderBy: { dateRequested: 'desc' }
  });
  
  return mocs.map(m => ({
    id: m.id,
    title: m.title,
    category: m.category as any,
    proposer: m.requester,
    requestDate: m.dateRequested,
    description: m.description,
    riskAssessment: m.assessment || undefined,
    verificationNotes: m.mitigation || undefined,
    status: m.status as any
  }));
}

export async function getMocRecord(id: string): Promise<MocRecord | null> {
  const m = await prisma.moc.findUnique({ where: { id } });
  if (!m) return null;
  
  return {
    id: m.id,
    title: m.title,
    category: m.category as any,
    proposer: m.requester,
    requestDate: m.dateRequested,
    description: m.description,
    riskAssessment: m.assessment || undefined,
    verificationNotes: m.mitigation || undefined,
    status: m.status as any
  };
}

export async function addMoc(moc: Omit<MocRecord, "id" | "status" | "riskAssessment" | "verificationNotes">) {
  const id = `MOC-${Date.now().toString().slice(-5)}`;
  
  await prisma.moc.create({
    data: {
      id,
      title: moc.title,
      category: moc.category,
      requester: moc.proposer,
      department: "General", // Default mapped
      dateRequested: moc.requestDate,
      description: moc.description,
      status: "Requested",
      riskLevel: "Low" // Default mapped
    }
  });
  
  revalidatePath("/modules/moc");
  return { success: true, id };
}

export async function updateMocStatus(
  id: string, 
  status: string, 
  notes?: { riskAssessment?: string; verificationNotes?: string }
) {
  const dataToUpdate: any = { status };
  
  if (notes?.riskAssessment) {
    dataToUpdate.assessment = notes.riskAssessment;
  }
  if (notes?.verificationNotes) {
    dataToUpdate.mitigation = notes.verificationNotes;
  }
  
  await prisma.moc.update({
    where: { id },
    data: dataToUpdate
  });
  
  revalidatePath("/modules/moc");
  revalidatePath(`/modules/moc/${id}`);
  return { success: true };
}

export async function deleteMoc(id: string) {
  await prisma.moc.delete({ where: { id } });
  revalidatePath("/modules/moc");
  return { success: true };
}
