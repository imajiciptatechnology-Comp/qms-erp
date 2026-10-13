"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Filter, Plus, Scale, AlertTriangle, CheckCircle, Clock, ChevronRight, Trash2, Download, Loader2, PieChart } from "lucide-react";
import type { EquipmentItem } from "./actions";
import { exportCalibrationExcel, deleteEquipment, updateEquipment, sendCalibrationReminders } from "./actions";
import { getCalibrationStatus } from "./utils";
import AddEquipmentModal from "./AddEquipmentModal";
import { TabNav, Tab } from "@/components/ui/TabNav";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CalibrationView({ equipments, user, rolesConfig }: { equipments: EquipmentItem[], user: any, rolesConfig: any[] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "analytics">("list");

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("calibration") || user?.department === "Quality Assurance";

  useEffect(() => {
    sendCalibrationReminders().catch(console.error);
  }, []);

  async function handleExport() {
    setIsExporting(true);
    const base64 = await exportCalibrationExcel();
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calibration-list-${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  }

  // Calculate dynamic statuses — memoized so getCalibrationStatus runs once per data change
  const equippedWithStatus = useMemo(() => equipments.map(eq => ({
    ...eq,
    calStatus: getCalibrationStatus(eq.nextCalibrationDate, eq.status)
  })), [equipments]);

  const filtered = useMemo(() => equippedWithStatus.filter(eq => {
    const matchSearch = eq.equipmentNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        eq.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "All" ? true :
                        filterStatus === "Overdue" ? eq.calStatus === "Overdue" :
                        filterStatus === "Warning" ? eq.calStatus === "Warning" :
                        eq.status === filterStatus;
    const matchCategory = filterCategory === "All" || eq.category === filterCategory;
    return matchSearch && matchStatus && matchCategory;
  }), [equippedWithStatus, searchTerm, filterStatus, filterCategory]);

  const activeEquipments = useMemo(() => equippedWithStatus.filter(e => e.status === "Active"), [equippedWithStatus]);
  const overdueCount = useMemo(() => equippedWithStatus.filter(e => e.calStatus === "Overdue").length, [equippedWithStatus]);
  const warningCount = useMemo(() => equippedWithStatus.filter(e => e.calStatus === "Warning").length, [equippedWithStatus]);
  const validCount = useMemo(() => equippedWithStatus.filter(e => e.calStatus === "Valid").length, [equippedWithStatus]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Calibration & Equipment</h1>
          <p className="text-slate-500 text-sm">Monitor and measure resources — ISO 9001:2015 Clause 7.1.5</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Excel
          </button>
          {canManage && (
            <button onClick={() => setIsAddOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Add Equipment
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600"><Scale className="w-6 h-6" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Total Active</p><p className="text-2xl font-bold text-slate-800">{activeEquipments.length}</p></div>
        </div>
        <div className="bg-white border border-emerald-100 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600"><CheckCircle className="w-6 h-6" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Valid Calibration</p><p className="text-2xl font-bold text-emerald-700">{validCount}</p></div>
        </div>
        <div className="bg-white border border-amber-100 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600"><Clock className="w-6 h-6" /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase">Due ≤ 30 Days</p><p className="text-2xl font-bold text-amber-700">{warningCount}</p></div>
        </div>
        <div className={`bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm ${overdueCount > 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
          <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${overdueCount > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Overdue</p>
            <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-700' : 'text-slate-800'}`}>{overdueCount}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabNav>
        <Tab active={activeTab === "list"} onClick={() => setActiveTab("list")}>
          <Search className="w-4 h-4" /> Equipment List
        </Tab>
        <Tab active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")}>
          <PieChart className="w-4 h-4" /> Analytics Dashboard
        </Tab>
      </TabNav>

      {activeTab === "analytics" && (
        <CalibrationAnalytics equipments={equippedWithStatus} />
      )}

      {activeTab === "list" && (
        <>
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search equipment ID, name, location..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 bg-white text-sm" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"}`}>
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
        {showFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500">
                <option value="All">All Statuses</option>
                <option value="Overdue">Calibration Overdue</option>
                <option value="Warning">Calibration Due Soon</option>
                <option value="Active">Active Equipment</option>
                <option value="Out of Service">Out of Service</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Category</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500">
                <option value="All">All Categories</option>
                <option value="Measuring">Measuring</option>
                <option value="Testing">Testing</option>
                <option value="Production">Production</option>
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
                <th className="px-6 py-4 font-semibold">Equipment ID</th>
                <th className="px-6 py-4 font-semibold">Name & Specs</th>
                <th className="px-6 py-4 font-semibold">Location</th>
                <th className="px-6 py-4 font-semibold">Calibration Status</th>
                <th className="px-6 py-4 font-semibold">Next Due Date</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map(eq => (
                <tr key={eq.id} onClick={() => router.push(`/modules/calibration/${eq.id}`)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 font-bold text-teal-600">
                    <div className="flex flex-col gap-1">
                      <span>{eq.equipmentNo}</span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 w-max px-1.5 py-0.5 rounded">{eq.category}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-800">{eq.name}</p>
                    <p className="text-xs text-slate-500">Range: {eq.range || '-'} | Tol: {eq.tolerance || '-'}</p>
                  </td>
                  <td className="px-6 py-4">{eq.location}</td>
                  <td className="px-6 py-4">
                    {eq.status !== "Active" ? (
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-semibold border border-slate-200">{eq.status}</span>
                    ) : eq.calStatus === "Overdue" ? (
                      <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-red-200">Overdue</span>
                    ) : eq.calStatus === "Warning" ? (
                      <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-200">Due Soon</span>
                    ) : eq.calStatus === "Valid" ? (
                      <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-200">Valid</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-semibold border border-slate-200">Not Calibrated</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {eq.nextCalibrationDate ? (
                      <div className="flex flex-col">
                        <span className={`font-medium ${eq.calStatus === "Overdue" ? "text-red-600" : eq.calStatus === "Warning" ? "text-amber-600" : "text-slate-700"}`}>
                          {eq.nextCalibrationDate}
                        </span>
                        <span className="text-[10px] text-slate-400">Freq: {eq.frequencyMonths} mo</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No record</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                      {canManage && eq.status === "Active" && (
                        <button onClick={() => updateEquipment(eq.id, { status: "Out of Service" })} title="Mark Out of Service"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors">
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => router.push(`/modules/calibration/${eq.id}`)}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      {canManage && (
                        <button onClick={() => { if(confirm("Delete this equipment?")) deleteEquipment(eq.id); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <EmptyTableRow colSpan={6} icon={<Scale className="w-12 h-12 text-slate-300" />} title="No equipment found" subtitle="Adjust filters or register new equipment." />
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {isAddOpen && <AddEquipmentModal onClose={() => setIsAddOpen(false)} />}
    </div>
  );
}

// ── Analytics Component ──────────────────────────────────────────────────────
function CalibrationAnalytics({ equipments }: { equipments: any[] }) {
  // Category distribution
  const categoryMap: Record<string, number> = {};
  equipments.forEach(eq => {
    categoryMap[eq.category] = (categoryMap[eq.category] || 0) + 1;
  });
  const categoryData = Object.entries(categoryMap).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value);

  // Status distribution
  const statusMap: Record<string, number> = {};
  equipments.forEach(eq => {
    const s = eq.status !== "Active" ? eq.status : eq.calStatus;
    statusMap[s] = (statusMap[s] || 0) + 1;
  });
  const statusData = Object.entries(statusMap).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value);

  const maxCat = Math.max(...categoryData.map(d => d.value), 1);
  const maxStat = Math.max(...statusData.map(d => d.value), 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Equipment Categories</h3>
        {categoryData.length === 0 ? <p className="text-sm text-slate-400">No data</p> : (
          <div className="space-y-3">
            {categoryData.map(d => (
              <div key={d.label} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-right text-xs text-slate-600 truncate">{d.label}</span>
                <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                  <div className="h-full bg-teal-500 rounded transition-all" style={{ width: `${(d.value / maxCat) * 100}%` }} />
                </div>
                <span className="w-6 text-xs font-bold text-slate-700">{d.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Calibration Status</h3>
        {statusData.length === 0 ? <p className="text-sm text-slate-400">No data</p> : (
          <div className="space-y-3">
            {statusData.map(d => {
              const isWarning = d.label === "Warning" || d.label === "Overdue";
              const isOut = d.label === "Out of Service" || d.label === "Damaged" || d.label === "Lost";
              const color = isWarning ? "bg-amber-500" : isOut ? "bg-red-500" : "bg-emerald-500";
              return (
                <div key={d.label} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-right text-xs text-slate-600 truncate">{d.label}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                    <div className={`h-full ${color} rounded transition-all`} style={{ width: `${(d.value / maxStat) * 100}%` }} />
                  </div>
                  <span className="w-6 text-xs font-bold text-slate-700">{d.value}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
