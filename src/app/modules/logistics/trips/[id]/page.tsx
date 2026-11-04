import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, CheckCircle2, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../../server";
import { canOverride, evaluateTrip, LEVEL_LABEL, CONTROL_ACTIONS } from "../../dispatchRules";
import { TRIP_STATUSES } from "../../trackingLib";
import { Card, DocLinks, InfoRow } from "../../ui";
import { OverrideForm, TripActions } from "./TripControls";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");

export default async function TripDetail({ params }: { params: Promise<{ id: string }> }) {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const { id } = await params;
  const exists = await prisma.trip.findUnique({ where: { id }, select: { id: true } });
  if (!exists) notFound();
  const ev = await evaluateTrip(id);
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id },
    include: { vehicle: { include: { truckType: true } }, driver: true, helper: true, route: true, client: true, order: { include: { stops: { orderBy: { seq: "asc" } } } }, events: { orderBy: { at: "asc" } }, overrides: { orderBy: { at: "asc" } } },
  });
  const st = TRIP_STATUSES[trip.status];
  const duty = trip.dutyAckJson ? (JSON.parse(trip.dutyAckJson) as { by: string; at: string; warnings: string[] }) : null;
  const preDeparture = trip.status === "Scheduled";

  return (
    <div className="space-y-6">
      <Link href="/modules/logistics/trips" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> Trips</Link>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800">{trip.tripNo}</h2>
          <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${st?.badge ?? ""}`}>{st?.label ?? trip.status}</span>
          {trip.suratJalanNo ? <span className="text-xs px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">Surat Jalan {trip.suratJalanNo}</span>
            : <span className="text-xs px-2.5 py-1 rounded-full border bg-amber-50 text-amber-800 border-amber-200">Surat Jalan belum terbit</span>}
          {trip.isSimulated && <span className="text-xs text-slate-500">(simulasi)</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {trip.suratJalanNo && <DocLinks kind="surat-jalan" id={trip.id} label="Surat Jalan" />}
          {!trip.isSimulated && <TripActions tripId={trip.id} canIssue={access.canDispatch && preDeparture && !trip.suratJalanNo && ev.blocked.length === 0 && ev.pending.length === 0} canCancel={access.canDispatch && preDeparture} />}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title={<span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-600" /> Dispatch check (rancangan 3.5)</span>}
            actions={<span className="text-xs text-slate-500">Override berlaku untuk trip ini saja</span>}>
            {ev.items.length === 0 ? <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Tidak ada kondisi blokir.</p> : (
              <ul className="space-y-3">
                {ev.items.map(c => (
                  <li key={c.key} className={`rounded-lg border p-3 ${c.level === "none" ? "border-red-200 bg-red-50/50" : c.override ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/50"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                        {c.level === "none" ? <Ban className="w-4 h-4 text-red-600" /> : c.override ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-amber-600" />}
                        #{c.code} {c.text}
                      </p>
                      <span className="text-xs text-slate-600">{LEVEL_LABEL[c.level]}</span>
                    </div>
                    {c.override ? (
                      <div className="mt-2 text-xs text-slate-700 space-y-0.5">
                        <p>Di-override oleh <b>{c.override.byName}</b> ({c.override.byRole}) · {fmt(c.override.at)}</p>
                        <p>Alasan: {c.override.reason}</p>
                        <p>Tindakan pengendalian: {c.override.controlAction}</p>
                        {c.override.evidenceUrl && <a href={c.override.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline"><FileText className="w-3 h-3" /> Bukti: {c.override.evidenceName ?? "lihat"}</a>}
                      </div>
                    ) : c.level !== "none" && preDeparture && (
                      canOverride(c.level, access)
                        ? <OverrideForm tripId={trip.id} condKey={c.key} needsEvidence={!!c.needsEvidence} actions={CONTROL_ACTIONS} />
                        : <p className="mt-1 text-xs text-slate-500">Menunggu {LEVEL_LABEL[c.level]} (role Anda: tidak berwenang).</p>
                    )}
                    {c.level === "none" && <p className="mt-1 text-xs text-red-700">Tidak bisa di-override (keselamatan/hukum). Ganti truk/sopir: batalkan trip ini lalu dispatch ulang.</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Timeline">
            <ol className="relative border-l border-slate-200 ml-2 space-y-2.5">
              {trip.events.map(e => (
                <li key={e.id} className="ml-4 text-sm">
                  <span className="absolute -left-1.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: TRIP_STATUSES[e.status]?.color ?? "#94a3b8" }} />
                  {e.label} <span className="text-xs text-slate-500">· {fmt(e.at)} · {e.source}{e.by ? ` · ${e.by}` : ""}</span>
                  {e.note && !e.note.startsWith("http") && <span className="block text-xs text-slate-500">{e.note}</span>}
                  {e.note?.startsWith("http") && <a href={e.note} target="_blank" rel="noreferrer" className="block text-xs text-blue-700 hover:underline">Lihat foto</a>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Trip">
            <InfoRow label="Order">{trip.order ? <Link href={`/modules/logistics/orders/${trip.order.id}`} className="text-blue-700 hover:underline">{trip.order.orderNo}</Link> : "—"}</InfoRow>
            <InfoRow label="Klien">{trip.client?.name ?? "—"}</InfoRow>
            <InfoRow label="Rute">{trip.route ? `${trip.route.origin} → ${trip.route.destination}` : "—"}</InfoRow>
            <InfoRow label="Truk"><Link href={`/modules/logistics/fleet/vehicles/${trip.vehicleId}`} className="text-blue-700 hover:underline">{trip.vehicle.plateNo}</Link> · {trip.vehicle.truckType.name}</InfoRow>
            <InfoRow label="Sopir"><Link href={`/modules/logistics/fleet/drivers/${trip.driverId}`} className="text-blue-700 hover:underline">{trip.driver.name}</Link> · {trip.driver.phone}</InfoRow>
            <InfoRow label="Kenek">{trip.helper?.name ?? "—"}</InfoRow>
            <InfoRow label="Jadwal berangkat">{fmt(trip.plannedStart)}</InfoRow>
            <InfoRow label="Janji tiba ke klien">{fmt(trip.promisedArrival)}</InfoRow>
            <InfoRow label="P2H">{trip.p2hDoneAt ? `Lolos · ${fmt(trip.p2hDoneAt)}` : "Belum / gagal"}</InfoRow>
            {trip.order && <InfoRow label="Bongkar">{trip.order.stops.map(s => s.name).join(" → ")}</InfoRow>}
          </Card>
          {duty && (
            <Card title="Duty-hour warnings (1.3b)">
              <ul className="text-sm text-amber-900 list-disc ml-4 space-y-1">{duty.warnings.map(w => <li key={w}>{w}</li>)}</ul>
              <p className="text-xs text-slate-500 mt-2">Dibaca & disetujui oleh {duty.by} · {fmt(duty.at)}</p>
            </Card>
          )}
          <Card title="Tracking">
            <Link href="/modules/logistics/tracking" className="text-sm text-blue-700 hover:underline">Buka Fleet Tracking</Link>
            {trip.order && <p className="text-xs text-slate-500 mt-1">Link klien: <a href={`/track/${trip.order.trackingToken}`} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">/track/…</a></p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
