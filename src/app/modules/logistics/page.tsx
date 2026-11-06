import Link from "next/link";
import { ClipboardList, FileClock, Truck, Users, Wallet, Sparkles, Mic } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "./server";
import { driverFlags, rupiah, today, vehicleFlags } from "./lib";
import { Card, StatCard, StatusBadge, btnPrimary, btnSecondary } from "./ui";

export default async function LogisticsOverview() {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const month = today().slice(0, 7);
  const [overridesMonth, waitingDispatch, noSj] = await Promise.all([
    prisma.dispatchOverride.count({ where: { at: { startsWith: month } } }),
    prisma.charterOrder.count({ where: { status: "Confirmed" } }),
    prisma.trip.count({ where: { isSimulated: false, status: "Scheduled", suratJalanNo: null } }),
  ]);
  const [orders, vehicles, drivers] = await Promise.all([
    prisma.charterOrder.findMany({ include: { client: { select: { name: true } }, route: { select: { code: true, destination: true } }, truckType: { select: { name: true } } }, orderBy: [{ loadDate: "asc" }] }),
    prisma.vehicle.findMany({ include: { truckType: { select: { name: true } } } }),
    prisma.driver.findMany({ where: { status: "Active" } }),
  ]);
  const active = orders.filter(o => o.status !== "Cancelled");
  const thisMonth = active.filter(o => o.loadDate.startsWith(month));
  const upcoming = active.filter(o => ["Draft", "Confirmed"].includes(o.status) && o.loadDate >= today()).slice(0, 6);
  const vFlags = vehicles.map(v => ({ v, flags: vehicleFlags(v) }));
  const ready = vFlags.filter(x => x.flags.length === 0).length;
  const attention = vFlags.filter(x => x.flags.length > 0);
  const simAlerts = drivers.map(d => ({ d, flags: driverFlags(d) })).filter(x => x.flags.length);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Orders this month" value={thisMonth.length} sub={`${active.filter(o => o.status === "Draft").length} draft menunggu konfirmasi`} icon={<ClipboardList className="w-6 h-6" />} tone="blue" />
        <StatCard label="Order value (month)" value={rupiah(thisMonth.reduce((s, o) => s + o.total, 0))} sub="termasuk PPN" icon={<Wallet className="w-6 h-6" />} tone="emerald" />
        <StatCard label="Trucks ready" value={`${ready} / ${vehicles.length}`} sub={`${attention.length} perlu perhatian`} icon={<Truck className="w-6 h-6" />} tone={attention.length ? "amber" : "emerald"} />
        <StatCard label="Drivers" value={drivers.length} sub={simAlerts.length ? `${simAlerts.length} SIM hampir/sudah habis` : "semua SIM berlaku"} icon={<Users className="w-6 h-6" />} tone={simAlerts.length ? "amber" : "slate"} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/modules/logistics/dispatch" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300"><p className="text-xs uppercase text-slate-500 font-semibold">Waiting for dispatch</p><p className="text-2xl font-bold text-slate-800">{waitingDispatch}</p><p className="text-xs text-slate-500">order Confirmed belum dapat truk</p></Link>
        <Link href="/modules/logistics/trips" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300"><p className="text-xs uppercase text-slate-500 font-semibold">Trips without Surat Jalan</p><p className="text-2xl font-bold text-amber-700">{noSj}</p><p className="text-xs text-slate-500">menunggu P2H sopir / override</p></Link>
        <Link href="/modules/logistics/trips" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300"><p className="text-xs uppercase text-slate-500 font-semibold">Overrides this month</p><p className="text-2xl font-bold text-slate-800">{overridesMonth}</p><p className="text-xs text-slate-500">jejak audit blokir yang dilewati</p></Link>
      </div>

      {access.canOrder && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-5 flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div>
            <p className="font-semibold text-indigo-900 flex items-center gap-2"><Sparkles className="w-4 h-4" aria-hidden /> Order masuk lewat chat? Tempel saja — atau bicara.</p>
            <p className="text-sm text-indigo-900/80 mt-1">AI menyusun order dari teks/suara, harga keluar otomatis dari tabel tarif (rute × jenis truk + multi-drop, inap, TKBM, pengawalan, asuransi, PPN).</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/modules/logistics/orders/new" className={btnPrimary}><Mic className="w-4 h-4" /> New order (chat / voice)</Link>
            <Link href="/modules/logistics/rates" className={btnSecondary}>Check price</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Upcoming loads" actions={<Link href="/modules/logistics/orders" className="text-sm text-blue-700 hover:underline">All orders</Link>}>
          {upcoming.length === 0 ? <p className="text-sm text-slate-500">Tidak ada jadwal muat mendatang.</p> : (
            <ul className="divide-y divide-slate-100 -my-2">
              {upcoming.map(o => (
                <li key={o.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/modules/logistics/orders/${o.id}`} className="text-sm font-medium text-blue-700 hover:underline">{o.orderNo}</Link>
                    <p className="text-xs text-slate-500 truncate">{o.client.name} · {o.route.code} {o.route.destination} · {o.truckType.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-600">{o.loadDate} {o.loadTime ?? ""}</p>
                    <StatusBadge status={o.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><FileClock className="w-4 h-4 text-amber-600" aria-hidden /> Fleet & driver alerts</span>} actions={<Link href="/modules/logistics/fleet" className="text-sm text-blue-700 hover:underline">Fleet & crew</Link>}>
          <ul className="space-y-2 text-sm">
            {attention.map(({ v, flags }) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800">{v.plateNo}</span><span className="text-xs text-slate-500">{v.truckType.name}</span>
                {flags.map(f => <span key={f.text} className={`text-xs px-2 py-0.5 rounded-full border ${f.level === "red" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>{f.text}</span>)}
              </li>
            ))}
            {simAlerts.map(({ d, flags }) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800">{d.name}</span><span className="text-xs text-slate-500">sopir</span>
                {flags.map(f => <span key={f.text} className={`text-xs px-2 py-0.5 rounded-full border ${f.level === "red" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>{f.text}</span>)}
              </li>
            ))}
            {attention.length + simAlerts.length === 0 && <li className="text-slate-500">Semua armada & sopir siap.</li>}
          </ul>
          <p className="text-xs text-slate-400 mt-3">Kondisi blokir lengkap (3.5) dicek di papan Dispatch.</p>
        </Card>
      </div>
    </div>
  );
}
