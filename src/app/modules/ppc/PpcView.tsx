"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Filter, Factory, CheckCircle, AlertTriangle, Clock, Trash2, ChevronRight, HardHat, Calendar } from "lucide-react";
import type { WorkOrder } from "./actions";
import TableFooter from "@/components/ui/TableFooter";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import { deleteWorkOrder } from "./actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddWoModal from "./AddWoModal";

const STATUS_COLORS: Record<string, string> = {
  "Scheduled": "bg-blue-100 text-blue-700 border-blue-200",
  "In Progress": "bg-purple-100 text-purple-700 border-purple-200",
  "Completed": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "On Hold": "bg-amber-100 text-amber-700 border-amber-200"
};

export default function PpcView({ workOrders, user, rolesConfig }: { workOrders: WorkOrder[], user: any, rolesConfig: any[] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("ppc_manage");

  const filtered = useMemo(() => workOrders.filter(w => {
    const matchSearch = w.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.machineId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.operator.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "All" || w.status === filterStatus;
    return matchSearch && matchStatus;
  }), [workOrders, searchTerm, filterStatus]);

  const totalCount = workOrders.length;
  const inProgressCount = useMemo(() => workOrders.filter(w => w.status === "In Progress").length, [workOrders]);
  const completedCount = useMemo(() => workOrders.filter(w => w.status === "Completed").length, [workOrders]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this Work Order? This cannot be undone.")) return;
    await deleteWorkOrder(id);
  }

  // Helper to compute progress bar
  const renderProgressBar = (w: WorkOrder) => {
    if (w.status === "Scheduled") return <div className="h-1.5 w-full bg-slate-100 rounded-full" />;
    if (w.status === "Completed") return <div className="h-1.5 w-full bg-emerald-500 rounded-full" />;
    
    // In Progress / On Hold -> just show an indeterminate or 50% bar, since we don't track live qty here unless updated
    return (
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full w-1/2 ${w.status === "On Hold" ? "bg-amber-400" : "bg-purple-500 animate-pulse"}`} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Production Planning (PPC)</h1>
          <p className="text-slate-500 text-sm">Control of Production & Service Provision (ISO 9001 Cl. 8.5)</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Work Order
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-semibold uppercase">Total Work Orders</p>
            <p className="text-2xl font-bold text-slate-800">{totalCount}</p>
          </div>
        </div>
        <div className="bg-white border border-purple-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-semibold uppercase">In Progress</p>
            <p className="text-2xl font-bold text-slate-800">{inProgressCount}</p>
          </div>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-semibold uppercase">Completed</p>
            <p className="text-2xl font-bold text-slate-800">{completedCount}</p>
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
              placeholder="Search by WO ID, product, machine, or operator..."
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
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">WO Number</th>
                <th className="px-6 py-4 font-semibold">Product & Target</th>
                <th className="px-6 py-4 font-semibold">Machine & Operator</th>
                <th className="px-6 py-4 font-semibold">Schedule</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map(w => (
                  <tr
                    key={w.id}
                    onClick={() => router.push(`/modules/ppc/${w.id}`)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-bold text-slate-700">{w.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{w.productName}</div>
                      <div className="text-xs text-slate-500 mt-1 flex flex-col gap-1">
                        <span>Target: {w.targetQuantity} units</span>
                        {renderProgressBar(w)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Factory className="w-3.5 h-3.5 text-slate-400" /> {w.machineId}
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <HardHat className="w-3.5 h-3.5 text-slate-400" /> {w.operator}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-600 flex flex-col gap-1">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Start: {w.startDate}</span>
                        <span className="flex items-center gap-1 text-slate-500"><Clock className="w-3.5 h-3.5" /> End: {w.endDate}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[w.status]}`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/modules/ppc/${w.id}`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="View Detail"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                        {canManage && w.status !== "Completed" && (
                          <button
                            onClick={e => handleDelete(e, w.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete WO"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                <EmptyTableRow colSpan={6} icon={<Factory className="w-12 h-12 text-slate-200" />} title="No Work Orders found" subtitle="Create a new Work Order to start production planning." />
              )}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={workOrders.length} />
      </div>

      <AddWoModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
}
