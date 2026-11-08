import Link from "next/link";
import { CalendarCheck, Plus } from "lucide-react";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import TableFooter from "@/components/ui/TableFooter";
import { getSalesAccess } from "@/app/modules/sales/access";
import { JOB_STATUS_LABEL, canSeeService, type Participant } from "@/app/modules/sales/lib";
import { StatusBadge, btnPrimary } from "@/app/modules/sales/ui";
import { getJobs } from "../actions";

export default async function JobsPage() {
  const { access } = await getSalesAccess();
  if (!canSeeService(access)) return null;
  const jobs = await getJobs();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Alur: Draft → diajukan → disetujui Sales Manager (terjadwal) → berjalan di lokasi → BAST. Job instalasi dibuat otomatis saat barang tiba; training ulang / tambahan bisa dibuat manual.</p>
        {access.canService && <Link href="/modules/customer-service/jobs/new" className={`${btnPrimary} justify-center shrink-0`}><Plus className="w-4 h-4" /> Job baru</Link>}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">No. Job</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Jenis & lokasi</th>
                <th className="px-6 py-4 font-semibold">Jadwal</th>
                <th className="px-6 py-4 font-semibold">Trainer / teknisi</th>
                <th className="px-6 py-4 font-semibold text-right">Peserta</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.length ? jobs.map(j => {
                const participants = JSON.parse(j.participantsJson) as Participant[];
                return (
                  <tr key={j.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4"><Link href={`/modules/customer-service/jobs/${j.id}`} className="font-bold text-slate-700 hover:text-blue-700 whitespace-nowrap">{j.jobNo}</Link>{j.salesOrder && <p className="text-xs text-slate-500">{j.salesOrder.soNo}</p>}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{j.customer.name}</td>
                    <td className="px-6 py-4">{j.type}<p className="text-xs text-slate-500">{j.mode}{j.location ? ` · ${j.location}` : ""}</p></td>
                    <td className="px-6 py-4 whitespace-nowrap">{j.startDate ? `${j.startDate}${j.endDate && j.endDate !== j.startDate ? ` – ${j.endDate}` : ""}` : "-"}</td>
                    <td className="px-6 py-4">{j.trainerName ?? "-"}{j.technicians && <p className="text-xs text-slate-500">{j.technicians}</p>}</td>
                    <td className="px-6 py-4 text-right tabular-nums">{participants.filter(p => p.attended).length}/{participants.length}</td>
                    <td className="px-6 py-4"><StatusBadge status={j.status} /><p className="text-xs text-slate-500 mt-1">{JOB_STATUS_LABEL[j.status]}</p></td>
                  </tr>
                );
              }) : <EmptyTableRow colSpan={7} icon={<CalendarCheck className="w-12 h-12 text-slate-200" />} title="Belum ada job instalasi / training" />}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={jobs.length} total={jobs.length} label="job" />
      </div>
    </div>
  );
}
