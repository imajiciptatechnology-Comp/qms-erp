"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Filter, PhoneCall, CheckCircle, AlertTriangle, Star, X, Save, ChevronRight, Trash2, Activity, MessageSquare, ShieldAlert } from "lucide-react";
import type { ComplaintItem } from "./actions";
import TableFooter from "@/components/ui/TableFooter";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import type { SatisfactionSurvey } from "./actions";
import { addComplaint, updateComplaint, deleteComplaint, escalateComplaintToNCR, createSurvey, addSurveyResponse, closeSurvey } from "./actions";
import { TabNav, Tab } from "@/components/ui/TabNav";

const STATUS_STYLE: Record<string, string> = {
  Open: "bg-red-100 text-red-700 border-red-200",
  "Under Investigation": "bg-amber-100 text-amber-700 border-amber-200",
  "Action Taken": "bg-blue-100 text-blue-700 border-blue-200",
  Closed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Rejected: "bg-slate-100 text-slate-700 border-slate-200",
};

const SEVERITY_STYLE: Record<string, string> = {
  Low: "bg-emerald-50 text-emerald-700",
  Medium: "bg-amber-50 text-amber-700",
  High: "bg-orange-50 text-orange-700",
  Critical: "bg-red-50 text-red-700 font-bold",
};

function getSLAStatus(complaint: ComplaintItem): { label: string; color: string } | null {
  if (!complaint.slaTargetDays) return null;
  const created = new Date(complaint.complaintDate);
  const dueDate = new Date(created);
  dueDate.setDate(dueDate.getDate() + complaint.slaTargetDays);

  if (complaint.status === "Closed" || complaint.status === "Rejected") {
    const closed = complaint.actualCloseDate ? new Date(complaint.actualCloseDate) : new Date();
    const onTime = closed <= dueDate;
    return onTime
      ? { label: "Closed On-Time", color: "bg-emerald-100 text-emerald-700" }
      : { label: "Closed Late", color: "bg-red-100 text-red-700" };
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `SLA Breached ${Math.abs(diffDays)}d`, color: "bg-red-100 text-red-700 font-bold" };
  if (diffDays === 0) return { label: "SLA Due Today", color: "bg-orange-100 text-orange-700 font-bold" };
  if (diffDays <= 1) return { label: `SLA Due in ${diffDays}d`, color: "bg-amber-100 text-amber-700" };
  return { label: `SLA: ${diffDays}d left`, color: "bg-slate-100 text-slate-600" };
}

const SOURCES = ["Phone", "Email", "Walk-in", "Survey", "Social Media", "Other"] as const;
const CATEGORIES = ["Product Quality", "Delivery / Lead Time", "Customer Service", "Billing / Invoice", "Documentation", "Safety", "Other"];

function AddComplaintModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    source: "Phone" as ComplaintItem["source"],
    customerName: "", customerContact: "", productService: "", description: "",
    category: "Product Quality", severity: "Medium" as ComplaintItem["severity"],
    picName: "", targetDate: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await addComplaint(form);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-cyan-50 sticky top-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><PhoneCall className="w-5 h-5 text-cyan-600" /> Register Customer Complaint</h2>
          <button onClick={onClose} className="p-2 hover:bg-cyan-100 rounded-full text-cyan-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Customer Name *</label>
              <input required value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Customer Contact</label>
              <input value={form.customerContact} onChange={e => setForm({...form, customerContact: e.target.value})}
                placeholder="Email / Phone"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Source *</label>
              <select required value={form.source} onChange={e => setForm({...form, source: e.target.value as ComplaintItem["source"]})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900">
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Product/Service *</label>
              <input required value={form.productService} onChange={e => setForm({...form, productService: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Category *</label>
              <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Severity *</label>
              <select required value={form.severity} onChange={e => setForm({...form, severity: e.target.value as ComplaintItem["severity"]})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900">
                {["Low","Medium","High","Critical"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">PIC</label>
              <input value={form.picName} onChange={e => setForm({...form, picName: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Target Resolution</label>
              <input type="date" value={form.targetDate} onChange={e => setForm({...form, targetDate: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Complaint Description *</label>
            <textarea required rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Register Complaint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ComplaintDetailPanel({ complaint, canManage, onClose }: { complaint: ComplaintItem; canManage: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    status: complaint.status,
    immediateResponse: complaint.immediateResponse || "",
    rootCause: complaint.rootCause || "",
    correctiveAction: complaint.correctiveAction || "",
    preventiveAction: complaint.preventiveAction || "",
    customerSatisfied: complaint.customerSatisfied ?? true,
    satisfactionScore: complaint.satisfactionScore ?? 4,
    feedbackNotes: complaint.feedbackNotes || "",
  });
  const [saving, setSaving] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [showEscalateForm, setShowEscalateForm] = useState(false);
  const [escalateDueDate, setEscalateDueDate] = useState("");
  const [escalateSeverity, setEscalateSeverity] = useState<"Minor" | "Major" | "Critical">("Major");

  async function handleSave() {
    setSaving(true);
    await updateComplaint(complaint.id, form, `Status changed to ${form.status}`);
    setSaving(false);
    onClose();
  }

  async function handleEscalate() {
    if (!escalateDueDate) { alert("Please fill in the NCR Due Date first."); return; }
    setEscalating(true);
    const res = await escalateComplaintToNCR(complaint.id, escalateDueDate, escalateSeverity);
    setEscalating(false);
    if (res.success) {
      alert(`NCR created successfully: ${res.ncNumber}`);
      setShowEscalateForm(false);
      onClose();
    } else {
      alert(res.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 sticky top-0 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-slate-800 text-lg">{complaint.complaintNo}</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[complaint.status]}`}>{complaint.status}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${SEVERITY_STYLE[complaint.severity]}`}>{complaint.severity}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{complaint.customerName} · {complaint.complaintDate}</p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Info */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-sm">
            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Source</p><p className="font-medium text-slate-800">{complaint.source}</p></div>
            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Category</p><p className="font-medium text-slate-800">{complaint.category}</p></div>
            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Product/Service</p><p className="font-medium text-slate-800">{complaint.productService}</p></div>
            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">PIC</p><p className="font-medium text-slate-800">{complaint.picName || "-"}</p></div>
            {complaint.customerContact && (
              <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Contact</p><p className="font-medium text-slate-800">{complaint.customerContact}</p></div>
            )}
            {complaint.slaTargetDays && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">SLA Target</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-800">{complaint.slaTargetDays} day(s)</p>
                  {(() => {
                    const sla = getSLAStatus(complaint);
                    return sla ? <span className={`text-xs px-2 py-0.5 rounded font-semibold ${sla.color}`}>{sla.label}</span> : null;
                  })()}
                </div>
              </div>
            )}
            {complaint.targetDate && (
              <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Target</p>
                <p className={`font-medium ${new Date(complaint.targetDate) < new Date() && complaint.status !== "Closed" ? "text-red-600" : "text-slate-800"}`}>{complaint.targetDate}</p>
              </div>
            )}
            <div className="col-span-2"><p className="text-xs text-slate-500 uppercase font-semibold mb-1">Complaint Description</p>
              <p className="text-slate-700 bg-white p-3 rounded-lg border border-slate-200 text-sm">{complaint.description}</p></div>
          </div>

          {/* Status */}
          {canManage && (
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value as ComplaintItem["status"]})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900">
                {["Open","Under Investigation","Action Taken","Closed","Rejected"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Response */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Immediate Response</label>
            <textarea rows={2} value={form.immediateResponse} onChange={e => setForm({...form, immediateResponse: e.target.value})}
              disabled={!canManage} placeholder="Initial actions taken..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900 resize-none disabled:bg-slate-50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Root Cause</label>
            <textarea rows={2} value={form.rootCause} onChange={e => setForm({...form, rootCause: e.target.value})}
              disabled={!canManage}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900 resize-none disabled:bg-slate-50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Corrective Action</label>
            <textarea rows={2} value={form.correctiveAction} onChange={e => setForm({...form, correctiveAction: e.target.value})}
              disabled={!canManage}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900 resize-none disabled:bg-slate-50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Preventive Action <span className="text-slate-400 font-normal text-xs">(to prevent similar incidents)</span></label>
            <textarea rows={2} value={form.preventiveAction} onChange={e => setForm({...form, preventiveAction: e.target.value})}
              disabled={!canManage}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900 resize-none disabled:bg-slate-50" />
          </div>

          {/* NCR Escalation */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <span className="text-sm font-bold text-slate-700">Escalate to NCR</span>
              </div>
              {complaint.ncReferenceId ? (
                <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                  NCR: {complaint.ncReferenceNo}
                </span>
              ) : canManage && (
                <button onClick={() => setShowEscalateForm(!showEscalateForm)}
                  className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors">
                  {showEscalateForm ? "Cancel" : "Create NCR"}
                </button>
              )}
            </div>
            {!complaint.ncReferenceId && showEscalateForm && (
              <div className="p-4 space-y-3 bg-red-50/30">
                <p className="text-xs text-slate-600">Create a new NCR from this complaint. The NCR will be automatically linked to this complaint.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Severity NCR</label>
                    <select value={escalateSeverity} onChange={e => setEscalateSeverity(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white text-slate-900">
                      <option value="Minor">Minor</option>
                      <option value="Major">Major</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Due Date NCR</label>
                    <input type="date" value={escalateDueDate} onChange={e => setEscalateDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white text-slate-900" />
                  </div>
                </div>
                <button onClick={handleEscalate} disabled={escalating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  <ShieldAlert className="w-4 h-4" />
                  {escalating ? "Creating NCR..." : "Create & Link NCR"}
                </button>
              </div>
            )}
            {complaint.ncReferenceId && (
              <div className="px-4 py-3 text-xs text-slate-600">
                This complaint has been escalated to NCR. Monitor progress in the NC Management module.
              </div>
            )}
          </div>

          {/* Customer Satisfaction */}
          <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Star className="w-4 h-4 text-cyan-500" /> Customer Satisfaction</p>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" checked={form.customerSatisfied} onChange={() => setForm({...form, customerSatisfied: true})} disabled={!canManage} className="w-4 h-4 accent-emerald-600" />
                <span className="text-emerald-700 font-medium">Satisfied</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" checked={!form.customerSatisfied} onChange={() => setForm({...form, customerSatisfied: false})} disabled={!canManage} className="w-4 h-4 accent-red-600" />
                <span className="text-red-700 font-medium">Not Satisfied</span>
              </label>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Satisfaction Score (1-5): <span className="text-cyan-700 font-bold">{form.satisfactionScore}</span> {["","⭐","⭐⭐","⭐⭐⭐","⭐⭐⭐⭐","⭐⭐⭐⭐⭐"][form.satisfactionScore]}</label>
              <input type="range" min={1} max={5} value={form.satisfactionScore} onChange={e => setForm({...form, satisfactionScore: +e.target.value})} disabled={!canManage} className="w-full accent-cyan-500" />
              <div className="flex justify-between text-xs text-slate-400 mt-1"><span>Very Poor</span><span>Very Good</span></div>
            </div>
            <textarea rows={2} value={form.feedbackNotes} onChange={e => setForm({...form, feedbackNotes: e.target.value})}
              disabled={!canManage} placeholder="Customer feedback notes..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900 resize-none disabled:bg-slate-50" />
          </div>

          {/* History */}
          {complaint.history && complaint.history.length > 0 && (
            <div>
              <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-slate-500" /> Activity Log</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {[...complaint.history].reverse().map((h, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-700">{h.action}</span>
                      <span className="text-slate-400 ml-2">by {h.userName} · {new Date(h.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SurveyTab({ surveys, canManage }: { surveys: SatisfactionSurvey[]; canManage: boolean }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPeriod, setNewPeriod] = useState("");
  const [saving, setSaving] = useState(false);
  const [responseForm, setResponseForm] = useState<{ surveyId: string; score: number; name: string; comments: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!newTitle || !newPeriod) return;
    setSaving(true);
    await createSurvey({ title: newTitle, period: newPeriod });
    setNewTitle(""); setNewPeriod(""); setShowCreate(false); setSaving(false);
  }

  async function handleResponse() {
    if (!responseForm) return;
    setSubmitting(true);
    await addSurveyResponse(responseForm.surveyId, { score: responseForm.score, respondentName: responseForm.name || undefined, comments: responseForm.comments || undefined });
    setResponseForm(null); setSubmitting(false);
  }

  const overallAvg = surveys.filter(s => s.avgScore).length > 0
    ? (surveys.filter(s => s.avgScore).reduce((a, s) => a + (s.avgScore || 0), 0) / surveys.filter(s => s.avgScore).length).toFixed(1)
    : null;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{surveys.length}</p>
          <p className="text-xs text-slate-500 font-semibold uppercase mt-1">Total Surveys</p>
        </div>
        <div className="bg-white border border-emerald-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{surveys.reduce((s, sv) => s + sv.responses.length, 0)}</p>
          <p className="text-xs text-slate-500 font-semibold uppercase mt-1">Total Responses</p>
        </div>
        <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-cyan-700">{overallAvg ? `${overallAvg}/5` : "N/A"}</p>
          <p className="text-xs text-slate-500 font-semibold uppercase mt-1">Avg CSAT Score</p>
        </div>
      </div>

      {/* Create survey */}
      {canManage && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          {!showCreate ? (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 text-sm font-medium text-cyan-600 hover:text-cyan-800 transition-colors">
              <Plus className="w-4 h-4" /> Create New Survey
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-700">New Satisfaction Survey</p>
              <div className="grid grid-cols-2 gap-3">
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Survey title (e.g., CSAT Q1 2025)"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900" />
                <input value={newPeriod} onChange={e => setNewPeriod(e.target.value)} placeholder="Periode (e.g., Q1 2025)"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={handleCreate} disabled={saving || !newTitle || !newPeriod}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? "Creating..." : "Create Survey"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Survey list */}
      {surveys.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-medium">No customer satisfaction surveys yet</p>
        </div>
      ) : surveys.map(sv => (
        <div key={sv.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{sv.surveyNo}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${sv.status === "Open" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>{sv.status}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{sv.title} · Period: {sv.period}</p>
            </div>
            <div className="flex items-center gap-3">
              {sv.avgScore && (
                <div className="text-center">
                  <p className="text-lg font-bold text-cyan-700">{sv.avgScore}/5</p>
                  <p className="text-xs text-slate-500">{sv.responses.length} resp.</p>
                </div>
              )}
              {sv.status === "Open" && (
                <>
                  <button onClick={() => setResponseForm({ surveyId: sv.id, score: 4, name: "", comments: "" })}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-medium transition-colors">
                    + Add Response
                  </button>
                  {canManage && (
                    <button onClick={() => closeSurvey(sv.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                      Close Survey
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Score distribution */}
          {sv.responses.length > 0 && (
            <div className="p-5">
              <div className="flex gap-1 h-10 items-end mb-2">
                {[1,2,3,4,5].map(score => {
                  const count = sv.responses.filter(r => r.score === score).length;
                  const pct = sv.responses.length > 0 ? (count / sv.responses.length) * 100 : 0;
                  return (
                    <div key={score} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-slate-500">{count}</span>
                      <div className="w-full rounded-t" style={{ height: `${Math.max(pct, 4)}%`, backgroundColor: score >= 4 ? "#10b981" : score === 3 ? "#f59e0b" : "#ef4444" }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(s => <div key={s} className="flex-1 text-center text-xs text-slate-400">{s}⭐</div>)}
              </div>
              {sv.responses.slice(-3).reverse().map((r, i) => r.comments ? (
                <div key={i} className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <span className="font-medium">{r.respondentName || "Anonymous"}</span>: "{r.comments}"
                </div>
              ) : null)}
            </div>
          )}
        </div>
      ))}

      {/* Response modal */}
      {responseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Submit Survey Response</h3>
              <button onClick={() => setResponseForm(null)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-2">Satisfaction Score</label>
              <div className="flex gap-2 justify-center">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setResponseForm({ ...responseForm, score: s })}
                    className={`w-12 h-12 rounded-xl text-lg font-bold transition-all ${responseForm.score === s ? "bg-cyan-600 text-white shadow-md scale-110" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    {["😞","😐","🙂","😊","🤩"][s-1]}
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-slate-500 mt-1">{["Very Unsatisfied","Unsatisfied","Neutral","Satisfied","Very Satisfied"][responseForm.score-1]}</p>
            </div>
            <input value={responseForm.name} onChange={e => setResponseForm({ ...responseForm, name: e.target.value })}
              placeholder="Respondent name (optional)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900" />
            <textarea rows={3} value={responseForm.comments} onChange={e => setResponseForm({ ...responseForm, comments: e.target.value })}
              placeholder="Comments / suggestions (optional)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none bg-white text-slate-900 resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setResponseForm(null)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
              <button onClick={handleResponse} disabled={submitting}
                className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit Response"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComplaintView({ complaints, surveys = [], user, rolesConfig }: { complaints: ComplaintItem[]; surveys?: SatisfactionSurvey[]; user: any; rolesConfig: any[] }) {
  const [activeTab, setActiveTab] = useState<"complaints" | "survey">("complaints");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSeverity, setFilterSeverity] = useState("All");
  const [filterCat, setFilterCat] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selected, setSelected] = useState<ComplaintItem | null>(null);

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("complaint") || user?.department === "Quality Assurance";

  const filtered = useMemo(() => complaints.filter(c => {
    const matchSearch = c.complaintNo.toLowerCase().includes(search.toLowerCase()) ||
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || c.status === filterStatus;
    const matchSev = filterSeverity === "All" || c.severity === filterSeverity;
    const matchCat = filterCat === "All" || c.category === filterCat;
    return matchSearch && matchStatus && matchSev && matchCat;
  }), [complaints, search, filterStatus, filterSeverity, filterCat]);

  const openCount = useMemo(() => complaints.filter(c => c.status === "Open" || c.status === "Under Investigation").length, [complaints]);
  const closedCount = useMemo(() => complaints.filter(c => c.status === "Closed").length, [complaints]);
  const avgScore = useMemo(() => {
    const scored = complaints.filter(c => c.satisfactionScore);
    if (scored.length === 0) return "N/A";
    return (scored.reduce((s, c) => s + (c.satisfactionScore || 0), 0) / scored.length).toFixed(1);
  }, [complaints]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customer Complaint</h1>
          <p className="text-slate-500 text-sm">Customer complaints & satisfaction — ISO 9001:2015 Clause 9.1.2 & 10.2</p>
        </div>
        <button onClick={() => setIsAddOpen(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Register Complaint
        </button>
      </div>

      {/* Tabs */}
      <TabNav>
        <Tab active={activeTab === "complaints"} onClick={() => setActiveTab("complaints")}>
          <PhoneCall className="w-4 h-4" /> Complaints
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === "complaints" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-600"}`}>{complaints.length}</span>
        </Tab>
        <Tab active={activeTab === "survey"} onClick={() => setActiveTab("survey")}>
          <Star className="w-4 h-4" /> CSAT Survey
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === "survey" ? "bg-cyan-100 text-cyan-700" : "bg-slate-200 text-slate-600"}`}>{surveys.length}</span>
        </Tab>
      </TabNav>

      {activeTab === "survey" && <SurveyTab surveys={surveys} canManage={canManage} />}

      {activeTab === "complaints" && <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-red-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600"><AlertTriangle className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Open</p><p className="text-xl font-bold text-slate-800">{openCount}</p></div>
        </div>
        <div className="bg-white border border-emerald-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600"><CheckCircle className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Resolved</p><p className="text-xl font-bold text-slate-800">{closedCount}</p></div>
        </div>
        <div className="bg-white border border-cyan-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center text-cyan-600"><Star className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Avg Satisfaction</p><p className="text-xl font-bold text-slate-800">{avgScore}{avgScore !== "N/A" && "/5"}</p></div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search no, customer, description..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-cyan-500 outline-none text-slate-900 bg-white text-sm" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? "bg-cyan-50 border-cyan-200 text-cyan-700" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"}`}>
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
        {showFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Status", val: filterStatus, set: setFilterStatus, opts: ["All","Open","Under Investigation","Action Taken","Closed","Rejected"] },
              { label: "Severity", val: filterSeverity, set: setFilterSeverity, opts: ["All","Low","Medium","High","Critical"] },
              { label: "Category", val: filterCat, set: setFilterCat, opts: ["All",...CATEGORIES] },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">{f.label}</label>
                <select value={f.val} onChange={e => f.set(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900">
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
                <th className="px-6 py-4 font-semibold">No</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Complaint</th>
                <th className="px-6 py-4 font-semibold">Severity</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">SLA</th>
                <th className="px-6 py-4 font-semibold text-center">Satisfaction</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map(c => (
                <tr key={c.id} onClick={() => setSelected(c)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-6 py-4 font-bold text-cyan-600">{c.complaintNo}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800">{c.customerName}</p>
                    <p className="text-xs text-slate-400">{c.source}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{c.category}</td>
                  <td className="px-6 py-4 max-w-xs">
                    <p className="truncate text-slate-700" title={c.description}>{c.description}</p>
                    <p className="text-xs text-slate-400">{c.complaintDate}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${SEVERITY_STYLE[c.severity]}`}>{c.severity}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const sla = getSLAStatus(c);
                      return sla ? (
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${sla.color}`}>{sla.label}</span>
                      ) : <span className="text-slate-300 text-xs">-</span>;
                    })()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {c.satisfactionScore ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-bold text-slate-800">{c.satisfactionScore}/5</span>
                        <span className="text-xs">{["","⭐","⭐⭐","⭐⭐⭐","⭐⭐⭐⭐","⭐⭐⭐⭐⭐"][c.satisfactionScore]}</span>
                      </div>
                    ) : <span className="text-slate-300 text-xs">N/A</span>}
                  </td>
                  <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setSelected(c)} className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-md transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      {canManage && (
                        <button onClick={() => { if (confirm("Delete this complaint?")) deleteComplaint(c.id); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <EmptyTableRow colSpan={8} icon={<MessageSquare className="w-12 h-12 text-slate-300" />} title="No customer complaints yet" subtitle='Click "Register Complaint" to log customer complaints.' />
              )}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={complaints.length} label="complaints" />
      </div>

      </>}

      {isAddOpen && <AddComplaintModal onClose={() => setIsAddOpen(false)} />}
      {selected && (
        <ComplaintDetailPanel
          complaint={complaints.find(c => c.id === selected.id) ?? selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
