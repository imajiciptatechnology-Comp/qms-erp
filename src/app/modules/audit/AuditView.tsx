"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, Search, MoreVertical, ClipboardCheck, Calendar, Play, CheckCircle, Lock, Trash2, LayoutGrid, Download, Loader2 } from "lucide-react";
import AddAuditModal from "./AddAuditModal";
import AuditProgramView from "./AuditProgramView";
import { updateAuditStatus, deleteAudit, AuditItem, getAuditExcel } from "./actions";
import { TabNav, Tab } from "@/components/ui/TabNav";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import { useRouter } from "next/navigation";

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    Planned: "bg-slate-100 text-slate-700 border-slate-200",
    "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
    Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Closed: "bg-purple-100 text-purple-700 border-purple-200",
  };
  return `px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status]}`;
};

export default function AuditView({ audits, user, rolesConfig, allUsers }: { audits: AuditItem[], user: any, rolesConfig: any[], allUsers: any[] }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"schedule" | "program">("schedule");
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    const base64 = await getAuditExcel();
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-program-${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    setIsExporting(false);
  }
  const menuRef = useRef<HTMLDivElement>(null);

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const isSuperAdmin = user?.role === "Super Admin";
  // The user can manage if they are Super Admin or have the audit_manage permission
  const canManageAudit = isSuperAdmin || roleData?.permissions.includes("audit_manage");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStatus = async (id: string, status: any) => {
    const res = await updateAuditStatus(id, status);
    if (!res.success && res.message) {
      alert(res.message);
    }
    setActiveMenuId(null);
  };

  const filteredAudits = useMemo(() => audits.filter(a =>
    a.auditNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.department.toLowerCase().includes(searchTerm.toLowerCase())
  ), [audits, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Internal Audit Program</h1>
          <p className="text-slate-500 text-sm">Schedule and manage ISO 9001 internal audits.</p>
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
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Schedule Audit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <TabNav>
        <Tab active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")}>
          <ClipboardCheck className="w-4 h-4" /> Audit Schedule
        </Tab>
        <Tab active={activeTab === "program"} onClick={() => setActiveTab("program")}>
          <LayoutGrid className="w-4 h-4" /> Annual Program
        </Tab>
      </TabNav>

      {activeTab === "program" && <AuditProgramView audits={audits} />}

      {activeTab === "schedule" && <><div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search audit no or department..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
        <div className="overflow-x-auto min-h-100 overflow-visible">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Audit No</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Planned Date</th>
                <th className="px-6 py-4 font-semibold">Lead Auditor</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Findings (NC)</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAudits.length > 0 ? filteredAudits.map((audit) => (
                <tr 
                  key={audit.id} 
                  onClick={() => router.push(`/modules/audit/${audit.id}`)}
                  className="hover:bg-slate-50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4 font-medium text-slate-800">{audit.auditNo}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      {audit.auditType || "Internal"}
                    </span>
                  </td>
                  <td className="px-6 py-4">{audit.department}</td>
                  <td className="px-6 py-4 text-slate-500">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar className="w-3.5 h-3.5" /> Planned: {audit.plannedDate}
                      </span>
                      {audit.actualDate ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                          <Calendar className="w-3.5 h-3.5" /> Actual: {audit.actualDate}
                        </span>
                      ) : audit.status !== "Planned" && (
                        <span className="text-xs text-amber-500 italic">Actual date not set</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">{audit.leadAuditor}</td>
                  <td className="px-6 py-4"><span className={getStatusBadge(audit.status)}>{audit.status}</span></td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${audit.findingsCount > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                        {audit.findingsCount} NC
                      </span>
                      {(audit.ofiCount ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
                          {audit.ofiCount} OFI
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === audit.id ? null : audit.id);
                      }} 
                      className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {activeMenuId === audit.id && (
                      <div ref={menuRef} className="absolute right-6 top-10 w-52 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <div className="p-1">
                          
                          {/* Who can start the audit? The assigned Lead Auditor OR people with Manage privilege */}
                          {audit.status === "Planned" && (canManageAudit || audit.leadAuditorId === user.id) && (
                            <button onClick={(e) => { e.stopPropagation(); handleStatus(audit.id, "In Progress"); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors text-left">
                              <Play className="w-4 h-4" /> Start Audit
                            </button>
                          )}
                          
                          {/* ONLY CAN MANAGE can mark as Completed or Closed */}
                          {audit.status === "In Progress" && canManageAudit && (
                            <button onClick={(e) => { e.stopPropagation(); handleStatus(audit.id, "Completed"); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors text-left">
                              <CheckCircle className="w-4 h-4" /> Mark as Completed
                            </button>
                          )}
                          
                          {audit.status === "Completed" && canManageAudit && (
                            <button onClick={(e) => { e.stopPropagation(); handleStatus(audit.id, "Closed"); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-md transition-colors text-left">
                              <Lock className="w-4 h-4" /> Close Audit
                            </button>
                          )}
                          
                          {canManageAudit && (
                            <>
                              <div className="h-px bg-slate-100 my-1"></div>
                              <button onClick={(e) => { e.stopPropagation(); deleteAudit(audit.id); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors text-left">
                                <Trash2 className="w-4 h-4" /> Delete Audit
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <EmptyTableRow colSpan={7} icon={<ClipboardCheck className="w-12 h-12 text-slate-300" />} title="No audits scheduled" />
              )}
            </tbody>
          </table>
        </div>
      </div></>}

      <AddAuditModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} users={allUsers} />
    </div>
  );
}
