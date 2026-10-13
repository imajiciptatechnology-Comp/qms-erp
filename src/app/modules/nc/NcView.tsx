"use client";

import { useState, useMemo } from "react";
import { Search, ShieldAlert, Calendar, CheckCircle, Plus, Filter, Trash2, Lightbulb, ChevronRight, BarChart3, Download, Loader2 } from "lucide-react";
import type { NCRItem } from "./actions";
import type { SupplierItem } from "@/app/modules/supplier/actions";
import { deleteNCR, updateOFIStatus, exportNCRsExcel } from "./actions";
// NCRItem used for type cast in OFI status update
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import AddNcModal from "./AddNcModal";
import { TabNav, Tab } from "@/components/ui/TabNav";
import TableFooter from "@/components/ui/TableFooter";

const STATUS_ORDER = ["Open", "Root Cause Analysis", "Action Plan", "Verification", "Closed"];

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    Open: "bg-red-100 text-red-700 border-red-200",
    "Root Cause Analysis": "bg-amber-100 text-amber-700 border-amber-200",
    "Action Plan": "bg-blue-100 text-blue-700 border-blue-200",
    Verification: "bg-purple-100 text-purple-700 border-purple-200",
    Closed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  return `inline-flex whitespace-nowrap w-max px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || "bg-slate-100 text-slate-700 border-slate-200"}`;
};

const getSeverityBadge = (severity: string) => {
  const styles: Record<string, string> = {
    Minor: "bg-amber-50 text-amber-700",
    Major: "bg-orange-50 text-orange-700",
    Critical: "bg-red-50 text-red-700 font-bold",
  };
  return `inline-flex whitespace-nowrap w-max px-2 py-1 rounded text-xs ${styles[severity] || ""}`;
};

// ── Helper: simple horizontal bar chart ──────────────────────────────────────
function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3 text-sm">
          <span className="w-36 text-right text-xs text-slate-600 shrink-0 truncate" title={d.label}>{d.label}</span>
          <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
            <div className={`h-full rounded transition-all ${color}`} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-6 text-xs font-bold text-slate-700 shrink-0">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Helper: monthly trend line chart ─────────────────────────────────────────
function TrendChart({ months, data }: { months: string[]; data: number[] }) {
  const max = Math.max(...data, 1);
  const W = 400, H = 80, PAD = 10;
  const toX = (i: number) => PAD + (i / (months.length - 1)) * (W - PAD * 2);
  const toY = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const area = `${line} L${toX(data.length - 1).toFixed(1)},${H - PAD} L${toX(0).toFixed(1)},${H - PAD} Z`;

  return (
    <div className="overflow-x-auto">
      <svg role="img" aria-labelledby="nc-trend-title" width={W} height={H + 20} className="overflow-visible">
        <title id="nc-trend-title">Monthly NC trend over last 12 months</title>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <line key={i} x1={PAD} x2={W - PAD} y1={toY(p * max)} y2={toY(p * max)} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {/* Area fill */}
        <path d={area} fill="#ef4444" fillOpacity="0.08" />
        {/* Line */}
        <path d={line} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots + values */}
        {data.map((v, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(v)} r="3" fill={v > 0 ? "#ef4444" : "#cbd5e1"} />
            {v > 0 && <text x={toX(i)} y={toY(v) - 6} textAnchor="middle" fontSize="9" fill="#64748b">{v}</text>}
          </g>
        ))}
        {/* X-axis labels */}
        {months.map((m, i) => (
          <text key={i} x={toX(i)} y={H + 16} textAnchor="middle" fontSize="9" fill="#94a3b8">{m}</text>
        ))}
      </svg>
    </div>
  );
}

