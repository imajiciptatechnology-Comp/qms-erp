import Link from "next/link";
import { Factory, FileSignature, Lock, Ship } from "lucide-react";
import { getSalesAccess } from "@/app/modules/sales/access";
import { PRODUCTION_LABEL, SHIPMENT_STATUS_LABEL, canSeeShipping, contractState, money } from "@/app/modules/sales/lib";
import { Card, StatCard, StatusBadge } from "@/app/modules/sales/ui";
import { getShippingOverview } from "./actions";

export default async function ContractShippingOverview() {
  const { access } = await getSalesAccess();
  if (!canSeeShipping(access)) return null;
  const { orders, shipments, contracts } = await getShippingOverview();

  const inProduction = orders.filter(o => o.status === "Confirmed" && o.productionStatus !== "Ready to Ship");
  const readyUnpaid = orders.filter(o => o.productionStatus === "Ready to Ship" && !o.payment.fullyPaid && !o.salesShipments.some(s => s.exceptionStatus === "Approved"));
  const readyPaid = orders.filter(o => o.status === "Confirmed" && o.productionStatus === "Ready to Ship" && (o.payment.fullyPaid || o.salesShipments.some(s => s.exceptionStatus === "Approved")) && !o.salesShipments.some(s => s.status !== "Cancelled"));
  const onTheWay = shipments.filter(s => s.status === "Shipped");
  const waitingContracts = contracts.filter(c => c.status === "Waiting Approval");
  const expiring = contracts.filter(c => contractState(c) === "Expiring");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Dalam produksi" value={inProduction.length} sub="order dikonfirmasi" icon={<Factory className="w-6 h-6" />} tone="blue" />
        <StatCard label="Siap kirim, belum lunas" value={readyUnpaid.length} sub="tertahan gerbang pelunasan" icon={<Lock className="w-6 h-6" />} tone={readyUnpaid.length ? "red" : "slate"} />
        <StatCard label="Dalam perjalanan" value={onTheWay.length} sub="shipment dikirim" icon={<Ship className="w-6 h-6" />} tone="emerald" />
        <StatCard label="Kontrak" value={waitingContracts.length} sub={`menunggu persetujuan · ${expiring.length} hampir habis`} icon={<FileSignature className="w-6 h-6" />} tone={waitingContracts.length ? "amber" : "slate"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Tertahan: siap kirim tapi belum lunas" actions={<Link href="/modules/contract-shipping/production" className="text-sm text-blue-600 hover:underline">Status produksi</Link>}>
          {readyUnpaid.length ? (
            <ul className="divide-y divide-slate-100">
              {readyUnpaid.map(o => (
                <li key={o.id} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                  <span><Link href={`/modules/sales/orders/${o.id}`} className="font-semibold text-slate-800 hover:underline">{o.soNo}</Link><span className="block text-xs text-slate-500">{o.customer.name}</span></span>
                  <span className="text-right"><span className="font-semibold text-red-700 tabular-nums">sisa {money(o.payment.remaining, o.currency)}</span><span className="block text-xs text-slate-500">dari {money(o.total, o.currency)}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Tidak ada order yang tertahan.</p>}
        </Card>

        <Card title="Siap dibuatkan shipment" actions={<Link href="/modules/contract-shipping/shipments/new" className="text-sm text-blue-600 hover:underline">Shipment baru</Link>}>
          {readyPaid.length ? (
            <ul className="divide-y divide-slate-100">
              {readyPaid.map(o => (
                <li key={o.id} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                  <span><span className="font-semibold text-slate-800">{o.soNo}</span><span className="block text-xs text-slate-500">{o.customer.name} · {o.customer.city ?? "-"}</span></span>
                  <Link href={`/modules/contract-shipping/shipments/new?so=${o.id}`} className="text-blue-700 text-sm font-medium hover:underline">Buat shipment</Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Belum ada order lunas yang siap kirim.</p>}
        </Card>

        <Card title="Shipment aktif" actions={<Link href="/modules/contract-shipping/shipments" className="text-sm text-blue-600 hover:underline">Semua shipment</Link>}>
          {shipments.length ? (
            <ul className="divide-y divide-slate-100">
              {shipments.slice(0, 8).map(s => (
                <li key={s.id}>
                  <Link href={`/modules/contract-shipping/shipments/${s.id}`} className="py-2.5 flex items-center justify-between gap-4 text-sm hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                    <span><span className="font-semibold text-slate-800">{s.shipmentNo}</span><span className="block text-xs text-slate-500">{s.customer.name} · {s.scope} · {s.mode} → {s.destination}</span></span>
                    <span className="flex flex-col items-end gap-1"><StatusBadge status={s.status} /><span className="text-xs text-slate-500">{SHIPMENT_STATUS_LABEL[s.status]}{s.eta ? ` · ETA ${s.eta}` : ""}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Belum ada shipment aktif.</p>}
        </Card>

        <Card title="Dalam produksi">
          {inProduction.length ? (
            <ul className="divide-y divide-slate-100">
              {inProduction.map(o => (
                <li key={o.id} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                  <span><span className="font-semibold text-slate-800">{o.soNo}</span><span className="block text-xs text-slate-500">{o.customer.name}{o.productionTarget ? ` · target ${o.productionTarget}` : ""}</span></span>
                  <span className="flex flex-col items-end gap-1"><StatusBadge status={o.productionStatus} /><span className="text-xs text-slate-500">{PRODUCTION_LABEL[o.productionStatus]}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Tidak ada order dalam produksi.</p>}
        </Card>
      </div>
    </div>
  );
}
