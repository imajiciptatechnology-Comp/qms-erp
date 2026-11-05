import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../server";
import { addDays, today } from "../lib";
import { parseP2HRecord } from "../p2hLib";
import { Card } from "../ui";
import BulkDelete from "../BulkDelete";
import { p2hVerdict } from "./P2HRecordView";
import { submittedBy } from "./data";

const th = "text-left font-semibold px-4 py-2.5 whitespace-nowrap";
const td = "px-4 py-2.5 align-top";
const fmt = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RESULTS = { all: "All results", pass: "Lolos", override: "Perlu override", fail: "Gagal (kritis)" } as const;

type Search = { result?: string; vehicle?: string; driver?: string; from?: string; to?: string; deleted?: string };

/** Log P2H: semua pemeriksaan harian yang dikirim sopir (dan P2H ulang di kantor) sebagai bukti/audit. */
export default async function P2HRecordsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const sp = await searchParams;
  const result = sp.result && sp.result in RESULTS ? (sp.result as keyof typeof RESULTS) : "all";
  const from = sp.from && DATE_RE.test(sp.from) ? sp.from : addDays(today(), -30);
  const to = sp.to && DATE_RE.test(sp.to) ? sp.to : today();
  // Tanggal WIB → batas ISO UTC.
  const fromIso = new Date(`${from}T00:00:00+07:00`).toISOString();
  const toIso = new Date(`${addDays(to, 1)}T00:00:00+07:00`).toISOString();

  const [checks, vehicles, drivers] = await Promise.all([
    prisma.preTripCheck.findMany({
      where: {
        at: { gte: fromIso, lt: toIso },
        ...(sp.vehicle ? { vehicleId: sp.vehicle } : {}),
        ...(sp.driver ? { driverId: sp.driver } : {}),
        ...(result === "fail" ? { criticalFails: { not: null } } : result === "override" ? { criticalFails: null, otherFails: { not: null } } : result === "pass" ? { criticalFails: null, otherFails: null } : {}),
      },
      include: { vehicle: { select: { plateNo: true } }, trip: { select: { id: true, tripNo: true, isSimulated: true } } },
      orderBy: { at: "desc" }, take: 200,
    }),
    prisma.vehicle.findMany({ select: { id: true, plateNo: true }, orderBy: { plateNo: "asc" } }),
    prisma.driver.findMany({ select: { id: true, name: true, code: true }, orderBy: { code: "asc" } }),
  ]);
  const driverName = new Map(drivers.map(d => [d.id, d.name]));
  const counts = { pass: 0, override: 0, fail: 0 } as Record<string, number>;
  for (const c of checks) counts[p2hVerdict(c).key]++;
  const sel = "px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white";

  return (
    <div className="space-y-6">
      {sp.deleted && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">Catatan P2H dihapus. Alasan tercatat di timeline trip dan Direktur Operasional diberi tahu.</p>}
      <Card title="P2H records" actions={<span className="text-xs text-slate-500">Bukti pemeriksaan harian dari sopir — untuk audit & investigasi</span>}>
        <form className="flex flex-wrap items-end gap-2 mb-4" method="get">
          <label className="text-xs text-slate-500">From<input type="date" name="from" defaultValue={from} className={`${sel} block mt-0.5`} /></label>
          <label className="text-xs text-slate-500">To<input type="date" name="to" defaultValue={to} className={`${sel} block mt-0.5`} /></label>
          <label className="text-xs text-slate-500">Result
            <select name="result" defaultValue={result} className={`${sel} block mt-0.5`}>{Object.entries(RESULTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <label className="text-xs text-slate-500">Truck
            <select name="vehicle" defaultValue={sp.vehicle ?? ""} className={`${sel} block mt-0.5`}><option value="">All trucks</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plateNo}</option>)}</select>
          </label>
          <label className="text-xs text-slate-500">Driver
            <select name="driver" defaultValue={sp.driver ?? ""} className={`${sel} block mt-0.5`}><option value="">All drivers</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </label>
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700">Filter</button>
          <Link href="/modules/logistics/p2h" className="px-3 py-1.5 text-sm text-slate-600 hover:underline">Reset</Link>
        </form>

        <p className="text-xs text-slate-500 mb-3">{checks.length}{checks.length === 200 ? "+" : ""} pemeriksaan · {counts.pass} lolos · {counts.override} perlu override · {counts.fail} gagal kritis</p>

        {checks.length === 0 ? <p className="text-sm text-slate-500">Belum ada P2H pada filter ini.</p> : (
          <>
          {access.isSuperAdmin && <BulkDelete formId="bulk-p2h" kind="p2h" />}
          <form id="bulk-p2h" className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 bg-slate-50"><tr>{access.isSuperAdmin && <th className={th}><input type="checkbox" data-select-all aria-label="Pilih semua P2H" /></th>}{["Waktu", "Truk", "Trip", "Diisi oleh", "Hasil", "Item bermasalah", "Odometer", "Bukti", ""].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {checks.map(c => {
                  const rec = parseP2HRecord(c.resultJson);
                  const v = p2hVerdict(c);
                  const photos = Object.values(rec.details).reduce((n, d) => n + (d.photos?.length ?? 0), 0);
                  const notes = Object.values(rec.details).filter(d => d.note).length;
                  return (
                    <tr key={c.id}>
                      {access.isSuperAdmin && <td className={td}><input type="checkbox" name="ids" value={c.id} aria-label={`Pilih P2H ${c.vehicle.plateNo} ${fmt(c.at)}`} /></td>}
                      <td className={`${td} whitespace-nowrap text-xs`}>{fmt(c.at)}</td>
                      <td className={`${td} whitespace-nowrap`}><Link href={`/modules/logistics/fleet/vehicles/${c.vehicleId}`} className="text-blue-700 hover:underline">{c.vehicle.plateNo}</Link></td>
                      <td className={`${td} whitespace-nowrap`}>{c.trip ? <Link href={`/modules/logistics/trips/${c.trip.id}`} className="text-blue-700 hover:underline">{c.trip.tripNo}</Link> : <span className="text-slate-400">—</span>}</td>
                      <td className={td}>{submittedBy(c, c.driverId ? driverName.get(c.driverId) : null)}<span className="block text-xs text-slate-500">{c.source}</span></td>
                      <td className={td}><span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${v.cls}`}>{v.short}</span></td>
                      <td className={`${td} text-xs`}>{[c.criticalFails, c.otherFails].filter(Boolean).join(", ") || "—"}</td>
                      <td className={`${td} text-xs whitespace-nowrap tabular-nums`}>{rec.odometerKm != null ? `${rec.odometerKm.toLocaleString("id-ID")} km` : "—"}</td>
                      <td className={`${td} text-xs whitespace-nowrap`}>{notes || photos ? `${notes} ket. · ${photos} foto` : "—"}</td>
                      <td className={`${td} whitespace-nowrap`}><Link href={`/modules/logistics/p2h/${c.id}`} className="text-sm font-medium text-blue-700 hover:underline">View</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </form>
          </>
        )}
      </Card>
    </div>
  );
}
