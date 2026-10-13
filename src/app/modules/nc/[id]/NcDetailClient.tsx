"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle, Activity, Calendar, Upload, Loader2, Download, GraduationCap, Plus, Edit, RefreshCw, Printer } from "lucide-react";
import { updateNCRStatus, updateNCRDetails, uploadNCEvidence, editNCR, reopenNCR, notifyNCRPIC, type NCRItem } from "../actions";
import type { TrainingRecord } from "@/app/modules/training/actions";
import AddTrainingModal from "@/app/modules/training/AddTrainingModal";

const STATUS_STAGES = ["Open", "Root Cause Analysis", "Action Plan", "Verification", "Closed"];

export default function NcDetailClient({
  ncr,
  user,
  rolesConfig,
  allUsers,
  linkedTrainings = [],
}: {
  ncr: NCRItem;
  user: any;
  rolesConfig: any[];
  allUsers: any[];
  linkedTrainings?: TrainingRecord[];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAddTrainingOpen, setIsAddTrainingOpen] = useState(false);
  const [isEditingNCR, setIsEditingNCR] = useState(false);
  const [editDesc, setEditDesc] = useState(ncr.description);
  const [editSeverity, setEditSeverity] = useState(ncr.severity);
  const [editDueDate, setEditDueDate] = useState(ncr.dueDate);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const currentStageIdx = STATUS_STAGES.indexOf(ncr.status);

  // Forms State
  const [containment, setContainment] = useState(ncr.containmentAction || "");
  
  const [rca, setRca] = useState(ncr.rca || { why1: "", why2: "", why3: "", why4: "", why5: "", rootCauseStatement: "" });
  
  const [actionPlan, setActionPlan] = useState(ncr.actionPlan || { description: "", preventiveAction: "", targetDate: "", picId: "" });
  
  const [verification, setVerification] = useState(ncr.verification || { notes: "", isEffective: true });

  const roleData = rolesConfig?.find((r: any) => r.name === user?.role);
  const isQA = user?.role === "Super Admin" || user?.department === "Quality Assurance" || roleData?.permissions.includes("audit_manage");

  async function handleUpdateStatus(newStatus: NCRItem["status"]) {
    // Validations
    if (newStatus === "Action Plan") {
      if (!rca.rootCauseStatement?.trim()) {
        alert("Please provide the Final Root Cause Statement before moving to the Action Plan stage.");
        return;
      }
    } else if (newStatus === "Verification") {
      if (!actionPlan.description?.trim() || !actionPlan.picId || !actionPlan.targetDate) {
        alert("Please provide Action Description, PIC, and Target Date before moving to the Verification stage.");
        return;
      }
    }

    setIsSubmitting(true);
    const res = await updateNCRStatus(ncr.id, newStatus);
    setIsSubmitting(false);
    if (!res.success) alert(res.message);
  }

  async function handleSaveContainment() {
    setIsSubmitting(true);
    await updateNCRDetails(ncr.id, { containmentAction: containment }, "Updated Containment Action");
    setIsSubmitting(false);
  }

  async function handleSaveRCA() {
    setIsSubmitting(true);
    await updateNCRDetails(ncr.id, { rca }, "Updated Root Cause Analysis (5-Why)");
    setIsSubmitting(false);
  }

  async function handleSaveActionPlan() {
    setIsSubmitting(true);
    const picUser = allUsers.find(u => u.id === actionPlan.picId);
    await updateNCRDetails(ncr.id, {
      actionPlan: { ...actionPlan, picName: picUser?.name }
    }, "Updated Corrective Action Plan");
    // Kirim notifikasi ke PIC jika ada
    if (actionPlan.picId && picUser) {
      await notifyNCRPIC(ncr.id, actionPlan.picId, picUser.name, ncr.ncNumber);
    }
    setIsSubmitting(false);
  }

  async function handleSaveEditNCR() {
    setIsSavingEdit(true);
    await editNCR(ncr.id, { description: editDesc, severity: editSeverity, dueDate: editDueDate });
    setIsSavingEdit(false);
    setIsEditingNCR(false);
  }

  async function handleReopen() {
    if (!confirm("Re-open this NCR? Status will revert to Open.")) return;
    setIsSubmitting(true);
    await reopenNCR(ncr.id);
    setIsSubmitting(false);
  }

  async function handleSaveVerification() {
    setIsSubmitting(true);
    await updateNCRDetails(ncr.id, { 
      verification: {
        ...verification,
        verifierId: user.id,
        verifierName: user.name,
        verificationDate: new Date().toISOString().split("T")[0]
      }
    }, "Updated Effectiveness Verification");
    setIsSubmitting(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    const res = await uploadNCEvidence(ncr.id, formData);
    setIsUploading(false);
    if (!res.success) alert(res.message);
  }

  const getSeverityStyle = (sev: string) => {
    if (sev === "Critical") return "bg-red-100 text-red-800 border-red-200";
    if (sev === "Major") return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-amber-100 text-amber-800 border-amber-200";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/modules/nc" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{ncr.ncNumber}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getSeverityStyle(ncr.severity)}`}>
              {ncr.severity}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">{ncr.department} · Source: {ncr.source}</p>
        </div>
        {ncr.status !== "Closed" && (() => {
          const today = new Date(); today.setHours(0,0,0,0);
          const due = new Date(ncr.dueDate);
          const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000*60*60*24));
          if (diffDays < 0) return (
            <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 border border-red-200 px-3 py-1.5 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" /> OVERDUE {Math.abs(diffDays)} hari
            </span>
          );
          if (diffDays <= 7) return (
            <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" /> Due in {diffDays} days
            </span>
          );
          return null;
        })()}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Link href={`/modules/nc/${ncr.id}/print`} target="_blank"
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Printer className="w-4 h-4" /> Print CAPA
          </Link>
          {ncr.status !== "Closed" && isQA && (
            <button onClick={() => setIsEditingNCR(!isEditingNCR)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              <Edit className="w-4 h-4" /> Edit NCR
            </button>
          )}
          {ncr.status === "Closed" && isQA && (
            <button onClick={handleReopen} disabled={isSubmitting}
              className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50">
              <RefreshCw className="w-4 h-4" /> Re-open NCR
            </button>
          )}
        </div>
      </div>

      {/* Edit NCR inline form */}
      {isEditingNCR && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Edit className="w-4 h-4" /> Edit NCR Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Severity</label>
              <select value={editSeverity} onChange={e => setEditSeverity(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white text-slate-900">
                <option value="Minor">Minor</option>
                <option value="Major">Major</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Due Date</label>
              <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white text-slate-900" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Problem Description</label>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white text-slate-900 resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setIsEditingNCR(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleSaveEditNCR} disabled={isSavingEdit} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
              {isSavingEdit ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Progress Workflow Bar */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between min-w-150">
          {STATUS_STAGES.map((stage, idx) => {
            const isActive = idx === currentStageIdx;
            const isCompleted = idx < currentStageIdx;
            return (
              <div key={stage} className="flex flex-col items-center relative flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 border-2 
                  ${isActive ? "bg-red-600 border-red-600 text-white shadow-lg" : 
                    isCompleted ? "bg-red-100 border-red-500 text-red-600" : "bg-slate-50 border-slate-200 text-slate-400"}`}
                >
                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : <span>{idx + 1}</span>}
                </div>
                <span className={`mt-2 text-xs font-bold ${isActive ? "text-red-700" : isCompleted ? "text-slate-700" : "text-slate-400"}`}>
                  {stage}
                </span>
                
                {/* Connecting Line */}
                {idx < STATUS_STAGES.length - 1 && (
                  <div className={`absolute top-5 left-[50%] w-full h-0.5 z-0
                    ${isCompleted ? "bg-red-500" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Action Prompts */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Info */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Non-Conformance Details</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Date Raised</p>
                <p className="font-medium text-slate-800">{ncr.dateRaised}</p>
              </div>
              {ncr.detectedBy && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Detected By</p>
                  <p className="font-medium text-slate-800">{ncr.detectedBy}</p>
                </div>
              )}
              {ncr.productBatch && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Product / Batch</p>
                  <p className="font-medium text-slate-800">{ncr.productBatch}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Target Due Date</p>
                {(() => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const due = new Date(ncr.dueDate);
                  const isOverdue = ncr.status !== "Closed" && due < today;
                  return (
                    <p className={`font-medium flex items-center gap-1.5 ${isOverdue ? "text-red-600" : "text-slate-800"}`}>
                      <Calendar className="w-3.5 h-3.5" />
                      {ncr.dueDate}
                      {isOverdue && <span className="text-[10px] font-bold bg-red-100 px-1.5 py-0.5 rounded-full">OVERDUE</span>}
                    </p>
                  );
                })()}
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">ISO Clause</p>
                <p className="font-medium text-slate-800">{ncr.isoClause || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Audit Reference</p>
                {ncr.auditId ? (
                  <Link href={`/modules/audit/${ncr.auditId}`} className="font-medium text-blue-600 hover:underline">View Audit</Link>
                ) : (
                  <p className="font-medium text-slate-800">-</p>
                )}
              </div>
              {ncr.supplierName && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Supplier Terkait</p>
                  <Link href="/modules/supplier" className="font-medium text-teal-600 hover:underline flex items-center gap-1">
                    {ncr.supplierName}
                  </Link>
                </div>
              )}
              {ncr.linkedRiskNo && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Linked Risk</p>
                  <Link href="/modules/risk" className="font-medium text-orange-600 hover:underline">
                    {ncr.linkedRiskNo}
                  </Link>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Problem Description</p>
              <div className="bg-slate-50 p-4 rounded-lg text-slate-700 text-sm whitespace-pre-wrap border border-slate-100">
                {ncr.description}
              </div>
            </div>

            {/* Stage 1: Containment Action */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-800 font-bold mb-2">Immediate Containment Action (Correction)</p>
              <textarea 
                value={containment} 
                onChange={e => setContainment(e.target.value)}
                disabled={ncr.status === "Closed"}
                placeholder="What immediate action was taken to stop the problem?"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white resize-none"
                rows={2}
              />
              {ncr.status !== "Closed" && (
                <button onClick={handleSaveContainment} disabled={isSubmitting} className="mt-2 px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors">
                  Save Containment
                </button>
              )}
            </div>
          </div>

          {/* Stage 2: Root Cause Analysis (5-Why) */}
          {currentStageIdx >= 1 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-slate-800">Root Cause Analysis (5-Why)</h3>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">STAGE 2</span>
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(num => {
                  const key = `why${num}` as keyof typeof rca;
                  return (
                    <div key={num} className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0">W{num}</div>
                      <input 
                        type="text" 
                        value={rca[key] || ""} 
                        onChange={e => setRca({...rca, [key]: e.target.value})}
                        disabled={ncr.status === "Closed" || currentStageIdx > 2}
                        placeholder={`Why did that happen?`}
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white"
                      />
                    </div>
                  );
                })}
                <div className="pt-3">
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Final Root Cause Statement</label>
                  <textarea 
                    value={rca.rootCauseStatement || ""} 
                    onChange={e => setRca({...rca, rootCauseStatement: e.target.value})}
                    disabled={ncr.status === "Closed" || currentStageIdx > 2}
                    placeholder="Summarize the actual root cause..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white resize-none"
                    rows={3}
                  />
                </div>
                {(currentStageIdx === 1 || currentStageIdx === 2) && (
                  <button onClick={handleSaveRCA} disabled={isSubmitting} className="mt-2 px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors">
                    Save Root Cause
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Stage 3: Corrective Action Plan */}
          {currentStageIdx >= 2 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-slate-800">Corrective Action Plan</h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">STAGE 3</span>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Action Description</label>
                  <textarea 
                    value={actionPlan.description} 
                    onChange={e => setActionPlan({...actionPlan, description: e.target.value})}
                    disabled={currentStageIdx > 3}
                    placeholder="What action will be taken to eliminate the root cause?"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white resize-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Preventive Action <span className="text-slate-400 font-normal text-xs">(Could this happen elsewhere?)</span></label>
                  <textarea 
                    value={actionPlan.preventiveAction || ""} 
                    onChange={e => setActionPlan({...actionPlan, preventiveAction: e.target.value})}
                    disabled={currentStageIdx > 3}
                    placeholder="Evaluate if similar non-conformities exist or could occur in other areas..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white resize-none"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1">PIC (Person in Charge)</label>
                    <select 
                      value={actionPlan.picId} 
                      onChange={e => setActionPlan({...actionPlan, picId: e.target.value})}
                      disabled={currentStageIdx > 3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white"
                    >
                      <option value="">Select Person...</option>
                      {allUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1">Target Completion Date</label>
                    <input
                      type="date"
                      value={actionPlan.targetDate}
                      onChange={e => setActionPlan({...actionPlan, targetDate: e.target.value})}
                      disabled={currentStageIdx > 3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">
                    Actual Completion Date
                    <span className="text-slate-400 font-normal text-xs ml-1">(fill in after action is completed)</span>
                  </label>
                  <input
                    type="date"
                    value={actionPlan.actualCompletionDate || ""}
                    onChange={e => setActionPlan({...actionPlan, actualCompletionDate: e.target.value})}
                    disabled={ncr.status === "Closed"}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white"
                  />
                  {actionPlan.actualCompletionDate && actionPlan.targetDate && actionPlan.actualCompletionDate > actionPlan.targetDate && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Completed past the target date
                    </p>
                  )}
                </div>
                {(currentStageIdx === 2 || currentStageIdx === 3) && (
                  <button onClick={handleSaveActionPlan} disabled={isSubmitting} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                    Save Action Plan
                  </button>
                )}

                <div className="pt-4 border-t border-slate-100 mt-2">
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Evidence of Implementation</label>
                  
                  {ncr.actionPlan?.evidenceFiles && ncr.actionPlan.evidenceFiles.length > 0 && (
                    <div className="flex flex-col gap-2 mb-3">
                      {ncr.actionPlan.evidenceFiles.map(file => (
                        <div key={file} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-sm text-slate-700 truncate mr-2">{file}</span>
                          <a href={file} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-slate-200 rounded text-blue-600">
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentStageIdx <= 3 && ncr.status !== "Closed" && (
                    <div className="flex items-center gap-3">
                      <label className={`cursor-pointer px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${isUploading ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {isUploading ? "Uploading..." : "Upload Evidence"}
                        <input type="file" className="hidden" disabled={isUploading} onChange={handleFileUpload} />
                      </label>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Stage 4: Verification of Effectiveness */}
          {currentStageIdx >= 3 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-slate-800">Verification of Effectiveness</h3>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">STAGE 4</span>
              </div>
              {isQA ? (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50 text-purple-800 text-sm rounded-lg border border-purple-100">
                    QA/Auditor Review: Please verify if the implemented actions effectively eliminated the root cause.
                  </div>
                  
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1">Verification Notes / Evidence</label>
                    <textarea 
                      value={verification.notes} 
                      onChange={e => setVerification({...verification, notes: e.target.value})}
                      disabled={ncr.status === "Closed"}
                      placeholder="Detail the objective evidence reviewed..."
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white resize-none"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1">Is Corrective Action Effective?</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={verification.isEffective} onChange={() => setVerification({...verification, isEffective: true})} disabled={ncr.status === "Closed"} className="w-4 h-4 accent-emerald-600" />
                        <span className="text-sm text-emerald-700 font-bold">Yes, Effective</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={!verification.isEffective} onChange={() => setVerification({...verification, isEffective: false})} disabled={ncr.status === "Closed"} className="w-4 h-4 accent-red-600" />
                        <span className="text-sm text-red-700 font-bold">No, Requires New Action</span>
                      </label>
                    </div>
                  </div>

                  {ncr.status === "Verification" && (
                    <button onClick={handleSaveVerification} disabled={isSubmitting} className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
                      Save Verification
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-lg">
                  Verification can only be performed by Quality Assurance or authorized auditors.
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Column: Actions & Log */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Action Progress Controller */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Workflow Actions</h3>
            <div className="space-y-3">
              {ncr.status === "Open" && (
                <button onClick={() => handleUpdateStatus("Root Cause Analysis")} disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors">
                  Start RCA Phase
                </button>
              )}
              {ncr.status === "Root Cause Analysis" && (
                <button onClick={() => handleUpdateStatus("Action Plan")} disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors">
                  Submit RCA & Move to Action Plan
                </button>
              )}
              {ncr.status === "Action Plan" && (
                <button onClick={() => handleUpdateStatus("Verification")} disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors">
                  Mark Action Completed & Request Verificaton
                </button>
              )}
              {ncr.status === "Verification" && isQA && verification.isEffective && (
                <button onClick={() => handleUpdateStatus("Closed")} disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors">
                  <CheckCircle className="w-4 h-4" /> Close NCR
                </button>
              )}
              {ncr.status === "Verification" && isQA && !verification.isEffective && (
                <button onClick={() => handleUpdateStatus("Root Cause Analysis")} disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors">
                  <AlertTriangle className="w-4 h-4" /> Action Failed (Return to RCA)
                </button>
              )}
              {ncr.status === "Closed" && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-sm font-bold rounded-lg border border-emerald-200 text-center flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  NCR Closed
                </div>
              )}
            </div>
          </div>

          {/* Linked Training (CAPA Action) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <GraduationCap className="w-4 h-4 text-indigo-500" />
                Training (CAPA Action)
              </h3>
              <button onClick={() => setIsAddTrainingOpen(true)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {linkedTrainings.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No training linked to this NCR yet.</p>
            ) : (
              <div className="space-y-2">
                {linkedTrainings.map(t => (
                  <Link key={t.id} href={`/modules/training/${t.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === "Completed" ? "bg-emerald-500" : t.status === "Cancelled" ? "bg-red-400" : "bg-slate-400"}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-blue-600 truncate">{t.trainingNo}</p>
                      <p className="text-xs text-slate-600 truncate">{t.title}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${t.status === "Completed" ? "bg-emerald-100 text-emerald-700" : t.status === "Cancelled" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}>
                      {t.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Activity Log */}
          {ncr.history && ncr.history.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  Audit Trail
                </h3>
              </div>
              <div className="p-6 max-h-125 overflow-y-auto custom-scrollbar">
                <div className="space-y-5 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {[...ncr.history].reverse().map((log, idx) => (
                    <div key={log.id || idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-indigo-50 text-indigo-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                        <Activity className="w-3 h-3" />
                      </div>
                      <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-3 rounded border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between space-x-2 mb-1">
                          <div className="font-bold text-slate-800 text-xs">{log.action}</div>
                        </div>
                        <div className="text-[10px] text-slate-500 mb-1 flex justify-between">
                          <span>{log.userName}</span>
                          <span>{new Date(log.date).toLocaleDateString()} {new Date(log.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        {log.note && <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded">{log.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <AddTrainingModal
        isOpen={isAddTrainingOpen}
        onClose={() => setIsAddTrainingOpen(false)}
        ncReferenceId={ncr.id}
        ncReferenceNo={ncr.ncNumber}
      />
    </div>
  );
}
