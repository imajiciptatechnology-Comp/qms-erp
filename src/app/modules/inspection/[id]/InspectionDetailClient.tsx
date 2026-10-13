"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle, AlertTriangle, Save, Loader2, FileText, Trash2, Plus, Clock, FilePlus, ShieldAlert } from "lucide-react";
import type { InspectionRecord, InspectionParameter } from "../actions";
import { updateInspectionStatus, addInspectionParameter, updateInspectionParameter, deleteInspectionParameter } from "../actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function InspectionDetailClient({ inspection, user, rolesConfig }: { inspection: InspectionRecord, user: any, rolesConfig: any[] }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  
  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("inspection_manage");
  
  const [isAddingParam, setIsAddingParam] = useState(false);

  const STATUS_COLORS: Record<string, string> = {
    Pass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Fail: "bg-red-100 text-red-700 border-red-200",
    "Conditional Accept": "bg-amber-100 text-amber-700 border-amber-200",
    Pending: "bg-slate-100 text-slate-700 border-slate-200"
  };

  const handleAddParam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    await addInspectionParameter(inspection.id, {
      name: formData.get("name") as string,
      standard: formData.get("standard") as string,
      actualResult: formData.get("actualResult") as string,
      status: formData.get("status") as any,
    });
    setIsAddingParam(false);
    setIsSaving(false);
    router.refresh();
  };

  const handleDeleteParam = async (paramId: string) => {
    if (!confirm("Remove this parameter?")) return;
    setIsSaving(true);
    await deleteInspectionParameter(inspection.id, paramId);
    setIsSaving(false);
    router.refresh();
  };

  const handleUpdateStatus = async (status: InspectionRecord["status"]) => {
    if (!confirm(`Mark inspection as ${status}?`)) return;
    setIsSaving(true);
    await updateInspectionStatus(inspection.id, status);
    setIsSaving(false);
    router.refresh();
  };

  const allPassed = inspection.parameters.length > 0 && inspection.parameters.every(p => p.status === "Pass");
  const anyFailed = inspection.parameters.some(p => p.status === "Fail");

  return (
    <div className="space-y-6 pb-10">
      {/* Breadcrumb & Header */}
      <div>
        <Link href="/modules/inspection" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Inspections
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              {inspection.itemName}
              <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {inspection.id}
              </span>
              <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[inspection.status]}`}>
                {inspection.status}
              </span>
            </h1>
            <p className="text-slate-500">Lot: {inspection.lotNumber} • Type: {inspection.type}</p>
          </div>
          <div className="flex flex-col md:items-end text-sm text-slate-600">
            <div>Inspector: <span className="font-semibold text-slate-800">{inspection.inspector}</span></div>
            <div>Date: <span className="font-semibold text-slate-800">{inspection.date}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Parameters Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-800">Inspection Parameters</h2>
              {canManage && inspection.status === "Pending" && (
                <button
                  onClick={() => setIsAddingParam(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Parameter
                </button>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-white text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Parameter Name</th>
                    <th className="px-6 py-3 font-semibold">Standard / Spec</th>
                    <th className="px-6 py-3 font-semibold">Actual Result</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    {canManage && inspection.status === "Pending" && <th className="px-6 py-3 font-semibold text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspection.parameters.length > 0 ? inspection.parameters.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{p.name}</td>
                      <td className="px-6 py-4">{p.standard}</td>
                      <td className="px-6 py-4">{p.actualResult}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[p.status]}`}>
                          {p.status === "Pass" ? <CheckCircle className="w-3 h-3" /> : p.status === "Fail" ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {p.status}
                        </span>
                      </td>
                      {canManage && inspection.status === "Pending" && (
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleDeleteParam(p.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        <p className="text-sm">No inspection parameters added yet.</p>
                      </td>
                    </tr>
                  )}
                  
                  {isAddingParam && (
                    <tr className="bg-blue-50/30">
                      <td colSpan={5} className="p-4">
                        <form onSubmit={handleAddParam} className="grid grid-cols-5 gap-3 items-end">
                          <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Parameter</label>
                            <input required name="name" placeholder="e.g. Dimensions" className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded" />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Standard</label>
                            <input required name="standard" placeholder="e.g. 10.0 ± 0.1 mm" className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded" />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Actual Result</label>
                            <input required name="actualResult" placeholder="e.g. 10.05 mm" className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded" />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                            <select required name="status" className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded">
                              <option value="Pass">Pass</option>
                              <option value="Fail">Fail</option>
                              <option value="Pending">Pending</option>
                            </select>
                          </div>
                          <div className="col-span-1 flex gap-2">
                            <button type="submit" disabled={isSaving} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700">Save</button>
                            <button type="button" onClick={() => setIsAddingParam(false)} className="px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded font-medium hover:bg-slate-50">Cancel</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-1 space-y-6">
          {/* General Details */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-slate-800">Inspection Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2">
                <span className="text-slate-500">Sample Size</span>
                <span className="font-medium text-slate-800">{inspection.sampleSize} units</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-500">Remarks</span>
                <span className="font-medium text-slate-800">{inspection.remarks || "-"}</span>
              </div>
            </div>
            
            {/* Final Decision */}
            {canManage && inspection.status === "Pending" && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h3 className="font-semibold text-slate-800 text-sm">Release Decision</h3>
                {inspection.parameters.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                    Add at least one inspection parameter to make a release decision.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleUpdateStatus("Pass")}
                      disabled={isSaving}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve (Pass)
                    </button>
                    <button
                      onClick={() => handleUpdateStatus("Conditional Accept")}
                      disabled={isSaving}
                      className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      <AlertTriangle className="w-4 h-4" /> Conditional Accept
                    </button>
                    <button
                      onClick={() => handleUpdateStatus("Fail")}
                      disabled={isSaving}
                      className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      <AlertTriangle className="w-4 h-4" /> Reject (Fail)
                    </button>
                  </div>
                )}
              </div>
            )}

            {canManage && inspection.status !== "Pending" && (
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleUpdateStatus("Pending")}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                >
                  <Clock className="w-4 h-4" /> Revert to Pending (Re-inspect)
                </button>
              </div>
            )}
            
            {/* Integration with NC if Failed */}
            {inspection.status === "Fail" && (
              <div className="pt-4 border-t border-red-100 mt-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-bold text-red-800 flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-4 h-4" /> Non-Conformance
                  </h3>
                  <p className="text-xs text-red-600 mb-3">
                    This inspection failed. A Non-Conformance Report (NCR) should be issued to investigate and disposition the nonconforming product.
                  </p>
                  
                  {inspection.ncReference ? (
                    <div className="text-sm font-medium text-red-800 flex items-center gap-2">
                      Linked NCR: 
                      <Link href={`/modules/nc/${inspection.ncReference}`} className="text-blue-600 hover:underline">
                        {inspection.ncReference}
                      </Link>
                    </div>
                  ) : canManage ? (
                    <Link
                      href={`/modules/nc?action=add&source=inspection&refId=${inspection.id}&item=${encodeURIComponent(inspection.itemName)}`}
                      className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <FilePlus className="w-4 h-4" /> Raise NCR Now
                    </Link>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
