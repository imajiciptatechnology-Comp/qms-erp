"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle, Wrench, Calendar, Clock, AlertTriangle, Play, FileText } from "lucide-react";
import type { MaintenanceRecord } from "../actions";
import { updateMaintenanceStatus } from "../actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MaintenanceDetailClient({ record, user, rolesConfig }: { record: MaintenanceRecord, user: any, rolesConfig: any[] }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  
  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("maintenance_manage") || user?.role === "Production Head";
  
  const STATUS_COLORS: Record<string, string> = {
    "Scheduled": "bg-blue-100 text-blue-700 border-blue-200",
    "In Progress": "bg-purple-100 text-purple-700 border-purple-200",
    "Completed": "bg-emerald-100 text-emerald-700 border-emerald-200",
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const isOverdue = record.status !== "Completed" && record.scheduledDate < todayStr;

  const handleUpdateStatus = async (status: MaintenanceRecord["status"], requireNotes: boolean = false) => {
    let notes = record.resolutionNotes;
    if (requireNotes) {
      const val = prompt("Please enter resolution notes (parts replaced, actions taken):", notes || "");
      if (val === null) return; // User cancelled
      if (val.trim() === "") {
        alert("Resolution notes are required to mark as Completed.");
        return;
      }
      notes = val;
    } else if (!confirm(`Change maintenance status to ${status}?`)) {
      return;
    }

    setIsSaving(true);
    await updateMaintenanceStatus(record.id, status, notes);
    setIsSaving(false);
    router.refresh();
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Breadcrumb & Header */}
      <div>
        <Link href="/modules/maintenance" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Maintenance
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              Maintenance Ticket
              <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {record.id}
              </span>
              <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[record.status]}`}>
                {record.status}
              </span>
            </h1>
            {isOverdue && (
              <p className="text-red-600 mt-2 flex items-center gap-2 text-sm font-bold bg-red-50 p-2 rounded w-fit border border-red-200">
                <AlertTriangle className="w-4 h-4" /> OVERDUE: This maintenance task was scheduled for {record.scheduledDate}.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Ticket Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" /> Machine / Equipment</p>
                  <p className="text-lg font-bold text-slate-800">{record.machineId}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Maintenance Type</p>
                  <span className={`px-2.5 py-1 rounded text-xs font-bold ${record.type === "Preventive" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
                    {record.type}
                  </span>
                </div>
                {record.relatedWorkOrder && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Triggered by Work Order</p>
                    <p className="text-sm font-bold text-slate-800">{record.relatedWorkOrder}</p>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Scheduled Date</p>
                  <p className={`text-base font-medium ${isOverdue ? "text-red-600" : "text-slate-800"}`}>{record.scheduledDate}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Technician / Vendor</p>
                  <p className="text-sm font-medium text-slate-800 bg-slate-50 px-3 py-1.5 rounded border border-slate-200 w-fit">{record.technician}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Description of Issue / Task</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200">
                {record.description}
              </p>
            </div>
            
            {record.status === "Completed" && (
              <div className="pt-4 border-t border-emerald-100 bg-emerald-50 p-4 rounded-lg mt-4 border">
                <div className="flex items-center gap-2 font-bold text-emerald-800 mb-2">
                  <CheckCircle className="w-5 h-5" /> Maintenance Completed
                </div>
                <p className="text-sm text-emerald-700 mb-4">Completed on: {record.completionDate}</p>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Resolution Notes / Parts Replaced</p>
                <p className="text-sm text-slate-800 bg-white p-3 rounded border border-emerald-200 whitespace-pre-wrap">
                  {record.resolutionNotes}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="lg:col-span-1 space-y-6">
          {/* Action Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Update Progress</h2>
            
            {canManage ? (
              <div className="space-y-3">
                {record.status === "Scheduled" && (
                  <button
                    onClick={() => handleUpdateStatus("In Progress")}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Play className="w-4 h-4" /> Start Maintenance
                  </button>
                )}
                
                {record.status === "In Progress" && (
                  <button
                    onClick={() => handleUpdateStatus("Completed", true)}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Mark as Completed
                  </button>
                )}

                {record.status === "Completed" && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500 text-center italic mb-4">Ticket is closed.</p>
                    <button
                      onClick={() => handleUpdateStatus("In Progress")}
                      disabled={isSaving}
                      className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                    >
                      Re-open Ticket (In Progress)
                    </button>
                  </div>
                )}

                <div className="pt-4 mt-4 border-t border-slate-100">
                  <button
                    onClick={async () => {
                      if(!confirm("Are you sure you want to delete this ticket?")) return;
                      setIsSaving(true);
                      const { deleteMaintenanceRecord } = await import("../actions");
                      await deleteMaintenanceRecord(record.id);
                      router.push("/modules/maintenance");
                    }}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-red-200"
                  >
                    Delete Ticket
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">You don't have permission to update maintenance tickets.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
