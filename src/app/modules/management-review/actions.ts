"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/app/actions/auth";
import { getJson, setJson } from "@/lib/kvStore";
import { uploadToStorage } from "@/lib/uploadFile";

export type MRActionItem = {
  id: string;
  description: string;
  picName: string;
  targetDate: string;
  status: "Open" | "In Progress" | "Completed";
  completedDate?: string;
};

export type ManagementReview = {
  id: string;
  reviewNo: string;
  title: string;
  reviewDate: string;
  chairperson: string;
  attendees: string;
  status: "Planned" | "In Progress" | "Completed" | "Approved";

  // ISO 9001 Cl 9.3.2 Inputs
  previousActionStatus?: string;
  internalExternalChanges?: string;
  qualityObjectivesPerformance?: string;
  processPerformance?: string;
  ncAndCorrectiveActions?: string;
  auditResults?: string;
  customerFeedback?: string;
  supplierPerformance?: string;
  riskOpportunities?: string;

  // ISO 9001 Cl 9.3.3 Outputs
  outputImprovements?: string;
  outputQmsChanges?: string;
  outputResources?: string;

  actionItems: MRActionItem[];
  conclusion?: string;
  approvedBy?: string;
  approvedDate?: string;
  minutesFileName?: string;
  createdAt: string;
  createdBy: string;
};

async function readReviews(): Promise<ManagementReview[]> {
  return getJson<ManagementReview[]>("management-reviews", []);
}

async function saveReviews(data: ManagementReview[]) {
  await setJson("management-reviews", data);
}

export async function getManagementReviews(): Promise<ManagementReview[]> {
  return await readReviews();
}

export async function addManagementReview(data: { title: string; reviewDate: string; chairperson: string; attendees: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const reviews = await readReviews();
  const year = new Date().getFullYear();
  const count = reviews.filter(r => r.reviewNo.includes(year.toString())).length + 1;

  const newReview: ManagementReview = {
    id: Date.now().toString(),
    reviewNo: `MR-${year}-${count.toString().padStart(3, "0")}`,
    ...data,
    status: "Planned",
    actionItems: [],
    createdAt: new Date().toISOString(),
    createdBy: user.name,
  };

  reviews.push(newReview);
  await saveReviews(reviews);
  revalidatePath("/modules/management-review");
  return { success: true, id: newReview.id };
}

export async function updateManagementReview(id: string, updates: Partial<ManagementReview>) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const reviews = await readReviews();
  const idx = reviews.findIndex(r => r.id === id);
  if (idx === -1) return { success: false };

  reviews[idx] = { ...reviews[idx], ...updates };
  await saveReviews(reviews);
  revalidatePath("/modules/management-review");
  return { success: true };
}

export async function addActionItem(reviewId: string, item: Omit<MRActionItem, "id" | "status">) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const reviews = await readReviews();
  const idx = reviews.findIndex(r => r.id === reviewId);
  if (idx === -1) return { success: false };

  const newItem: MRActionItem = {
    id: Date.now().toString(),
    ...item,
    status: "Open",
  };

  reviews[idx].actionItems.push(newItem);
  await saveReviews(reviews);
  revalidatePath("/modules/management-review");
  return { success: true };
}

export async function updateActionItem(reviewId: string, itemId: string, updates: Partial<MRActionItem>) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const reviews = await readReviews();
  const rIdx = reviews.findIndex(r => r.id === reviewId);
  if (rIdx === -1) return { success: false };

  const iIdx = reviews[rIdx].actionItems.findIndex(a => a.id === itemId);
  if (iIdx === -1) return { success: false };

  if (updates.status === "Completed" && !updates.completedDate) {
    updates.completedDate = new Date().toISOString().split("T")[0];
  }

  reviews[rIdx].actionItems[iIdx] = { ...reviews[rIdx].actionItems[iIdx], ...updates };
  await saveReviews(reviews);
  revalidatePath("/modules/management-review");
  return { success: true };
}

export async function approveManagementReview(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "Unauthorized" };

  const reviews = await readReviews();
  const idx = reviews.findIndex(r => r.id === id);
  if (idx === -1) return { success: false, message: "Review not found" };
  if (reviews[idx].status !== "Completed") return { success: false, message: "Review must be Completed before approving" };

  reviews[idx].status = "Approved";
  reviews[idx].approvedBy = user.name;
  reviews[idx].approvedDate = new Date().toISOString().split("T")[0];
  await saveReviews(reviews);
  revalidatePath("/modules/management-review");
  return { success: true };
}

