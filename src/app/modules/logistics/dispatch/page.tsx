import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../server";
import { ACTIVE_TRIP_STATUSES } from "../trackingLib";
import { driverConditions, dutyWarnings, orderConditions, readiness, vehicleConditions, vehicleRuleInclude, vehicleWarnings } from "../dispatchRules";
import { Card, StatusBadge } from "../ui";
import DispatchBoard, { type Candidate } from "./DispatchBoard";

export default async function DispatchPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const { order: pick } = await searchParams;
  const [orders, active] = await Promise.all([
    prisma.charterOrder.findMany({ where: { status: { in: ["Confirmed", "Scheduled"] } }, include: { client: true, route: true, truckType: true, stops: { orderBy: { seq: "asc" } } }, orderBy: [{ loadDate: "asc" }, { loadTime: "asc" }] }),
    prisma.trip.findMany({ where: { status: { in: ACTIVE_TRIP_STATUSES }, isSimulated: false }, select: { id: true, tripNo: true, orderId: true, vehicleId: true, driverId: true, helperId: true } }),
  ]);
  const tripOf = new Map(active.filter(t => t.orderId).map(t => [t.orderId!, t]));
  const waiting = orders.filter(o => o.status === "Confirmed" && !tripOf.has(o.id));
  const scheduled = orders.filter(o => tripOf.has(o.id));
  const sel = waiting.find(o => o.id === pick) ?? waiting[0] ?? null;

  let board: { trucks: Candidate[]; drivers: Candidate[]; helpers: Candidate[] } | null = null;
  if (sel) {
    const busyV = new Set(active.map(t => t.vehicleId));
    const busyD = new Set(active.map(t => t.driverId));
    const busyH = new Set(active.map(t => t.helperId).filter(Boolean) as string[]);
    const [vehicles, drivers, helpers] = await Promise.all([
      prisma.vehicle.findMany({ where: { truckTypeId: sel.truckTypeId }, include: vehicleRuleInclude, orderBy: { plateNo: "asc" } }),
      prisma.driver.findMany({ where: { status: "Active" }, include: { qualifications: true }, orderBy: { code: "asc" } }),
      prisma.helper.findMany({ where: { status: "Active" }, orderBy: { code: "asc" } }),
    ]);
    const load = orderConditions(sel.cargoWeightTon, sel.truckType, true);
    const rank = (c: Candidate) => (c.busy ? 3 : { ready: 0, attention: 1, unfit: 2 }[c.state]);
    board = {
      trucks: vehicles.map(v => {
        const conds = [...vehicleConditions(v), ...load];
        return { id: v.id, label: v.plateNo, sub: `${v.brand ?? ""} · ${v.odometerKm.toLocaleString("id-ID")} km`, state: readiness(conds), conditions: conds, warnings: vehicleWarnings(v), busy: busyV.has(v.id) };
      }).sort((a, b) => rank(a) - rank(b)),
      drivers: (await Promise.all(drivers.map(async d => {
        const conds = driverConditions(d, sel.truckType);
        const warnings = conds.some(c => c.code === "3a") ? [] : await dutyWarnings(d.id, sel.route.durationHours, sel.loadDate);
        return { id: d.id, label: d.name, sub: `${d.code} · ${d.simClass} · ${String(d.experienceYears).replace(".", ",")} th`, state: readiness(conds), conditions: conds, warnings, busy: busyD.has(d.id) };
      }))).sort((a, b) => rank(a) - rank(b) || a.warnings.length - b.warnings.length),
      helpers: helpers.map(h => ({ id: h.id, label: h.name, sub: h.code, state: "ready" as const, conditions: [], warnings: [], busy: busyH.has(h.id), preferredDriverId: h.preferredDriverId })),
    };
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6 items-start">
      <div className="space-y-6">
        <Card title={`Waiting for dispatch (${waiting.length})`}>
          {waiting.length === 0 ? <p className="text-sm text-slate-500">Tidak ada order Confirmed yang menunggu truk.</p> : (
            <ul className="space-y-1.5 -mx-2">
              {waiting.map(o => (
                <li key={o.id}>
                  <Link href={`/modules/logistics/dispatch?order=${o.id}`} className={`block rounded-lg px-3 py-2 text-sm ${sel?.id === o.id ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"}`}>
                    <span className="font-medium text-slate-800">{o.orderNo}</span>
                    <span className="block text-xs text-slate-500">{o.client.name} · {o.route.code} · {o.truckType.name}</span>
                    <span className="block text-xs text-slate-500">Muat {o.loadDate} {o.loadTime ?? ""}{o.cargoWeightTon ? ` · ${o.cargoWeightTon} ton` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Scheduled (${scheduled.length})`}>
          {scheduled.length === 0 ? <p className="text-sm text-slate-500">Belum ada.</p> : (
            <ul className="space-y-2 text-sm">
              {scheduled.map(o => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <Link href={`/modules/logistics/trips/${tripOf.get(o.id)!.id}`} className="text-blue-700 hover:underline">{o.orderNo}</Link>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {sel && board ? (
        <DispatchBoard
          key={sel.id}
          canDispatch={access.canDispatch}
          order={{ id: sel.id, orderNo: sel.orderNo, client: sel.client.name, route: `${sel.route.code} · ${sel.route.origin} → ${sel.route.destination} (±${sel.route.durationHours} jam)`, truckType: sel.truckType.name, requiresHelper: sel.truckType.requiresHelper, capacityTon: sel.truckType.capacityTon, cargo: `${sel.cargoDesc}${sel.cargoWeightTon ? ` · ${sel.cargoWeightTon} ton` : ""}`, load: `${sel.loadDate} ${sel.loadTime ?? ""} · ${sel.originName}`, stops: sel.stops.map(s => s.name) }}
          {...board}
        />
      ) : <Card><p className="text-sm text-slate-500">Pilih order di kiri. Order baru muncul di sini setelah dikonfirmasi (Charter Orders → Confirm).</p></Card>}
    </div>
  );
}
