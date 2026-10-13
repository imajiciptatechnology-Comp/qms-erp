"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle, AlertTriangle, Siren, Clock, FileSearch, HardHat, User, MapPin } from "lucide-react";
import type { IncidentRecord } from "../../actions";
import { updateIncidentStatus } from "../../actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function IncidentDetailClient({ incident, user, rolesConfig }: { incident: IncidentRecord, user: any, rolesConfig: any[] }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  
  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("hse_manage") || user?.role === "HSE Officer";
  
  const STATUS_COLORS: Record<string, string> = {
    "Open": "bg-red-100 text-red-700 border-red-200",
    "Investigating": "bg-amber-100 text-amber-700 border-amber-200",
    "Closed": "bg-emerald-100 text-emerald-700 border-emerald-200",
  };

  const handleUpdateStatus = async (status: IncidentRecord["status"], requireAction: boolean = false) => {
    let actionStr = incident.actionTaken;
    if (requireAction) {
      const val = prompt("Please enter Corrective/Preventive Action taken:", actionStr || "");
      if (val === null) return; 
      if (val.trim() === "") {
        alert("Corrective Action is required to close an incident (ISO 9001 Requirement).");
        return;
      }
      actionStr = val;
    } else if (!confirm(`Change incident status to ${status}?`)) {
      return;
    }

    setIsSaving(true);
    await updateIncidentStatus(incident.id, status, actionStr);
    setIsSaving(false);
    router.refresh();
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Breadcrumb & Header */}
      <div>
        <Link href="/modules/hse" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to HSE Management
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              Incident Report
              <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {incident.id}
              </span>
              <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[incident.status]}`}>
                {incident.status}
              </span>
            </h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Date Occurred: <span className="font-medium text-slate-700">{incident.date}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-blue-600" /> Incident Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Siren className="w-3.5 h-3.5" /> Incident Type</p>
                  <span className={`px-2.5 py-1 rounded text-xs font-bold border ${incident.type === "Near Miss" ? "bg-orange-50 text-orange-700 border-orange-200" : incident.type === "Accident" ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                    {incident.type}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</p>
                  <p className="text-base font-bold text-slate-800">{incident.location}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Reported By</p>
                  <p className="text-sm font-medium text-slate-800 bg-slate-50 px-3 py-1.5 rounded border border-slate-200 w-fit">{incident.reporterName}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Detailed Description</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200">
                {incident.description}
              </p>
            </div>
            
            {incident.status === "Closed" && (
              <div className="pt-4 border-t border-emerald-100 bg-emerald-50 p-4 rounded-lg mt-4 border">
                <div className="flex items-center gap-2 font-bold text-emerald-800 mb-2">
                  <CheckCircle className="w-5 h-5" /> Incident Closed & Action Taken
                </div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Corrective / Preventive Action</p>
                <p className="text-sm text-slate-800 bg-white p-3 rounded border border-emerald-200 whitespace-pre-wrap">
                  {incident.actionTaken}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="lg:col-span-1 space-y-6">
          {/* Action Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Investigation Progress</h2>
            
            {canManage ? (
              <div className="space-y-3">
                {incident.status === "Open" && (
                  <button
                    onClick={() => handleUpdateStatus("Investigating")}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    <FileSearch className="w-4 h-4" /> Begin Investigation
                  </button>
                )}
                
                {incident.status === "Investigating" && (
                  <button
                    onClick={() => handleUpdateStatus("Closed", true)}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" /> Close & Add Action
                  </button>
                )}

                {incident.status === "Closed" && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500 text-center italic mb-4">Investigation closed.</p>
                    <button
                      onClick={() => handleUpdateStatus("Investigating")}
                      disabled={isSaving}
                      className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                    >
                      Re-open Investigation
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">You don't have permission to update incident status.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
