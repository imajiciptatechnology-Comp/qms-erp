import Link from "next/link";
import { Boxes } from "lucide-react";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import TableFooter from "@/components/ui/TableFooter";
import { getSalesAccess } from "@/app/modules/sales/access";
import { canSeeService } from "@/app/modules/sales/lib";
import { StatusBadge } from "@/app/modules/sales/ui";
import { getInstalledBase } from "../actions";

export default async function InstalledBasePage() {
  const { access } = await getSalesAccess();
  if (!canSeeService(access)) return null;
  const units = await getInstalledBase();

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Semua unit trainer yang sudah BAST, per nomor seri, beserta kontrak garansinya. Garansi yang hampir habis adalah peluang kontrak service / AMC.</p>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Unit</th>
                <th className="px-6 py-4 font-semibold">No. seri</th>
                <th className="px-6 py-4 font-semibold">Customer & SO</th>
                <th className="px-6 py-4 font-semibold">BAST</th>
                <th className="px-6 py-4 font-semibold">Garansi</th>
                <th className="px-6 py-4 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.length ? units.map(u => (
                <tr key={u.key} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{u.product}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{u.serialNumber}</td>
                  <td className="px-6 py-4"><p className="font-semibold text-slate-800">{u.customer}</p><Link href={`/modules/sales/orders/${u.soId}`} className="text-xs text-blue-700 hover:underline">{u.soNo}</Link></td>
                  <td className="px-6 py-4 whitespace-nowrap">{u.bastDate ?? "-"}</td>
                  <td className="px-6 py-4">{u.warranty ? <><StatusBadge status={u.warranty.state ?? "Active"} /><p className="text-xs text-slate-500 mt-1"><Link href={`/modules/contract-shipping/contracts/${u.warranty.id}`} className="hover:underline">{u.warranty.contractNo}</Link> · s/d {u.warranty.endDate}</p></> : <span className="text-xs text-slate-400">Tanpa garansi</span>}</td>
                  <td className="px-6 py-4">{access.canService && <Link href={`/modules/customer-service/tickets/new?unit=${encodeURIComponent(u.key)}`} className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap">Buat tiket</Link>}</td>
                </tr>
              )) : <EmptyTableRow colSpan={6} icon={<Boxes className="w-12 h-12 text-slate-200" />} title="Belum ada unit terpasang" />}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={units.length} total={units.length} label="unit" />
      </div>
    </div>
  );
}
