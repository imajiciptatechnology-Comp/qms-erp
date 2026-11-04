import { prisma } from "@/lib/prisma";
import { getBotUsername, isTelegramConfigured } from "@/lib/telegram";
import { getLogisticsAccess } from "../server";
import { getFleetSnapshot } from "../tracking";
import { vehicleFlags } from "../lib";
import FleetTracking from "./FleetTracking";
import DriverChat from "../bot/DriverChat";

export default async function FleetTrackingPage() {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const configured = isTelegramConfigured();
  const [snapshot, botUsername, drivers, vehicles, orders, routes, links] = await Promise.all([
    getFleetSnapshot(),
    configured ? getBotUsername().catch(() => null) : null,
    prisma.driver.findMany({ where: { status: "Active" }, orderBy: { code: "asc" }, select: { id: true, name: true, code: true, simClass: true } }),
    prisma.vehicle.findMany({ where: { status: "Ready" }, include: { truckType: true }, orderBy: { plateNo: "asc" } }),
    prisma.charterOrder.findMany({ where: { status: "Confirmed" }, include: { route: true, truckType: true, client: true }, orderBy: { loadDate: "asc" } }),
    prisma.logisticsRoute.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.chatChannelLink.findMany({ where: { active: true, chatId: { not: null } }, select: { driverId: true } }),
  ]);
  const linked = new Set(links.map(l => l.driverId));
  return (
    <FleetTracking
      initial={snapshot}
      canSimulate={access.canDispatch}
      chatSlot={
        <DriverChat
          configured={configured} botUsername={botUsername} canDispatch={access.canDispatch} isSuperAdmin={access.isSuperAdmin}
          drivers={drivers.map(d => ({ id: d.id, label: `${d.name} (${d.code} · ${d.simClass})`, linked: linked.has(d.id) })).sort((a, b) => Number(b.linked) - Number(a.linked))}
          vehicles={vehicles.filter(v => !vehicleFlags(v).some(f => f.level === "red") && !/P2H gagal/i.test(v.notes ?? "")).map(v => ({ id: v.id, label: `${v.plateNo} · ${v.truckType.name}` }))}
          orders={orders.map(o => ({ id: o.id, label: `${o.orderNo} · ${o.client.name} · ${o.route.code} · ${o.truckType.name}` }))}
          routes={routes.map(r => ({ id: r.id, label: `${r.code} · ${r.origin} → ${r.destination}` }))}
        />
      }
    />
  );
}
