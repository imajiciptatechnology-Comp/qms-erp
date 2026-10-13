"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus, Search, Filter, GraduationCap, Calendar, Users, CheckCircle,
  Trash2, ChevronRight, ChevronLeft, AlertTriangle, Grid3x3, BookOpen,
  LayoutGrid, ShieldAlert, Save, FileText, Star, Download, Loader2
} from "lucide-react";
import type { TrainingRecord, CompetencyRequirement, MandatoryComplianceRow } from "./actions";
import { deleteTraining, saveCompetencyRequirements, getEmployeeTranscript, getTrainingCSV, sendUpcomingReminders } from "./actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddTrainingModal from "./AddTrainingModal";
import { TabNav, Tab } from "@/components/ui/TabNav";
import TableFooter from "@/components/ui/TableFooter";
import EmptyTableRow from "@/components/ui/EmptyTableRow";

const STATUS_BADGE: Record<string, string> = {
  Planned: "bg-slate-100 text-slate-700 border-slate-200",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
};

const TYPE_COLOR: Record<string, string> = {
  Internal: "bg-blue-50 text-blue-700",
  External: "bg-purple-50 text-purple-700",
  "On-the-Job": "bg-amber-50 text-amber-700",
  "E-Learning": "bg-cyan-50 text-cyan-700",
  Certification: "bg-emerald-50 text-emerald-700",
};

// Competency matrix: derived from completed trainings
function buildMatrix(trainings: TrainingRecord[]) {
  const completed = trainings.filter(t => t.status === "Completed");
  // employee → { [category]: { passed, trainingTitles } }
  const matrix: Record<string, Record<string, { passed: boolean; titles: string[] }>> = {};
  const categories = new Set<string>();

  completed.forEach(t => {
    categories.add(t.category);
    t.participants.forEach(p => {
      if (!matrix[p.name]) matrix[p.name] = {};
      if (!matrix[p.name][t.category]) matrix[p.name][t.category] = { passed: false, titles: [] };
      if (p.result === "Pass" || p.result === "Attended") matrix[p.name][t.category].passed = true;
      matrix[p.name][t.category].titles.push(t.title);
    });
  });

  return { matrix, categories: Array.from(categories).sort(), employees: Object.keys(matrix).sort() };
}

// Expiry alerts: certificates expiring within 90 days
function getExpiryAlerts(trainings: TrainingRecord[]) {
  const alerts: { name: string; dept: string; trainingTitle: string; certNo?: string; expiry: string; daysLeft: number }[] = [];
  const today = new Date(); today.setHours(0,0,0,0);

  trainings.filter(t => t.status === "Completed").forEach(t => {
    t.participants.forEach(p => {
      if (p.certificateExpiry) {
        const exp = new Date(p.certificateExpiry);
        const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000*60*60*24));
        if (daysLeft <= 90) {
          alerts.push({ name: p.name, dept: p.department, trainingTitle: t.title, certNo: p.certificateNo, expiry: p.certificateExpiry, daysLeft });
        }
      }
    });
  });

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const STATUS_COLOR: Record<string, string> = {
  Planned: "bg-slate-100 text-slate-600 border-slate-300",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-300",
  Cancelled: "bg-red-100 text-red-600 border-red-300",
};

