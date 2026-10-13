"use client";

import { useState } from "react";
import { Plus, ClipboardList, CheckCircle, Calendar, Users, ChevronRight, Trash2, X, Save, Edit, AlertTriangle, Zap, Loader2, Upload, Download, FileText } from "lucide-react";
import type { ManagementReview, MRActionItem } from "./actions";
import { addManagementReview, updateManagementReview, addActionItem, updateActionItem, deleteManagementReview, getAutoFillData, uploadMRMinutes, approveManagementReview } from "./actions";
import EmptyTableRow from "@/components/ui/EmptyTableRow";

const STATUS_STYLE: Record<string, string> = {
  Planned: "bg-slate-100 text-slate-700 border-slate-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Approved: "bg-purple-100 text-purple-700 border-purple-200",
};

const ACTION_STATUS_STYLE: Record<string, string> = {
  Open: "bg-red-100 text-red-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Completed: "bg-emerald-100 text-emerald-700",
};

const INPUT_FIELDS = [
  { key: "previousActionStatus", label: "Status of Previous Action Items", hint: "Have all action items from the previous management review been closed?" },
  { key: "internalExternalChanges", label: "Relevant Internal & External Changes", hint: "Changes in regulations, market, technology, organizational structure..." },
  { key: "qualityObjectivesPerformance", label: "Quality Objectives & KPI Performance", hint: "Were quality objectives achieved? Performance data and trends..." },
  { key: "processPerformance", label: "Process Performance & Product/Service Conformity", hint: "Quality trends, process efficiency, NCR rate, defect rate..." },
  { key: "ncAndCorrectiveActions", label: "Nonconformities & Corrective Actions", hint: "Summary of open/closed CAPAs, NC trends, effectiveness of actions..." },
  { key: "auditResults", label: "Internal & External Audit Results", hint: "Audit findings, trends, areas requiring attention..." },
  { key: "customerFeedback", label: "Customer Feedback & Complaints", hint: "Customer satisfaction scores, number of complaints, positive/negative feedback..." },
  { key: "supplierPerformance", label: "External Provider (Supplier) Performance", hint: "Supplier evaluations, NCs from suppliers, on-time delivery rate..." },
  { key: "riskOpportunities", label: "Risks & Opportunities", hint: "Risk register updates, newly identified improvement opportunities..." },
];

function AddReviewModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ title: "", reviewDate: "", chairperson: "", attendees: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await addManagementReview(form);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-purple-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-purple-600" /> Schedule Management Review</h2>
          <button onClick={onClose} className="p-2 hover:bg-purple-100 rounded-full text-purple-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Review Title *</label>
            <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              placeholder="e.g., Management Review Q2 2025"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Review Date *</label>
              <input required type="date" value={form.reviewDate} onChange={e => setForm({...form, reviewDate: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Chairperson *</label>
              <input required value={form.chairperson} onChange={e => setForm({...form, chairperson: e.target.value})}
                placeholder="e.g., CEO / Managing Director"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Attendees</label>
            <textarea rows={2} value={form.attendees} onChange={e => setForm({...form, attendees: e.target.value})}
              placeholder="Names of attendees, comma separated..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Schedule Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReviewDetailPanel({ review, onClose, canManage }: { review: ManagementReview; onClose: () => void; canManage: boolean }) {
  const [inputs, setInputs] = useState<Partial<ManagementReview>>({
    previousActionStatus: review.previousActionStatus || "",
    internalExternalChanges: review.internalExternalChanges || "",
    qualityObjectivesPerformance: review.qualityObjectivesPerformance || "",
    processPerformance: review.processPerformance || "",
    ncAndCorrectiveActions: review.ncAndCorrectiveActions || "",
    auditResults: review.auditResults || "",
    customerFeedback: review.customerFeedback || "",
    supplierPerformance: review.supplierPerformance || "",
    riskOpportunities: review.riskOpportunities || "",
    outputImprovements: review.outputImprovements || "",
    outputQmsChanges: review.outputQmsChanges || "",
    outputResources: review.outputResources || "",
    conclusion: review.conclusion || "",
    status: review.status,
  });
  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [uploadingMinutes, setUploadingMinutes] = useState(false);
  const [approving, setApproving] = useState(false);

  async function handleApprove() {
    if (!confirm(`Approve Management Review ${review.reviewNo}? This action cannot be undone.`)) return;
    setApproving(true);
    const res = await approveManagementReview(review.id);
    setApproving(false);
    if (res.success) onClose();
    else alert(res.message);
  }

  async function handleUploadMinutes(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMinutes(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadMRMinutes(review.id, fd);
    setUploadingMinutes(false);
    if (!res.success) alert(res.message);
  }
  const [newAction, setNewAction] = useState({ description: "", picName: "", targetDate: "" });
  const [addingAction, setAddingAction] = useState(false);

  async function handleAutoFill() {
    if (!confirm("Auto-fill will populate input fields with current system data. Existing entries will be overwritten. Continue?")) return;
    setAutoFilling(true);
    const data = await getAutoFillData();
    setInputs(prev => ({ ...prev, ...data }));
    setAutoFilling(false);
  }

  async function handleSave() {
    setSaving(true);
    await updateManagementReview(review.id, inputs);
    setSaving(false);
  }

  async function handleAddAction() {
    if (!newAction.description || !newAction.picName || !newAction.targetDate) return;
    setAddingAction(true);
    await addActionItem(review.id, newAction);
    setNewAction({ description: "", picName: "", targetDate: "" });
    setAddingAction(false);
  }

  async function handleActionStatus(itemId: string, status: MRActionItem["status"]) {
    await updateActionItem(review.id, itemId, { status });
  }

  const openActions = review.actionItems.filter(a => a.status !== "Completed").length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-auto my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 sticky top-0 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-slate-800 text-lg">{review.reviewNo}</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[review.status]}`}>{review.status}</span>
            </div>
            <p className="text-sm text-slate-500">{review.title} · {review.reviewDate}</p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
                </button>
                {review.status === "Completed" && (
                  <button onClick={handleApprove} disabled={approving}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    <CheckCircle className="w-4 h-4" /> {approving ? "Approving..." : "Approve MR"}
                  </button>
                )}
              </>
            )}
            {review.status === "Approved" && review.approvedBy && (
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold">
                ✓ Approved by {review.approvedBy} · {review.approvedDate}
              </span>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl text-sm">
            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Chairperson</p><p className="font-medium text-slate-800">{review.chairperson}</p></div>
            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Date</p><p className="font-medium text-slate-800">{review.reviewDate}</p></div>
            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Status</p>
              {canManage ? (
                <select value={inputs.status} onChange={e => setInputs({...inputs, status: e.target.value as ManagementReview["status"]})}
                  className="px-2 py-1 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900">
                  {["Planned","In Progress","Completed","Approved"].map(s => <option key={s}>{s}</option>)}
                </select>
              ) : <p className="font-medium text-slate-800">{review.status}</p>}
            </div>
            {review.attendees && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Attendees</p>
                <p className="text-slate-700 text-sm">{review.attendees}</p>
              </div>
            )}
          </div>

          {/* Inputs (Cl. 9.3.2) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">INPUT</span>
                Review Inputs (Clause 9.3.2)
              </h3>
              {canManage && (
                <button onClick={handleAutoFill} disabled={autoFilling}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-100 transition-colors disabled:opacity-50">
                  {autoFilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {autoFilling ? "Fetching data..." : "Auto-fill from System"}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {INPUT_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">{f.label}</label>
                  <textarea
                    rows={2}
                    value={(inputs as any)[f.key] || ""}
                    onChange={e => setInputs({...inputs, [f.key]: e.target.value})}
                    disabled={!canManage}
                    placeholder={f.hint}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900 resize-none disabled:bg-slate-50 disabled:text-slate-600"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Outputs (Cl. 9.3.3) */}
          <div>
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">OUTPUT</span>
              Review Outputs (Clause 9.3.3)
            </h3>
            <div className="space-y-3">
              {[
                { key: "outputImprovements", label: "Opportunities for Improvement" },
                { key: "outputQmsChanges", label: "Needs for Changes to the QMS" },
                { key: "outputResources", label: "Resource Needs" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">{f.label}</label>
                  <textarea rows={2} value={(inputs as any)[f.key] || ""} onChange={e => setInputs({...inputs, [f.key]: e.target.value})}
                    disabled={!canManage}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900 resize-none disabled:bg-slate-50 disabled:text-slate-600" />
                </div>
              ))}
            </div>
          </div>

          {/* Action Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                Action Items
                {openActions > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">{openActions} open</span>}
              </h3>
            </div>

            {review.actionItems.length > 0 && (
              <div className="space-y-2 mb-4">
                {review.actionItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{item.description}</p>
                      <p className="text-xs text-slate-500">PIC: {item.picName} · Due: {item.targetDate}</p>
                    </div>
                    {canManage ? (
                      <select value={item.status} onChange={e => handleActionStatus(item.id, e.target.value as MRActionItem["status"])}
                        className="px-2 py-1 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900 shrink-0">
                        {["Open","In Progress","Completed"].map(s => <option key={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ACTION_STATUS_STYLE[item.status]}`}>{item.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canManage && (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-600">Add Action Item</p>
                <input value={newAction.description} onChange={e => setNewAction({...newAction, description: e.target.value})}
                  placeholder="Action description..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={newAction.picName} onChange={e => setNewAction({...newAction, picName: e.target.value})}
                    placeholder="PIC"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900" />
                  <input type="date" value={newAction.targetDate} onChange={e => setNewAction({...newAction, targetDate: e.target.value})}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900" />
                </div>
                <button onClick={handleAddAction} disabled={addingAction || !newAction.description}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  <Plus className="w-4 h-4" /> {addingAction ? "Adding..." : "Add Action"}
                </button>
              </div>
            )}
          </div>

          {/* Minutes of Meeting */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-500" /> Minutes of Meeting
              </p>
              {canManage && (
                <label className={`cursor-pointer flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${uploadingMinutes ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"}`}>
                  {uploadingMinutes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadingMinutes ? "Uploading..." : "Upload Minutes"}
                  <input type="file" className="hidden" disabled={uploadingMinutes} accept=".pdf,.doc,.docx" onChange={handleUploadMinutes} />
                </label>
              )}
            </div>
            <div className="px-4 py-3">
              {review.minutesFileName ? (
                <a href={`/uploads/management-reviews/${review.minutesFileName}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center text-purple-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-slate-700 flex-1 truncate">{review.minutesFileName}</span>
                  <Download className="w-4 h-4 text-slate-400" />
                </a>
              ) : (
                <p className="text-xs text-slate-400 italic">No minutes uploaded yet.</p>
              )}
            </div>
          </div>

          {/* Conclusion */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Conclusion</label>
            <textarea rows={3} value={inputs.conclusion || ""} onChange={e => setInputs({...inputs, conclusion: e.target.value})}
              disabled={!canManage}
              placeholder="Overall conclusion of the management review..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900 resize-none disabled:bg-slate-50 disabled:text-slate-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManagementReviewView({ reviews, user, rolesConfig }: { reviews: ManagementReview[]; user: any; rolesConfig: any[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ManagementReview | null>(null);

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("management-review") || user?.department === "Quality Assurance";

  const totalActions = reviews.reduce((s, r) => s + r.actionItems.length, 0);
  const openActions = reviews.reduce((s, r) => s + r.actionItems.filter(a => a.status !== "Completed").length, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Management Review</h1>
          <p className="text-slate-500 text-sm">QMS management review — ISO 9001:2015 Clause 9.3</p>
        </div>
        {canManage && (
          <button onClick={() => setIsAddOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Schedule Review
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-purple-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600"><ClipboardList className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Total Reviews</p><p className="text-xl font-bold text-slate-800">{reviews.length}</p></div>
        </div>
        <div className="bg-white border border-emerald-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600"><CheckCircle className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Completed</p><p className="text-xl font-bold text-slate-800">{reviews.filter(r => r.status === "Completed" || r.status === "Approved").length}</p></div>
        </div>
        <div className="bg-white border border-red-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600"><AlertTriangle className="w-5 h-5" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Open Actions</p><p className="text-xl font-bold text-slate-800">{openActions}</p></div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Review No</th>
                <th className="px-6 py-4 font-semibold">Title</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Chairperson</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Actions</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reviews.length > 0 ? reviews.map(r => {
                const open = r.actionItems.filter(a => a.status !== "Completed").length;
                return (
                  <tr key={r.id} onClick={() => setSelectedReview(r)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-6 py-4 font-bold text-purple-600">{r.reviewNo}</td>
                    <td className="px-6 py-4 font-medium text-slate-800 max-w-xs truncate">{r.title}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-slate-600"><Calendar className="w-3.5 h-3.5" />{r.reviewDate}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-slate-600"><Users className="w-3.5 h-3.5" />{r.chairperson}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-slate-600">{r.actionItems.length} total</span>
                        {open > 0 && <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{open} open</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setSelectedReview(r)} className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <button onClick={() => { if (confirm("Delete this Management Review? This cannot be undone.")) deleteManagementReview(r.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <EmptyTableRow colSpan={7} icon={<ClipboardList className="w-12 h-12 text-slate-300" />} title="No Management Reviews scheduled" subtitle='Click "Schedule Review" to create the first management review.' />
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-sm text-slate-500">
          {reviews.length} review(s) · {totalActions} action items ({openActions} open)
        </div>
      </div>

      {isAddOpen && <AddReviewModal onClose={() => setIsAddOpen(false)} />}
      {selectedReview && (
        <ReviewDetailPanel
          review={reviews.find(r => r.id === selectedReview.id) ?? selectedReview}
          onClose={() => setSelectedReview(null)}
          canManage={canManage}
        />
      )}
    </div>
  );
}
