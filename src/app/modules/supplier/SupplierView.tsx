"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Filter, Building2, CheckCircle, AlertTriangle, Star, X, Save, ChevronRight, Trash2, TrendingUp, ShieldAlert, Download, Loader2 } from "lucide-react";
import type { SupplierItem } from "./actions";
import TableFooter from "@/components/ui/TableFooter";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import { addSupplier, addEvaluation, updateSupplierStatus, deleteSupplier, exportApprovedSupplierList } from "./actions";
import type { NCRItem } from "@/app/modules/nc/actions";
import Link from "next/link";

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Conditional: "bg-amber-100 text-amber-700 border-amber-200",
  Suspended: "bg-red-100 text-red-700 border-red-200",
  Blacklisted: "bg-slate-800 text-white border-slate-800",
};

const QUAL_STYLE: Record<string, string> = {
  Approved: "bg-emerald-100 text-emerald-700",
  "Conditional Approval": "bg-amber-100 text-amber-700",
  Pending: "bg-slate-100 text-slate-700",
  Rejected: "bg-red-100 text-red-700",
};

const GRADE_STYLE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 font-bold",
  B: "bg-blue-100 text-blue-700 font-bold",
  C: "bg-amber-100 text-amber-700 font-bold",
  D: "bg-red-100 text-red-700 font-bold",
};

const CATEGORIES = ["Raw Material", "Services", "Equipment", "Subcontract", "Utilities", "Calibration", "Other"];

function AddSupplierModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    name: "", category: "Raw Material", address: "", contactName: "", contactEmail: "",
    contactPhone: "", productsSupplied: "", isCritical: false, certifications: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await addSupplier(form);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-teal-50 sticky top-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Building2 className="w-5 h-5 text-teal-600" /> Register New Supplier</h2>
          <button onClick={onClose} className="p-2 hover:bg-teal-100 rounded-full text-teal-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Supplier Name *</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Category *</label>
              <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="isCritical" checked={form.isCritical} onChange={e => setForm({...form, isCritical: e.target.checked})}
                className="w-4 h-4 accent-teal-600" />
              <label htmlFor="isCritical" className="text-sm font-medium text-slate-700">Critical Supplier</label>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Contact Person</label>
              <input value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Email</label>
              <input type="email" value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Phone</label>
              <input value={form.contactPhone} onChange={e => setForm({...form, contactPhone: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Products/Services Supplied *</label>
              <input required value={form.productsSupplied} onChange={e => setForm({...form, productsSupplied: e.target.value})}
                placeholder="e.g., Steel, Rubber, Calibration Service"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Certifications</label>
              <input value={form.certifications} onChange={e => setForm({...form, certifications: e.target.value})}
                placeholder="e.g., ISO 9001, ISO 14001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Address</label>
              <input value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Register Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SupplierDetailPanel({ supplier, canManage, onClose, linkedNcrs = [] }: { supplier: SupplierItem; canManage: boolean; onClose: () => void; linkedNcrs?: NCRItem[] }) {
  const [evalForm, setEvalForm] = useState({ period: "", qualityScore: 80, deliveryScore: 80, serviceScore: 80, priceScore: 80, notes: "" });
  const [saving, setSaving] = useState(false);
  const [showEvalForm, setShowEvalForm] = useState(false);

  async function handleEvaluate() {
    if (!evalForm.period) return;
    setSaving(true);
    await addEvaluation(supplier.id, evalForm);
    setShowEvalForm(false);
    setEvalForm({ period: "", qualityScore: 80, deliveryScore: 80, serviceScore: 80, priceScore: 80, notes: "" });
    setSaving(false);
  }

  const latestEval = [...supplier.evaluations].sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate))[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 sticky top-0 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-bold text-slate-800 text-lg">{supplier.supplierNo}</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[supplier.status]}`}>{supplier.status}</span>
              {supplier.isCritical && <span className="flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"><Star className="w-3 h-3" /> Critical</span>}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{supplier.name} · {supplier.category}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Info */}
          <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl">
            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Products/Services</p><p className="font-medium text-slate-800">{supplier.productsSupplied}</p></div>
            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Qualification</p>
              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${QUAL_STYLE[supplier.qualificationStatus]}`}>{supplier.qualificationStatus}</span>
            </div>
            {supplier.contactName && <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Contact</p><p className="text-slate-700">{supplier.contactName}</p></div>}
            {supplier.contactEmail && <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Email</p><p className="text-slate-700">{supplier.contactEmail}</p></div>}
            {supplier.certifications && <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Certifications</p><p className="text-slate-700">{supplier.certifications}</p></div>}
            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">NC Count</p>
              <span className={`text-sm font-bold ${supplier.ncCount > 0 ? "text-red-600" : "text-emerald-600"}`}>{supplier.ncCount}</span>
            </div>
          </div>

          {/* Latest Score */}
          {latestEval && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-bold text-slate-700">Latest Evaluation — {latestEval.period}</p>
                <span className={`w-10 h-10 flex items-center justify-center rounded-full text-lg ${GRADE_STYLE[latestEval.grade]}`}>{latestEval.grade}</span>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                {[
                  { label: "Quality (40%)", val: latestEval.qualityScore },
                  { label: "Delivery (30%)", val: latestEval.deliveryScore },
                  { label: "Service (20%)", val: latestEval.serviceScore },
                  { label: "Price (10%)", val: latestEval.priceScore },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-lg p-2">
                    <p className="text-slate-500">{s.label}</p>
                    <p className="font-bold text-slate-800 text-base mt-0.5">{s.val}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-center">
                <p className="text-xs text-slate-500">Total Score</p>
                <p className="text-2xl font-bold text-teal-700">{latestEval.totalScore}</p>
              </div>
            </div>
          )}

          {/* Evaluation History */}
          {supplier.evaluations.length > 1 && (
            <div>
              <p className="text-sm font-bold text-slate-700 mb-2">Evaluation History</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Period</th>
                      <th className="px-3 py-2 font-semibold text-center">Quality</th>
                      <th className="px-3 py-2 font-semibold text-center">Delivery</th>
                      <th className="px-3 py-2 font-semibold text-center">Service</th>
                      <th className="px-3 py-2 font-semibold text-center">Total</th>
                      <th className="px-3 py-2 font-semibold text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...supplier.evaluations].sort((a,b) => b.evaluationDate.localeCompare(a.evaluationDate)).map(e => (
                      <tr key={e.id}>
                        <td className="px-3 py-2 font-medium text-slate-700">{e.period}</td>
                        <td className="px-3 py-2 text-center">{e.qualityScore}</td>
                        <td className="px-3 py-2 text-center">{e.deliveryScore}</td>
                        <td className="px-3 py-2 text-center">{e.serviceScore}</td>
                        <td className="px-3 py-2 text-center font-bold">{e.totalScore}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${GRADE_STYLE[e.grade]}`}>{e.grade}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Linked NCs */}
          {linkedNcrs.length > 0 && (
            <div>
              <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                Linked NC / CAPA
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">{linkedNcrs.length}</span>
              </p>
              <div className="space-y-1.5">
                {linkedNcrs.map(nc => (
                  <Link key={nc.id} href={`/modules/nc/${nc.id}`}
                    className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <span className="text-xs font-bold text-blue-600">{nc.ncNumber}</span>
                    <span className="text-xs text-slate-600 flex-1 truncate">{nc.description}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${nc.status === "Closed" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{nc.status}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Evaluate Form */}
          {canManage && (
            <div>
              {!showEvalForm ? (
                <button onClick={() => setShowEvalForm(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors">
                  <TrendingUp className="w-4 h-4" /> Add New Evaluation
                </button>
              ) : (
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-bold text-slate-700">Supplier Evaluation</p>
                  <input value={evalForm.period} onChange={e => setEvalForm({...evalForm, period: e.target.value})}
                    placeholder="Period (e.g., 2025-Q1)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "qualityScore", label: "Quality (0-100)" },
                      { key: "deliveryScore", label: "Delivery (0-100)" },
                      { key: "serviceScore", label: "Service (0-100)" },
                      { key: "priceScore", label: "Price (0-100)" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">{f.label}</label>
                        <input type="number" min={0} max={100} value={(evalForm as any)[f.key]} onChange={e => setEvalForm({...evalForm, [f.key]: +e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center text-sm">
                    Total Score: <span className="font-bold text-teal-700">
                      {Math.round(evalForm.qualityScore*0.4 + evalForm.deliveryScore*0.3 + evalForm.serviceScore*0.2 + evalForm.priceScore*0.1)}
                    </span> → Grade: <span className="font-bold">
                      {calcDisplayGrade(Math.round(evalForm.qualityScore*0.4 + evalForm.deliveryScore*0.3 + evalForm.serviceScore*0.2 + evalForm.priceScore*0.1))}
                    </span>
                  </div>
                  <textarea value={evalForm.notes} onChange={e => setEvalForm({...evalForm, notes: e.target.value})} rows={2} placeholder="Notes (optional)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowEvalForm(false)} className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                    <button onClick={handleEvaluate} disabled={saving || !evalForm.period} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                      {saving ? "Saving..." : "Submit Evaluation"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status change */}
          {canManage && (
            <div className="flex gap-2 flex-wrap">
              {(["Active","Conditional","Suspended","Blacklisted"] as const).map(s => (
                <button key={s} onClick={() => updateSupplierStatus(supplier.id, s)}
                  disabled={supplier.status === s}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-40 ${STATUS_STYLE[s]}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function calcDisplayGrade(score: number) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

export default function SupplierView({ suppliers, user, rolesConfig, ncrs = [] }: { suppliers: SupplierItem[]; user: any; rolesConfig: any[]; ncrs?: NCRItem[] }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCat, setFilterCat] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    const base64 = await exportApprovedSupplierList();
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `approved-supplier-list-${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  }

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("supplier") || user?.department === "Quality Assurance";

  const filtered = useMemo(() => suppliers.filter(s => {
    const matchSearch = s.supplierNo.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.productsSupplied.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || s.status === filterStatus;
    const matchCat = filterCat === "All" || s.category === filterCat;
    return matchSearch && matchStatus && matchCat;
  }), [suppliers, search, filterStatus, filterCat]);

  const approvedCount = useMemo(() => suppliers.filter(s => s.qualificationStatus === "Approved").length, [suppliers]);
  const criticalCount = useMemo(() => suppliers.filter(s => s.isCritical).length, [suppliers]);
  const pendingCount = useMemo(() => suppliers.filter(s => s.qualificationStatus === "Pending").length, [suppliers]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Supplier Quality</h1>
          <p className="text-slate-500 text-sm">Evaluate & control external providers — ISO 9001:2015 Clause 8.4</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export ASL
          </button>
          {canManage && (
            <button onClick={() => setIsAddOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Register Supplier
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-emerald-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600"><CheckCircle className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Approved</p><p className="text-xl font-bold text-slate-800">{approvedCount}</p></div>
        </div>
        <div className="bg-white border border-amber-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600"><Star className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Critical Suppliers</p><p className="text-xl font-bold text-slate-800">{criticalCount}</p></div>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600"><AlertTriangle className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Pending Evaluation</p><p className="text-xl font-bold text-slate-800">{pendingCount}</p></div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search supplier no, name, products..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 bg-white text-sm" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"}`}>
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
        {showFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 text-slate-900">
                {["All","Active","Conditional","Suspended","Blacklisted"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Category</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 text-slate-900">
                {["All",...CATEGORIES].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Supplier No</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Products/Services</th>
                <th className="px-6 py-4 font-semibold">Qualification</th>
                <th className="px-6 py-4 font-semibold text-center">Grade</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map(s => {
                const latestEval = [...s.evaluations].sort((a,b) => b.evaluationDate.localeCompare(a.evaluationDate))[0];
                return (
                  <tr key={s.id} onClick={() => setSelectedSupplier(s)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-6 py-4 font-bold text-teal-600">
                      <div className="flex items-center gap-1.5">
                        {s.supplierNo}
                        {s.isCritical && <span title="Critical Supplier"><Star className="w-3.5 h-3.5 text-amber-500" /></span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">{s.name}</td>
                    <td className="px-6 py-4 text-slate-600">{s.category}</td>
                    <td className="px-6 py-4 max-w-xs truncate text-slate-600">{s.productsSupplied}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${QUAL_STYLE[s.qualificationStatus]}`}>{s.qualificationStatus}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {latestEval ? (
                        <span className={`w-8 h-8 inline-flex items-center justify-center rounded-full text-sm ${GRADE_STYLE[latestEval.grade]}`}>{latestEval.grade}</span>
                      ) : <span className="text-slate-300 text-xs">N/A</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                    </td>
                    <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setSelectedSupplier(s)} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <button onClick={() => { if (confirm("Delete this supplier?")) deleteSupplier(s.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <EmptyTableRow colSpan={8} icon={<Building2 className="w-12 h-12 text-slate-300" />} title="No suppliers registered yet" />
              )}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={suppliers.length} label="suppliers" />
      </div>

      {isAddOpen && <AddSupplierModal onClose={() => setIsAddOpen(false)} />}
      {selectedSupplier && (
        <SupplierDetailPanel
          supplier={suppliers.find(s => s.id === selectedSupplier.id) ?? selectedSupplier}
          canManage={canManage}
          onClose={() => setSelectedSupplier(null)}
          linkedNcrs={ncrs.filter(n => n.supplierId === selectedSupplier.id)}
        />
      )}
    </div>
  );
}
