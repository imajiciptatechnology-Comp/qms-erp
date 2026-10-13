"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Filter, Flame, CheckCircle, AlertTriangle, Trash2, ShieldAlert, FileText, XCircle } from "lucide-react";
import type { WelderRecord, WPSRecord } from "./actions";
import { deleteWelder, revokeWelder, markWPSObsolete, deleteWPS } from "./actions";
import AddWelderModal from "./AddWelderModal";
import AddWpsModal from "./AddWpsModal";
import EmptyTableRow from "@/components/ui/EmptyTableRow";

export default function WeldingView({ welders, wpsList, user, rolesConfig }: { welders: WelderRecord[], wpsList: WPSRecord[], user: any, rolesConfig: any[] }) {
  const [activeTab, setActiveTab] = useState<"welders" | "wps">("welders");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddWelderOpen, setIsAddWelderOpen] = useState(false);
  const [isAddWpsOpen, setIsAddWpsOpen] = useState(false);

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("welding_manage") || user?.role === "Production Head";

  const STATUS_COLORS: Record<string, string> = {
    "Active": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Expired": "bg-red-100 text-red-700 border-red-200",
    "Revoked": "bg-slate-100 text-slate-700 border-slate-200",
    "Obsolete": "bg-amber-100 text-amber-700 border-amber-200",
  };

  const filteredWelders = useMemo(() => welders.filter(w =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.stampNumber.toLowerCase().includes(searchTerm.toLowerCase())
  ), [welders, searchTerm]);

  const filteredWPS = useMemo(() => wpsList.filter(w =>
    w.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.baseMetal.toLowerCase().includes(searchTerm.toLowerCase())
  ), [wpsList, searchTerm]);

  const expiredWelders = useMemo(() => welders.filter(w => w.status === "Expired").length, [welders]);

  async function handleRevokeWelder(id: string) {
    if (!confirm("Are you sure you want to revoke this welder's qualification?")) return;
    await revokeWelder(id);
  }

  async function handleDeleteWelder(id: string) {
    if (!confirm("Delete this welder record entirely?")) return;
    await deleteWelder(id);
  }

  async function handleObsoleteWPS(id: string) {
    if (!confirm("Mark this WPS as obsolete?")) return;
    await markWPSObsolete(id);
  }

  async function handleDeleteWPS(id: string) {
    if (!confirm("Delete this WPS record entirely?")) return;
    await deleteWPS(id);
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Welding Management <Flame className="w-6 h-6 text-orange-500" />
          </h1>
          <p className="text-slate-500 text-sm">Validation of Special Processes (ISO 9001 Cl. 8.5.1f)</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && activeTab === "welders" && (
            <button
              onClick={() => setIsAddWelderOpen(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Register Welder
            </button>
          )}
          {canManage && activeTab === "wps" && (
            <button
              onClick={() => setIsAddWpsOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add WPS
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("welders")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === "welders" ? "bg-orange-100 text-orange-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Welder Qualifications (WPQ)
            {expiredWelders > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                {expiredWelders}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("wps")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === "wps" ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Welding Procedures (WPS)
          </button>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search records..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 bg-white text-sm"
          />
        </div>
      </div>

      {/* Welders Tab */}
      {activeTab === "welders" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {expiredWelders > 0 && (
            <div className="bg-red-50 p-3 border-b border-red-100 flex items-center gap-2 text-sm text-red-700 font-medium">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Warning: {expiredWelders} welder(s) have expired qualifications. Re-validation is required to perform welding tasks.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Welder Stamp</th>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Process & Position</th>
                  <th className="px-6 py-4 font-semibold">Expiry Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  {canManage && <th className="px-6 py-4 font-semibold text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWelders.length > 0 ? filteredWelders.map(w => (
                  <tr key={w.id} className={`hover:bg-slate-50 transition-colors ${w.status === "Expired" ? "bg-red-50/20" : ""}`}>
                    <td className="px-6 py-4 font-bold text-slate-700">{w.stampNumber}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{w.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold border border-slate-200">{w.processType}</span>
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold border border-blue-100">{w.position}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${w.status === "Expired" ? "text-red-600 font-bold" : "text-slate-600"}`}>
                        {w.expiryDate}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[w.status]}`}>
                        {w.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {w.status === "Active" && (
                            <button onClick={() => handleRevokeWelder(w.id)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors" title="Revoke Qualification">
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteWelder(w.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete Record">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )) : (
                  <EmptyTableRow colSpan={canManage ? 6 : 5} icon={<ShieldAlert className="w-12 h-12 text-slate-200" />} title="No Welders Found" />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WPS Tab */}
      {activeTab === "wps" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">WPS Number</th>
                  <th className="px-6 py-4 font-semibold">Process</th>
                  <th className="px-6 py-4 font-semibold">Base Metal</th>
                  <th className="px-6 py-4 font-semibold">Filler Metal</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  {canManage && <th className="px-6 py-4 font-semibold text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWPS.length > 0 ? filteredWPS.map(w => (
                  <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" /> {w.id}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold border border-slate-200">{w.processType}</span>
                    </td>
                    <td className="px-6 py-4 font-medium">{w.baseMetal}</td>
                    <td className="px-6 py-4 font-medium">{w.fillerMetal}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[w.status]}`}>
                        {w.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {w.status === "Active" && (
                            <button onClick={() => handleObsoleteWPS(w.id)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors" title="Mark as Obsolete">
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteWPS(w.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete WPS">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )) : (
                  <EmptyTableRow colSpan={canManage ? 6 : 5} icon={<FileText className="w-12 h-12 text-slate-200" />} title="No WPS Documents Found" />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddWelderModal isOpen={isAddWelderOpen} onClose={() => setIsAddWelderOpen(false)} />
      <AddWpsModal isOpen={isAddWpsOpen} onClose={() => setIsAddWpsOpen(false)} />
    </div>
  );
}
