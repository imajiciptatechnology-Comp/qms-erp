import Link from "next/link";
import { Mic, MessageSquareText, Plus, PencilLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../server";
import { rupiah } from "../lib";
import { Card, StatusBadge, btnPrimary } from "../ui";

const SOURCE_ICON = { Teks: MessageSquareText, Suara: Mic, Manual: PencilLine } as const;

export default async function OrdersPage() {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const orders = await prisma.charterOrder.findMany({
    include: { client: { select: { name: true } }, route: { select: { code: true, destination: true } }, truckType: { select: { name: true } }, _count: { select: { stops: true } } },
    orderBy: [{ loadDate: "desc" }, { orderNo: "desc" }],
  });
  return (
    <Card title={`Charter orders (${orders.length})`} actions={access.canOrder ? <Link href="/modules/logistics/orders/new" className={btnPrimary}><Plus className="w-4 h-4" /> New order</Link> : null}>
      {orders.length === 0 ? <p className="text-sm text-slate-500">Belum ada order.</p> : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-slate-50">
              <tr>{["No. order", "Klien", "Rute", "Truk", "Muat", "Titik", "Total", "Sumber", "Status"].map(h => <th key={h} className="text-left font-semibold px-5 py-2.5 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(o => {
                const Icon = SOURCE_ICON[o.source as keyof typeof SOURCE_ICON] ?? PencilLine;
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 whitespace-nowrap"><Link href={`/modules/logistics/orders/${o.id}`} className="font-medium text-blue-700 hover:underline">{o.orderNo}</Link></td>
                    <td className="px-5 py-3">{o.client.name}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{o.route.code} · {o.route.destination}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{o.truckType.name}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{o.loadDate}{o.loadTime ? ` ${o.loadTime}` : ""}</td>
                    <td className="px-5 py-3 text-center">{o._count.stops}</td>
                    <td className="px-5 py-3 whitespace-nowrap tabular-nums">{rupiah(o.total)}</td>
                    <td className="px-5 py-3"><span className="inline-flex items-center gap-1 text-xs text-slate-600"><Icon className="w-3.5 h-3.5" aria-hidden />{o.source}</span></td>
                    <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
