"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Filter, RefreshCw, ChevronRight, Trash2, FileText, Settings, Layers, Folder, Users } from "lucide-react";
import type { MocRecord } from "./actions";
import TableFooter from "@/components/ui/TableFooter";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import { deleteMoc } from "./actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddMocModal from "./AddMocModal";

const STATUS_COLORS: Record<string, string> = {
  "Requested": "bg-slate-100 text-slate-700 border-slate-200",
  "Assessed": "bg-blue-100 text-blue-700 border-blue-200",
  "Approved": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Rejected": "bg-red-100 text-red-700 border-red-200",
  "Implemented": "bg-purple-100 text-purple-700 border-purple-200",
  "Closed": "bg-slate-800 text-slate-100 border-slate-700",
};

const CATEGORY_ICONS: Record<string, any> = {
  "Process": Settings,
  "Equipment": Settings,
  "Material": Layers,
  "Document": FileText,
  "Organization": Users,
};

export default function MocView({ records, user, rolesConfig }: { records: MocRecord[], user: any, rolesConfig: any[] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  // QA Manager or Super Admin
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("moc");

  const filtered = useMemo(() => records.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.proposer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "All" || r.status === filterStatus;
    const matchCat = filterCategory === "All" || r.category === filterCategory;
    return matchSearch && matchStatus && matchCat;
  }), [records, searchTerm, filterStatus, filterCategory]);

  const activeCount = useMemo(() => records.filter(r => r.status !== "Closed" && r.status !== "Rejected").length, [records]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this MOC ticket?")) return;
    await deleteMoc(id);
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Management of Change <RefreshCw className="w-6 h-6 text-blue-600" />
          </h1>
          <p className="text-slate-500 text-sm">Planning of Changes (ISO 9001 Cl. 6.3)</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Anyone can propose a change */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Propose Change
          </button>
        </div>
      </div>

      {/* Stats & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-4">
            <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Active MOCs</p>
                <p className="text-lg font-bold text-slate-800 leading-none mt-1">{activeCount}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search MOC..."
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
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Category</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                <option value="All">All Categories</option>
                {Object.keys(CATEGORY_ICONS).map(c => <option key={c} value={c}>{c}</option>)}
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
                <th className="px-6 py-4 font-semibold">MOC ID & Date</th>
                <th className="px-6 py-4 font-semibold">Title & Category</th>
                <th className="px-6 py-4 font-semibold">Proposer</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map(r => {
                  const Icon = CATEGORY_ICONS[r.category] || Folder;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/modules/moc/${r.id}`)}
                      className="transition-colors cursor-pointer group hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-700">{r.id}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{r.requestDate}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 truncate max-w-sm" title={r.title}>{r.title}</div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <Icon className="w-3.5 h-3.5" /> {r.category}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">{r.proposer}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/modules/moc/${r.id}`}
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Detail"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                          {canManage && (
                            <button
                              onClick={e => handleDelete(e, r.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete MOC"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                }) : (
                <EmptyTableRow colSpan={5} icon={<RefreshCw className="w-12 h-12 text-slate-200" />} title="No MOC records found" subtitle="Propose a new change to get started." />
              )}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={records.length} />
      </div>

      <AddMocModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} user={user} />
    </div>
  );
}
