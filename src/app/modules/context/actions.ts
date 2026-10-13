"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/app/actions/auth";

const CONTEXT_FILE = path.join(process.cwd(), ".data", "context.json");

export type ContextIssue = {
  id: string;
  type: "Internal" | "External";
  category: string;
  description: string;
  impact: "Opportunity" | "Threat" | "Neutral";
  relevance: "High" | "Medium" | "Low";
  lastReviewed?: string;
};

export type InterestedParty = {
  id: string;
  name: string;
  category: string;
  needs: string;
  monitoringMethod: string;
  relevance: "High" | "Medium" | "Low";
  lastReviewed?: string;
};

export type ContextData = {
  issues: ContextIssue[];
  parties: InterestedParty[];
  qmsScope?: string;
  qualityPolicy?: string;
  policyLastUpdated?: string;
  policyUpdatedBy?: string;
  lastReviewedDate?: string;
  reviewedBy?: string;
};

function readContext(): ContextData {
  try {
    if (!fs.existsSync(CONTEXT_FILE)) return { issues: [], parties: [] };
    return JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf-8"));
  } catch { return { issues: [], parties: [] }; }
}

function saveContext(data: ContextData) {
  fs.writeFileSync(CONTEXT_FILE, JSON.stringify(data, null, 2));
}

export async function getContext(): Promise<ContextData> {
  return readContext();
}

export async function saveQualityPolicy(policy: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = readContext();
  data.qualityPolicy = policy;
  data.policyLastUpdated = new Date().toISOString().split("T")[0];
  data.policyUpdatedBy = user.name;
  saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}

export async function saveQmsScope(scope: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = readContext();
  data.qmsScope = scope;
  data.lastReviewedDate = new Date().toISOString().split("T")[0];
  data.reviewedBy = user.name;
  saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}

export async function addIssue(issue: Omit<ContextIssue, "id" | "lastReviewed">) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = readContext();
  data.issues.push({ ...issue, id: Date.now().toString(), lastReviewed: new Date().toISOString().split("T")[0] });
  saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}

export async function updateIssue(id: string, updates: Partial<ContextIssue>) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = readContext();
  const idx = data.issues.findIndex(i => i.id === id);
  if (idx === -1) return { success: false };
  data.issues[idx] = { ...data.issues[idx], ...updates, lastReviewed: new Date().toISOString().split("T")[0] };
  saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}

export async function deleteIssue(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = readContext();
  data.issues = data.issues.filter(i => i.id !== id);
  saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}

export async function addParty(party: Omit<InterestedParty, "id" | "lastReviewed">) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = readContext();
  data.parties.push({ ...party, id: Date.now().toString(), lastReviewed: new Date().toISOString().split("T")[0] });
  saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}

export async function deleteParty(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = readContext();
  data.parties = data.parties.filter(p => p.id !== id);
  saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}
