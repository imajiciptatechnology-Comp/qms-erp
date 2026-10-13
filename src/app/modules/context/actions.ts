"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/app/actions/auth";
import { getJson, setJson } from "@/lib/kvStore";

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

async function readContext(): Promise<ContextData> {
  return getJson<ContextData>("context", { issues: [], parties: [] });
}

async function saveContext(data: ContextData) {
  await setJson("context", data);
}

export async function getContext(): Promise<ContextData> {
  return await readContext();
}

export async function saveQualityPolicy(policy: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = await readContext();
  data.qualityPolicy = policy;
  data.policyLastUpdated = new Date().toISOString().split("T")[0];
  data.policyUpdatedBy = user.name;
  await saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}

export async function saveQmsScope(scope: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = await readContext();
  data.qmsScope = scope;
  data.lastReviewedDate = new Date().toISOString().split("T")[0];
  data.reviewedBy = user.name;
  await saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}

export async function addIssue(issue: Omit<ContextIssue, "id" | "lastReviewed">) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = await readContext();
  data.issues.push({ ...issue, id: Date.now().toString(), lastReviewed: new Date().toISOString().split("T")[0] });
  await saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}

export async function updateIssue(id: string, updates: Partial<ContextIssue>) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = await readContext();
  const idx = data.issues.findIndex(i => i.id === id);
  if (idx === -1) return { success: false };
  data.issues[idx] = { ...data.issues[idx], ...updates, lastReviewed: new Date().toISOString().split("T")[0] };
  await saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}

export async function deleteIssue(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = await readContext();
  data.issues = data.issues.filter(i => i.id !== id);
  await saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}

export async function addParty(party: Omit<InterestedParty, "id" | "lastReviewed">) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = await readContext();
  data.parties.push({ ...party, id: Date.now().toString(), lastReviewed: new Date().toISOString().split("T")[0] });
  await saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}

export async function deleteParty(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  const data = await readContext();
  data.parties = data.parties.filter(p => p.id !== id);
  await saveContext(data);
  revalidatePath("/modules/context");
  return { success: true };
}
