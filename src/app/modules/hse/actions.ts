"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface IncidentRecord {
  id: string; // INC-2026-001
  date: string;
  type: "Near Miss" | "Accident" | "Environmental" | "Property Damage";
  location: string;
  description: string;
  reporterName: string;
  status: "Open" | "Investigating" | "Closed";
  actionTaken?: string; // Corrective Action
}

export interface PatrolRecord {
  id: string; // PAT-2026-001
  date: string;
  inspector: string;
  area: string;
  findings: string;
  isCompliance: boolean;
}

// --- Incidents ---

export async function getIncidents(): Promise<IncidentRecord[]> {
  const incidents = await prisma.incident.findMany({
    orderBy: { date: 'desc' }
  });
  
  return incidents.map(i => {
    // Parse actionsJson back to actionTaken string if needed
    let actionTaken = "";
    try {
      const actions = JSON.parse(i.actionsJson);
      actionTaken = actions.length > 0 ? actions[0].description : "";
    } catch {
      actionTaken = i.actionsJson;
    }
    
    return {
      id: i.id,
      date: i.date,
      type: i.type as any,
      location: i.location,
      description: i.description,
      reporterName: "System", // Not stored in schema, mapped default
      status: i.status as any,
      actionTaken
    };
  });
}

export async function getIncident(id: string): Promise<IncidentRecord | null> {
  const i = await prisma.incident.findUnique({ where: { id } });
  if (!i) return null;
  
  let actionTaken = "";
  try {
    const actions = JSON.parse(i.actionsJson);
    actionTaken = actions.length > 0 ? actions[0].description : "";
  } catch {
    actionTaken = i.actionsJson;
  }
  
  return {
    id: i.id,
    date: i.date,
    type: i.type as any,
    location: i.location,
    description: i.description,
    reporterName: "System",
    status: i.status as any,
    actionTaken
  };
}

export async function addIncident(incident: Omit<IncidentRecord, "id" | "status" | "actionTaken">) {
  const id = `INC-${Date.now().toString().slice(-5)}`;
  
  await prisma.incident.create({
    data: {
      id,
      date: incident.date,
      time: "00:00", // Mapped default
      location: incident.location,
      type: incident.type,
      description: incident.description,
      severity: "Minor", // Mapped default
      status: "Open",
      actionsJson: "[]"
    }
  });
  
  revalidatePath("/modules/hse");
  return { success: true, id };
}

export async function updateIncidentStatus(id: string, status: string, actionTaken?: string) {
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) return { success: false, message: "Incident not found" };
  
  const actionsJson = actionTaken ? JSON.stringify([{ description: actionTaken }]) : incident.actionsJson;
  
  await prisma.incident.update({
    where: { id },
    data: { 
      status,
      actionsJson
    }
  });
  
  revalidatePath("/modules/hse");
  revalidatePath(`/modules/hse/incident/${id}`);
  return { success: true };
}

export async function deleteIncident(id: string) {
  await prisma.incident.delete({ where: { id } });
  revalidatePath("/modules/hse");
  return { success: true };
}

// --- Patrols ---

export async function getPatrols(): Promise<PatrolRecord[]> {
  const patrols = await prisma.patrol.findMany({
    orderBy: { date: 'desc' }
  });
  
  return patrols.map(p => ({
    id: p.id,
    date: p.date,
    inspector: p.inspector,
    area: p.area,
    findings: p.findings,
    isCompliance: p.isCompliance
  }));
}

export async function addPatrol(patrol: Omit<PatrolRecord, "id">) {
  const id = `PAT-${Date.now().toString().slice(-5)}`;
  
  await prisma.patrol.create({
    data: {
      id,
      date: patrol.date,
      inspector: patrol.inspector,
      area: patrol.area,
      findings: patrol.findings,
      isCompliance: patrol.isCompliance
    }
  });
  
  revalidatePath("/modules/hse");
  return { success: true, id };
}

export async function deletePatrol(id: string) {
  await prisma.patrol.delete({ where: { id } });
  revalidatePath("/modules/hse");
  return { success: true };
}

export async function getHSEExcel(): Promise<string> {
  const { buildExcel } = await import("@/lib/excel");
  const [incidents, patrols] = await Promise.all([getIncidents(), getPatrols()]);
  const generated = new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });

  return buildExcel({
    sheetName: "Incidents",
    title: "INCIDENT REPORT REGISTER",
    subtitle: `ISO 9001:2015 Clause 7.1.4 — Generated: ${generated}`,
    columns: [
      { header: "Incident ID",   key: "id",           width: 16 },
      { header: "Date",          key: "date",          width: 14 },
      { header: "Type",          key: "type",          width: 20 },
      { header: "Location",      key: "location",      width: 24 },
      { header: "Description",   key: "description",   width: 44 },
      { header: "Reporter",      key: "reporterName",  width: 20 },
      { header: "Status",        key: "status",        width: 14 },
      { header: "Action Taken",  key: "actionTaken",   width: 40 },
    ],
    rows: incidents.map(i => ({
      id:           i.id,
      date:         i.date,
      type:         i.type,
      location:     i.location,
      description:  i.description,
      reporterName: i.reporterName,
      status:       i.status,
      actionTaken:  i.actionTaken || "-",
    })),
    extraSheets: [{
      sheetName: "Safety Patrols",
      title: "SAFETY PATROL RECORDS",
      subtitle: `ISO 9001:2015 Clause 7.1.4 — Generated: ${generated}`,
      columns: [
        { header: "Patrol ID",   key: "id",          width: 16 },
        { header: "Date",        key: "date",         width: 14 },
        { header: "Inspector",   key: "inspector",    width: 22 },
        { header: "Area",        key: "area",         width: 24 },
        { header: "Findings",    key: "findings",     width: 44 },
        { header: "Compliance",  key: "isCompliance", width: 14 },
      ],
      rows: patrols.map(p => ({
        id:           p.id,
        date:         p.date,
        inspector:    p.inspector,
        area:         p.area,
        findings:     p.findings,
        isCompliance: p.isCompliance ? "Compliant" : "Non-Compliant",
      })),
    }],
  });
}
