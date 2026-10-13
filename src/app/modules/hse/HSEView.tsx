"use client";

import { useState, useMemo } from "react";
import { Search, Plus, ShieldAlert, CheckCircle, AlertTriangle, Trash2, HardHat, FileSearch, ShieldCheck, Siren, Download, Loader2 } from "lucide-react";
import type { IncidentRecord, PatrolRecord } from "./actions";
import { deleteIncident, deletePatrol, getHSEExcel } from "./actions";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddIncidentModal from "./AddIncidentModal";
import AddPatrolModal from "./AddPatrolModal";

export default function HSEView({ incidents, patrols, user, rolesConfig }: { incidents: IncidentRecord[], patrols: PatrolRecord[], user: any, rolesConfig: any[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"incidents" | "patrols">("incidents");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddIncidentOpen, setIsAddIncidentOpen] = useState(false);
  const [isAddPatrolOpen, setIsAddPatrolOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    const base64 = await getHSEExcel();
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hse-report-${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    setIsExporting(false);
  }

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  // HSE Manage permission (HSE Officer or Super Admin)
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("hse_manage") || user?.role === "HSE Officer";
  // Everyone should be able to report incidents, but we will keep it simple: any logged in user can report an incident. 
  // Only HSE can manage/close them.
  
  const INCIDENT_STATUS_COLORS: Record<string, string> = {
    "Open": "bg-red-100 text-red-700 border-red-200",
    "Investigating": "bg-amber-100 text-amber-700 border-amber-200",
    "Closed": "bg-emerald-100 text-emerald-700 border-emerald-200",
  };

  const filteredIncidents = useMemo(() => incidents.filter(i =>
    i.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.type.toLowerCase().includes(searchTerm.toLowerCase())
  ), [incidents, searchTerm]);

  const filteredPatrols = useMemo(() => patrols.filter(p =>
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.area.toLowerCase().includes(searchTerm.toLowerCase())
  ), [patrols, searchTerm]);

  const openIncidents = useMemo(() => incidents.filter(i => i.status === "Open").length, [incidents]);

  async function handleDeleteIncident(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this incident report?")) return;
    await deleteIncident(id);
  }

  async function handleDeletePatrol(id: string) {
    if (!confirm("Delete this safety patrol record?")) return;
    await deletePatrol(id);
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            HSE Management <HardHat className="w-6 h-6 text-emerald-600" />
          </h1>
          <p className="text-slate-500 text-sm">Health, Safety, Environment (ISO 9001 Cl. 7.1.4)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Excel
          </button>
          {activeTab === "incidents" && (
            <button
              onClick={() => setIsAddIncidentOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <Siren className="w-4 h-4" /> Report Incident
            </button>
          )}
          {canManage && activeTab === "patrols" && (
            <button
              onClick={() => setIsAddPatrolOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Patrol Record
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("incidents")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === "incidents" ? "bg-red-100 text-red-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Incident Reports
            {openIncidents > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                {openIncidents}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("patrols")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === "patrols" ? "bg-emerald-100 text-emerald-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Safety Patrols
          </button>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search records..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 bg-white text-sm"
          />
        </div>
      </div>

      {/* Incidents Tab */}
      {activeTab === "incidents" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {openIncidents > 0 && (
            <div className="bg-red-50 p-3 border-b border-red-100 flex items-center gap-2 text-sm text-red-700 font-medium">
              <Siren className="w-5 h-5 text-red-500" />
              Action Required: {openIncidents} incident(s) are currently Open and require investigation / corrective actions!
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Incident ID & Date</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold">Location</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIncidents.length > 0 ? filteredIncidents.map(i => (
                  <tr 
                    key={i.id} 
                    onClick={() => router.push(`/modules/hse/incident/${i.id}`)}
                    className={`transition-colors cursor-pointer group hover:bg-slate-50 ${i.status === "Open" ? "bg-red-50/20" : ""}`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700">{i.id}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{i.date}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded text-xs font-bold border ${i.type === "Near Miss" ? "bg-orange-50 text-orange-700 border-orange-200" : i.type === "Accident" ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                        {i.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">{i.location}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${INCIDENT_STATUS_COLORS[i.status]}`}>
                        {i.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/modules/hse/incident/${i.id}`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="View Detail"
                        >
                          <FileSearch className="w-4 h-4" />
                        </Link>
                        {canManage && (
                          <button onClick={e => handleDeleteIncident(e, i.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete Incident">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <EmptyTableRow colSpan={5} icon={<ShieldCheck className="w-12 h-12 text-emerald-200" />} title="Zero Incidents" subtitle="No incidents reported matching your criteria." />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Patrols Tab */}
      {activeTab === "patrols" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date & ID</th>
                  <th className="px-6 py-4 font-semibold">Area Inspected</th>
                  <th className="px-6 py-4 font-semibold">Inspector</th>
                  <th className="px-6 py-4 font-semibold">Findings</th>
                  <th className="px-6 py-4 font-semibold">Result</th>
                  {canManage && <th className="px-6 py-4 font-semibold text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatrols.length > 0 ? filteredPatrols.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700">{p.date}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{p.id}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">{p.area}</td>
                    <td className="px-6 py-4">{p.inspector}</td>
                    <td className="px-6 py-4 max-w-xs truncate" title={p.findings}>{p.findings}</td>
                    <td className="px-6 py-4">
                      {p.isCompliance ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3.5 h-3.5" /> Compliant
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                          <AlertTriangle className="w-3.5 h-3.5" /> Needs Attention
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => handleDeletePatrol(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete Patrol">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                )) : (
                  <EmptyTableRow colSpan={canManage ? 6 : 5} icon={<FileSearch className="w-12 h-12 text-slate-200" />} title="No Patrol Records" />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddIncidentModal isOpen={isAddIncidentOpen} onClose={() => setIsAddIncidentOpen(false)} user={user} />
      <AddPatrolModal isOpen={isAddPatrolOpen} onClose={() => setIsAddPatrolOpen(false)} user={user} />
    </div>
  );
}