export async function getAutoFillData(): Promise<Partial<ManagementReview>> {
  const [
    { getNCRs },
    { getAudits },
    { getObjectives },
    { getComplaints },
    { getSuppliers },
  ] = await Promise.all([
    import("@/app/modules/nc/actions"),
    import("@/app/modules/audit/actions"),
    import("@/app/modules/objectives/actions"),
    import("@/app/modules/complaint/actions"),
    import("@/app/modules/supplier/actions"),
  ]);

  const [ncrs, audits, objectives, complaints, suppliers] = await Promise.all([
    getNCRs(), getAudits(), getObjectives(), getComplaints(), getSuppliers(),
  ]);

  const today = new Date();
  const year = today.getFullYear();

  // NC summary
  const openNCs = ncrs.filter(n => n.status !== "Closed" && n.findingType !== "OFI");
  const closedNCs = ncrs.filter(n => n.status === "Closed");
  const overdueNCs = openNCs.filter(n => new Date(n.dueDate) < today);
  const ncAndCorrectiveActions =
    `Total NC Open: ${openNCs.length} | Closed: ${closedNCs.length} | Overdue: ${overdueNCs.length}.\n` +
    (overdueNCs.length > 0 ? `NC Overdue: ${overdueNCs.map(n => n.ncNumber).join(", ")}.\n` : "") +
    `Source terbanyak: ${getMostCommon(openNCs.map(n => n.source)) || "-"}.`;

  // Audit summary
  const yearAudits = audits.filter(a => new Date(a.plannedDate).getFullYear() === year);
  const completedAudits = yearAudits.filter(a => a.status === "Completed" || a.status === "Closed");
  const totalFindings = yearAudits.reduce((s, a) => s + (a.findingsCount || 0), 0);
  const auditResults =
    `Audit ${year}: ${yearAudits.length} dijadwalkan, ${completedAudits.length} selesai.\n` +
    `Total temuan NC: ${totalFindings}.\n` +
    `Audit belum selesai: ${yearAudits.filter(a => a.status === "Planned" || a.status === "In Progress").length}.`;

  // Objectives summary
  const yearObjs = objectives.filter(o => o.year === year);
  const achieved = yearObjs.filter(o => o.status === "Achieved").length;
  const onTrack = yearObjs.filter(o => o.status === "On Track").length;
  const behind = yearObjs.filter(o => o.status === "Behind" || o.status === "At Risk").length;
  const qualityObjectivesPerformance =
    `Sasaran Mutu ${year}: ${yearObjs.length} total.\n` +
    `Achieved: ${achieved} | On Track: ${onTrack} | At Risk/Behind: ${behind}.\n` +
    (behind > 0 ? `Perlu perhatian: ${yearObjs.filter(o => o.status === "Behind" || o.status === "At Risk").map(o => o.title).join(", ")}.` : "Semua sasaran on track.");

  // Customer complaints
  const openComplaints = complaints.filter(c => c.status !== "Closed" && c.status !== "Rejected");
  const avgSat = complaints.filter(c => c.satisfactionScore).length > 0
    ? (complaints.filter(c => c.satisfactionScore).reduce((s, c) => s + (c.satisfactionScore || 0), 0) / complaints.filter(c => c.satisfactionScore).length).toFixed(1)
    : "N/A";
  const customerFeedback =
    `Keluhan pelanggan open: ${openComplaints.length}.\n` +
    `Total keluhan: ${complaints.length} | Rata-rata skor kepuasan: ${avgSat}/5.\n` +
    (openComplaints.length > 0 ? `Open complaints: ${openComplaints.map(c => c.complaintNo).join(", ")}.` : "");

  // Supplier summary
  const approved = suppliers.filter(s => s.qualificationStatus === "Approved").length;
  const conditional = suppliers.filter(s => s.qualificationStatus === "Conditional Approval").length;
  const pending = suppliers.filter(s => s.qualificationStatus === "Pending").length;
  const supplierPerformance =
    `Supplier terdaftar: ${suppliers.length} (Approved: ${approved}, Conditional: ${conditional}, Pending Eval: ${pending}).\n` +
    (conditional > 0 ? `Supplier conditional: ${suppliers.filter(s => s.qualificationStatus === "Conditional Approval").map(s => s.name).join(", ")}.` : "");

  return {
    ncAndCorrectiveActions,
    auditResults,
    qualityObjectivesPerformance,
    customerFeedback,
    supplierPerformance,
  };
}

function getMostCommon(arr: string[]): string | null {
  if (!arr.length) return null;
  const freq: Record<string, number> = {};
  arr.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export async function uploadMRMinutes(reviewId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "Unauthorized" };

  const file = formData.get("file") as File;
  if (!file || !file.name) return { success: false, message: "No file provided" };

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const fileName = `MR-${reviewId}-minutes-${Date.now()}.${ext}`;
  const publicUrl = await uploadToStorage("management-reviews", file, fileName);

  const reviews = await readReviews();
  const idx = reviews.findIndex(r => r.id === reviewId);
  if (idx === -1) return { success: false, message: "Review not found" };

  reviews[idx].minutesFileName = publicUrl;
  await saveReviews(reviews);
  revalidatePath("/modules/management-review");
  return { success: true, fileName: publicUrl };
}

export async function deleteManagementReview(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const reviews = (await readReviews()).filter((r: ManagementReview) => r.id !== id);
  await saveReviews(reviews);
  revalidatePath("/modules/management-review");
  return { success: true };
}
