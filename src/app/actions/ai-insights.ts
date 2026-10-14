"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getJson, setJson } from "@/lib/kvStore";
import { aiComplete, parseAiJson, AiError, isAiConfigured } from "@/lib/ai";
import { getCurrentUser } from "@/app/actions/auth";
import { getDashboardData } from "@/app/dashboard-data";

export type AiInsight = {
  module: string;
  severity: "info" | "warning" | "critical";
  title: string;
  finding: string;
  recommendation: string;
};

export type AiInsightsResult = {
  generatedAt: string;
  generatedBy: string;
  model: string;
  summary: string;
  insights: AiInsight[];
};

const CACHE_KEY = "ai_insights";
const MIN_INTERVAL_MS = 60_000; // hemat kuota: maksimal 1x generate per menit

function countBy<T>(rows: T[], key: (r: T) => string) {
  const out: Record<string, number> = {};
  for (const r of rows) out[key(r)] = (out[key(r)] || 0) + 1;
  return out;
}

/** Ringkasan agregat seluruh modul — hanya angka, bukan data mentah. */
async function buildContext() {
  const today = new Date().toISOString().split("T")[0];
  const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().split("T")[0];

  const [dash, ncrs, complaints, equipments, trainings, risks] = await Promise.all([
    getDashboardData(),
    prisma.nCR.findMany({ select: { severity: true, status: true, source: true, department: true, findingType: true } }),
    prisma.complaint.findMany({ select: { status: true, severity: true, category: true } }),
    prisma.equipment.findMany({ select: { status: true, nextCalDate: true } }),
    prisma.training.findMany({ select: { status: true, isMandatory: true, plannedDate: true } }),
    prisma.risk.findMany({ select: { riskLevel: true, status: true, category: true } }),
  ]);

  return {
    today,
    kpi: dash.kpi,
    nonConformance: {
      bySeverity: countBy(ncrs, n => n.severity),
      bySource: countBy(ncrs, n => n.source),
      byDepartment: countBy(ncrs, n => n.department),
      byStatus: countBy(ncrs, n => n.status),
      byFindingType: countBy(ncrs, n => n.findingType),
      recent: dash.recentNCs.map(n => ({ no: n.ncNumber, status: n.status, dept: n.department, description: n.description })),
    },
    complaints: {
      total: complaints.length,
      byStatus: countBy(complaints, c => c.status),
      bySeverity: countBy(complaints, c => c.severity),
      byCategory: countBy(complaints, c => c.category),
    },
    calibration: {
      total: equipments.length,
      byStatus: countBy(equipments, e => e.status),
      overdue: equipments.filter(e => e.nextCalDate && e.nextCalDate < today).length,
      dueWithin30Days: equipments.filter(e => e.nextCalDate >= today && e.nextCalDate <= in30).length,
    },
    training: {
      total: trainings.length,
      byStatus: countBy(trainings, t => t.status),
      mandatoryNotCompleted: trainings.filter(t => t.isMandatory && t.status !== "Completed" && t.status !== "Cancelled").length,
    },
    risk: {
      byLevel: countBy(risks, r => r.riskLevel),
      byStatus: countBy(risks, r => r.status),
      byCategory: countBy(risks, r => r.category),
    },
    documents: { byStatus: Object.fromEntries(dash.charts.documentByStatus.map(d => [d.name, d.value])) },
    audits: { byStatus: Object.fromEntries(dash.charts.auditByStatus.map(d => [d.name, d.value])) },
    hse: { openIncidents: dash.recentIncidents.map(i => ({ id: i.id, type: i.type, date: i.date })) },
    moc: { active: dash.activeMocList.map(m => ({ id: m.id, title: m.title, status: m.status })) },
  };
}

const SYSTEM_PROMPT = `You are a senior ISO 9001 Quality Management consultant analysing a company's QMS ERP data.
You receive aggregated counts for every module (non-conformance, complaints, calibration, training, risk, documents, audits, HSE, MOC, production, maintenance, welding).
Find the most important patterns, risks, and overdue items, and give concrete, actionable recommendations that reference ISO 9001 clauses where relevant.
Base every statement strictly on the numbers given; never invent data. If data is very small, say so briefly.
Respond ONLY with JSON in this exact shape:
{
  "summary": "2-3 sentence overall assessment",
  "insights": [
    { "module": "NC | Complaint | Calibration | Training | Risk | Document | Audit | HSE | MOC | Production | Maintenance | Welding",
      "severity": "info | warning | critical",
      "title": "short headline",
      "finding": "what the data shows, with numbers",
      "recommendation": "specific next action" }
  ]
}
Return 4 to 8 insights, most severe first. Write in English.`;

export async function getCachedInsights(): Promise<AiInsightsResult | null> {
  return getJson<AiInsightsResult | null>(CACHE_KEY, null);
}

export async function generateInsights(): Promise<{ ok: true; result: AiInsightsResult } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan login terlebih dahulu." };
  if (!isAiConfigured()) return { ok: false, error: "AI belum dikonfigurasi (AI_API_KEY belum di-set)." };

  const cached = await getCachedInsights();
  if (cached && Date.now() - new Date(cached.generatedAt).getTime() < MIN_INTERVAL_MS) {
    return { ok: true, result: cached };
  }

  try {
    const context = await buildContext();
    const { text, model } = await aiComplete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `QMS data (JSON):\n${JSON.stringify(context)}` },
      ],
      { json: true, maxTokens: 4096 }
    );

    const parsed = parseAiJson<{ summary?: string; insights?: AiInsight[] }>(text);
    const severities = ["info", "warning", "critical"];
    const insights = (parsed.insights || [])
      .filter(i => i && i.title && i.finding)
      .map(i => ({ ...i, severity: severities.includes(i.severity) ? i.severity : "info" }) as AiInsight)
      .slice(0, 8);

    const result: AiInsightsResult = {
      generatedAt: new Date().toISOString(),
      generatedBy: user.name,
      model,
      summary: parsed.summary || "",
      insights,
    };
    await setJson(CACHE_KEY, result);
    revalidatePath("/");
    return { ok: true, result };
  } catch (err) {
    console.error("[ai-insights]", err);
    return { ok: false, error: err instanceof AiError ? err.message : "Gagal membuat analisis AI." };
  }
}
