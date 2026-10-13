"use client";

import { useState } from "react";
import { ArrowLeft, Plus, AlertTriangle, CheckCircle, Clock, Calendar, ShieldAlert, FileText, Upload, Download, Loader2, Lightbulb, ListChecks, X } from "lucide-react";
import Link from "next/link";
import type { AuditItem, ChecklistItem } from "../actions";
import { uploadAuditReport, updateActualDate, updateAuditChecklist, editAudit, exportAuditExcel } from "../actions";
import type { NCRItem } from "@/app/modules/nc/actions";
import AddFindingModal from "./AddFindingModal";
import AddAuditModal from "../AddAuditModal";

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    Planned: "bg-slate-100 text-slate-700",
    "In Progress": "bg-blue-100 text-blue-700",
    Completed: "bg-emerald-100 text-emerald-700",
    Closed: "bg-purple-100 text-purple-700",
  };
  return `px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status]}`;
};

const PREDEFINED_CHECKLIST: Omit<ChecklistItem, "id">[] = [
  { clause: "4.1", question: "Has the organization identified external & internal issues relevant to the QMS objectives?", result: null },
  { clause: "5.1", question: "Has Top Management demonstrated commitment to the QMS?", result: null },
  { clause: "6.1", question: "Have risks and opportunities been identified and addressed?", result: null },
  { clause: "7.1.5", question: "Have measuring instruments in use been calibrated?", result: null },
  { clause: "8.5.1", question: "Is the production process controlled in accordance with documentation?", result: null },
];

