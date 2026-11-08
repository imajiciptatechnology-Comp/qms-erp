import Link from "next/link";
import { Plus, Ship } from "lucide-react";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import TableFooter from "@/components/ui/TableFooter";
import { getSalesAccess } from "@/app/modules/sales/access";
import { EXCEPTION_LABEL, SHIPMENT_STATUS_LABEL, canSeeShipping } from "@/app/modules/sales/lib";
import { StatusBadge, btnPrimary } from "@/app/modules/sales/ui";
import { getShipments } from "../actions";

export default async function ShipmentsPage() {
  const { access } = await getSalesAccess();
  if (!canSeeShipping(access)) return null;
  const shipments = await getShipments();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Satu Sales Order bisa dikirim dalam satu atau beberapa shipment. Rilis kiriman terkunci sampai order lunas (termasuk L/C).</p>
        {access.canShipping && <Link href="/modules/contract-shipping/shipments/new" className={`${btnPrimary} justify-center shrink-0`}><Plus className="w-4 h-4" /> Shipment baru</Link>}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">No. Shipment</th>
                <th className="px-6 py-4 font-semibold">Customer & SO</th>
                <th className="px-6 py-4 font-semibold">Rute</th>
                <th className="px-6 py-4 font-semibold">ETD / ETA</th>
                <th className="px-6 py-4 font-semibold">B/L / AWB</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shipments.length ? shipments.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4"><Link href={`/modules/contract-shipping/shipments/${s.id}`} className="font-bold text-slate-700 hover:text-blue-700 whitespace-nowrap">{s.shipmentNo}</Link><p className="text-xs text-slate-500">{s.scope}{s.incoterm ? ` · ${s.incoterm}` : ""}</p></td>
                  <td className="px-6 py-4"><p className="font-semibold text-slate-800">{s.customer.name}</p><p className="text-xs text-slate-500">{s.salesOrder.soNo} · PO {s.salesOrder.customerPoNo}</p></td>
                  <td className="px-6 py-4">{s.mode}: {s.origin} → {s.destination}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{s.etd ?? "-"} / {s.eta ?? "-"}</td>
                  <td className="px-6 py-4">{s.awbNo ?? "-"}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={s.status} />
                    <p className="text-xs text-slate-500 mt-1">{SHIPMENT_STATUS_LABEL[s.status]}</p>
                    {s.exceptionStatus && <p className={`text-xs mt-0.5 ${s.exceptionStatus === "Approved" ? "text-emerald-700" : s.exceptionStatus === "Rejected" ? "text-red-700" : "text-amber-700"}`}>{EXCEPTION_LABEL[s.exceptionStatus]}</p>}
                  </td>
                </tr>
              )) : <EmptyTableRow colSpan={6} icon={<Ship className="w-12 h-12 text-slate-200" />} title="Belum ada shipment" />}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={shipments.length} total={shipments.length} label="shipment" />
      </div>
    </div>
  );
}
