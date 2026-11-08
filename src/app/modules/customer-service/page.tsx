import Link from "next/link";
import { CalendarCheck, GraduationCap, Headset, ShieldCheck } from "lucide-react";
import { getSalesAccess } from "@/app/modules/sales/access";
import { JOB_STATUS_LABEL, PRIORITY_COLORS, canSeeService, ticketOverdue, today } from "@/app/modules/sales/lib";
import { Card, StatCard, StatusBadge } from "@/app/modules/sales/ui";
import { getServiceOverview } from "./actions";

export default async function CustomerServiceOverview() {
  const { access } = await getSalesAccess();
  if (!canSeeService(access)) return null;
  const { jobs, tickets, warranties, stats } = await getServiceOverview();

  const toSchedule = jobs.filter(j => j.status === "Draft");
  const upcoming = jobs.filter(j => ["Scheduled", "In Progress", "Waiting Approval"].includes(j.status));
  const overdue = tickets.filter(ticketOverdue);
  const expiring = warranties.filter(w => w.state === "Expiring");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Job perlu dijadwalkan" value={toSchedule.length} sub={`${upcoming.length} terjadwal / berjalan`} icon={<CalendarCheck className="w-6 h-6" />} tone={toSchedule.length ? "amber" : "slate"} />
        <StatCard label="Peserta terlatih" value={stats.trained} sub={`${stats.completedJobs} job selesai${stats.avgFeedback ? ` · kepuasan ${stats.avgFeedback.toFixed(1)}/5` : ""}`} icon={<GraduationCap className="w-6 h-6" />} tone="emerald" />
        <StatCard label="Tiket terbuka" value={tickets.length} sub={overdue.length ? `${overdue.length} lewat SLA respon` : "Semua dalam SLA"} icon={<Headset className="w-6 h-6" />} tone={overdue.length ? "red" : "blue"} />
        <StatCard label="Garansi aktif" value={warranties.length} sub={`${expiring.length} habis dalam 60 hari`} icon={<ShieldCheck className="w-6 h-6" />} tone={expiring.length ? "amber" : "slate"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Instalasi & training" actions={<Link href="/modules/customer-service/jobs" className="text-sm text-blue-600 hover:underline">Semua job</Link>}>
          {jobs.length ? (
            <ul className="divide-y divide-slate-100">
              {jobs.slice(0, 8).map(j => (
                <li key={j.id}>
                  <Link href={`/modules/customer-service/jobs/${j.id}`} className="py-2.5 flex items-center justify-between gap-4 text-sm hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                    <span className="min-w-0"><span className="font-semibold text-slate-800">{j.jobNo}</span> <span className="text-slate-500">· {j.type}</span><span className="block text-xs text-slate-500 truncate">{j.customer.name}{j.startDate ? ` · ${j.startDate}${j.endDate && j.endDate !== j.startDate ? ` s/d ${j.endDate}` : ""}` : " · belum dijadwalkan"}</span></span>
                    <span className="flex flex-col items-end gap-1 shrink-0"><StatusBadge status={j.status} /><span className="text-xs text-slate-500">{JOB_STATUS_LABEL[j.status]}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Tidak ada job aktif. Job dibuat otomatis saat barang tiba di client.</p>}
        </Card>

        <Card title="Tiket terbuka" actions={<Link href="/modules/customer-service/tickets" className="text-sm text-blue-600 hover:underline">Semua tiket</Link>}>
          {tickets.length ? (
            <ul className="divide-y divide-slate-100">
              {tickets.slice(0, 8).map(t => {
                const late = ticketOverdue(t);
                return (
                  <li key={t.id}>
                    <Link href={`/modules/customer-service/tickets/${t.id}`} className="py-2.5 flex items-center justify-between gap-4 text-sm hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                      <span className="min-w-0"><span className="font-semibold text-slate-800">{t.ticketNo}</span> <span className="text-slate-500">· {t.category}</span><span className="block text-xs text-slate-500 truncate">{t.customer.name} · {t.subject}</span>{late && <span className="block text-xs text-red-600 font-semibold">Lewat SLA respon</span>}</span>
                      <span className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                        <StatusBadge status={t.status} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-slate-500">Tidak ada tiket terbuka.</p>}
        </Card>

        <Card title="Garansi akan habis" className="xl:col-span-2" actions={<Link href="/modules/customer-service/installed-base" className="text-sm text-blue-600 hover:underline">Installed base</Link>}>
          {expiring.length ? (
            <ul className="divide-y divide-slate-100">
              {expiring.map(w => (
                <li key={w.id} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                  <span><Link href={`/modules/contract-shipping/contracts/${w.id}`} className="font-semibold text-slate-800 hover:underline">{w.contractNo}</Link><span className="block text-xs text-slate-500">{w.customer.name} · {w.title}</span></span>
                  <span className="text-xs font-semibold text-amber-800">berakhir {w.endDate}{w.endDate < today() ? " (lewat)" : ""}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Tidak ada garansi yang habis dalam 60 hari. Tawarkan kontrak service / AMC sebelum garansi berakhir.</p>}
        </Card>
      </div>
    </div>
  );
}
