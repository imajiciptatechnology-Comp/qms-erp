"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Filter, CheckCircle, AlertTriangle, Clock, Trash2, ChevronRight, ClipboardCheck } from "lucide-react";
import type { InspectionRecord } from "./actions";
import TableFooter from "@/components/ui/TableFooter";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import { deleteInspection } from "./actions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import AddInspectionModal from "./AddInspectionModal";

const STATUS_COLORS: Record<string, string> = {
  Pass: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Fail: "bg-red-100 text-red-700 border-red-200",
  "Conditional Accept": "bg-amber-100 text-amber-700 border-amber-200",
  Pending: "bg-slate-100 text-slate-700 border-slate-200"
};

const TYPE_COLORS: Record<string, string> = {
  "Incoming": "text-blue-600 bg-blue-50 border-blue-200",
  "In-Process": "text-purple-600 bg-purple-50 border-purple-200",
  "Final": "text-teal-600 bg-teal-50 border-teal-200"
};

export default function InspectionView({ inspections, user, rolesConfig }: { inspections: InspectionRecord[], user: any, rolesConfig: any[] }) {
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
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("inspection_manage");

  const filtered = useMemo(() => inspections.filter(i => {
    const matchSearch = (i.itemName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.lotNumber || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "All" || i.status === filterStatus;
    const matchType = filterType === "All" || i.type === filterType;
    return matchSearch && matchStatus && matchType;
  }), [inspections, searchTerm, filterStatus, filterType]);

  const totalCount = inspections.length;
  const passedCount = useMemo(() => inspections.filter(i => i.status === "Pass" || i.status === "Conditional Accept").length, [inspections]);
  const failedCount = useMemo(() => inspections.filter(i => i.status === "Fail").length, [inspections]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this inspection record? This cannot be undone.")) return;
    await deleteInspection(id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quality Inspection</h1>
          <p className="text-slate-500 text-sm">Release of products and services (ISO 9001 Cl. 8.6)</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Inspection
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-semibold uppercase">Total Inspections</p>
            <p className="text-2xl font-bold text-slate-800">{totalCount}</p>
          </div>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-semibold uppercase">Passed / Accepted</p>
            <p className="text-2xl font-bold text-slate-800">{passedCount}</p>
          </div>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-semibold uppercase">Failed / Rejected</p>
            <p className="text-2xl font-bold text-slate-800">{failedCount}</p>
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
              placeholder="Search by ID, item name, or lot number..."
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
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Type</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                <option value="All">All Types</option>
                {Object.keys(TYPE_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
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
                <th className="px-6 py-4 font-semibold">Inspection ID</th>
                <th className="px-6 py-4 font-semibold">Item & Lot No</th>
                <th className="px-6 py-4 font-semibold">Type & Date</th>
                <th className="px-6 py-4 font-semibold">Inspector</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map(i => (
                  <tr
                    key={i.id}
                    onClick={() => router.push(`/modules/inspection/${i.id}`)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-bold text-slate-700">{i.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{i.itemName}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Lot: {i.lotNumber}</span>
                        <span>•</span>
                        <span>Qty: {i.sampleSize}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${TYPE_COLORS[i.type]}`}>
                          {i.type}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {i.date}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{i.inspector}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[i.status]}`}>
                        {i.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/modules/inspection/${i.id}`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="View Detail"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                        {canManage && (
                          <button
                            onClick={e => handleDelete(e, i.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete Inspection"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                <EmptyTableRow colSpan={6} icon={<ClipboardCheck className="w-12 h-12 text-slate-200" />} title="No inspection records found" subtitle="Create a new inspection to get started." />
              )}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={inspections.length} />
      </div>

      <AddInspectionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} user={user} />
    </div>
  );
}
