import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../server";
import { TRIP_STATUSES } from "../trackingLib";
import { LEVEL_LABEL, type OverrideLevel } from "../dispatchRules";
import { today } from "../lib";
import { Card } from "../ui";
import BulkDelete from "../BulkDelete";

const th = "text-left font-semibold px-4 py-2.5 whitespace-nowrap";
const td = "px-4 py-2.5 align-top";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ cancelled?: string; deleted?: string }> }) {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const { cancelled, deleted } = await searchParams;
  const flash = cancelled ? `Trip ${cancelled.slice(0, 40)} dibatalkan. Sopir dikabari lewat bot; order-nya (bila ada) kembali ke antrean dispatch.`
    : deleted ? `Trip ${deleted.slice(0, 40)} dihapus. Direktur Operasional diberi tahu; alasan tercatat di riwayat order (bila ada).` : null;
  const month = today().slice(0, 7);
  const [trips, overrides] = await Promise.all([
    prisma.trip.findMany({ where: { isSimulated: false }, include: { vehicle: true, driver: true, client: true, route: true, order: { select: { orderNo: true } }, _count: { select: { overrides: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.dispatchOverride.findMany({ where: { at: { startsWith: month } }, include: { trip: { select: { id: true, tripNo: true, vehicle: { select: { plateNo: true } }, driver: { select: { name: true } } } } }, orderBy: { at: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      {flash && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{flash}</p>}
      <Card title={`Trips (${trips.length})`} actions={access.canDispatch ? <Link href="/modules/logistics/dispatch" className="text-sm text-blue-700 hover:underline">Dispatch board</Link> : null}>
        {trips.length === 0 ? <p className="text-sm text-slate-500">Belum ada trip. Assign order Confirmed di papan Dispatch.</p> : (
          <>
          {access.isSuperAdmin && <BulkDelete formId="bulk-trips" kind="trip" />}
          <form id="bulk-trips" className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 bg-slate-50"><tr>{access.isSuperAdmin && <th className={th}><input type="checkbox" data-select-all aria-label="Pilih semua trip" /></th>}{["Trip", "Order · klien", "Truk", "Sopir", "Jadwal", "Status", "Surat Jalan", "Override"].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {trips.map(t => (
                  <tr key={t.id}>
                    {access.isSuperAdmin && <td className={td}><input type="checkbox" name="ids" value={t.id} aria-label={`Pilih ${t.tripNo}`} /></td>}
                    <td className={`${td} whitespace-nowrap`}><Link href={`/modules/logistics/trips/${t.id}`} className="font-medium text-blue-700 hover:underline">{t.tripNo}</Link></td>
                    <td className={td}>{t.order?.orderNo ?? "—"}<span className="block text-xs text-slate-500">{t.client?.name ?? ""} · {t.route?.code}</span></td>
                    <td className={`${td} whitespace-nowrap`}>{t.vehicle.plateNo}</td>
                    <td className={`${td} whitespace-nowrap`}>{t.driver.name}</td>
                    <td className={`${td} whitespace-nowrap text-xs`}>{fmt(t.plannedStart)}</td>
                    <td className={td}><span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${TRIP_STATUSES[t.status]?.badge ?? ""}`}>{TRIP_STATUSES[t.status]?.label ?? t.status}</span></td>
                    <td className={`${td} text-xs whitespace-nowrap`}>{t.suratJalanNo ?? <span className="text-amber-700">belum terbit</span>}</td>
                    <td className={`${td} text-xs`}>{t._count.overrides || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </form>
          </>
        )}
      </Card>

      <Card title={`Overrides this month (${overrides.length})`} actions={<span className="text-xs text-slate-500">Jejak audit — bisa dijadikan temuan audit internal ISO</span>}>
        {overrides.length === 0 ? <p className="text-sm text-slate-500">Belum ada override bulan ini.</p> : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 bg-slate-50"><tr>{["Waktu", "Trip", "Kondisi", "Level", "Oleh", "Alasan · tindakan", "Bukti"].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {overrides.map(o => (
                  <tr key={o.id}>
                    <td className={`${td} whitespace-nowrap text-xs`}>{fmt(o.at)}</td>
                    <td className={`${td} whitespace-nowrap`}><Link href={`/modules/logistics/trips/${o.trip.id}`} className="text-blue-700 hover:underline">{o.trip.tripNo}</Link><span className="block text-xs text-slate-500">{o.trip.vehicle.plateNo} · {o.trip.driver.name}</span></td>
                    <td className={td}>#{o.condition.split(":")[0]} {o.conditionText}</td>
                    <td className={`${td} text-xs whitespace-nowrap`}>{LEVEL_LABEL[o.level as OverrideLevel] ?? o.level}</td>
                    <td className={`${td} text-xs`}>{o.byName}<span className="block text-slate-500">{o.byRole}</span></td>
                    <td className={`${td} text-xs max-w-xs`}>{o.reason}<span className="block text-slate-500">{o.controlAction}{o.followUpId ? " · maintenance request dibuat" : ""}</span></td>
                    <td className={`${td} text-xs`}>{o.evidenceUrl ? <a href={o.evidenceUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Lihat</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
