"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Filter, TriangleAlert, Shield, ShieldAlert, TrendingDown, Eye, Trash2, ChevronRight, X, Save } from "lucide-react";
import type { RiskItem } from "./actions";
import type { NCRItem } from "@/app/modules/nc/actions";
import Link from "next/link";
import { addRisk, updateRisk, deleteRisk } from "./actions";
import { TabNav, Tab } from "@/components/ui/TabNav";
import TableFooter from "@/components/ui/TableFooter";
import EmptyTableRow from "@/components/ui/EmptyTableRow";

const LIKELIHOOD_LABELS: Record<number, string> = { 1: "Rare", 2: "Unlikely", 3: "Possible", 4: "Likely", 5: "Almost Certain" };
const SEVERITY_LABELS: Record<number, string> = { 1: "Negligible", 2: "Minor", 3: "Moderate", 4: "Major", 5: "Catastrophic" };

const LEVEL_STYLE: Record<string, string> = {
  Low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  High: "bg-orange-100 text-orange-700 border-orange-200",
  Critical: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_STYLE: Record<string, string> = {
  Open: "bg-red-100 text-red-700 border-red-200",
  "In Treatment": "bg-blue-100 text-blue-700 border-blue-200",
  Monitored: "bg-amber-100 text-amber-700 border-amber-200",
  Closed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const CATEGORIES = ["Process", "Product/Service", "Customer", "Supplier", "Compliance/Regulatory", "Infrastructure", "Human Resources", "Financial", "Environmental"];
const TREATMENTS = ["Accept", "Mitigate", "Transfer", "Avoid"] as const;
const ISO_CLAUSES = ["4.1", "4.2", "5.1", "5.2", "6.1", "6.2", "7.1", "7.2", "8.1", "8.4", "8.5", "9.1", "9.2", "9.3", "10.1", "10.2"];

function ScoreMatrix({ value }: { value: number }) {
  const level = value >= 15 ? "Critical" : value >= 9 ? "High" : value >= 4 ? "Medium" : "Low";
  return (
    <div className="flex items-center gap-2">
      <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${LEVEL_STYLE[level]}`}>{value}</span>
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${LEVEL_STYLE[level]}`}>{level}</span>
    </div>
  );
}

function AddRiskModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    title: "", category: "Process", process: "", department: "", description: "", potentialImpact: "",
    likelihood: 3, severity: 3, treatment: "Mitigate" as RiskItem["treatment"],
    mitigationAction: "", opportunity: "", picName: "", targetDate: "", isoClause: "",
  });
  const [saving, setSaving] = useState(false);
  const score = form.likelihood * form.severity;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await addRisk(form);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-orange-50 sticky top-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><TriangleAlert className="w-5 h-5 text-orange-500" /> Register New Risk</h2>
          <button onClick={onClose} className="p-2 hover:bg-orange-100 rounded-full text-orange-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Risk Title *</label>
              <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Category *</label>
              <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Department *</label>
              <select required value={form.department} onChange={e => setForm({...form, department: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900">
                <option value="">Select...</option>
                {["Top Management","Quality Assurance","Production","Engineering","HSE","HR & Admin","All Departments"].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Business Process</label>
              <input value={form.process} onChange={e => setForm({...form, process: e.target.value})}
                placeholder="e.g., Production, Procurement, Delivery"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">ISO Clause</label>
              <select value={form.isoClause} onChange={e => setForm({...form, isoClause: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900">
                <option value="">-</option>
                {ISO_CLAUSES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Risk Description *</label>
            <textarea required rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Potential Impact *</label>
            <textarea required rows={2} value={form.potentialImpact} onChange={e => setForm({...form, potentialImpact: e.target.value})}
              placeholder="What is the impact if this risk occurs?"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900 resize-none" />
          </div>

          {/* Risk Matrix */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-4">
            <p className="text-sm font-bold text-slate-700">Risk Assessment</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">Likelihood (1-5): <span className="text-orange-700">{LIKELIHOOD_LABELS[form.likelihood]}</span></label>
                <input type="range" min={1} max={5} value={form.likelihood} onChange={e => setForm({...form, likelihood: +e.target.value})} className="w-full accent-orange-500" />
                <div className="flex justify-between text-xs text-slate-400 mt-1"><span>Rare</span><span>Almost Certain</span></div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">Severity (1-5): <span className="text-orange-700">{SEVERITY_LABELS[form.severity]}</span></label>
                <input type="range" min={1} max={5} value={form.severity} onChange={e => setForm({...form, severity: +e.target.value})} className="w-full accent-orange-500" />
                <div className="flex justify-between text-xs text-slate-400 mt-1"><span>Negligible</span><span>Catastrophic</span></div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-700">Risk Score:</span>
              <ScoreMatrix value={score} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Treatment *</label>
              <select required value={form.treatment} onChange={e => setForm({...form, treatment: e.target.value as RiskItem["treatment"]})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900">
                {TREATMENTS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">PIC</label>
              <input value={form.picName} onChange={e => setForm({...form, picName: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Target Date</label>
              <input type="date" value={form.targetDate} onChange={e => setForm({...form, targetDate: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900" />
            </div>
          </div>

          {form.treatment !== "Accept" && (
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Mitigation Action</label>
              <textarea rows={2} value={form.mitigationAction} onChange={e => setForm({...form, mitigationAction: e.target.value})}
                placeholder="Mitigation steps to be taken..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900 resize-none" />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Related Opportunity</label>
            <input value={form.opportunity} onChange={e => setForm({...form, opportunity: e.target.value})}
              placeholder="Opportunities that can be leveraged related to this risk..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900" />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Register Risk"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RiskDetailPanel({ risk, allUsers, onClose, linkedNcrs = [] }: { risk: RiskItem; allUsers: any[]; onClose: () => void; linkedNcrs?: NCRItem[] }) {
  const [residualL, setResidualL] = useState(risk.residualLikelihood ?? risk.likelihood);
  const [residualS, setResidualS] = useState(risk.residualSeverity ?? risk.severity);
  const [status, setStatus] = useState(risk.status);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateRisk(risk.id, { residualLikelihood: residualL, residualSeverity: residualS, status });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 sticky top-0">
          <div>
            <h2 className="font-bold text-slate-800">{risk.riskNo}</h2>
            <p className="text-xs text-slate-500">{risk.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs text-slate-500 font-semibold uppercase">Category</p><p className="font-medium text-slate-800">{risk.category}</p></div>
            <div><p className="text-xs text-slate-500 font-semibold uppercase">Department</p><p className="font-medium text-slate-800">{risk.department}</p></div>
            <div className="col-span-2"><p className="text-xs text-slate-500 font-semibold uppercase">Description</p><p className="text-slate-700 bg-slate-50 p-3 rounded-lg text-sm">{risk.description}</p></div>
            <div className="col-span-2"><p className="text-xs text-slate-500 font-semibold uppercase">Potential Impact</p><p className="text-red-900 bg-red-50 p-3 rounded-lg text-sm">{risk.potentialImpact}</p></div>
          </div>

          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">Initial Risk Score</p>
            <div className="flex gap-6 text-sm">
              <div><span className="text-slate-500">Likelihood: </span><span className="font-medium">{risk.likelihood} — {LIKELIHOOD_LABELS[risk.likelihood]}</span></div>
              <div><span className="text-slate-500">Severity: </span><span className="font-medium">{risk.severity} — {SEVERITY_LABELS[risk.severity]}</span></div>
            </div>
            <ScoreMatrix value={risk.riskScore} />
          </div>

          {risk.mitigationAction && (
            <div><p className="text-xs text-slate-500 font-semibold uppercase mb-1">Mitigation Action</p>
            <p className="text-sm text-blue-900 bg-blue-50 p-3 rounded-lg">{risk.mitigationAction}</p></div>
          )}

          {linkedNcrs.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-500" /> Linked NC / CAPA
                <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{linkedNcrs.length}</span>
              </p>
              <div className="space-y-1.5">
                {linkedNcrs.map(nc => (
                  <Link key={nc.id} href={`/modules/nc/${nc.id}`}
                    className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm">
                    <span className="font-bold text-blue-600">{nc.ncNumber}</span>
                    <span className="text-slate-600 flex-1 truncate text-xs">{nc.description}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${nc.status === "Closed" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{nc.status}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-700">Residual Risk (After Treatment)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Residual Likelihood: <span className="text-orange-700">{LIKELIHOOD_LABELS[residualL]}</span></label>
                <input type="range" min={1} max={5} value={residualL} onChange={e => setResidualL(+e.target.value)} className="w-full accent-orange-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Residual Severity: <span className="text-orange-700">{SEVERITY_LABELS[residualS]}</span></label>
                <input type="range" min={1} max={5} value={residualS} onChange={e => setResidualS(+e.target.value)} className="w-full accent-orange-500" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-700">Residual Score:</span>
              <ScoreMatrix value={residualL * residualS} />
              {(residualL * residualS) < risk.riskScore && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> Reduced</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as RiskItem["status"])}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white text-slate-900">
              {["Open","In Treatment","Monitored","Closed"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Close</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RiskView({ risks, ncrs = [], user, rolesConfig, allUsers }: { risks: RiskItem[]; ncrs?: NCRItem[]; user: any; rolesConfig: any[]; allUsers: any[] }) {
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCat, setFilterCat] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<RiskItem | null>(null);
  const [activeTab, setActiveTab] = useState<"register" | "matrix">("register");

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("risk") || user?.department === "Quality Assurance";

  const filtered = useMemo(() => risks.filter(r => {
    const matchSearch = r.riskNo.toLowerCase().includes(search.toLowerCase()) ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.department.toLowerCase().includes(search.toLowerCase());
    const matchLevel = filterLevel === "All" || r.riskLevel === filterLevel;
    const matchStatus = filterStatus === "All" || r.status === filterStatus;
    const matchCat = filterCat === "All" || r.category === filterCat;
    return matchSearch && matchLevel && matchStatus && matchCat;
  }), [risks, search, filterLevel, filterStatus, filterCat]);

  const criticalCount = useMemo(() => risks.filter(r => r.riskLevel === "Critical" && r.status !== "Closed").length, [risks]);
  const highCount = useMemo(() => risks.filter(r => r.riskLevel === "High" && r.status !== "Closed").length, [risks]);
  const openCount = useMemo(() => risks.filter(r => r.status === "Open" || r.status === "In Treatment").length, [risks]);

  const today = new Date();
  const overdueReview = useMemo(() => {
    const now = new Date();
    return risks.filter(r => {
      if (r.status === "Closed") return false;
      if (!r.lastReviewed) return true;
      const diffDays = Math.ceil((now.getTime() - new Date(r.lastReviewed).getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 90;
    });
  }, [risks]);

  // Risk matrix 5x5
  const matrixCells = useMemo(() => {
    const cells: Record<string, RiskItem[]> = {};
    for (let l = 1; l <= 5; l++) {
      for (let s = 1; s <= 5; s++) {
        cells[`${l}-${s}`] = risks.filter(r => r.likelihood === l && r.severity === s && r.status !== "Closed");
      }
    }
    return cells;
  }, [risks]);

  const matrixBg = (l: number, s: number) => {
    const score = l * s;
    if (score >= 15) return "bg-red-100 border-red-200";
    if (score >= 9) return "bg-orange-100 border-orange-200";
    if (score >= 4) return "bg-amber-100 border-amber-200";
    return "bg-emerald-100 border-emerald-200";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Risk Management</h1>
          <p className="text-slate-500 text-sm">Identify & control risks and opportunities — ISO 9001:2015 Clause 6.1</p>
        </div>
        {canManage && (
          <button onClick={() => setIsAddOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Register Risk
          </button>
        )}
      </div>

      {/* Periodic Review Alert */}
      {overdueReview.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <TriangleAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">
              {overdueReview.length} risk{overdueReview.length > 1 ? "s" : ""} have not been reviewed in over 90 days
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              ISO 9001:2015 Cl. 6.1 requires periodic review of risks and opportunities.
              Risks due for review: <span className="font-semibold">{overdueReview.map(r => r.riskNo).join(", ")}</span>
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-red-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600 font-bold text-lg">{criticalCount}</div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Critical</p><p className="text-sm font-medium text-slate-700">Active critical risks</p></div>
        </div>
        <div className="bg-white border border-orange-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold text-lg">{highCount}</div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">High</p><p className="text-sm font-medium text-slate-700">Needs attention</p></div>
        </div>
        <div className="bg-white border border-blue-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-lg">{openCount}</div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Active</p><p className="text-sm font-medium text-slate-700">Under treatment</p></div>
        </div>
      </div>

      {/* Tabs */}
      <TabNav>
        <Tab active={activeTab === "register"} onClick={() => setActiveTab("register")}>
          <Shield className="w-4 h-4" /> Risk Register
        </Tab>
        <Tab active={activeTab === "matrix"} onClick={() => setActiveTab("matrix")}>
          <Eye className="w-4 h-4" /> Risk Matrix
        </Tab>
      </TabNav>

      {activeTab === "matrix" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-800">Risk Matrix (5×5)</h3>
            <div className="flex gap-3 text-xs">
              {["Low","Medium","High","Critical"].map(l => (
                <span key={l} className={`px-2 py-1 rounded border font-semibold ${LEVEL_STYLE[l]}`}>{l}</span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-slate-500 font-semibold text-left w-24">L \ S</th>
                  {[1,2,3,4,5].map(s => <th key={s} className="p-2 text-center text-slate-600 font-semibold">{s}<br/><span className="font-normal text-slate-400">{SEVERITY_LABELS[s].slice(0,4)}</span></th>)}
                </tr>
              </thead>
              <tbody>
                {[5,4,3,2,1].map(l => (
                  <tr key={l}>
                    <td className="p-2 text-slate-600 font-semibold">{l} — {LIKELIHOOD_LABELS[l].slice(0,8)}</td>
                    {[1,2,3,4,5].map(s => (
                      <td key={s} className={`p-2 border rounded-lg text-center align-top min-w-24 ${matrixBg(l,s)}`}>
                        <div className="text-xs font-bold text-slate-600 mb-1">{l*s}</div>
                        {matrixCells[`${l}-${s}`].map(r => (
                          <div key={r.id} title={r.title} onClick={() => setSelectedRisk(r)}
                            className="text-[10px] bg-white rounded px-1 py-0.5 mb-1 truncate max-w-20 cursor-pointer hover:bg-orange-50 border border-slate-200">
                            {r.riskNo}
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "register" && (
        <>
          {/* Search & Filter */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search risk no, title, department..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 bg-white text-sm" />
              </div>
              <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"}`}>
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
            {showFilters && (
              <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Level", val: filterLevel, set: setFilterLevel, opts: ["All","Low","Medium","High","Critical"] },
                  { label: "Status", val: filterStatus, set: setFilterStatus, opts: ["All","Open","In Treatment","Monitored","Closed"] },
                  { label: "Category", val: filterCat, set: setFilterCat, opts: ["All",...CATEGORIES] },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">{f.label}</label>
                    <select value={f.val} onChange={e => f.set(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-orange-500">
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
                    <th className="px-6 py-4 font-semibold">Risk No</th>
                    <th className="px-6 py-4 font-semibold">Title</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Department</th>
                    <th className="px-6 py-4 font-semibold text-center">Score</th>
                    <th className="px-6 py-4 font-semibold">Treatment</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length > 0 ? filtered.map(r => {
                    const needsReview = r.status !== "Closed" && (!r.lastReviewed || Math.ceil((today.getTime() - new Date(r.lastReviewed).getTime()) / (1000*60*60*24)) > 90);
                    return (
                    <tr key={r.id} onClick={() => setSelectedRisk(r)} className={`cursor-pointer transition-colors ${needsReview ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-slate-50"}`}>
                      <td className="px-6 py-4 font-bold text-orange-600">
                        <div className="flex items-center gap-1.5">
                          {r.riskNo}
                          {needsReview && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Review Due</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800 max-w-xs truncate">{r.title}</p>
                        {r.isoClause && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">Cl. {r.isoClause}</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{r.category}</td>
                      <td className="px-6 py-4">{r.department}</td>
                      <td className="px-6 py-4 text-center"><ScoreMatrix value={r.riskScore} /></td>
                      <td className="px-6 py-4">
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-medium">{r.treatment}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setSelectedRisk(r)} className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <button onClick={() => { if (confirm("Delete this risk?")) deleteRisk(r.id); }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  }) : (
                    <EmptyTableRow colSpan={8} icon={<Shield className="w-12 h-12 text-slate-300" />} title="No risks registered yet" subtitle='Click "Register Risk" to start documenting risks.' />
                  )}
                </tbody>
              </table>
            </div>
            <TableFooter filtered={filtered.length} total={risks.length} label="risks" />
          </div>
        </>
      )}

      {isAddOpen && <AddRiskModal onClose={() => setIsAddOpen(false)} />}
      {selectedRisk && (
        <RiskDetailPanel
          risk={risks.find(r => r.id === selectedRisk.id) ?? selectedRisk}
          allUsers={allUsers}
          onClose={() => setSelectedRisk(null)}
          linkedNcrs={ncrs.filter(n => n.linkedRiskId === selectedRisk.id)}
        />
      )}
    </div>
  );
}
