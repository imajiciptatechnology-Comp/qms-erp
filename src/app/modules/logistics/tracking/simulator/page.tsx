import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../../server";
import { driverFlags } from "../../lib";
import { readiness, vehicleConditions, vehicleRuleInclude } from "../../dispatchRules";
import { Card } from "../../ui";
import DriverSimulator from "./DriverSimulator";

export default async function DriverSimulatorPage() {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  if (!access.canDispatch) return <Card><p className="text-sm text-slate-500">Driver simulator hanya untuk Dispatcher, Operations Manager, dan Super Admin.</p></Card>;
  const [drivers, vehicles, orders, routes] = await Promise.all([
    prisma.driver.findMany({ where: { status: "Active" }, orderBy: { code: "asc" } }),
    prisma.vehicle.findMany({ where: { status: "Ready" }, include: vehicleRuleInclude, orderBy: { plateNo: "asc" } }),
    prisma.charterOrder.findMany({ where: { status: "Confirmed" }, include: { route: true, truckType: true, client: true }, orderBy: { loadDate: "asc" } }),
    prisma.logisticsRoute.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <DriverSimulator
      drivers={drivers.filter(d => !driverFlags(d).some(f => f.level === "red")).map(d => ({ id: d.id, label: `${d.name} (${d.code} · ${d.simClass})` }))}
      vehicles={vehicles.filter(v => readiness(vehicleConditions(v)) === "ready").map(v => ({ id: v.id, label: `${v.plateNo} · ${v.truckType.name}` }))}
      orders={orders.map(o => ({ id: o.id, label: `${o.orderNo} · ${o.client.name} · ${o.route.code} · ${o.truckType.name}` }))}
      routes={routes.map(r => ({ id: r.id, label: `${r.code} · ${r.origin} → ${r.destination}` }))}
    />
  );
}
