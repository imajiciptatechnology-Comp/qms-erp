"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { uploadToStorage } from "@/lib/uploadFile";
import { getCurrentUser } from "@/app/actions/auth";
import { createNotificationForUser } from "@/app/actions/notifications";


export type RCA = {
  why1?: string;
  why2?: string;
  why3?: string;
  why4?: string;
  why5?: string;
  rootCauseStatement?: string;
};

export type ActionPlanDetail = {
  description?: string;
  preventiveAction?: string;
  picId?: string;
  picName?: string;
  targetDate?: string;
  actualCompletionDate?: string;
  evidenceFiles?: string[];
};

export type VerificationDetail = {
  notes?: string;
  isEffective?: boolean;
  verifierId?: string;
  verifierName?: string;
  verificationDate?: string;
};

export type HistoryEntry = {
  id: string;
  date: string;
  userName: string;
  action: string;
  note?: string;
};

export interface NCR {
  id: string;
  ncNumber: string;
  source: string;
  department: string;
  process: string;
  description: string;
  severity: "Minor" | "Major" | "Critical";
  detectedBy?: string;
  productBatch?: string;
  isoClause?: string;
  dateRaised: string;
  dueDate: string;
  status: "Open" | "Root Cause Analysis" | "Action Plan" | "Verification" | "Closed";
  findingType: string;
  ofiStatus?: "Open" | "Under Review" | "Accepted" | "Implemented" | "Rejected";
  auditId?: string;
  supplierId?: string;
  supplierName?: string;
  linkedRiskId?: string;
  linkedRiskNo?: string;
  containmentAction?: string;
  rca?: RCA;
  actionPlan?: ActionPlanDetail;
  verification?: VerificationDetail;
  history: HistoryEntry[];
}

export type NCRItem = NCR;

function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function parseNCR(nc: any): NCRItem {
  return {
    id: nc.id,
    ncNumber: nc.ncNumber,
    source: nc.source,
    department: nc.department,
    process: nc.process,
    description: nc.description,
    severity: nc.severity as NCR["severity"],
    detectedBy: nc.detectedBy || undefined,
    productBatch: nc.productBatch || undefined,
    isoClause: nc.isoClause || undefined,
    dateRaised: nc.dateRaised,
    dueDate: nc.dueDate,
    status: nc.status as NCR["status"],
    findingType: nc.findingType,
    ofiStatus: nc.ofiStatus || undefined,
    auditId: nc.auditId || undefined,
    supplierId: nc.supplierId || undefined,
    supplierName: nc.supplierName || undefined,
    linkedRiskId: nc.linkedRiskId || undefined,
    linkedRiskNo: nc.linkedRiskNo || undefined,
    containmentAction: nc.containmentAction || undefined,
    rca: safeParse<RCA | undefined>(nc.rcaJson, undefined),
    actionPlan: safeParse<ActionPlanDetail | undefined>(nc.actionPlanJson, undefined),
    verification: safeParse<VerificationDetail | undefined>(nc.verificationJson, undefined),
    history: safeParse<HistoryEntry[]>(nc.historyJson, []),
  };
}

async function logHistory(id: string, action: string, note?: string) {
  const user = await getCurrentUser();
  const nc = await prisma.nCR.findUnique({ where: { id } });
  if (!nc) return;
  const history = safeParse<HistoryEntry[]>(nc.historyJson, []);
  history.push({
    id: Date.now().toString(),
    date: new Date().toISOString(),
    userName: user?.name || "System",
    action,
    note,
  });
  await prisma.nCR.update({ where: { id }, data: { historyJson: JSON.stringify(history) } });
}

export async function getNCRs(): Promise<NCRItem[]> {
  const ncrs = await prisma.nCR.findMany({ orderBy: { dateRaised: "desc" } });
  return ncrs.map(parseNCR);
}

export async function getNCRById(id: string): Promise<NCRItem | null> {
  const nc = await prisma.nCR.findUnique({ where: { id } });
  return nc ? parseNCR(nc) : null;
}

export async function addNCR(data: any) {
  const user = await getCurrentUser();
  const dateRaised = new Date().toISOString().split("T")[0];
  const ncNumber = data.ncNumber || `NC-${Date.now().toString().slice(-6)}`;
  const isOFI = data.findingType === "OFI";

  const history: HistoryEntry[] = [{
    id: Date.now().toString(),
    date: new Date().toISOString(),
    userName: user?.name || "System",
    action: isOFI ? "OFI raised" : "NCR raised",
  }];

  const created = await prisma.nCR.create({
    data: {
      ncNumber,
      source: data.source || "System",
      department: data.department || "General",
      process: data.process || data.source || "System",
      description: data.description || "",
      severity: data.severity || "Minor",
      detectedBy: data.detectedBy || null,
      productBatch: data.productBatch || null,
      isoClause: data.isoClause || null,
      dateRaised,
      dueDate: data.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "Open",
      findingType: isOFI ? "OFI" : (data.findingType || "NC"),
      ofiStatus: isOFI ? "Open" : null,
      auditId: data.auditId || null,
      supplierId: data.supplierId || null,
      supplierName: data.supplierName || null,
      linkedRiskId: data.linkedRiskId || null,
      linkedRiskNo: data.linkedRiskNo || null,
      historyJson: JSON.stringify(history),
    }
  });

  revalidatePath("/modules/nc");
  if (data.auditId) revalidatePath(`/modules/audit/${data.auditId}`);
  return { success: true, message: `${isOFI ? "OFI" : "NCR"} ${ncNumber} created`, data: parseNCR(created) };
}

