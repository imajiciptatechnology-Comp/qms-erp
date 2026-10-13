"use server";

import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/app/actions/auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "calibration");

export interface CalibrationRecord {
  id: string;
  date: string;
  certificateNo: string;
  calibratedBy: string;
  result: "Pass" | "Fail" | "Adjusted";
  nextDueDate: string;
  remarks?: string;
  attachmentUrl?: string;
  masterEquipmentUsed?: string;
}

export interface PMRecord {
  id: string;
  date: string;
  conductedBy: string;
  status: "Completed" | "Issues Found";
  notes?: string;
}

export interface EquipmentItem {
  id: string;
  equipmentNo: string;
  name: string;
  category: "Measuring" | "Testing" | "Production" | "Other";
  location: string;
  range?: string;
  tolerance?: string;
  resolution?: string;
  frequencyMonths: number;
  lastCalibrationDate?: string;
  nextCalibrationDate?: string;
  status: "Active" | "Out of Service" | "Lost" | "Damaged";
  picName: string;
  history: CalibrationRecord[];

  pmFrequencyDays?: number;
  pmChecklist?: string[];
  pmHistory?: PMRecord[];
}

function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

function mapEquipment(e: any): EquipmentItem {
  return {
    id: e.id,
    equipmentNo: e.serialNumber,
    name: e.equipmentName,
    category: e.category as EquipmentItem["category"],
    location: e.location,
    range: e.range || undefined,
    tolerance: e.tolerance,
    resolution: e.resolution || undefined,
    frequencyMonths: e.frequencyMonths,
    lastCalibrationDate: e.lastCalDate,
    nextCalibrationDate: e.nextCalDate,
    status: e.status as any,
    picName: e.picName || "-",
    history: e.records.map((r: any) => ({
      id: r.id,
      date: r.date,
      certificateNo: r.certificateNo,
      calibratedBy: r.performedBy,
      result: r.result as any,
      nextDueDate: e.nextCalDate,
      remarks: r.remarks || undefined,
      attachmentUrl: r.attachmentUrl || undefined,
      masterEquipmentUsed: r.masterEquipmentUsed || undefined,
    })),
    pmFrequencyDays: e.pmFrequencyDays || undefined,
    pmChecklist: safeParse<string[]>(e.pmChecklistJson, []),
    pmHistory: (e.pmRecords || []).map((p: any) => ({
      id: p.id,
      date: p.date,
      conductedBy: p.conductedBy,
      status: p.status as any,
      notes: p.notes || undefined,
    })),
  };
}

export async function getEquipments(): Promise<EquipmentItem[]> {
  const eqs = await prisma.equipment.findMany({
    include: { records: true, pmRecords: true }
  });
  return eqs.map(mapEquipment);
}

export async function getEquipment(id: string): Promise<EquipmentItem | null> {
  const e = await prisma.equipment.findUnique({
    where: { id },
    include: { records: true, pmRecords: true }
  });
  return e ? mapEquipment(e) : null;
}

export async function addEquipment(data: Omit<EquipmentItem, "id" | "history" | "lastCalibrationDate" | "nextCalibrationDate" | "pmHistory">) {
  const id = `CAL-${Date.now().toString().slice(-4)}`;

  await prisma.equipment.create({
    data: {
      id,
      equipmentName: data.name,
      serialNumber: data.equipmentNo,
      category: data.category || "Measuring",
      location: data.location,
      range: data.range || null,
      resolution: data.resolution || null,
      frequencyMonths: data.frequencyMonths,
      lastCalDate: new Date().toISOString().split("T")[0],
      nextCalDate: new Date().toISOString().split("T")[0],
      status: "Active",
      tolerance: data.tolerance || "N/A",
      picName: data.picName || null,
      pmFrequencyDays: data.pmFrequencyDays || null,
      pmChecklistJson: JSON.stringify(data.pmChecklist || []),
    }
  });

  revalidatePath("/modules/calibration");
  return { success: true, id };
}

export async function updateEquipment(id: string, data: Partial<EquipmentItem>) {
  const updateData: any = {};
  if (data.name) updateData.equipmentName = data.name;
  if (data.equipmentNo) updateData.serialNumber = data.equipmentNo;
  if (data.category) updateData.category = data.category;
  if (data.location) updateData.location = data.location;
  if (data.range !== undefined) updateData.range = data.range;
  if (data.resolution !== undefined) updateData.resolution = data.resolution;
  if (data.frequencyMonths) updateData.frequencyMonths = data.frequencyMonths;
  if (data.status) updateData.status = data.status;
  if (data.tolerance) updateData.tolerance = data.tolerance;
  if (data.picName !== undefined) updateData.picName = data.picName;

  await prisma.equipment.update({
    where: { id },
    data: updateData
  });

  revalidatePath("/modules/calibration");
  revalidatePath(`/modules/calibration/${id}`);
  return { success: true };
}

