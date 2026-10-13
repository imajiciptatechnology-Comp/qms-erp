"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Filter, PenTool, CheckCircle, Clock, Trash2, ChevronRight, BarChart3, AlertCircle } from "lucide-react";
import type { DesignProject } from "./actions";
import TableFooter from "@/components/ui/TableFooter";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import { deleteDesignProject } from "./actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddDesignModal from "./AddDesignModal";

const STATUS_COLORS: Record<string, string> = {
  Planning: "bg-slate-100 text-slate-700 border-slate-200",
  Inputs: "bg-blue-100 text-blue-700 border-blue-200",
  Controls: "bg-amber-100 text-amber-700 border-amber-200",
  Outputs: "bg-purple-100 text-purple-700 border-purple-200",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200"
};

export default function DesignView({ projects, user, rolesConfig, allUsers }: { projects: DesignProject[], user: any, rolesConfig: any[], allUsers: any[] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("design_manage") || user?.department === "Engineering";

  const filtered = useMemo(() => projects.filter(p => {
    const matchSearch = p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.picName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "All" || p.status === filterStatus;
    return matchSearch && matchStatus;
  }), [projects, searchTerm, filterStatus]);

  const activeCount = useMemo(() => projects.filter(p => p.status !== "Completed" && p.status !== "Cancelled").length, [projects]);
  const completedCount = useMemo(() => projects.filter(p => p.status === "Completed").length, [projects]);
  const today = new Date();
  const overdueCount = useMemo(() => {
    const now = new Date();
    return projects.filter(p => p.status !== "Completed" && p.status !== "Cancelled" && new Date(p.expectedEndDate) < now).length;
  }, [projects]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this design project? This action cannot be undone.")) return;
    await deleteDesignProject(id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Design & Development</h1>
          <p className="text-slate-500 text-sm">Manage product design lifecycle from planning to outputs (ISO 9001 Cl. 8.3).</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <PenTool className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-semibold uppercase">Active Projects</p>
            <p className="text-2xl font-bold text-slate-800">{activeCount}</p>
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
        <div className={`bg-white border rounded-xl p-5 flex items-center gap-4 shadow-sm ${overdueCount > 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${overdueCount > 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
            {overdueCount > 0 ? <AlertCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-sm text-slate-500 font-semibold uppercase">Overdue</p>
            <p className="text-2xl font-bold text-slate-800">{overdueCount}</p>
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
              placeholder="Search project name, ID, or PIC..."
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
                <th className="px-6 py-4 font-semibold">Project ID</th>
                <th className="px-6 py-4 font-semibold">Project Name</th>
                <th className="px-6 py-4 font-semibold">PIC / Dept</th>
                <th className="px-6 py-4 font-semibold">Timeline</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map(p => {
                const isOverdue = p.status !== "Completed" && p.status !== "Cancelled" && new Date(p.expectedEndDate) < today;
                
                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/modules/design/${p.id}`)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-bold text-slate-700">{p.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{p.projectName}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[250px]" title={p.description}>{p.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{p.picName}</div>
                      <div className="text-xs text-slate-500">{p.department}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs flex flex-col gap-1">
                        <span className="text-slate-500">Start: <span className="text-slate-700 font-medium">{p.startDate}</span></span>
                        <span className={`${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                          End: <span className={`${!isOverdue && 'text-slate-700 font-medium'}`}>{p.expectedEndDate}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/modules/design/${p.id}`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="View Detail"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                        {canManage && (
                          <button
                            onClick={e => handleDelete(e, p.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete Project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <EmptyTableRow colSpan={6} icon={<PenTool className="w-12 h-12 text-slate-200" />} title="No design projects found" subtitle="Create a new project to get started." />
              )}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={projects.length} label="projects" />
      </div>

      <AddDesignModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} user={user} allUsers={allUsers} />
    </div>
  );
}
