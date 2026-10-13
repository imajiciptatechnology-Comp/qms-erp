"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";

export type RiskItem = {
  id: string;
  riskNo: string;
  title: string;
  category: string;
  process: string;
  department: string;
  description: string;
  potentialImpact: string;
  likelihood: number;
  severity: number;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  treatment: "Accept" | "Mitigate" | "Transfer" | "Avoid";
  mitigationAction?: string;
  opportunity?: string;
  picId?: string;
  picName?: string;
  targetDate?: string;
  residualLikelihood?: number;
  residualSeverity?: number;
  residualScore?: number;
  status: "Open" | "In Treatment" | "Monitored" | "Closed";
  isoClause?: string;
  dateIdentified: string;
  lastReviewed?: string;
  history?: { id: string; date: string; userName: string; action: string }[];
};

function calcRiskLevel(score: number): RiskItem["riskLevel"] {
  if (score >= 15) return "Critical";
  if (score >= 9) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

export async function getRisks(): Promise<RiskItem[]> {
  const risks = await prisma.risk.findMany({
    orderBy: { dateIdentified: 'desc' }
  });
  
  return risks.map(r => ({
    id: r.id,
    riskNo: r.riskNo,
    title: r.title,
    category: r.category,
    process: r.process,
    department: r.department,
    description: r.description,
    potentialImpact: r.potentialImpact,
    likelihood: r.likelihood,
    severity: r.severity,
    riskScore: r.riskScore,
    riskLevel: r.riskLevel as any,
    treatment: r.treatment as any,
    mitigationAction: r.mitigationAction || undefined,
    opportunity: r.opportunity || undefined,
    picId: r.picId || undefined,
    picName: r.picName || undefined,
    targetDate: r.targetDate || undefined,
    residualLikelihood: r.residualLikelihood || undefined,
    residualSeverity: r.residualSeverity || undefined,
    residualScore: r.residualScore || undefined,
    status: r.status as any,
    isoClause: r.isoClause || undefined,
    dateIdentified: r.dateIdentified,
    lastReviewed: r.lastReviewed || undefined,
    history: JSON.parse(r.historyJson)
  }));
}

export async function addRisk(data: {
  title: string;
  category: string;
  process: string;
  department: string;
  description: string;
  potentialImpact: string;
  likelihood: number;
  severity: number;
  treatment: RiskItem["treatment"];
  mitigationAction?: string;
  opportunity?: string;
  picName?: string;
  targetDate?: string;
  isoClause?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "Unauthorized" };

  const id = `RSK-${Date.now().toString().slice(-5)}`;
  const year = new Date().getFullYear();
  const count = await prisma.risk.count() + 1;
  const riskNo = `RISK-${year}-${count.toString().padStart(3, "0")}`;
  const riskScore = data.likelihood * data.severity;

  const historyEntry = { id: Date.now().toString(), date: new Date().toISOString(), userName: user.name, action: "Risk identified and registered" };

  await prisma.risk.create({
    data: {
      id,
      riskNo,
      ...data,
      riskScore,
      riskLevel: calcRiskLevel(riskScore),
      status: data.treatment === "Accept" ? "Monitored" : "Open",
      dateIdentified: new Date().toISOString().split("T")[0],
      historyJson: JSON.stringify([historyEntry])
    }
  });

  revalidatePath("/modules/risk");
  return { success: true };
}

export async function updateRisk(id: string, updates: Partial<RiskItem>) {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "Unauthorized" };

  const risk = await prisma.risk.findUnique({ where: { id } });
  if (!risk) return { success: false, message: "Risk not found" };

  const dataToUpdate: any = { ...updates };

  if (updates.likelihood !== undefined || updates.severity !== undefined) {
    const lik = updates.likelihood ?? risk.likelihood;
    const sev = updates.severity ?? risk.severity;
    dataToUpdate.riskScore = lik * sev;
    dataToUpdate.riskLevel = calcRiskLevel(dataToUpdate.riskScore);
  }

  if (updates.residualLikelihood !== undefined || updates.residualSeverity !== undefined) {
    const rl = updates.residualLikelihood ?? risk.residualLikelihood ?? risk.likelihood;
    const rs = updates.residualSeverity ?? risk.residualSeverity ?? risk.severity;
    dataToUpdate.residualScore = rl * rs;
  }

  dataToUpdate.lastReviewed = new Date().toISOString().split("T")[0];
  
  const history = JSON.parse(risk.historyJson);
  history.push({ id: Date.now().toString(), date: new Date().toISOString(), userName: user.name, action: "Risk updated" });
  dataToUpdate.historyJson = JSON.stringify(history);

  // remove nested fields that prisma doesn't map directly
  delete dataToUpdate.history; 

  await prisma.risk.update({
    where: { id },
    data: dataToUpdate
  });

  revalidatePath("/modules/risk");
  return { success: true };
}

export async function deleteRisk(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  await prisma.risk.delete({ where: { id } });
  revalidatePath("/modules/risk");
  return { success: true };
}
