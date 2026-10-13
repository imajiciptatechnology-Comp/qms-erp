"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle, RefreshCw, Clock, AlertTriangle, Play, FileText, User, XCircle, ShieldCheck } from "lucide-react";
import type { MocRecord } from "../actions";
import { updateMocStatus } from "../actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MocDetailClient({ record, user, rolesConfig }: { record: MocRecord, user: any, rolesConfig: any[] }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  
  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("moc");
  
  const STATUS_COLORS: Record<string, string> = {
    "Requested": "bg-slate-100 text-slate-700 border-slate-200",
    "Assessed": "bg-blue-100 text-blue-700 border-blue-200",
    "Approved": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Rejected": "bg-red-100 text-red-700 border-red-200",
    "Implemented": "bg-purple-100 text-purple-700 border-purple-200",
    "Closed": "bg-slate-800 text-slate-100 border-slate-700",
  };

  const STEPS = ["Requested", "Assessed", "Approved", "Implemented", "Closed"];
  const currentStepIndex = STEPS.indexOf(record.status === "Rejected" ? "Requested" : record.status);

  const handleUpdateStatus = async (status: MocRecord["status"]) => {
    let notesUpdate: any = {};

    if (status === "Assessed") {
      const val = prompt("Risk Assessment (ISO 9001 Requirement): Describe the potential risks of this change and how they will be mitigated:", record.riskAssessment || "");
      if (val === null) return; 
      if (val.trim() === "") {
        alert("Risk Assessment is required before approving an MOC.");
        return;
      }
      notesUpdate.riskAssessment = val;
    }

    if (status === "Closed") {
      const val = prompt("Verification Notes: How did you verify that this change was implemented successfully and effectively?", record.verificationNotes || "");
      if (val === null) return; 
      if (val.trim() === "") {
        alert("Verification notes are required to close an MOC.");
        return;
      }
      notesUpdate.verificationNotes = val;
    }

    if (!notesUpdate.riskAssessment && !notesUpdate.verificationNotes) {
      if (!confirm(`Change MOC status to ${status}?`)) return;
    }

    setIsSaving(true);
    await updateMocStatus(record.id, status, Object.keys(notesUpdate).length > 0 ? notesUpdate : undefined);
    setIsSaving(false);
    router.refresh();
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Breadcrumb & Header */}
      <div>
        <Link href="/modules/moc" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to MOC
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              MOC Ticket
              <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {record.id}
              </span>
              <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[record.status]}`}>
                {record.status}
              </span>
            </h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Requested Date: <span className="font-medium text-slate-700">{record.requestDate}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Workflow Progress Bar */}
      {record.status !== "Rejected" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -z-10 hidden md:block rounded-full"></div>
            {STEPS.map((step, idx) => {
              const isCompleted = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step} className="flex md:flex-col items-center gap-4 md:gap-2 relative bg-white md:bg-transparent px-2 mb-4 md:mb-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${
                    isCompleted ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-300 text-slate-400"
                  }`}>
                    {isCompleted ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-sm font-semibold ${isCurrent ? "text-blue-700" : isCompleted ? "text-slate-800" : "text-slate-400"}`}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" /> Proposal Details
            </h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Title of Change</p>
                <p className="text-lg font-bold text-slate-800">{record.title}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</p>
                  <span className="px-3 py-1 bg-slate-100 rounded text-sm font-medium border border-slate-200">
                    {record.category}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Proposed By</p>
                  <p className="text-sm font-medium text-slate-800">{record.proposer}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description & Reason</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {record.description}
                </p>
              </div>
            </div>
            
            {record.riskAssessment && (
              <div className="pt-4 border-t border-blue-100 bg-blue-50/50 p-4 rounded-lg mt-4 border">
                <div className="flex items-center gap-2 font-bold text-blue-800 mb-2">
                  <ShieldCheck className="w-5 h-5" /> Risk Assessment (ISO 9001)
                </div>
                <p className="text-sm text-slate-800 bg-white p-3 rounded border border-blue-200 whitespace-pre-wrap">
                  {record.riskAssessment}
                </p>
              </div>
            )}

            {record.verificationNotes && (
              <div className="pt-4 border-t border-emerald-100 bg-emerald-50 p-4 rounded-lg mt-4 border">
                <div className="flex items-center gap-2 font-bold text-emerald-800 mb-2">
                  <CheckCircle className="w-5 h-5" /> Verification Notes (Closure)
                </div>
                <p className="text-sm text-slate-800 bg-white p-3 rounded border border-emerald-200 whitespace-pre-wrap">
                  {record.verificationNotes}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="lg:col-span-1 space-y-6">
          {/* Action Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Change Workflow</h2>
            
            {canManage ? (
              <div className="space-y-3">
                {record.status === "Requested" && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus("Assessed")}
                      disabled={isSaving}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                      <ShieldCheck className="w-4 h-4" /> Assess Risk
                    </button>
                    <button
                      onClick={() => handleUpdateStatus("Rejected")}
                      disabled={isSaving}
                      className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-red-600 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                    >
                      <XCircle className="w-4 h-4" /> Reject Proposal
                    </button>
                  </>
                )}
                
                {record.status === "Assessed" && (
                  <button
                    onClick={() => handleUpdateStatus("Approved")}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve Change
                  </button>
                )}

                {record.status === "Approved" && (
                  <button
                    onClick={() => handleUpdateStatus("Implemented")}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    <Play className="w-4 h-4" /> Mark as Implemented
                  </button>
                )}

                {record.status === "Implemented" && (
                  <button
                    onClick={() => handleUpdateStatus("Closed")}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" /> Verify & Close MOC
                  </button>
                )}

                {(record.status === "Closed" || record.status === "Rejected") && (
                  <p className="text-sm text-slate-500 text-center italic">This MOC is finalized and locked.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">You don't have permission to update MOC status.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
