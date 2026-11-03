import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import TableFooter from "@/components/ui/TableFooter";
import { getSalesAccess } from "../access";
import { getSalesOrders } from "../actions";
import { rupiah } from "../lib";
import { StatusBadge } from "../ui";

export default async function SalesOrdersPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const orders = await getSalesOrders();

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Sales Order dibuat dari penawaran yang diterima, saat PO customer masuk (tombol “Input PO” di halaman penawaran).</p>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">No. SO</th>
                <th className="px-6 py-4 font-semibold">Customer & PO</th>
                <th className="px-6 py-4 font-semibold">Tanggal</th>
                <th className="px-6 py-4 font-semibold text-right">Nilai</th>
                <th className="px-6 py-4 font-semibold text-right">Terbayar</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length ? orders.map(o => {
                const paid = o.invoices.filter(i => i.status !== "Cancelled").reduce((s, i) => s + i.paidAmount, 0);
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4"><Link href={`/modules/sales/orders/${o.id}`} className="font-bold text-slate-700 hover:text-blue-700 whitespace-nowrap">{o.soNo}</Link></td>
                    <td className="px-6 py-4"><p className="font-semibold text-slate-800">{o.customer.name}</p><p className="text-xs text-slate-500">PO {o.customerPoNo}</p></td>
                    <td className="px-6 py-4 whitespace-nowrap">{o.orderDate}</td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">{rupiah(o.total)}</td>
                    <td className="px-6 py-4 text-right tabular-nums whitespace-nowrap">{Math.round(paid / o.total * 100)}%</td>
                    <td className="px-6 py-4"><StatusBadge status={o.status} /></td>
                  </tr>
                );
              }) : <EmptyTableRow colSpan={6} icon={<ShoppingCart className="w-12 h-12 text-slate-200" />} title="Belum ada sales order" />}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={orders.length} total={orders.length} label="sales order" />
      </div>
    </div>
  );
}
