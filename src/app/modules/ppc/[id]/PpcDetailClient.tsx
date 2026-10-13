"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle, Factory, Clock, Save, Loader2, Target, Calendar, ClipboardCheck, ArrowRight, AlertTriangle } from "lucide-react";
import type { WorkOrder } from "../actions";
import { updateWorkOrderStatus, markQCRequested } from "../actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PpcDetailClient({ workOrder, user, rolesConfig }: { workOrder: WorkOrder, user: any, rolesConfig: any[] }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  
  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("ppc_manage");
  
  const STATUS_COLORS: Record<string, string> = {
    "Scheduled": "bg-blue-100 text-blue-700 border-blue-200",
    "In Progress": "bg-purple-100 text-purple-700 border-purple-200",
    "Completed": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "On Hold": "bg-amber-100 text-amber-700 border-amber-200"
  };

  const handleUpdateStatus = async (status: WorkOrder["status"], promptActual: boolean = false) => {
    let actualQty = workOrder.actualQuantity;
    if (promptActual) {
      const val = prompt(`Enter actual quantity produced (Target: ${workOrder.targetQuantity}):`, actualQty?.toString() || workOrder.targetQuantity.toString());
      if (val === null) return; // User cancelled
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 0) {
        alert("Invalid quantity.");
        return;
      }
      actualQty = parsed;
    } else if (!confirm(`Change status to ${status}?`)) {
      return;
    }

    setIsSaving(true);
    await updateWorkOrderStatus(workOrder.id, status, actualQty);
    setIsSaving(false);
    router.refresh();
  };

  const handleRequestQC = async () => {
    setIsSaving(true);
    await markQCRequested(workOrder.id);
    setIsSaving(false);
    
    // Redirect to QC Inspection with query params
    router.push(`/modules/inspection?action=add&source=production&refId=${workOrder.id}&item=${encodeURIComponent(workOrder.productName)}&lot=${encodeURIComponent(`LOT-${workOrder.id}`)}&qty=${workOrder.actualQuantity || workOrder.targetQuantity}`);
  };

  const renderProgressBar = () => {
    if (workOrder.status === "Scheduled") return <div className="h-3 w-full bg-slate-100 rounded-full" />;
    
    let pct = 50;
    let colorClass = "bg-purple-500 animate-pulse";
    
    if (workOrder.status === "On Hold") {
      colorClass = "bg-amber-400";
    } else if (workOrder.status === "Completed") {
      pct = workOrder.actualQuantity ? Math.min(100, Math.round((workOrder.actualQuantity / workOrder.targetQuantity) * 100)) : 100;
      colorClass = "bg-emerald-500";
    }

    return (
      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex items-center">
        <div className={`h-full transition-all duration-1000 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Breadcrumb & Header */}
      <div>
        <Link href="/modules/ppc" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Production Planning
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              {workOrder.productName}
              <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {workOrder.id}
              </span>
              <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[workOrder.status]}`}>
                {workOrder.status}
              </span>
            </h1>
          </div>
          <div className="flex flex-col md:items-end text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              Schedule: <span className="font-semibold text-slate-800">{workOrder.startDate} to {workOrder.endDate}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Details Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Production Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Target Quantity</p>
                  <p className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    {workOrder.targetQuantity} <span className="text-sm font-medium text-slate-500">units</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Actual Quantity Produced</p>
                  <p className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    {workOrder.actualQuantity !== undefined ? (
                      <>
                        <span className={workOrder.actualQuantity >= workOrder.targetQuantity ? "text-emerald-600" : "text-amber-600"}>
                          {workOrder.actualQuantity}
                        </span>
                        <span className="text-sm font-medium text-slate-500">units</span>
                      </>
                    ) : (
                      <span className="text-slate-400 text-base font-normal italic">Not completed yet</span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Machine / Area</p>
                  <p className="text-sm font-medium text-slate-800 flex items-center gap-2">
                    <Factory className="w-4 h-4 text-slate-400" /> {workOrder.machineId}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Operator (PIC)</p>
                  <p className="text-sm font-medium text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-600 border border-slate-200">
                      {workOrder.operator.charAt(0)}
                    </span>
                    {workOrder.operator}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Production Progress</p>
              {renderProgressBar()}
            </div>
            
            {workOrder.notes && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Production Notes</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {workOrder.notes}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="lg:col-span-1 space-y-6">
          {/* Action Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Update Progress</h2>
            
            {canManage ? (
              <div className="space-y-3">
                {workOrder.status === "Scheduled" && (
                  <button
                    onClick={() => handleUpdateStatus("In Progress")}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    Start Production
                  </button>
                )}
                
                {(workOrder.status === "In Progress" || workOrder.status === "On Hold") && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus("Completed", true)}
                      disabled={isSaving}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" /> Mark as Completed
                    </button>
                    {workOrder.status === "In Progress" && (
                      <button
                        onClick={() => handleUpdateStatus("On Hold")}
                        disabled={isSaving}
                        className="w-full flex items-center justify-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        Put On Hold
                      </button>
                    )}
                    {(workOrder.status === "In Progress" || workOrder.status === "On Hold") && (
                      <button
                        onClick={() => {
                          router.push(`/modules/maintenance?action=add&machine=${encodeURIComponent(workOrder.machineId)}&woId=${workOrder.id}`);
                        }}
                        disabled={isSaving}
                        className="w-full flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        <AlertTriangle className="w-4 h-4" /> Report Machine Breakdown
                      </button>
                    )}
                    {workOrder.status === "On Hold" && (
                      <button
                        onClick={() => handleUpdateStatus("In Progress")}
                        disabled={isSaving}
                        className="w-full flex items-center justify-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        Resume Production
                      </button>
                    )}
                  </>
                )}

                {workOrder.status === "Completed" && (
                  <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg text-sm border border-emerald-200 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-semibold">Production Completed</p>
                      <p className="text-emerald-700 mt-1">This work order has been marked as finished.</p>
                      
                      <div className="mt-4">
                        <button
                          onClick={handleRequestQC}
                          disabled={workOrder.qcRequested || isSaving}
                          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            workOrder.qcRequested 
                              ? "bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300" 
                              : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                          }`}
                        >
                          {workOrder.qcRequested ? (
                            <>
                              <CheckCircle className="w-4 h-4" /> QC Inspection Requested
                            </>
                          ) : (
                            <>
                              Forward to QC Inspection <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">You don't have permission to update work orders.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