export async function updateNCRStatus(id: string, status: NCR["status"]) {
  await prisma.nCR.update({ where: { id }, data: { status } });
  await logHistory(id, `Status changed to ${status}`);
  revalidatePath("/modules/nc");
  revalidatePath(`/modules/nc/${id}`);
  return { success: true, message: `Status updated to ${status}` };
}

export async function updateNCRDetails(id: string, updates: any, note: string) {
  const data: any = {};

  if (updates.containmentAction !== undefined) data.containmentAction = updates.containmentAction;
  if (updates.rca !== undefined) data.rcaJson = JSON.stringify(updates.rca);
  if (updates.actionPlan !== undefined) data.actionPlanJson = JSON.stringify(updates.actionPlan);
  if (updates.verification !== undefined) data.verificationJson = JSON.stringify(updates.verification);

  if (Object.keys(data).length === 0) return { success: false, message: "No changes to save" };

  await prisma.nCR.update({ where: { id }, data });
  await logHistory(id, note);

  revalidatePath("/modules/nc");
  revalidatePath(`/modules/nc/${id}`);
  return { success: true };
}

export async function uploadNCEvidence(id: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, message: "No file provided" };

  const nc = await prisma.nCR.findUnique({ where: { id } });
  if (!nc) return { success: false, message: "NCR not found" };

  const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
  const fileName = `${nc.ncNumber.replace(/[^a-zA-Z0-9-]/g, "_")}_${Date.now()}${ext}`;
  const publicUrl = await uploadToStorage("nc", file, fileName);

  const actionPlan = safeParse<ActionPlanDetail>(nc.actionPlanJson, {});
  actionPlan.evidenceFiles = [...(actionPlan.evidenceFiles || []), publicUrl];

  await prisma.nCR.update({ where: { id }, data: { actionPlanJson: JSON.stringify(actionPlan) } });
  await logHistory(id, "Uploaded implementation evidence", file.name);

  revalidatePath(`/modules/nc/${id}`);
  return { success: true };
}

export async function editNCR(id: string, updates: { description?: string; severity?: NCR["severity"]; dueDate?: string }) {
  const data: any = {};
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.severity !== undefined) data.severity = updates.severity;
  if (updates.dueDate !== undefined) data.dueDate = updates.dueDate;

  await prisma.nCR.update({ where: { id }, data });
  await logHistory(id, "Edited NCR details");

  revalidatePath("/modules/nc");
  revalidatePath(`/modules/nc/${id}`);
  return { success: true };
}

export async function reopenNCR(id: string) {
  await prisma.nCR.update({ where: { id }, data: { status: "Open" } });
  await logHistory(id, "NCR re-opened");

  revalidatePath("/modules/nc");
  revalidatePath(`/modules/nc/${id}`);
  return { success: true };
}

export async function notifyNCRPIC(id: string, picId: string, picName: string, ncNumber: string) {
  await createNotificationForUser(
    picId,
    `You have been assigned as PIC for the corrective action of NCR ${ncNumber}.`,
    `/modules/nc/${id}`
  );
  return { success: true };
}

export async function deleteNCR(id: string) {
  await prisma.nCR.delete({ where: { id } });
  revalidatePath("/modules/nc");
  return { success: true };
}

export async function updateOFIStatus(id: string, ofiStatus: NCR["ofiStatus"]) {
  await prisma.nCR.update({ where: { id }, data: { ofiStatus } });
  await logHistory(id, `OFI status changed to ${ofiStatus}`);
  revalidatePath("/modules/nc");
  return { success: true };
}

export async function exportNCRsExcel(): Promise<string> {
  const { buildExcel } = await import("@/lib/excel");
  const list = await getNCRs();

  const rows = list.map(n => ({
    ncNumber:       n.ncNumber,
    findingType:    n.findingType,
    severity:       n.severity,
    department:     n.department,
    source:         n.source,
    description:    n.description,
    dateRaised:     n.dateRaised,
    dueDate:        n.dueDate,
    status:         n.status,
    rootCause:      n.rca?.rootCauseStatement || "-",
    actionPlan:     n.actionPlan?.description || "-",
    targetDate:     n.actionPlan?.targetDate || "-",
    verifiedBy:     n.verification?.verifierName || "-",
    verifiedDate:   n.verification?.verificationDate || "-",
  }));

  return buildExcel({
    sheetName: "NCR Register",
    title: "NC & OFI REGISTER (CAPA)",
    subtitle: `ISO 9001:2015 Clause 8.7 & 10.2 — Generated: ${new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}`,
    columns: [
      { header: "NC Number",      key: "ncNumber",      width: 18 },
      { header: "Type",           key: "findingType",   width: 10 },
      { header: "Severity",       key: "severity",       width: 10 },
      { header: "Department",     key: "department",    width: 22 },
      { header: "Source",         key: "source",         width: 22 },
      { header: "Description",    key: "description",   width: 40 },
      { header: "Date Raised",    key: "dateRaised",    width: 14 },
      { header: "Due Date",       key: "dueDate",       width: 14 },
      { header: "Status",         key: "status",        width: 18 },
      { header: "Root Cause",     key: "rootCause",     width: 36 },
      { header: "Action Plan",    key: "actionPlan",    width: 36 },
      { header: "Target Date",    key: "targetDate",    width: 16 },
      { header: "Verified By",    key: "verifiedBy",    width: 18 },
      { header: "Verified Date",  key: "verifiedDate",  width: 14 },
    ],
    rows,
  });
}
