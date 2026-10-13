"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Plus, Filter, Wrench, CheckCircle, Clock, Trash2, ChevronRight, AlertTriangle, Settings2, Calendar } from "lucide-react";
import type { MaintenanceRecord } from "./actions";
import TableFooter from "@/components/ui/TableFooter";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import { deleteMaintenanceRecord } from "./actions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AddMaintenanceModal from "./AddMaintenanceModal";

const STATUS_COLORS: Record<string, string> = {
  "Scheduled": "bg-blue-100 text-blue-700 border-blue-200",
  "In Progress": "bg-purple-100 text-purple-700 border-purple-200",
  "Completed": "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function MaintenanceView({ records, user, rolesConfig }: { records: MaintenanceRecord[], user: any, rolesConfig: any[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("maintenance_manage") || user?.role === "Production Head";

  // Check Overdue logic
  const todayStr = new Date().toISOString().split("T")[0];
  const isOverdue = (r: MaintenanceRecord) => r.status !== "Completed" && r.scheduledDate < todayStr;

  const filtered = useMemo(() => records.filter(r => {
    const matchSearch = r.machineId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.technician.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "All" || r.status === filterStatus;
    const matchType = filterType === "All" || r.type === filterType;
    return matchSearch && matchStatus && matchType;
  }), [records, searchTerm, filterStatus, filterType]);

  const totalCount = records.length;
  const preventiveCount = useMemo(() => records.filter(r => r.type === "Preventive").length, [records]);
  const correctiveCount = useMemo(() => records.filter(r => r.type === "Corrective").length, [records]);
  const overdueCount = useMemo(() => records.filter(r => r.status !== "Completed" && r.scheduledDate < todayStr).length, [records, todayStr]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this Maintenance Ticket? This cannot be undone.")) return;
    await deleteMaintenanceRecord(id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Machine Maintenance</h1>
          <p className="text-slate-500 text-sm">Infrastructure Management (ISO 9001 Cl. 7.1.3)</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Ticket
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Total Tickets</p>
            <p className="text-2xl font-bold text-slate-800">{totalCount}</p>
          </div>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Preventive (Routine)</p>
            <p className="text-2xl font-bold text-slate-800">{preventiveCount}</p>
          </div>
        </div>
        <div className="bg-white border border-orange-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Corrective (Breakdown)</p>
            <p className="text-2xl font-bold text-slate-800">{correctiveCount}</p>
          </div>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden">
          {overdueCount > 0 && <div className="absolute inset-0 bg-red-50 animate-pulse -z-10" />}
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-red-500 font-bold uppercase">Overdue</p>
            <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by ticket ID, machine, technician..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white text-sm transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"}`}
          >
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-slate-100 flex gap-4">
            <div className="w-48">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                <option value="All">All Status</option>
                {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="w-48">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Type</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                <option value="All">All Types</option>
                <option value="Preventive">Preventive</option>
                <option value="Corrective">Corrective</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Ticket ID</th>
                <th className="px-6 py-4 font-semibold">Machine / Equipment</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Schedule & Tech</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map(r => {
                  const overdue = isOverdue(r);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/modules/maintenance/${r.id}`)}
                      className={`transition-colors cursor-pointer group ${overdue ? "bg-red-50/30 hover:bg-red-50/60" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-6 py-4 font-bold text-slate-700">
                        {r.id}
                        {r.relatedWorkOrder && (
                          <div className="text-[10px] mt-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded border border-orange-200 w-fit font-medium">
                            WO: {r.relatedWorkOrder}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800 flex items-center gap-2">
                        {r.machineId}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${r.type === "Preventive" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-sm">
                          <span className={`flex items-center gap-1 font-medium ${overdue ? "text-red-600" : "text-slate-700"}`}>
                            <Calendar className="w-3.5 h-3.5" /> {r.scheduledDate} {overdue && <span title="Overdue!"><AlertTriangle className="w-3.5 h-3.5" /></span>}
                          </span>
                          <span className="text-xs text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 w-fit">
                            {r.technician}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/modules/maintenance/${r.id}`}
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Detail"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                          {canManage && r.status !== "Completed" && (
                            <button
                              onClick={e => handleDelete(e, r.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete Ticket"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                }) : (
                <EmptyTableRow colSpan={6} icon={<Wrench className="w-12 h-12 text-slate-200" />} title="No Maintenance Tickets found" subtitle="Create a new ticket to schedule machine servicing." />
              )}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={records.length} />
      </div>

      <AddMaintenanceModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
}
