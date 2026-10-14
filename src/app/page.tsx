import DashboardCharts from '@/components/DashboardCharts';
import Link from "next/link";
import {
  Activity, AlertTriangle, CheckCircle, FileText, GraduationCap,
  ShieldAlert, Calendar, Clock, ChevronRight, BookOpen,
  TriangleAlert, Target, Building2, PhoneCall,
  Scale, Factory, Truck, Wrench, Flame, HardHat, RefreshCw
} from "lucide-react";
import { getDashboardData } from "./dashboard-data";
import AiInsightsPanel from "@/components/AiInsightsPanel";
import { getCachedInsights } from "./actions/ai-insights";
import { isAiConfigured } from "@/lib/ai";

// Server Action "Generate Analysis" memanggil AI dan bisa butuh puluhan detik.
export const maxDuration = 60;

export default async function Home() {
  const [{ kpi, charts, recentNCs, recentIncidents, activeMocList }, aiInsights] = await Promise.all([
    getDashboardData(),
    getCachedInsights(),
  ]);
  const {
    openNCs, overdueNCs, auditsThisMonth, activeMocs, activeRisks, openIncidents,
    welderCount, expiredWelders, maintenanceCount, overdueMaintenance, activeWOs,
  } = kpi;

  const NC_STATUS_BADGE: Record<string, string> = {
    Open: "bg-red-100 text-red-700",
    "Root Cause Analysis": "bg-amber-100 text-amber-700",
    "Action Plan": "bg-blue-100 text-blue-700",
    Verification: "bg-purple-100 text-purple-700",
    Closed: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Global Dashboard</h1>
        <p className="text-slate-500 text-sm">QMS ERP — ISO 9001 Complete Overview</p>
      </div>

      {/* ─── Graphical Dashboard ──────────────────────────────────────────── */}
      <AiInsightsPanel initial={aiInsights} configured={isAiConfigured()} />

      <DashboardCharts {...charts} />

      {/* ─── Row 1: Core QMS KPIs ──────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Core Quality Systems</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/modules/nc" className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm shadow-slate-900/5 hover:shadow-md hover:shadow-slate-900/10 transition-shadow flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-100 shrink-0">
              <ShieldAlert className="w-6 h-6 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Open NCs</p>
              <p className="text-3xl font-bold tabular-nums text-slate-800 mt-0.5">{openNCs}</p>
              {overdueNCs > 0 ? (
                <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{overdueNCs} overdue</p>
              ) : <p className="text-xs text-slate-400 mt-1">No overdue</p>}
            </div>
          </Link>

          <Link href="/modules/audit" className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm shadow-slate-900/5 hover:shadow-md hover:shadow-slate-900/10 transition-shadow flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-100 shrink-0">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Audits This Month</p>
              <p className="text-3xl font-bold tabular-nums text-slate-800 mt-0.5">{auditsThisMonth}</p>
              <p className="text-xs text-slate-400 mt-1">Planned & Active</p>
            </div>
          </Link>

          <Link href="/modules/moc" className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm shadow-slate-900/5 hover:shadow-md hover:shadow-slate-900/10 transition-shadow flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-50 shrink-0 border border-blue-100">
              <RefreshCw className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active MOCs</p>
              <p className="text-3xl font-bold tabular-nums text-slate-800 mt-0.5">{activeMocs}</p>
              <p className="text-xs text-slate-400 mt-1">Ongoing changes</p>
            </div>
          </Link>

          <Link href="/modules/risk" className="bg-white p-5 rounded-xl border border-orange-100 shadow-sm shadow-slate-900/5 hover:shadow-md hover:shadow-slate-900/10 transition-shadow flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-orange-100 shrink-0">
              <TriangleAlert className="w-6 h-6 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Risks</p>
              <p className="text-3xl font-bold tabular-nums text-slate-800 mt-0.5">{activeRisks}</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ─── Row 2: Operational KPIs (PPC, HSE, Welding, Maintenance) ─────── */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Operations & Production</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/modules/hse" className="bg-white p-5 rounded-xl border border-red-200 shadow-sm shadow-slate-900/5 hover:shadow-md hover:shadow-slate-900/10 transition-shadow flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-50 shrink-0 border border-red-100">
              <HardHat className="w-6 h-6 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Open Incidents</p>
              <p className="text-3xl font-bold tabular-nums text-slate-800 mt-0.5">{openIncidents}</p>
              {openIncidents > 0 ? (
                <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1 animate-pulse">Action Required!</p>
              ) : <p className="text-xs text-emerald-600 font-semibold mt-1">Zero Accidents</p>}
            </div>
          </Link>

          <Link href="/modules/welding" className="bg-white p-5 rounded-xl border border-orange-200 shadow-sm shadow-slate-900/5 hover:shadow-md hover:shadow-slate-900/10 transition-shadow flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-orange-50 shrink-0 border border-orange-100">
              <Flame className="w-6 h-6 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Welders</p>
              <p className="text-3xl font-bold tabular-nums text-slate-800 mt-0.5">{welderCount}</p>
              {expiredWelders > 0 ? (
                <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{expiredWelders} Expired!</p>
              ) : <p className="text-xs text-slate-400 mt-1">All Certified</p>}
            </div>
          </Link>

          <Link href="/modules/maintenance" className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm shadow-slate-900/5 hover:shadow-md hover:shadow-slate-900/10 transition-shadow flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-slate-100 shrink-0">
              <Wrench className="w-6 h-6 text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Maintenance</p>
              <p className="text-3xl font-bold tabular-nums text-slate-800 mt-0.5">{maintenanceCount}</p>
              {overdueMaintenance > 0 ? (
                <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{overdueMaintenance} Overdue</p>
              ) : <p className="text-xs text-slate-400 mt-1">On Schedule</p>}
            </div>
          </Link>

          <Link href="/modules/ppc" className="bg-white p-5 rounded-xl border border-indigo-200 shadow-sm shadow-slate-900/5 hover:shadow-md hover:shadow-slate-900/10 transition-shadow flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-indigo-50 shrink-0 border border-indigo-100">
              <Factory className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active WOs</p>
              <p className="text-3xl font-bold tabular-nums text-slate-800 mt-0.5">{activeWOs}</p>
              <p className="text-xs text-slate-400 mt-1">In Production</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ─── Main Content ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent NCs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-900/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" /> Recent Non-Conformances
              </h3>
              <Link href="/modules/nc" className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {recentNCs.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-500">
                <CheckCircle className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                <p className="font-medium text-sm">No open non-conformances</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentNCs.map(nc => (
                  <Link key={nc.id} href={`/modules/nc/${nc.id}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-blue-600">{nc.ncNumber}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${NC_STATUS_BADGE[nc.status] || "bg-slate-100 text-slate-600"}`}>
                          {nc.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{nc.department} — {nc.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-900/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-500" /> Active MOC Proposals
              </h3>
              <Link href="/modules/moc" className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {activeMocList.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-500">
                <p className="font-medium text-sm">No active MOCs</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeMocList.map(m => (
                  <Link key={m.id} href={`/modules/moc/${m.id}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-700">{m.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{m.id} · {m.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Urgent HSE */}
          {recentIncidents.length > 0 && (
            <div className="bg-red-50/30 rounded-xl border border-red-200 shadow-sm shadow-red-900/5 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-red-100 flex items-center justify-between">
                <h3 className="font-bold text-red-800 text-sm flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-red-500" /> Open HSE Incidents
                </h3>
              </div>
              <div className="divide-y divide-red-50">
                {recentIncidents.map(i => (
                  <Link key={i.id} href={`/modules/hse/incident/${i.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-red-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{i.id} — {i.type}</p>
                      <p className="text-xs text-red-600 font-medium">Needs Action!</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm shadow-slate-900/5">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { href: "/modules/nc", icon: ShieldAlert, label: "Raise NCR", color: "bg-red-50 text-red-600" },
                { href: "/modules/hse", icon: HardHat, label: "Report Incident", color: "bg-orange-50 text-orange-600" },
                { href: "/modules/moc", icon: RefreshCw, label: "Propose Change (MOC)", color: "bg-blue-50 text-blue-600" },
                { href: "/modules/ppc", icon: Factory, label: "Production (PPC)", color: "bg-indigo-50 text-indigo-600" },
                { href: "/modules/shipping", icon: Truck, label: "Shipping / Delivery", color: "bg-teal-50 text-teal-600" },
              ].map(q => (
                <Link key={q.href} href={q.href}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${q.color}`}>
                    <q.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{q.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