// ── NC Analytics Component ────────────────────────────────────────────────────
function NcAnalytics({ ncItems }: { ncItems: NCRItem[] }) {
  const today = new Date();

  // By Source (Pareto — sorted desc)
  const sourceMap: Record<string, number> = {};
  ncItems.forEach(n => { sourceMap[n.source] = (sourceMap[n.source] || 0) + 1; });
  const bySource = Object.entries(sourceMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  // By Department
  const deptMap: Record<string, number> = {};
  ncItems.forEach(n => { deptMap[n.department] = (deptMap[n.department] || 0) + 1; });
  const byDept = Object.entries(deptMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  // By Severity
  const sevMap: Record<string, number> = { Minor: 0, Major: 0, Critical: 0 };
  ncItems.forEach(n => { if (n.severity) sevMap[n.severity] = (sevMap[n.severity] || 0) + 1; });

  // Monthly trend — last 12 months
  const monthLabels: string[] = [];
  const monthCounts: number[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthLabels.push(d.toLocaleString("default", { month: "short" }));
    monthCounts.push(ncItems.filter(n => {
      const r = new Date(n.dateRaised);
      return r.getFullYear() === d.getFullYear() && r.getMonth() === d.getMonth();
    }).length);
  }

  // Resolution time & on-time rate
  const closed = ncItems.filter(n => n.status === "Closed");
  const avgResolutionDays = closed.length > 0
    ? Math.round(closed.reduce((s, n) => {
        const diff = (new Date(n.dueDate).getTime() - new Date(n.dateRaised).getTime()) / (1000 * 60 * 60 * 24);
        return s + Math.max(diff, 0);
      }, 0) / closed.length)
    : 0;

  const onTimeCount = closed.filter(n => {
    const closeStage = n.history?.find(h => h.action.includes("Closed"));
    if (!closeStage) return true;
    return new Date(closeStage.date) <= new Date(n.dueDate);
  }).length;
  const onTimePct = closed.length > 0 ? Math.round((onTimeCount / closed.length) * 100) : 0;

  const openCount = ncItems.filter(n => n.status !== "Closed").length;
  const overdueCount = ncItems.filter(n => n.status !== "Closed" && new Date(n.dueDate) < today).length;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total NCs", val: ncItems.length, sub: "All time", color: "border-slate-200" },
          { label: "Open", val: openCount, sub: `${overdueCount} overdue`, color: overdueCount > 0 ? "border-red-200 bg-red-50/30" : "border-slate-200" },
          { label: "Closed", val: closed.length, sub: `${onTimePct}% on-time`, color: "border-emerald-200" },
          { label: "Avg Resolution", val: `${avgResolutionDays}d`, sub: "Target lead time", color: "border-blue-200" },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-xl border p-4 ${s.color}`}>
            <p className="text-xs text-slate-500 font-semibold uppercase">{s.label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{s.val}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-red-500" /> Monthly NC Trend (Last 12 Months)
        </h3>
        {ncItems.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6">No NC data available.</p>
        ) : (
          <TrendChart months={monthLabels} data={monthCounts} />
        )}
      </div>

      {/* Pareto Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Source */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4">NC by Source (Pareto)</h3>
          {bySource.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No data.</p>
          ) : (
            <BarChart data={bySource} color="bg-red-400" />
          )}
        </div>

        {/* By Department */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4">NC by Department (Pareto)</h3>
          {byDept.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No data.</p>
          ) : (
            <BarChart data={byDept} color="bg-orange-400" />
          )}
        </div>
      </div>

      {/* Severity distribution */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-4">Severity Distribution</h3>
        <div className="flex items-end gap-6 h-24">
          {Object.entries(sevMap).map(([sev, count]) => {
            const pct = ncItems.length > 0 ? (count / ncItems.length) * 100 : 0;
            const color = sev === "Critical" ? "bg-red-500" : sev === "Major" ? "bg-orange-400" : "bg-amber-300";
            return (
              <div key={sev} className="flex flex-col items-center gap-2 flex-1">
                <span className="text-xs font-bold text-slate-600">{count}</span>
                <div className="w-full rounded-t" style={{ height: `${Math.max(pct, 4)}px`, maxHeight: "64px" }}>
                  <div className={`w-full h-full rounded-t ${color}`} style={{ height: `${Math.max(pct * 0.64, 4)}px` }} />
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${sev === "Critical" ? "bg-red-100 text-red-700" : sev === "Major" ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"}`}>{sev}</span>
              </div>
            );
          })}
          <div className="flex-1 text-center text-xs text-slate-400">
            <p className="font-bold text-slate-700 text-lg">{onTimePct}%</p>
            <p>Closed On-Time</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NcView({ ncrs, user, rolesConfig, suppliers = [] }: { ncrs: NCRItem[], user: any, rolesConfig: any[], suppliers?: SupplierItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSeverity, setFilterSeverity] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"nc" | "ofi" | "analytics">("nc");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  async function handleExport() {
    setIsExporting(true);
    const base64 = await exportNCRsExcel();
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nc-register-${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  }

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("audit_manage") || user?.department === "Quality Assurance";

  const ncItems = useMemo(() => ncrs.filter(n => n.findingType !== "OFI"), [ncrs]);
  const ofiItems = useMemo(() => ncrs.filter(n => n.findingType === "OFI"), [ncrs]);

  const activeList = useMemo(() => activeTab === "nc" ? ncItems : ofiItems, [activeTab, ncItems, ofiItems]);

  const filtered = useMemo(() => activeList.filter(ncr => {
    const matchSearch = ncr.ncNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "All" || ncr.status === filterStatus;
    const matchSeverity = filterSeverity === "All" || ncr.severity === filterSeverity;
    const matchSource = filterSource === "All" || ncr.source === filterSource;
    return matchSearch && matchStatus && matchSeverity && matchSource;
  }), [activeList, searchTerm, filterStatus, filterSeverity, filterSource]);

  // Stats for NC tab
  const openCount = useMemo(() => ncItems.filter(n => n.status === "Open").length, [ncItems]);
  const overdueCount = useMemo(() => ncItems.filter(n => n.status !== "Closed" && new Date(n.dueDate) < new Date()).length, [ncItems]);
  const closedCount = useMemo(() => ncItems.filter(n => n.status === "Closed").length, [ncItems]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this NCR? This action cannot be undone.")) return;
    await deleteNCR(id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">NC Management (CAPA)</h1>
          <p className="text-slate-500 text-sm">Track and manage Non-Conformances and Corrective Actions.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Excel
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Raise NCR
          </button>
        </div>
      </div>

      {/* Stats (NC only) */}
      {activeTab === "nc" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-red-100 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600 font-bold text-lg">{openCount}</div>
            <div><p className="text-xs text-slate-500 font-semibold uppercase">Open</p><p className="text-sm font-medium text-slate-700">Awaiting action</p></div>
          </div>
          <div className="bg-white border border-amber-100 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 font-bold text-lg">{overdueCount}</div>
            <div><p className="text-xs text-slate-500 font-semibold uppercase">Overdue</p><p className="text-sm font-medium text-slate-700">Past due date</p></div>
          </div>
          <div className="bg-white border border-emerald-100 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 font-bold text-lg">{closedCount}</div>
            <div><p className="text-xs text-slate-500 font-semibold uppercase">Closed</p><p className="text-sm font-medium text-slate-700">Resolved</p></div>
          </div>
        </div>
      )}

      {/* Tabs NC / OFI / Analytics */}
      <TabNav>
        <Tab active={activeTab === "nc"} onClick={() => setActiveTab("nc")}>
          <ShieldAlert className="w-4 h-4 text-red-500" />
          NC / CAPA
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === "nc" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-600"}`}>{ncItems.length}</span>
        </Tab>
        <Tab active={activeTab === "ofi"} onClick={() => setActiveTab("ofi")}>
          <Lightbulb className="w-4 h-4 text-blue-500" />
          OFI
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === "ofi" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>{ofiItems.length}</span>
        </Tab>
        <Tab active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")}>
          <BarChart3 className="w-4 h-4 text-purple-500" />
          Analytics
        </Tab>
      </TabNav>

      {/* ── Analytics Tab ── */}
      {activeTab === "analytics" && <NcAnalytics ncItems={ncItems} />}

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search NCR number, department, description..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"}`}
          >
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-red-500">
                <option value="All">All Status</option>
                {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Severity</label>
              <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-red-500">
                <option value="All">All Severity</option>
                <option value="Minor">Minor</option>
                <option value="Major">Major</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Source</label>
              <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-red-500">
                <option value="All">All Sources</option>
                <option value="Internal Audit">Internal Audit</option>
                <option value="Customer Complaint">Customer Complaint</option>
                <option value="Process Monitoring">Process Monitoring</option>
                <option value="Supplier Issue">Supplier Issue</option>
                <option value="Management Review">Management Review</option>
                <option value="Other">Other</option>
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
                <th className="px-6 py-4 font-semibold">NCR Number</th>
                <th className="px-6 py-4 font-semibold">Source</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                {activeTab === "nc" && <th className="px-6 py-4 font-semibold text-center">Severity</th>}
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Due Date</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map(ncr => {
                const isOverdue = ncr.status !== "Closed" && new Date(ncr.dueDate) < new Date();
                return (
                  <tr
                    key={ncr.id}
                    onClick={() => router.push(`/modules/nc/${ncr.id}`)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-bold text-blue-600">{ncr.ncNumber}</td>
                    <td className="px-6 py-4">
                      <div>{ncr.source}</div>
                      {ncr.isoClause && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">Cl. {ncr.isoClause}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium">{ncr.department}</td>
                    <td className="px-6 py-4 max-w-xs">
                      <p className="truncate" title={ncr.description}>{ncr.description}</p>
                    </td>
                    {activeTab === "nc" && (
                      <td className="px-6 py-4 text-center">
                        <span className={getSeverityBadge(ncr.severity)}>{ncr.severity}</span>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {activeTab === "ofi" ? (
                        <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                          <span className={`inline-flex whitespace-nowrap w-max px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            (ncr.ofiStatus || "Open") === "Implemented" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                            (ncr.ofiStatus || "Open") === "Accepted" ? "bg-blue-100 text-blue-700 border-blue-200" :
                            (ncr.ofiStatus || "Open") === "Under Review" ? "bg-amber-100 text-amber-700 border-amber-200" :
                            (ncr.ofiStatus || "Open") === "Rejected" ? "bg-slate-100 text-slate-600 border-slate-200" :
                            "bg-red-100 text-red-700 border-red-200"
                          }`}>{ncr.ofiStatus || "Open"}</span>
                          {canManage && (ncr.ofiStatus !== "Implemented" && ncr.ofiStatus !== "Rejected") && (
                            <select
                              defaultValue=""
                              onChange={async e => {
                                if (e.target.value) {
                                  await updateOFIStatus(ncr.id, e.target.value as NCRItem["ofiStatus"]);
                                  e.target.value = "";
                                }
                              }}
                              className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none"
                            >
                              <option value="">Update status...</option>
                              <option value="Under Review">Under Review</option>
                              <option value="Accepted">Accepted</option>
                              <option value="Implemented">Implemented</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          )}
                        </div>
                      ) : (
                        <span className={getStatusBadge(ncr.status)}>{ncr.status}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-slate-500"><Calendar className="w-3.5 h-3.5" />{ncr.dueDate}</span>
                        {isOverdue && (
                          <span className="inline-flex w-max items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">OVERDUE</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/modules/nc/${ncr.id}`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="View Detail"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                        {canManage && (
                          <button
                            onClick={e => handleDelete(e, ncr.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete NCR"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={activeTab === "nc" ? 8 : 7} className="px-6 py-12 text-center text-slate-500">
                    {activeTab === "nc" ? (
                      <>
                        <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                        <p className="font-medium text-slate-600">No Non-Conformances found</p>
                        <p className="text-sm">Great job keeping quality high!</p>
                      </>
                    ) : (
                      <>
                        <Lightbulb className="w-12 h-12 text-blue-200 mx-auto mb-3" />
                        <p className="font-medium text-slate-600">No OFI recorded</p>
                        <p className="text-sm">Log improvement opportunities from audit findings.</p>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={activeList.length} />
      </div>

      <AddNcModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} suppliers={suppliers} />
    </div>
  );
}
