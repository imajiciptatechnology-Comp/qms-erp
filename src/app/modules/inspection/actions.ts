"use server";

import { revalidatePath } from "next/cache";
import { getJson, setJson } from "@/lib/kvStore";

export interface InspectionParameter {
  id: string;
  name: string;
  standard: string;
  actualResult: string;
  status: "Pass" | "Fail" | "Pending";
}

export interface InspectionRecord {
  id: string;
  type: "Incoming" | "In-Process" | "Final";
  itemName: string;
  lotNumber: string;
  sampleSize: number;
  inspector: string;
  date: string;
  status: "Pass" | "Fail" | "Conditional Accept" | "Pending";
  remarks: string;
  parameters: InspectionParameter[];
  ncReference?: string;
}

export async function getInspections(): Promise<InspectionRecord[]> {
  return getJson<InspectionRecord[]>("inspection", []);
}

export async function getInspection(id: string) {
  const inspections = await getInspections();
  return inspections.find(i => i.id === id) || null;
}

async function saveInspections(data: InspectionRecord[]) {
  await setJson("inspection", data);
}

export async function addInspection(data: {
  type: "Incoming" | "In-Process" | "Final";
  itemName: string;
  lotNumber: string;
  sampleSize: number;
  inspector: string;
  date: string;
  remarks: string;
}) {
  const inspections = await getInspections();
  const id = `QC-${Date.now().toString().slice(-5)}`;
  
  const newInspection: InspectionRecord = {
    id,
    ...data,
    status: "Pending",
    parameters: []
  };
  
  inspections.unshift(newInspection);
  await saveInspections(inspections);
  revalidatePath("/modules/inspection");
  
  return { success: true, id };
}

export async function updateInspectionStatus(id: string, status: InspectionRecord["status"], ncReference?: string) {
  const inspections = await getInspections();
  const idx = inspections.findIndex(i => i.id === id);
  if (idx === -1) return { success: false, message: "Inspection not found" };
  
  inspections[idx].status = status;
  if (ncReference !== undefined) {
    inspections[idx].ncReference = ncReference;
  }
  
  await saveInspections(inspections);
  revalidatePath("/modules/inspection");
  revalidatePath(`/modules/inspection/${id}`);
  
  return { success: true };
}

export async function addInspectionParameter(inspectionId: string, data: Omit<InspectionParameter, "id">) {
  const inspections = await getInspections();
  const idx = inspections.findIndex(i => i.id === inspectionId);
  if (idx === -1) return { success: false, message: "Inspection not found" };
  
  const newParam: InspectionParameter = {
    ...data,
    id: `PARAM-${Date.now()}`
  };
  
  inspections[idx].parameters.push(newParam);
  await saveInspections(inspections);
  revalidatePath(`/modules/inspection/${inspectionId}`);
  
  return { success: true };
}

export async function updateInspectionParameter(
  inspectionId: string, 
  parameterId: string, 
  data: Partial<Omit<InspectionParameter, "id">>
) {
  const inspections = await getInspections();
  const idx = inspections.findIndex(i => i.id === inspectionId);
  if (idx === -1) return { success: false, message: "Inspection not found" };
  
  const paramIdx = inspections[idx].parameters.findIndex(p => p.id === parameterId);
  if (paramIdx === -1) return { success: false, message: "Parameter not found" };
  
  inspections[idx].parameters[paramIdx] = {
    ...inspections[idx].parameters[paramIdx],
    ...data
  };
  
  await saveInspections(inspections);
  revalidatePath(`/modules/inspection/${inspectionId}`);
  
  return { success: true };
}

export async function deleteInspectionParameter(inspectionId: string, parameterId: string) {
  const inspections = await getInspections();
  const idx = inspections.findIndex(i => i.id === inspectionId);
  if (idx === -1) return { success: false, message: "Inspection not found" };
  
  inspections[idx].parameters = inspections[idx].parameters.filter(p => p.id !== parameterId);
  
  await saveInspections(inspections);
  revalidatePath(`/modules/inspection/${inspectionId}`);
  
  return { success: true };
}

export async function deleteInspection(id: string) {
  let inspections = await getInspections();
  inspections = inspections.filter(i => i.id !== id);
  await saveInspections(inspections);
  revalidatePath("/modules/inspection");
  return { success: true };
}