export default function AuditDetailClient({ audit, ncrs, user, rolesConfig = [], allUsers = [] }: {
  audit: AuditItem; ncrs: NCRItem[]; user: any; rolesConfig?: any[]; allUsers?: any[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingReport, setIsEditingReport] = useState(false);
  const [isSavingDate, setIsSavingDate] = useState(false);
  const [actualDateInput, setActualDateInput] = useState(audit.actualDate || "");
  const [isEditingActualDate, setIsEditingActualDate] = useState(false);
  const [isEditingAudit, setIsEditingAudit] = useState(false);
  const [editScope, setEditScope] = useState(audit.scope || "");
  const [editCriteria, setEditCriteria] = useState(audit.criteria || "");
  const [editPlannedDate, setEditPlannedDate] = useState(audit.plannedDate || "");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    const base64 = await exportAuditExcel(audit.id);
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${audit.auditNo}-report.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  }

  const roleData = rolesConfig?.find((r: any) => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("audit_manage");

  async function handleSaveEdit() {
    setIsSavingEdit(true);
    const fd = new FormData();
    fd.append("scope", editScope);
    fd.append("criteria", editCriteria);
    fd.append("plannedDate", editPlannedDate);
    await editAudit(audit.id, fd);
    setIsSavingEdit(false);
    setIsEditingAudit(false);
  }

  const ncFindings = ncrs.filter(n => n.findingType !== "OFI");
  const ofiFindings = ncrs.filter(n => n.findingType === "OFI");

  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    audit.checklist && audit.checklist.length > 0
      ? audit.checklist
      : PREDEFINED_CHECKLIST.map((c, i) => ({ ...c, id: Date.now().toString() + i }))
  );
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  async function handleSaveChecklist() {
    setIsSavingChecklist(true);
    await updateAuditChecklist(audit.id, checklist);
    setIsSavingChecklist(false);
  }

  function updateChecklistItem(id: string, updates: Partial<ChecklistItem>) {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  function addChecklistItem() {
    setChecklist(prev => [...prev, { id: Date.now().toString(), clause: "", question: "", result: null, notes: "" }]);
  }

  function removeChecklistItem(id: string) {
    setChecklist(prev => prev.filter(c => c.id !== id));
  }

  async function handleUploadReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const res = await uploadAuditReport(audit.id, formData);
    setIsUploading(false);
    if (!res.success) alert(res.message);
    else setIsEditingReport(false);
  }

  async function handleSaveActualDate() {
    if (!actualDateInput) return;
    setIsSavingDate(true);
    await updateActualDate(audit.id, actualDateInput);
    setIsSavingDate(false);
    setIsEditingActualDate(false);
  }

  const canLogFinding = audit.status === "In Progress";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/modules/audit" className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">Audit {audit.auditNo}</h1>
            <span className={getStatusBadge(audit.status)}>{audit.status}</span>
          </div>
          <p className="text-slate-500 text-sm">Internal Audit Details</p>
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button onClick={handleExport} disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Excel
          </button>
          {canManage && audit.status !== "Closed" && (
            <button onClick={() => setIsEditingAudit(!isEditingAudit)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              ✏️ Edit
            </button>
          )}
          {audit.status === "Closed" && canManage && (
            <button onClick={() => setIsFollowUpOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors">
              🔄 Follow-up Audit
            </button>
          )}
        </div>
      </div>

      {/* Edit Audit Form */}
      {isEditingAudit && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm">Edit Audit Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Planned Date</label>
              <input type="date" value={editPlannedDate} onChange={e => setEditPlannedDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Audit Criteria</label>
              <input type="text" value={editCriteria} onChange={e => setEditCriteria(e.target.value)}
                placeholder="e.g., ISO 9001:2015 Clause 7.5, 8.4" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Scope / Objective</label>
            <textarea value={editScope} onChange={e => setEditScope(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900 resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setIsEditingAudit(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleSaveEdit} disabled={isSavingEdit} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {isSavingEdit ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Audit Info */}
        <div className="col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Audit Information</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Audit Type</p>
                <p className="font-medium text-slate-800">{audit.auditType || "Internal Audit"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Department</p>
                <p className="font-medium text-slate-800">{audit.department}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Planned Date</p>
                <p className="font-medium text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" /> {audit.plannedDate}
                </p>
              </div>
              {/* Actual Date */}
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Actual Date</p>
                {audit.actualDate && !isEditingActualDate ? (
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-emerald-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> {audit.actualDate}
                    </p>
                    {audit.status !== "Closed" && (
                      <button onClick={() => setIsEditingActualDate(true)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                    )}
                  </div>
                ) : audit.status !== "Planned" && audit.status !== "Closed" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={actualDateInput}
                      onChange={e => setActualDateInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      onClick={handleSaveActualDate}
                      disabled={isSavingDate || !actualDateInput}
                      className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
                    >
                      {isSavingDate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                    </button>
                    {isEditingActualDate && (
                      <button onClick={() => setIsEditingActualDate(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Not set</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Lead Auditor</p>
                <p className="font-medium text-slate-800">{audit.leadAuditor}</p>
              </div>
              {audit.auditeeName && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Auditee (PIC Dept.)</p>
                  <p className="font-medium text-slate-800">{audit.auditeeName}</p>
                </div>
              )}
              {audit.coAuditors && audit.coAuditors.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Co-Auditors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {audit.coAuditors.map(name => (
                      <span key={name} className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full font-medium">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Scope</p>
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">{audit.scope}</p>
              </div>
              {audit.criteria && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Criteria</p>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">{audit.criteria}</p>
                </div>
              )}
            </div>
          </div>

          {/* Audit Report Section */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Audit Report & Summary
              </h3>
              {(audit.summary || audit.reportFileName) && audit.status !== "Closed" && !isEditingReport && (
                <button onClick={() => setIsEditingReport(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                  Edit Report
                </button>
              )}
            </div>

            {((audit.summary || audit.reportFileName) && !isEditingReport) ? (
              <div className="space-y-4">
                {audit.summary && (
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Executive Summary</p>
                    <div className="text-sm text-blue-900 bg-blue-50/50 p-4 rounded-lg border border-blue-100 whitespace-pre-wrap leading-relaxed max-h-100 overflow-y-auto">
                      {audit.summary}
                    </div>
                  </div>
                )}
                {audit.reportFileName && (
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Attached Report</p>
                    <a
                      href={audit.reportFileName}
                      target="_blank"
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-red-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-800 text-sm truncate">{audit.reportFileName}</p>
                        <p className="text-xs text-slate-500">Click to view/download</p>
                      </div>
                      <Download className="w-5 h-5 text-slate-400" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {audit.status === "Planned" ? (
                  <p className="text-sm text-slate-500 italic text-center py-4">Audit must be In Progress to upload a report.</p>
                ) : (
                  <form onSubmit={handleUploadReport} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Executive Summary</label>
                      <textarea required name="summary" defaultValue={audit.summary || ""} rows={8} placeholder="Write a comprehensive conclusion of this audit..." className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white resize-y text-sm"></textarea>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Upload Report Document {audit.reportFileName && "(Optional to replace existing)"}</label>
                      <input required={!audit.reportFileName} type="file" name="file" accept=".pdf,.doc,.docx" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                    </div>
                    <div className="flex gap-2">
                      {isEditingReport && (
                        <button type="button" onClick={() => setIsEditingReport(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
                          Cancel
                        </button>
                      )}
                      <button type="submit" disabled={isUploading} className="flex-1 flex justify-center items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:bg-slate-400">
                        {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Upload className="w-4 h-4" /> Save Report & Summary</>}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Findings */}
        <div className="col-span-1 md:col-span-2 space-y-6">

          {/* Audit Checklist */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-indigo-500" />
                Audit Checklist
              </h3>
              {audit.status !== "Closed" && (
                <button
                  onClick={handleSaveChecklist}
                  disabled={isSavingChecklist}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {isSavingChecklist ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Checklist"}
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold rounded-tl-lg w-24">Clause</th>
                      <th className="px-4 py-3 font-semibold w-2/5">Audit Question</th>
                      <th className="px-4 py-3 font-semibold w-40">Result</th>
                      <th className="px-4 py-3 font-semibold min-w-[250px]">Auditor Notes</th>
                      <th className="px-4 py-3 font-semibold rounded-tr-lg w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {checklist.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 align-top">
                          <input 
                            type="text" 
                            value={item.clause} 
                            onChange={e => updateChecklistItem(item.id, { clause: e.target.value })}
                            disabled={audit.status === "Closed"}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-xs"
                            placeholder="Clause"
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <textarea
                            value={item.question}
                            onChange={e => updateChecklistItem(item.id, { question: e.target.value })}
                            disabled={audit.status === "Closed"}
                            rows={2}
                            placeholder="Audit question..."
                            className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white resize-none text-xs"
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <select
                            value={item.result || ""}
                            onChange={e => updateChecklistItem(item.id, { result: e.target.value as any })}
                            disabled={audit.status === "Closed"}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-xs"
                          >
                            <option value="">- Select -</option>
                            <option value="Conform">Conform</option>
                            <option value="Non-Conform">Non-Conform</option>
                            <option value="OFI">OFI</option>
                            <option value="N/A">N/A</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <textarea
                            value={item.notes || ""}
                            onChange={e => updateChecklistItem(item.id, { notes: e.target.value })}
                            disabled={audit.status === "Closed"}
                            placeholder="Observations/evidence..."
                            rows={2}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white resize-none text-xs"
                          />
                        </td>
                        <td className="px-4 py-3 align-top text-center">
                          {audit.status !== "Closed" && (
                            <button onClick={() => removeChecklistItem(item.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Remove question">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {audit.status !== "Closed" && (
                <button onClick={addChecklistItem} className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add Question
                </button>
              )}
            </div>
          </div>

          {/* NC Findings */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                NC Findings
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{ncFindings.length}</span>
              </h3>
              {canLogFinding && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Log Finding
                </button>
              )}
            </div>

            <div className="space-y-4">
              {ncFindings.length > 0 ? ncFindings.map(ncr => (
                <div key={ncr.id} className="border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${ncr.severity === 'Critical' ? 'bg-red-100 text-red-600' : ncr.severity === 'Major' ? 'bg-orange-100 text-orange-600' : 'bg-amber-100 text-amber-600'}`}>
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <Link href="/modules/nc" className="font-bold text-blue-600 hover:underline">{ncr.ncNumber}</Link>
                        <p className="text-xs text-slate-500 font-medium">{ncr.severity} Non-Conformance</p>
                        {ncr.isoClause && (
                          <span className="inline-block mt-0.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                            Clause {ncr.isoClause}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-semibold">{ncr.status}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-3">{ncr.description}</p>
                </div>
              )) : (
                <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="font-medium text-slate-700">No NC Findings</p>
                  <p className="text-sm text-slate-500 mt-1">This audit has no non-conformances.</p>
                </div>
              )}
            </div>
          </div>

          {/* OFI Findings */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-blue-500" />
                Opportunities for Improvement (OFI)
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{ofiFindings.length}</span>
              </h3>
              {canLogFinding && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Log OFI
                </button>
              )}
            </div>

            <div className="space-y-4">
              {ofiFindings.length > 0 ? ofiFindings.map(ofi => (
                <div key={ofi.id} className="border border-blue-100 rounded-xl p-4 bg-blue-50/30 hover:bg-blue-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                        <Lightbulb className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-blue-700">{ofi.ncNumber}</p>
                        <p className="text-xs text-slate-500 font-medium">Opportunity for Improvement</p>
                        {ofi.isoClause && (
                          <span className="inline-block mt-0.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                            Clause {ofi.isoClause}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">{ofi.status}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-3">{ofi.description}</p>
                </div>
              )) : (
                <div className="text-center py-8 px-4 border-2 border-dashed border-blue-100 rounded-xl bg-blue-50/30">
                  <Lightbulb className="w-10 h-10 text-blue-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-600">No OFI Recorded</p>
                  <p className="text-sm text-slate-500 mt-1">Log improvement opportunities during the audit.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <AddFindingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} audit={audit} />

      {/* Follow-up Audit Modal */}
      <AddAuditModal
        isOpen={isFollowUpOpen}
        onClose={() => setIsFollowUpOpen(false)}
        users={allUsers}
      />
    </div>
  );
}
