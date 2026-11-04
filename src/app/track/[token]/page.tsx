import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPublicTracking } from "@/app/modules/logistics/tracking";
import { TRIP_STATUSES } from "@/app/modules/logistics/trackingLib";
import PublicMap from "./PublicMap";

export const metadata: Metadata = { title: "Lacak Pengiriman", robots: { index: false, follow: false } };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("id-ID", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");

/** Link tracking untuk klien (rancangan 3.2 / 10.2): publik, tanpa login, token acak per order. */
export default async function PublicTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPublicTracking(token);
  if (!data) notFound();
  const company = await prisma.companyProfile.findUnique({ where: { key: "logistics" }, select: { name: true, tagline: true, phone: true } });
  const { order, trip } = data;
  const late = trip?.etaFirstStop && trip.promisedArrival && trip.etaFirstStop > trip.promisedArrival;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#0B2545] text-white">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <p className="text-xs uppercase tracking-wider text-orange-300 font-semibold">{company?.name ?? "Pengiriman"}</p>
          <p className="text-sm text-white/70">{company?.tagline}</p>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate-500">Nomor order</p>
          <h1 className="text-xl font-bold text-slate-800">{order.orderNo}</h1>
          <p className="text-sm text-slate-600 mt-1">{order.client} · {order.route} · {order.truckType}</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Status</p>
              {trip ? (
                <p className="font-semibold mt-0.5 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: TRIP_STATUSES[trip.status]?.color }} />{trip.statusLabel}</p>
              ) : <p className="font-semibold mt-0.5">{order.status === "Completed" ? "Selesai" : "Menunggu jadwal truk"}</p>}
            </div>
            <div className={`rounded-xl p-3 ${late ? "bg-amber-50" : "bg-slate-50"}`}>
              <p className="text-xs text-slate-500">Perkiraan tiba (titik bongkar 1)</p>
              <p className="font-semibold mt-0.5">{trip?.etaFirstStop ? fmt(trip.etaFirstStop) : trip && trip.stopsDone > 0 ? "Sudah tiba" : "—"}</p>
              {late && <p className="text-xs text-amber-800 mt-0.5">Ada keterlambatan; tim kami akan menghubungi Anda.</p>}
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Truk</p>
              <p className="font-semibold mt-0.5">{trip ? `${trip.plateNo} · Pak ${trip.driverFirstName}` : "—"}</p>
              {trip && <p className="text-xs text-slate-500">Bongkar {trip.stopsDone}/{trip.stopsTotal} titik</p>}
            </div>
          </div>
        </div>

        {trip && trip.lat != null && (
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
            <PublicMap lat={trip.lat} lng={trip.lng!} status={trip.status} plateNo={trip.plateNo} path={trip.path} />
            <p className="text-xs text-slate-500 mt-2 px-1">Posisi terakhir: {fmt(trip.lastPingAt)} · halaman diperbarui otomatis tiap menit.</p>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="font-semibold text-slate-800">Rute</p>
          <ol className="mt-2 space-y-1 text-sm text-slate-700 list-decimal list-inside">
            <li>Muat: {order.origin} · {order.loadDate} {order.loadTime ?? ""}</li>
            {order.stops.map((s, i) => <li key={i}>Bongkar: {s}</li>)}
          </ol>
          {trip && trip.timeline.length > 0 && (
            <>
              <p className="font-semibold text-slate-800 mt-5">Riwayat</p>
              <ol className="mt-2 relative border-l border-slate-200 ml-1.5 space-y-2.5">
                {trip.timeline.map((e, i) => (
                  <li key={i} className="ml-4 text-sm">
                    <span className="absolute -left-1.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: TRIP_STATUSES[e.status]?.color ?? "#64748b" }} />
                    {e.label} <span className="text-xs text-slate-500">· {fmt(e.at)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
        <p className="text-center text-xs text-slate-400">Pertanyaan? Hubungi {company?.name} {company?.phone ? `· ${company.phone}` : ""}</p>
      </main>
    </div>
  );
}
