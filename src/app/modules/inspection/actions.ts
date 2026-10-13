"use server";

import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";

const INSPECTION_FILE = path.join(process.cwd(), ".data", "inspection.json");

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
  try {
    if (!fs.existsSync(INSPECTION_FILE)) return [];
    return JSON.parse(fs.readFileSync(INSPECTION_FILE, "utf-8"));
  } catch (error) {
    console.error("Error reading inspection data:", error);
    return [];
  }
}

export async function getInspection(id: string) {
  const inspections = await getInspections();
  return inspections.find(i => i.id === id) || null;
}

function saveInspections(data: InspectionRecord[]) {
  const dir = path.dirname(INSPECTION_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(INSPECTION_FILE, JSON.stringify(data, null, 2));
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
  saveInspections(inspections);
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
  
  saveInspections(inspections);
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
  saveInspections(inspections);
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
  
  saveInspections(inspections);
  revalidatePath(`/modules/inspection/${inspectionId}`);
  
  return { success: true };
}

export async function deleteInspectionParameter(inspectionId: string, parameterId: string) {
  const inspections = await getInspections();
  const idx = inspections.findIndex(i => i.id === inspectionId);
  if (idx === -1) return { success: false, message: "Inspection not found" };
  
  inspections[idx].parameters = inspections[idx].parameters.filter(p => p.id !== parameterId);
  
  saveInspections(inspections);
  revalidatePath(`/modules/inspection/${inspectionId}`);
  
  return { success: true };
}

export async function deleteInspection(id: string) {
  let inspections = await getInspections();
  inspections = inspections.filter(i => i.id !== id);
  saveInspections(inspections);
  revalidatePath("/modules/inspection");
  return { success: true };
}
