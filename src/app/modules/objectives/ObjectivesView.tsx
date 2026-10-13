"use client";

import { useState } from "react";
import { Plus, Target, TrendingUp, CheckCircle, AlertTriangle, X, Save, ChevronDown, BarChart3, Trash2 } from "lucide-react";
import type { QualityObjective } from "./actions";
import { addObjective, addMeasurement, deleteObjective } from "./actions";

const STATUS_STYLE: Record<string, string> = {
  "On Track": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "At Risk": "bg-amber-100 text-amber-700 border-amber-200",
  "Behind": "bg-red-100 text-red-700 border-red-200",
  "Achieved": "bg-blue-100 text-blue-700 border-blue-200",
  "Closed": "bg-slate-100 text-slate-700 border-slate-200",
};

const ISO_CLAUSES = ["4.1","4.2","5.2","6.2","7.1","7.2","8.1","8.2","8.5","9.1","10.3"];

function ProgressBar({ value, target, unit }: { value?: number; target: number; unit: string }) {
  const pct = Math.min(Math.round(((value ?? 0) / target) * 100), 100);
  const color = pct >= 100 ? "bg-blue-500" : pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{value ?? 0} {unit}</span>
        <span>Target: {target} {unit}</span>
      </div>
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-right font-semibold text-slate-600">{pct}%</p>
    </div>
  );
}

function Sparkline({ measurements, target }: { measurements: { value: number; date: string }[]; target: number }) {
  if (measurements.length < 2) return null;
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const values = sorted.map(m => m.value);
  const allValues = [...values, target];
  const min = Math.min(...allValues) * 0.9;
  const max = Math.max(...allValues) * 1.1 || 1;
  const W = 160, H = 40, PAD = 4;

  const toX = (i: number) => PAD + (i / (values.length - 1)) * (W - PAD * 2);
  const toY = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2);

  const linePath = values.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const targetY = toY(target).toFixed(1);

  const trend = values[values.length - 1] >= values[0];
  const lineColor = values[values.length - 1] >= target ? "#10b981" : values[values.length - 1] >= target * 0.8 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex items-center gap-2">
      <svg role="img" aria-label={`Objective trend: ${trend ? "improving" : "declining"}`} width={W} height={H} className="overflow-visible">
        {/* Target line */}
        <line x1={PAD} y1={targetY} x2={W - PAD} y2={targetY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,2" />
        {/* Trend line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Last point dot */}
        <circle cx={toX(values.length - 1)} cy={toY(values[values.length - 1])} r="3" fill={lineColor} />
      </svg>
      <span className={`text-xs font-bold ${trend ? "text-emerald-600" : "text-red-500"}`}>
        {trend ? "↑" : "↓"}
      </span>
    </div>
  );
}

function AddObjectiveModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    title: "", description: "", department: "", isoClause: "9.1", kpiName: "", kpiUnit: "%",
    target: 90, baseline: 0, frequency: "Quarterly" as QualityObjective["frequency"],
    picName: "", startDate: new Date().toISOString().split("T")[0],
    targetDate: "", actions: "", year: new Date().getFullYear(),
    status: "On Track" as QualityObjective["status"],
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await addObjective(form);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-blue-50 sticky top-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Target className="w-5 h-5 text-blue-600" /> Add Quality Objective</h2>
          <button onClick={onClose} className="p-2 hover:bg-blue-100 rounded-full text-blue-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Quality Objective Title *</label>
              <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                placeholder="e.g., Reduce production defect rate"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Department *</label>
              <select required value={form.department} onChange={e => setForm({...form, department: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900">
                <option value="">Select...</option>
                {["Top Management","Quality Assurance","Production","Engineering","HSE","HR & Admin","All Departments"].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">ISO Clause</label>
              <select value={form.isoClause} onChange={e => setForm({...form, isoClause: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900">
                {ISO_CLAUSES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">KPI Name *</label>
              <input required value={form.kpiName} onChange={e => setForm({...form, kpiName: e.target.value})}
                placeholder="e.g., Defect Rate, Customer Satisfaction Score"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Unit *</label>
              <input required value={form.kpiUnit} onChange={e => setForm({...form, kpiUnit: e.target.value})}
                placeholder="e.g., %, ppm, days, units"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Target *</label>
              <input required type="number" step="any" value={form.target} onChange={e => setForm({...form, target: +e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Baseline</label>
              <input type="number" step="any" value={form.baseline} onChange={e => setForm({...form, baseline: +e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Monitoring Frequency</label>
              <select value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value as QualityObjective["frequency"]})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900">
                {["Monthly","Quarterly","Semi-Annual","Annual"].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">PIC</label>
              <input value={form.picName} onChange={e => setForm({...form, picName: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Start Date *</label>
              <input required type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Target Date *</label>
              <input required type="date" value={form.targetDate} onChange={e => setForm({...form, targetDate: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Description / Context</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Action Plan to Achieve Objective</label>
            <textarea rows={2} value={form.actions} onChange={e => setForm({...form, actions: e.target.value})}
              placeholder="Steps to be taken..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Add Objective"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ObjectiveCard({ obj, canManage }: { obj: QualityObjective; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleRecord() {
    if (!newValue) return;
    setSaving(true);
    await addMeasurement(obj.id, parseFloat(newValue), newNotes || undefined);
    setNewValue("");
    setNewNotes("");
    setSaving(false);
  }

  const sortedMeasurements = [...obj.measurements].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-bold text-blue-600">{obj.objectiveNo}</span>
              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">Cl. {obj.isoClause}</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{obj.frequency}</span>
            </div>
            <h3 className="font-bold text-slate-800">{obj.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{obj.department} · PIC: {obj.picName || "-"}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[obj.status]}`}>{obj.status}</span>
            {canManage && (
              <button onClick={() => deleteObjective(obj.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500 font-semibold">{obj.kpiName}</p>
            {obj.measurements.length >= 2 && (
              <Sparkline measurements={obj.measurements} target={obj.target} />
            )}
          </div>
          <ProgressBar value={obj.currentValue} target={obj.target} unit={obj.kpiUnit} />
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
          <span>Target: {obj.targetDate}</span>
          <span>{obj.measurements.length} measurement(s)</span>
        </div>

        {canManage && (
          <div className="mt-4 flex gap-2">
            <input type="number" step="any" value={newValue} onChange={e => setNewValue(e.target.value)}
              placeholder={`Record ${obj.kpiName} (${obj.kpiUnit})`}
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
            <input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Notes (optional)"
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
            <button onClick={handleRecord} disabled={!newValue || saving}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1 shrink-0">
              {saving ? "..." : <><TrendingUp className="w-3.5 h-3.5" /> Record</>}
            </button>
          </div>
        )}

        {obj.measurements.length > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Hide" : "Show"} measurement history
          </button>
        )}
      </div>

      {expanded && sortedMeasurements.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 p-4">
          <table className="w-full text-xs text-left">
            <thead><tr className="text-slate-500 border-b border-slate-200">
              <th className="pb-2 font-semibold">Date</th>
              <th className="pb-2 font-semibold text-right">Value</th>
              <th className="pb-2 font-semibold">Notes</th>
              <th className="pb-2 font-semibold">Recorded By</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {sortedMeasurements.map(m => (
                <tr key={m.id}>
                  <td className="py-1.5 text-slate-600">{m.date}</td>
                  <td className="py-1.5 text-right font-bold text-slate-800">{m.value} {obj.kpiUnit}</td>
                  <td className="py-1.5 text-slate-500">{m.notes || "-"}</td>
                  <td className="py-1.5 text-slate-500">{m.recordedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ObjectivesView({ objectives, user, rolesConfig }: { objectives: QualityObjective[]; user: any; rolesConfig: any[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterDept, setFilterDept] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("objectives") || user?.department === "Quality Assurance";

  const years = Array.from(new Set(objectives.map(o => o.year.toString()))).sort((a, b) => +b - +a);
  if (!years.includes(new Date().getFullYear().toString())) years.unshift(new Date().getFullYear().toString());

  const filtered = objectives.filter(o => {
    const matchYear = filterYear === "All" || o.year.toString() === filterYear;
    const matchDept = filterDept === "All" || o.department === filterDept;
    const matchStatus = filterStatus === "All" || o.status === filterStatus;
    return matchYear && matchDept && matchStatus;
  });

  const achieved = filtered.filter(o => o.status === "Achieved").length;
  const onTrack = filtered.filter(o => o.status === "On Track").length;
  const atRisk = filtered.filter(o => o.status === "At Risk" || o.status === "Behind").length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quality Objectives</h1>
          <p className="text-slate-500 text-sm">Monitor quality objective achievement — ISO 9001:2015 Clause 6.2 & 9.1</p>
        </div>
        {canManage && (
          <button onClick={() => setIsAddOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Objective
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-blue-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600"><CheckCircle className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Achieved</p><p className="text-xl font-bold text-slate-800">{achieved}</p></div>
        </div>
        <div className="bg-white border border-emerald-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600"><TrendingUp className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">On Track</p><p className="text-xl font-bold text-slate-800">{onTrack}</p></div>
        </div>
        <div className="bg-white border border-red-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600"><AlertTriangle className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">At Risk / Behind</p><p className="text-xl font-bold text-slate-800">{atRisk}</p></div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3">
        {[
          { label: "Year", val: filterYear, set: setFilterYear, opts: ["All", ...years] },
          { label: "Department", val: filterDept, set: setFilterDept, opts: ["All","Top Management","Quality Assurance","Production","Engineering","HSE","HR & Admin"] },
          { label: "Status", val: filterStatus, set: setFilterStatus, opts: ["All","On Track","At Risk","Behind","Achieved","Closed"] },
        ].map(f => (
          <div key={f.label}>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">{f.label}</label>
            <select value={f.val} onChange={e => f.set(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
              {f.opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Objectives List */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map(obj => (
            <ObjectiveCard key={obj.id} obj={obj} canManage={canManage} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-500">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-600">No Quality Objectives yet</p>
          <p className="text-sm mt-1">Click "Add Objective" to define quality objectives.</p>
        </div>
      )}

      {isAddOpen && <AddObjectiveModal onClose={() => setIsAddOpen(false)} />}
    </div>
  );
}
