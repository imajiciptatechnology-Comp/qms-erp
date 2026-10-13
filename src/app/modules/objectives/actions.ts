"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";

export type Measurement = {
  id: string;
  date: string;
  value: number;
  notes?: string;
  recordedBy: string;
};

export type QualityObjective = {
  id: string;
  objectiveNo: string;
  title: string;
  description: string;
  department: string;
  isoClause: string;
  kpiName: string;
  kpiUnit: string;
  target: number;
  baseline?: number;
  currentValue?: number;
  frequency: "Monthly" | "Quarterly" | "Semi-Annual" | "Annual";
  picName?: string;
  startDate: string;
  targetDate: string;
  status: "On Track" | "At Risk" | "Behind" | "Achieved" | "Closed";
  measurements: Measurement[];
  actions?: string;
  year: number;
};

export async function getObjectives(): Promise<QualityObjective[]> {
  const objectives = await prisma.qualityObjective.findMany({
    include: { measurements: true },
    orderBy: { year: 'desc' }
  });
  
  return objectives.map(o => ({
    id: o.id,
    objectiveNo: o.objectiveNo,
    title: o.title,
    description: o.description,
    department: o.department,
    isoClause: o.isoClause,
    kpiName: o.kpiName,
    kpiUnit: o.kpiUnit,
    target: o.target,
    baseline: o.baseline || undefined,
    currentValue: o.currentValue || undefined,
    frequency: o.frequency as any,
    picName: o.picName || undefined,
    startDate: o.startDate,
    targetDate: o.targetDate,
    status: o.status as any,
    actions: o.actions || undefined,
    year: o.year,
    measurements: o.measurements.map(m => ({
      id: m.id,
      date: m.date,
      value: m.value,
      notes: m.notes || undefined,
      recordedBy: m.recordedBy
    }))
  }));
}

export async function addObjective(data: Omit<QualityObjective, "id" | "objectiveNo" | "measurements" | "currentValue">) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const id = `OBJ-${Date.now().toString().slice(-5)}`;
  const year = new Date().getFullYear();
  const count = await prisma.qualityObjective.count() + 1;
  const objectiveNo = `OBJ-${year}-${count.toString().padStart(3, "0")}`;

  await prisma.qualityObjective.create({
    data: {
      id,
      objectiveNo,
      ...data,
      currentValue: data.baseline
    }
  });

  revalidatePath("/modules/objectives");
  return { success: true };
}

export async function addMeasurement(objectiveId: string, value: number, notes?: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const obj = await prisma.qualityObjective.findUnique({ where: { id: objectiveId } });
  if (!obj) return { success: false };

  await prisma.measurement.create({
    data: {
      objectiveId,
      date: new Date().toISOString().split("T")[0],
      value,
      notes,
      recordedBy: user.name
    }
  });

  const pct = (value / obj.target) * 100;
  let status = obj.status;
  
  if (pct >= 100) status = "Achieved";
  else if (pct >= 80) status = "On Track";
  else if (pct >= 60) status = "At Risk";
  else status = "Behind";

  if (new Date(obj.targetDate) < new Date() && status !== "Achieved") {
    status = "Behind";
  }

  await prisma.qualityObjective.update({
    where: { id: objectiveId },
    data: {
      currentValue: value,
      status
    }
  });

  revalidatePath("/modules/objectives");

  if (status === "Behind" || status === "At Risk") {
    try {
      const { createNotificationForPermission } = await import("@/app/actions/notifications");
      const msg = `Quality Objective ${status}: "${obj.title}" (${obj.department}) — current value ${value} ${obj.kpiUnit}, target ${obj.target} ${obj.kpiUnit}`;
      await createNotificationForPermission("objectives", msg, "/modules/objectives");
    } catch {}
  }

  return { success: true };
}

export async function updateObjectiveStatus(id: string, status: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  await prisma.qualityObjective.update({
    where: { id },
    data: { status }
  });

  revalidatePath("/modules/objectives");
  return { success: true };
}

export async function deleteObjective(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  await prisma.qualityObjective.delete({ where: { id } });
  revalidatePath("/modules/objectives");
  return { success: true };
}
