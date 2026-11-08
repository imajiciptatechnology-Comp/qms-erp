import Link from "next/link";
import { Headset, Plus } from "lucide-react";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import TableFooter from "@/components/ui/TableFooter";
import { getSalesAccess } from "@/app/modules/sales/access";
import { PRIORITY_COLORS, TICKET_SLA_HOURS, canSeeService, ticketOverdue } from "@/app/modules/sales/lib";
import { StatusBadge, btnPrimary } from "@/app/modules/sales/ui";
import { getTickets } from "../actions";

export default async function TicketsPage() {
  const { access } = await getSalesAccess();
  if (!canSeeService(access)) return null;
  const tickets = await getTickets();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-500">SLA respon pertama: Critical {TICKET_SLA_HOURS.Critical} jam · High {TICKET_SLA_HOURS.High} jam · Medium {TICKET_SLA_HOURS.Medium} jam · Low {TICKET_SLA_HOURS.Low} jam. Keluhan mutu produk bisa diteruskan ke Customer Complaint (QMS).</p>
        {access.canService && <Link href="/modules/customer-service/tickets/new" className={`${btnPrimary} justify-center shrink-0`}><Plus className="w-4 h-4" /> Tiket baru</Link>}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">No. Tiket</th>
                <th className="px-6 py-4 font-semibold">Customer & masalah</th>
                <th className="px-6 py-4 font-semibold">Unit</th>
                <th className="px-6 py-4 font-semibold">Prioritas</th>
                <th className="px-6 py-4 font-semibold">PIC</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.length ? tickets.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4"><Link href={`/modules/customer-service/tickets/${t.id}`} className="font-bold text-slate-700 hover:text-blue-700 whitespace-nowrap">{t.ticketNo}</Link><p className="text-xs text-slate-500">{t.category} · {t.channel}</p></td>
                  <td className="px-6 py-4"><p className="font-semibold text-slate-800">{t.customer.name}</p><p className="text-xs text-slate-500">{t.subject}</p></td>
                  <td className="px-6 py-4">{t.productName ?? "-"}{t.serialNumber && <p className="text-xs text-slate-500">S/N {t.serialNumber}</p>}{t.underWarranty && <p className="text-xs text-emerald-700 font-medium">Dalam garansi</p>}</td>
                  <td className="px-6 py-4"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>{ticketOverdue(t) && <p className="text-xs text-red-600 font-semibold mt-1">Lewat SLA</p>}</td>
                  <td className="px-6 py-4">{t.assignedTo ?? "-"}</td>
                  <td className="px-6 py-4"><StatusBadge status={t.status} /></td>
                </tr>
              )) : <EmptyTableRow colSpan={6} icon={<Headset className="w-12 h-12 text-slate-200" />} title="Belum ada tiket" />}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={tickets.length} total={tickets.length} label="tiket" />
      </div>
    </div>
  );
}