function AnnualPlanView({ trainings }: { trainings: TrainingRecord[] }) {
  const [year, setYear] = useState(new Date().getFullYear());

  const filtered = trainings.filter(t => new Date(t.plannedDate).getFullYear() === year);

  // Collect all departments (from data + defaults)
  const deptSet = new Set(["Quality Assurance", "Production", "Engineering", "HSE", "HR & Admin", "Top Management", "All Departments"]);
  filtered.forEach(t => deptSet.add(t.department));
  const depts = Array.from(deptSet).filter(d => filtered.some(t => t.department === d || t.department === "All Departments"));

  const totalYear = filtered.length;
  const completedYear = filtered.filter(t => t.status === "Completed").length;
  const plannedYear = filtered.filter(t => t.status === "Planned").length;

  return (
    <div className="space-y-5">
      {/* Year selector + stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(y => y - 1)}
            className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xl font-bold text-slate-800 w-16 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)}
            className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-3 text-sm">
          {[
            { label: "Total", val: totalYear, cls: "bg-white border-slate-200 text-slate-800" },
            { label: "Completed", val: completedYear, cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
            { label: "Planned", val: plannedYear, cls: "bg-slate-50 border-slate-200 text-slate-700" },
          ].map(s => (
            <div key={s.label} className={`border rounded-lg px-4 py-2 text-center ${s.cls}`}>
              <p className="text-xs opacity-70">{s.label}</p>
              <p className="font-bold text-lg">{s.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-40 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                Department
              </th>
              {MONTHS.map(m => (
                <th key={m} className="px-2 py-3 text-center font-semibold text-slate-600 text-xs min-w-20">{m}</th>
              ))}
              <th className="px-3 py-3 text-center font-semibold text-slate-600 text-xs">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {depts.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-6 py-10 text-center text-slate-400">
                  No trainings scheduled for {year}
                </td>
              </tr>
            ) : depts.map(dept => {
              const deptTrainings = filtered.filter(t => t.department === dept || t.department === "All Departments");
              const total = filtered.filter(t => t.department === dept).length;
              return (
                <tr key={dept} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-100">
                    {dept}
                  </td>
                  {MONTHS.map((_, mi) => {
                    const cell = deptTrainings.filter(t => new Date(t.plannedDate).getMonth() === mi);
                    return (
                      <td key={mi} className="px-2 py-3 text-center align-middle">
                        {cell.length > 0 ? (
                          <div className="flex flex-col gap-1 items-center">
                            {cell.map(t => (
                              <span key={t.id} title={`${t.title}\nTrainer: ${t.trainer}\nStatus: ${t.status}`}
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border truncate max-w-18 cursor-default ${STATUS_COLOR[t.status]}`}>
                                {t.trainingNo}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center">
                    {total > 0
                      ? <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{total}</span>
                      : <span className="text-slate-300">0</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLOR).map(([s, cls]) => (
          <span key={s} className={`px-2.5 py-1 rounded border font-semibold ${cls}`}>{s}</span>
        ))}
      </div>
    </div>
  );
}

// ─── RESULT / STATUS helpers ────────────────────────────────────────────────
const RESULT_BADGE: Record<string, string> = {
  Pass: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Fail: "bg-red-100 text-red-700 border-red-200",
  Attended: "bg-blue-100 text-blue-700 border-blue-200",
};

// ─── EMPLOYEE TRANSCRIPT TAB ─────────────────────────────────────────────────
function EmployeeTranscriptTab({ allUsers, allTrainings }: { allUsers: any[], allTrainings: TrainingRecord[] }) {
  const [selectedName, setSelectedName] = useState("");
  const [transcript, setTranscript] = useState<Awaited<ReturnType<typeof getEmployeeTranscript>>>([]);
  const [loading, setLoading] = useState(false);

  async function handleSelect(name: string) {
    setSelectedName(name);
    if (!name) { setTranscript([]); return; }
    setLoading(true);
    const data = await getEmployeeTranscript(name);
    setTranscript(data);
    setLoading(false);
  }

  // Collect all known participant names from training data
  const allParticipantNames = Array.from(new Set([
    ...allUsers.map(u => u.name),
    ...allTrainings.flatMap(t => t.participants.map(p => p.name)),
  ])).sort();

  const passCount = transcript.filter(r => r.result === "Pass").length;
  const totalCompleted = transcript.filter(r => r.status === "Completed").length;
  const expiringSoon = transcript.filter(r => {
    if (!r.certificateExpiry) return false;
    const d = new Date(r.certificateExpiry);
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.ceil((d.getTime() - today.getTime()) / (1000*60*60*24)) <= 90;
  }).length;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <label className="text-sm font-semibold text-slate-700 block mb-2">Select Employee</label>
        <select value={selectedName} onChange={e => handleSelect(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white text-sm">
          <option value="">-- Select employee --</option>
          {allParticipantNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {selectedName && !loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{transcript.length}</p>
              <p className="text-xs text-slate-500 font-semibold uppercase mt-1">Total Training</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{passCount}</p>
              <p className="text-xs text-emerald-600 font-semibold uppercase mt-1">Pass</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{expiringSoon}</p>
              <p className="text-xs text-amber-600 font-semibold uppercase mt-1">Cert Expiring Soon</p>
            </div>
          </div>

          {/* Transcript Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                Training Transcript — {selectedName}
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-1">{totalCompleted} completed</span>
              </h3>
            </div>
            {transcript.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-medium">No training records found for {selectedName}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-700">
                    <tr>
                      <th className="px-4 py-3">No Training</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-center">Result</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3">Certificate</th>
                      <th className="px-4 py-3 text-center">Mandatory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transcript.map(row => {
                      const certExpired = row.certificateExpiry && new Date(row.certificateExpiry) < new Date();
                      const certExpiringSoon = row.certificateExpiry && !certExpired && Math.ceil((new Date(row.certificateExpiry).getTime() - new Date().getTime()) / (1000*60*60*24)) <= 90;
                      return (
                        <tr key={row.trainingId} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <Link href={`/modules/training/${row.trainingId}`} className="font-bold text-indigo-600 hover:underline">{row.trainingNo}</Link>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate">{row.title}</td>
                          <td className="px-4 py-3 text-slate-600">{row.category}</td>
                          <td className="px-4 py-3 text-slate-500">{row.date}</td>
                          <td className="px-4 py-3 text-center">
                            {row.status === "Completed" && row.result ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${RESULT_BADGE[row.result]}`}>{row.result}</span>
                            ) : (
                              <span className="text-xs text-slate-400">{row.status}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-700">{row.score !== undefined ? row.score : "—"}</td>
                          <td className="px-4 py-3">
                            {row.certificateNo ? (
                              <div>
                                <p className="text-xs font-medium text-slate-700">{row.certificateNo}</p>
                                {row.certificateExpiry && (
                                  <p className={`text-xs flex items-center gap-0.5 ${certExpired ? "text-red-600 font-semibold" : certExpiringSoon ? "text-amber-600 font-semibold" : "text-slate-400"}`}>
                                    {(certExpired || certExpiringSoon) && <AlertTriangle className="w-3 h-3" />}
                                    {row.certificateExpiry}
                                  </p>
                                )}
                              </div>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.isMandatory ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Mandatory</span> : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {loading && (
        <div className="text-center py-12 text-slate-500">
          <GraduationCap className="w-10 h-10 animate-pulse text-indigo-400 mx-auto mb-2" />
          <p className="text-sm">Loading transcript...</p>
        </div>
      )}
    </div>
  );
}

// ─── MANDATORY COMPLIANCE TAB ─────────────────────────────────────────────────
function MandatoryComplianceTab({ compliance, onSchedule }: { compliance: MandatoryComplianceRow[], onSchedule: () => void }) {
  if (compliance.length === 0) return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-500">
      <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
      <p className="font-medium">No mandatory trainings registered yet.</p>
      <p className="text-sm mt-1">Mark trainings as "Mandatory" when creating or editing them.</p>
      <button onClick={onSchedule} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
        + Schedule Mandatory Training
      </button>
    </div>
  );

  const totalCompliantEmployees = compliance.reduce((s, c) => s + c.completed.length, 0);
  const totalPending = compliance.reduce((s, c) => s + c.pending.length, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{compliance.length}</p>
          <p className="text-xs text-slate-500 font-semibold uppercase mt-1">Mandatory Trainings</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{totalCompliantEmployees}</p>
          <p className="text-xs text-emerald-600 font-semibold uppercase mt-1">Completed</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{totalPending}</p>
          <p className="text-xs text-red-600 font-semibold uppercase mt-1">Pending</p>
        </div>
      </div>

      {compliance.map(c => (
        <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">MANDATORY</span>
                <Link href={`/modules/training/${c.id}`} className="font-bold text-slate-800 hover:text-indigo-600 transition-colors">{c.title}</Link>
                <span className="text-xs text-slate-400">{c.trainingNo} · {c.department}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Date: {c.plannedDate} · Status: {c.status}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-lg font-bold text-slate-800">{c.complianceRate}%</p>
                <p className="text-xs text-slate-500">{c.completed.length}/{c.completed.length + c.pending.length} completed</p>
              </div>
              <div className="w-16 h-16 relative shrink-0">
                <svg role="img" aria-label={`Compliance rate: ${c.complianceRate}%`} viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <title>{`Compliance rate: ${c.complianceRate}%`}</title>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke={c.complianceRate === 100 ? "#10b981" : c.complianceRate >= 50 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="3"
                    strokeDasharray={`${c.complianceRate} ${100 - c.complianceRate}`}
                    strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">✓ Completed ({c.completed.length})</p>
              {c.completed.length === 0
                ? <p className="text-sm text-slate-400 italic">No one has completed this yet.</p>
                : <div className="flex flex-wrap gap-2">{c.completed.map(n => (
                    <span key={n} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">{n}</span>
                  ))}</div>}
            </div>
            <div>
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">✗ Pending ({c.pending.length})</p>
              {c.pending.length === 0
                ? <p className="text-sm text-emerald-600 font-medium">All employees completed! 🎉</p>
                : <div className="flex flex-wrap gap-2">{c.pending.map(n => (
                    <span key={n} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full">{n}</span>
                  ))}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const ALL_CATEGORIES = ["Quality / ISO", "Safety / K3", "Technical", "Soft Skills", "Regulatory", "Welding / Fabrication", "Environmental", "Other"];
const ALL_DEPTS = ["Top Management", "Quality Assurance", "Production", "Engineering", "HSE", "HR & Admin"];

type GapRow = { department: string; requiredCategories: string[]; employees: { name: string; hasCategories: string[]; missingCategories: string[] }[] };

function CompetencyGapTab({ requirements, gaps, canManage, onScheduleGap }: {
  requirements: CompetencyRequirement[];
  gaps: GapRow[];
  canManage: boolean;
  onScheduleGap?: (dept: string, category: string) => void;
}) {
  const [filterDept, setFilterDept] = useState("All");
  // filter gaps by dept
  const filteredGaps = filterDept === "All" ? gaps : gaps.filter(g => g.department === filterDept);
  const [localReqs, setLocalReqs] = useState<CompetencyRequirement[]>(() => {
    // Ensure all depts have an entry
    return ALL_DEPTS.map(dept => {
      const existing = requirements.find(r => r.department === dept);
      return existing || { id: dept, department: dept, requiredCategories: [], lastUpdated: "" };
    });
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleCategory(dept: string, cat: string) {
    setLocalReqs(prev => prev.map(r => {
      if (r.department !== dept) return r;
      const has = r.requiredCategories.includes(cat);
      return { ...r, requiredCategories: has ? r.requiredCategories.filter(c => c !== cat) : [...r.requiredCategories, cat] };
    }));
    setSaved(false);
  }

  async function handleSave() {
    setIsSaving(true);
    const toSave = localReqs.map(r => ({ ...r, lastUpdated: new Date().toISOString().split("T")[0] }));
    await saveCompetencyRequirements(toSave);
    setIsSaving(false);
    setSaved(true);
  }

  const totalMissing = gaps.reduce((s, g) => s + g.employees.filter(e => e.missingCategories.length > 0).length, 0);

  return (
    <div className="space-y-6">
      {/* Requirements definition */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">Competency Requirements per Department</h3>
            <p className="text-xs text-slate-500 mt-0.5">Check the training categories required to be completed by each department.</p>
          </div>
          {canManage && (
            <button onClick={handleSave} disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-indigo-400">
              {isSaving ? "Saving..." : <><Save className="w-4 h-4" /> Save</>}
            </button>
          )}
        </div>
        {saved && <div className="px-6 py-2 bg-emerald-50 text-emerald-700 text-xs font-semibold border-b border-emerald-100">✓ Requirements saved.</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold text-slate-700 sticky left-0 bg-slate-50 min-w-40 border-r border-slate-200">Department</th>
                {ALL_CATEGORIES.map(cat => (
                  <th key={cat} className="px-2 py-3 text-center font-semibold text-slate-600 text-xs min-w-24">{cat}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {localReqs.map(req => (
                <tr key={req.department} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white border-r border-slate-100">{req.department}</td>
                  {ALL_CATEGORIES.map(cat => (
                    <td key={cat} className="px-2 py-3 text-center">
                      <input type="checkbox"
                        checked={req.requiredCategories.includes(cat)}
                        onChange={() => canManage && toggleCategory(req.department, cat)}
                        disabled={!canManage}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer disabled:cursor-default" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gap Analysis */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Competency Gap Analysis
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Employees who have not met their department's competency requirements.</p>
          </div>
          <div className="flex items-center gap-3">
            {totalMissing > 0 && (
              <span className="text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-full">{totalMissing} employee{totalMissing !== 1 ? "s" : ""} with gaps</span>
            )}
            {gaps.length > 0 && (
              <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="All">All Departments</option>
                {gaps.map(g => <option key={g.department} value={g.department}>{g.department}</option>)}
              </select>
            )}
          </div>
        </div>

        {gaps.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-medium">No competency requirements defined yet.</p>
            <p className="text-sm">Fill in the requirements table above first.</p>
          </div>
        ) : filteredGaps.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <CheckCircle className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
            <p className="font-medium text-sm">No gaps found for the selected department.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredGaps.map(g => {
              const withGaps = g.employees.filter(e => e.missingCategories.length > 0);
              const allMet = g.employees.filter(e => e.missingCategories.length === 0);
              return (
                <div key={g.department} className="p-6">
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <h4 className="font-bold text-slate-800">{g.department}</h4>
                    <span className="text-xs text-slate-500">Required: {g.requiredCategories.join(", ")}</span>
                    {withGaps.length > 0
                      ? <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{withGaps.length} gap</span>
                      : <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">All met</span>}
                    {withGaps.length > 0 && onScheduleGap && (
                      <div className="ml-auto flex gap-2 flex-wrap">
                        {g.requiredCategories.filter(cat => withGaps.some(e => e.missingCategories.includes(cat))).map(cat => (
                          <button key={cat} onClick={() => onScheduleGap(g.department, cat)}
                            className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors font-medium">
                            <Plus className="w-3 h-3" /> Schedule "{cat}"
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {g.employees.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No employees have recorded training in this department yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {withGaps.map(e => (
                        <div key={e.name} className="border border-red-100 bg-red-50/40 rounded-lg p-3">
                          <p className="font-semibold text-slate-800 text-sm">{e.name}</p>
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Missing: {e.missingCategories.join(", ")}
                          </p>
                          {e.hasCategories.length > 0 && (
                            <p className="text-xs text-emerald-600 mt-0.5">✓ Has: {e.hasCategories.join(", ")}</p>
                          )}
                        </div>
                      ))}
                      {allMet.map(e => (
                        <div key={e.name} className="border border-emerald-100 bg-emerald-50/30 rounded-lg p-3">
                          <p className="font-semibold text-slate-800 text-sm">{e.name}</p>
                          <p className="text-xs text-emerald-600 mt-1">✓ All met</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrainingView({
  trainings, user, rolesConfig, allUsers, requirements = [], gaps = [], mandatoryCompliance = []
}: {
  trainings: TrainingRecord[]; user: any; rolesConfig: any[]; allUsers: any[];
  requirements?: CompetencyRequirement[];
  gaps?: GapRow[];
  mandatoryCompliance?: MandatoryComplianceRow[];
}) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPreset, setModalPreset] = useState<{ category?: string; department?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterDept, setFilterDept] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"records" | "matrix" | "expiry" | "plan" | "gap" | "mandatory" | "transcript">("records");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Fire and forget reminder sending
    sendUpcomingReminders().catch(console.error);
  }, []);

  async function handleExportCSV() {
    setIsExporting(true);
    const base64 = await getTrainingCSV();
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-recap-${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  }

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("training");

  const filtered = useMemo(() => trainings.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.trainingNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.trainer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "All" || t.status === filterStatus;
    const matchType = filterType === "All" || t.type === filterType;
    const matchDept = filterDept === "All" || t.department === filterDept;
    return matchSearch && matchStatus && matchType && matchDept;
  }), [trainings, searchTerm, filterStatus, filterType, filterDept]);

  const { matrix, categories, employees } = useMemo(() => buildMatrix(trainings), [trainings]);
  const expiryAlerts = useMemo(() => getExpiryAlerts(trainings), [trainings]);

  const totalParticipants = useMemo(() =>
    trainings.filter(t => t.status === "Completed").reduce((s, t) => s + t.participants.length, 0),
    [trainings]);
  const planned = useMemo(() => trainings.filter(t => t.status === "Planned").length, [trainings]);
  const completed = useMemo(() => trainings.filter(t => t.status === "Completed").length, [trainings]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this training record?")) return;
    await deleteTraining(id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Training Management</h1>
          <p className="text-slate-500 text-sm">Manage employee competency & training records — ISO 9001:2015 Clause 6.2</p>
        </div>
        {canManage && (
          <button onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Training
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600"><GraduationCap className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Planned</p><p className="text-xl font-bold text-slate-800">{planned}</p></div>
        </div>
        <div className="bg-white border border-emerald-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600"><CheckCircle className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Completed</p><p className="text-xl font-bold text-slate-800">{completed}</p></div>
        </div>
        <div className="bg-white border border-blue-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600"><Users className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Participants Trained</p><p className="text-xl font-bold text-slate-800">{totalParticipants}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <TabNav>
        {([
          { key: "records" as const, label: "Records", icon: <BookOpen className="w-4 h-4" />, badge: 0 },
          { key: "plan" as const, label: "Annual Plan", icon: <LayoutGrid className="w-4 h-4" />, badge: 0 },
          { key: "mandatory" as const, label: "Mandatory", icon: <Star className="w-4 h-4" />, badge: mandatoryCompliance.filter(c => c.pending.length > 0).length },
          { key: "transcript" as const, label: "Transcript", icon: <FileText className="w-4 h-4" />, badge: 0 },
          { key: "matrix" as const, label: "Matrix", icon: <Grid3x3 className="w-4 h-4" />, badge: 0 },
          { key: "gap" as const, label: "Gap", icon: <ShieldAlert className="w-4 h-4" />, badge: 0 },
          { key: "expiry" as const, label: "Expiry", icon: <AlertTriangle className="w-4 h-4" />, badge: expiryAlerts.length },
        ]).map(tab => (
          <Tab key={tab.key} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
            {tab.icon} {tab.label}
            {tab.badge > 0 ? <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">{tab.badge}</span> : null}
          </Tab>
        ))}
      </TabNav>

      {/* ===== TAB: ANNUAL PLAN ===== */}
      {activeTab === "plan" && <AnnualPlanView trainings={trainings} />}

      {/* ===== TAB: MANDATORY COMPLIANCE ===== */}
      {activeTab === "mandatory" && (
        <MandatoryComplianceTab
          compliance={mandatoryCompliance}
          onSchedule={() => { setModalPreset(null); setIsModalOpen(true); }}
        />
      )}

      {/* ===== TAB: EMPLOYEE TRANSCRIPT ===== */}
      {activeTab === "transcript" && (
        <EmployeeTranscriptTab allUsers={allUsers} allTrainings={trainings} />
      )}

      {/* ===== TAB: COMPETENCY GAP ===== */}
      {activeTab === "gap" && (
        <CompetencyGapTab
          requirements={requirements}
          gaps={gaps}
          canManage={canManage}
          onScheduleGap={(dept, cat) => {
            setModalPreset({ department: dept, category: cat });
            setIsModalOpen(true);
          }}
        />
      )}

      {/* ===== TAB: TRAINING RECORDS ===== */}
      {activeTab === "records" && (
        <>
          {/* Filter bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search training title, no, trainer..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white text-sm" />
              </div>
              <button onClick={handleExportCSV} disabled={isExporting}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50">
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export Excel
              </button>
              <button onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"}`}>
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
            {showFilters && (
              <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Status", val: filterStatus, set: setFilterStatus, opts: ["All", "Planned", "Completed", "Cancelled"] },
                  { label: "Type", val: filterType, set: setFilterType, opts: ["All", "Internal", "External", "On-the-Job", "E-Learning", "Certification"] },
                  { label: "Department", val: filterDept, set: setFilterDept, opts: ["All", "Top Management", "Quality Assurance", "Production", "Engineering", "HSE", "HR & Admin"] },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">{f.label}</label>
                    <select value={f.val} onChange={e => f.set(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
                      {f.opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Training No</th>
                    <th className="px-6 py-4 font-semibold">Title</th>
                    <th className="px-6 py-4 font-semibold">Type / Category</th>
                    <th className="px-6 py-4 font-semibold">Department</th>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold text-center">Participants</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length > 0 ? filtered.map(t => (
                    <tr key={t.id} onClick={() => router.push(`/modules/training/${t.id}`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-indigo-600">{t.trainingNo}</span>
                          {t.isMandatory && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">MANDATORY</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800 truncate max-w-[200px]">{t.title}</p>
                        {t.trainer && <p className="text-xs text-slate-400 mt-0.5">Trainer: {t.trainer}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${TYPE_COLOR[t.type] || "bg-slate-100 text-slate-700"}`}>{t.type}</span>
                        <p className="text-xs text-slate-500 mt-0.5">{t.category}</p>
                      </td>
                      <td className="px-6 py-4">{t.department}</td>
                      <td className="px-6 py-4 text-slate-500">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1 text-xs text-slate-400"><Calendar className="w-3.5 h-3.5" />Plan: {t.plannedDate}</span>
                          {t.actualDate && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><Calendar className="w-3.5 h-3.5" />Actual: {t.actualDate}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-sm font-bold ${t.participants.length > 0 ? "text-slate-800" : "text-slate-400"}`}>
                          {t.participants.length}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_BADGE[t.status]}`}>{t.status}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/modules/training/${t.id}`} onClick={e => e.stopPropagation()}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                          {canManage && (
                            <button onClick={e => handleDelete(e, t.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <EmptyTableRow colSpan={8} icon={<GraduationCap className="w-12 h-12 text-slate-300" />} title="No training records found" subtitle='Click "Add Training" to start scheduling trainings.' />
                  )}
                </tbody>
              </table>
            </div>
            <TableFooter filtered={filtered.length} total={trainings.length} />
          </div>
        </>
      )}

      {/* ===== TAB: COMPETENCY MATRIX ===== */}
      {activeTab === "matrix" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800">Competency Matrix</h3>
            <p className="text-xs text-slate-500 mt-0.5">Based on completed training. ✅ = Pass/Attended, ⬜ = Not yet</p>
          </div>
          {employees.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Grid3x3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-medium">No competency data yet</p>
              <p className="text-sm">Add participants to completed trainings to view the matrix.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 sticky left-0 bg-slate-50 min-w-[160px] border-r border-slate-200">Employee</th>
                    {categories.map(cat => (
                      <th key={cat} className="px-3 py-3 text-center font-semibold text-slate-600 text-xs min-w-[110px]">{cat}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map(emp => (
                    <tr key={emp} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white border-r border-slate-100">{emp}</td>
                      {categories.map(cat => {
                        const cell = matrix[emp]?.[cat];
                        return (
                          <td key={cat} className="px-3 py-3 text-center">
                            {cell ? (
                              <span title={cell.titles.join(", ")} className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm cursor-default ${cell.passed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                                {cell.passed ? "✓" : "—"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-50 text-slate-300 text-sm">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: EXPIRY ALERTS ===== */}
      {activeTab === "expiry" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Expiry Alerts
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Certificates expiring within the next 90 days.</p>
          </div>
          {expiryAlerts.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
              <p className="font-medium">No certificates expiring soon</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {expiryAlerts.map((a, i) => (
                <div key={i} className={`px-6 py-4 flex items-center justify-between ${a.daysLeft < 0 ? "bg-red-50" : a.daysLeft <= 30 ? "bg-amber-50" : "bg-yellow-50/30"}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${a.daysLeft < 0 ? "bg-red-100 text-red-700" : a.daysLeft <= 30 ? "bg-amber-100 text-amber-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {a.daysLeft < 0 ? "!" : a.daysLeft}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{a.name} <span className="text-xs text-slate-500 font-normal">({a.dept})</span></p>
                      <p className="text-sm text-slate-600">{a.trainingTitle}</p>
                      {a.certNo && <p className="text-xs text-slate-400">Cert: {a.certNo}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-700">Expiry: {a.expiry}</p>
                    <p className={`text-xs font-bold ${a.daysLeft < 0 ? "text-red-600" : a.daysLeft <= 30 ? "text-amber-600" : "text-yellow-600"}`}>
                      {a.daysLeft < 0 ? `Expired ${Math.abs(a.daysLeft)} days ago` : `${a.daysLeft} days left`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AddTrainingModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setModalPreset(null); }}
        presetDepartment={modalPreset?.department}
        presetCategory={modalPreset?.category}
      />
    </div>
  );
}