export async function addCalibrationRecord(equipmentId: string, record: Omit<CalibrationRecord, "id" | "attachmentUrl">) {
  const created = await prisma.calibrationRecord.create({
    data: {
      equipmentId,
      date: record.date,
      certificateNo: record.certificateNo,
      performedBy: record.calibratedBy,
      result: record.result,
      remarks: record.remarks,
      masterEquipmentUsed: record.masterEquipmentUsed,
    }
  });

  await prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      lastCalDate: record.date,
      nextCalDate: record.nextDueDate
    }
  });

  revalidatePath(`/modules/calibration/${equipmentId}`);
  revalidatePath("/modules/calibration");
  return { success: true, data: { id: created.id } };
}

export async function uploadCalibrationCertificate(equipmentId: string, recordId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, message: "No file provided" };

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name);
  const fileName = `${recordId}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);

  await prisma.calibrationRecord.update({
    where: { id: recordId },
    data: { attachmentUrl: `/uploads/calibration/${fileName}` }
  });

  revalidatePath(`/modules/calibration/${equipmentId}`);
  return { success: true };
}

export async function addPMRecord(equipmentId: string, record: Omit<PMRecord, "id">) {
  await prisma.pMRecord.create({
    data: {
      equipmentId,
      date: record.date,
      conductedBy: record.conductedBy,
      status: record.status,
      notes: record.notes,
    }
  });

  revalidatePath(`/modules/calibration/${equipmentId}`);
  return { success: true };
}

export async function raiseNCRFromEquipment(equipmentId: string, recordId: string) {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, include: { records: true } });
  if (!equipment) return { success: false, message: "Equipment not found" };

  const record = equipment.records.find(r => r.id === recordId);
  if (!record) return { success: false, message: "Calibration record not found" };

  const { addNCR } = await import("@/app/modules/nc/actions");
  const result = await addNCR({
    source: "Process Monitoring",
    department: equipment.location,
    description: `Calibration ${record.result} for equipment ${equipment.equipmentName} (${equipment.serialNumber}), certificate ${record.certificateNo}.${record.remarks ? ` Remarks: ${record.remarks}` : ""}`,
    severity: record.result === "Fail" ? "Major" : "Minor",
    findingType: "NC",
  });

  revalidatePath(`/modules/calibration/${equipmentId}`);
  return { success: true, message: `NCR ${result.data?.ncNumber} raised for this calibration record` };
}

export async function deleteEquipment(id: string) {
  await prisma.equipment.delete({ where: { id } });
  revalidatePath("/modules/calibration");
  return { success: true };
}

export async function exportCalibrationExcel() {
  const { buildExcel } = await import("@/lib/excel");
  const equipment = await getEquipments();

  const rows = equipment.map(e => ({
    equipmentNo:   e.equipmentNo,
    name:          e.name,
    category:      e.category,
    location:      e.location,
    status:        e.status,
    range:         e.range || "-",
    resolution:    e.resolution || "-",
    tolerance:     e.tolerance || "-",
    calFrequency:  e.frequencyMonths ? `${e.frequencyMonths} months` : "-",
    lastCalDate:   e.lastCalibrationDate || "-",
    nextCalDate:   e.nextCalibrationDate || "-",
  }));

  return buildExcel({
    sheetName: "Equipment List",
    title: "DAFTAR INDUK PERALATAN & KALIBRASI",
    subtitle: `ISO 9001:2015 Clause 7.1.5 — Generated: ${new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}`,
    columns: [
      { header: "No. Alat",       key: "equipmentNo",   width: 15 },
      { header: "Nama Alat",      key: "name",          width: 30 },
      { header: "Kategori",       key: "category",      width: 15 },
      { header: "Lokasi",         key: "location",      width: 20 },
      { header: "Status",         key: "status",        width: 15 },
      { header: "Range",          key: "range",         width: 15 },
      { header: "Resolusi",       key: "resolution",    width: 15 },
      { header: "Toleransi",      key: "tolerance",     width: 15 },
      { header: "Freq Kalibrasi", key: "calFrequency",  width: 15 },
      { header: "Kalibrasi Trakhir", key: "lastCalDate", width: 18 },
      { header: "Kalibrasi Brkutnya", key: "nextCalDate", width: 18 },
    ],
    rows,
  });
}

export async function sendCalibrationReminders() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const equipments = await prisma.equipment.findMany();
  const { createNotificationForPermission } = await import("@/app/actions/notifications");

  for (const e of equipments) {
    const diffDays = Math.ceil((new Date(e.nextCalDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) {
      const msg = diffDays < 0
        ? `Calibration OVERDUE: ${e.equipmentName} (${e.serialNumber}) — was due ${e.nextCalDate}`
        : `Calibration due in ${diffDays} day(s): ${e.equipmentName} (${e.serialNumber})`;
      await createNotificationForPermission("calibration", msg, `/modules/calibration/${e.id}`);
    }
  }

  return { success: true };
}
