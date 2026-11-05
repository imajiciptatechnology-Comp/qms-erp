"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Copy, Loader2, MapPin, Play, RefreshCw, Smartphone, Sparkles, Square, Truck, Wrench, X } from "lucide-react";
import { Card, StatCard, btnPrimary, btnSecondary } from "../ui";
import { TRIP_STATUSES, gmapsPoint } from "../trackingLib";
import type { DeployedUnit, FleetSnapshot } from "../tracking";
import type { MapUnit } from "./FleetMap";
import { aiFleetSummary, fetchFleetSnapshot, runSimulation, stopSimulation } from "./actions";

const FleetMap = dynamic(() => import("./FleetMap"), { ssr: false, loading: () => <div className="h-[460px] rounded-lg border border-slate-200 bg-slate-50 animate-pulse" /> });

const REFRESH_MS = 30_000;
const hm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");
const ago = (iso: string | null, now: number) => {
  if (!iso) return "—";
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  return m <= 0 ? "baru saja" : m < 60 ? `${m} menit lalu` : `${Math.floor(m / 60)} j ${m % 60} m lalu`;
};
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function StatusPill({ status }: { status: string }) {
  const s = TRIP_STATUSES[status];
  return <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${s?.badge ?? "bg-slate-100 border-slate-200"}`}><span className="w-2 h-2 rounded-full" style={{ background: s?.color }} aria-hidden />{s?.label ?? status}</span>;
}

const IDLE_STYLE: Record<string, { label: string; cls: string }> = {
  ready: { label: "Siap di pool", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  attention: { label: "Perhatian", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  repair: { label: "Perbaikan", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  unfit: { label: "Tidak layak", cls: "bg-red-50 text-red-700 border-red-200" },
};

export default function FleetTracking({ initial, canSimulate, chatSlot }: { initial: FleetSnapshot; canSimulate: boolean; chatSlot?: React.ReactNode }) {
  const [snap, setSnap] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [simBusy, startSim] = useTransition();
  const [speed, setSpeed] = useState(initial.simulation.speed ?? 30);
  const [summary, setSummary] = useState<{ text: string; model: string } | null>(null);
  const [summaryBusy, startSummary] = useTransition();
  const [now, setNow] = useState(() => Date.parse(initial.at));

  const refresh = useCallback(() => startRefresh(async () => {
    const res = await fetchFleetSnapshot();
    if (res.ok) { setSnap(res.snapshot); setError(null); setNow(Date.parse(res.snapshot.at)); } else setError(res.error);
  }), []);

  useEffect(() => {
    // Simulasi lebih cepat dari jam nyata → refresh lebih sering supaya pergerakan terlihat.
    const ms = snap.simulation.running && (snap.simulation.speed ?? 1) >= 30 ? 10_000 : REFRESH_MS;
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, ms);
    return () => clearInterval(t);
  }, [refresh, snap.simulation.running, snap.simulation.speed]);

  const units = snap.units;
  const alerts = useMemo(() => units.flatMap(u => u.alerts.map(a => ({ ...a, unit: u }))).sort((a, b) => (a.level === b.level ? 0 : a.level === "red" ? -1 : 1)), [units]);
  const atRisk = units.filter(u => u.alerts.some(a => a.level === "red")).length;
  const sel = units.find(u => u.id === selected) ?? null;

  const mapUnits: MapUnit[] = units.map(u => ({
    id: u.id, plateNo: u.plateNo, status: u.status, lat: u.lat, lng: u.lng, path: u.path,
    stale: u.alerts.some(a => a.code === "no_ping"), alert: u.alerts.some(a => a.level === "red"),
    popupHtml: `<b>${esc(u.plateNo)}</b> · ${esc(u.truckType)}<br/>${esc(u.statusLabel)}<br/>Sopir: ${esc(u.driverName)}${u.helperName ? ` + ${esc(u.helperName)}` : ""}<br/>${esc(u.clientName ?? "")}${u.orderNo ? ` · ${esc(u.orderNo)}` : ""}<br/>${esc(u.routeLabel)}<br/>ETA bongkar: ${hm(u.etaFirstStop)}${u.promisedArrival ? ` (janji ${hm(u.promisedArrival)})` : ""}`,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Fleet Tracking</h2>
            <p className="text-sm text-slate-500">Diperbarui {hm(snap.at)} · otomatis tiap {snap.simulation.running && (snap.simulation.speed ?? 1) >= 30 ? "10" : "30"} detik{snap.simulation.running ? ` · simulasi ${snap.simulation.speed}× lebih cepat` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={refresh} disabled={refreshing} className={btnSecondary}>{refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh</button>
            <button type="button" disabled={summaryBusy} onClick={() => startSummary(async () => { const r = await aiFleetSummary(); if (r.ok) setSummary({ text: r.text, model: r.model }); else setError(r.error); })} className={btnSecondary}>
              {summaryBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-indigo-600" />} AI fleet summary
            </button>
            {canSimulate && <Link href="/modules/logistics/tracking/simulator" className={btnSecondary}><Smartphone className="w-4 h-4 text-sky-600" /> Driver simulator</Link>}
            {canSimulate && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                <label className="text-xs text-slate-600 flex items-center gap-1">Speed
                  <select value={speed} onChange={e => setSpeed(Number(e.target.value))} className="text-xs border border-slate-200 rounded px-1 py-1 bg-white">
                    {[1, 10, 30, 60].map(s => <option key={s} value={s}>{s}×</option>)}
                  </select>
                </label>
                <button type="button" disabled={simBusy} className={btnPrimary} onClick={() => startSim(async () => { const r = await runSimulation(speed); if (r.ok) { setSnap(r.snapshot); setNow(Date.parse(r.snapshot.at)); setError(null); } else setError(r.error); })}>
                  {simBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {snap.simulation.running ? "Restart simulation" : "Run simulation"}
                </button>
                {snap.simulation.running && (
                  <button type="button" disabled={simBusy} className={btnSecondary} onClick={() => startSim(async () => { const r = await stopSimulation(); if (r.ok) { setSnap(r.snapshot); setSelected(null); } else setError(r.error); })}><Square className="w-4 h-4" /> Stop</button>
                )}
              </div>
            )}
          </div>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      </Card>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Units deployed" value={units.length} sub={`${units.filter(u => u.isSimulated).length} simulasi · ${units.filter(u => !u.isSimulated).length} nyata`} icon={<Truck className="w-6 h-6" />} tone="blue" />
        <StatCard label="At risk" value={atRisk} sub="telat / lokasi hilang" icon={<AlertTriangle className="w-6 h-6" />} tone={atRisk ? "red" : "emerald"} />
        <StatCard label="Alerts" value={alerts.length} sub="peringatan berbasis aturan" icon={<MapPin className="w-6 h-6" />} tone={alerts.length ? "amber" : "slate"} />
        <StatCard label="Not running" value={snap.idle.length} sub={`${snap.idle.filter(i => i.state === "ready").length} siap di pool`} icon={<Wrench className="w-6 h-6" />} tone="slate" />
      </div>

      {summary && (
        <Card title={<span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-600" /> AI fleet summary</span>}
          actions={<div className="flex gap-2"><button type="button" className={btnSecondary} onClick={() => navigator.clipboard?.writeText(summary.text)}><Copy className="w-4 h-4" /> Copy</button><button type="button" aria-label="Tutup ringkasan" className={btnSecondary} onClick={() => setSummary(null)}><X className="w-4 h-4" /></button></div>}>
          <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">{summary.text}</p>
          <p className="text-xs text-slate-400 mt-3">Disusun AI ({summary.model}) dari data di layar ini — periksa sebelum mengirim pesan ke klien.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2" title="Map" actions={<span className="text-xs text-slate-500 hidden sm:inline">Titik abu-abu = lokasi tidak update · garis putus = rencana rute</span>}>
          <FleetMap units={mapUnits} selectedId={selected} onSelect={setSelected} />
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-600">
            {["ToLoad", "Loading", "InTransit", "Unloading", "Returning", "Scheduled"].map(s => <span key={s} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: TRIP_STATUSES[s].color }} />{TRIP_STATUSES[s].label}</span>)}
          </div>
        </Card>
        <Card title={`Alerts (${alerts.length})`}>
          {alerts.length === 0 ? <p className="text-sm text-slate-500">Tidak ada peringatan.</p> : (
            <ul className="space-y-2 max-h-[520px] overflow-y-auto -mr-2 pr-2">
              {alerts.map((a, i) => (
                <li key={`${a.unit.id}-${a.code}-${i}`}>
                  <button type="button" onClick={() => setSelected(a.unit.id)} className={`w-full text-left rounded-lg border px-3 py-2 text-sm hover:shadow-sm ${a.level === "red" ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
                    <span className="font-semibold">{a.unit.plateNo}</span> · {a.text}
                    <span className="block text-xs opacity-80">{a.unit.driverName} · {a.unit.routeLabel}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-400 mt-3">Aturan: lokasi tidak update &gt; 30 mnt · diam &gt; 45 mnt di luar muat/bongkar · ETA lewat janji · belum P2H saat jadwal lewat · jam mengemudi &gt; 10 jam. Trip simulasi memakai waktu simulasi.</p>
        </Card>
      </div>

      <Card title={`Deployed units (${units.length})`}>
        {units.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada unit yang jalan.{canSimulate ? " Tekan Run simulation untuk menggerakkan truk dummy di peta." : ""}</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 bg-slate-50">
                <tr>{["Nopol", "Sopir · kenek", "Klien · rute", "Status", "Lokasi terakhir", "ETA vs janji", "Titik bongkar", "Peringatan"].map(h => <th key={h} className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map(u => <UnitRow key={u.id} u={u} now={now} selected={u.id === selected} onSelect={() => setSelected(u.id === selected ? null : u.id)} />)}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {sel && (
        <Card title={`Timeline ${sel.plateNo} · ${sel.tripNo}`} actions={<button type="button" aria-label="Tutup timeline" onClick={() => setSelected(null)} className={btnSecondary}><X className="w-4 h-4" /></button>}>
          <ol className="relative border-l border-slate-200 ml-2 space-y-3">
            {sel.timeline.map((e, i) => (
              <li key={i} className="ml-4">
                <span className="absolute -left-1.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: TRIP_STATUSES[e.status]?.color ?? "#64748b" }} />
                <p className="text-sm text-slate-800">{e.label}</p>
                <p className="text-xs text-slate-500">{new Date(e.at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {e.source}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title={`Units not running (${snap.idle.length})`}>
          <ul className="divide-y divide-slate-100 -my-2">
            {snap.idle.map(i => (
              <li key={i.id} className="py-2.5 flex flex-wrap items-start gap-2 justify-between">
                <div>
                  <Link href={`/modules/logistics/fleet/vehicles/${i.id}`} className="font-medium text-blue-700 hover:underline">{i.plateNo}</Link>
                  <span className="text-xs text-slate-500 ml-2">{i.truckType}</span>
                  {i.reasons.length > 0 && <p className="text-xs text-slate-600 mt-0.5">{i.reasons.join(" · ")}</p>}
                  {i.note && <p className="text-xs text-slate-500 mt-0.5">{i.note}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${IDLE_STYLE[i.state].cls}`}>{IDLE_STYLE[i.state].label}</span>
              </li>
            ))}
          </ul>
        </Card>
        {chatSlot}
      </div>
    </div>
  );
}

function UnitRow({ u, now, selected, onSelect }: { u: DeployedUnit; now: number; selected: boolean; onSelect: () => void }) {
  const late = u.alerts.some(a => a.code === "late");
  return (
    <tr className={`cursor-pointer ${selected ? "bg-blue-50/60" : "hover:bg-slate-50"}`} onClick={onSelect}>
      <td className="px-4 py-2.5 align-top whitespace-nowrap">
        <span className="font-semibold text-slate-800">{u.plateNo}</span>
        <span className="block text-xs text-slate-500">{u.truckType}</span>
        {u.isSimulated && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">simulasi</span>}
      </td>
      <td className="px-4 py-2.5 align-top whitespace-nowrap">{u.driverName}{u.helperName && <span className="block text-xs text-slate-500">+ {u.helperName}</span>}</td>
      <td className="px-4 py-2.5 align-top">
        <span className="block whitespace-nowrap">{u.clientName ?? "—"}</span>
        <span className="block text-xs text-slate-500 whitespace-nowrap">{u.routeLabel}</span>
        {u.orderId && <Link href={`/modules/logistics/orders/${u.orderId}`} onClick={e => e.stopPropagation()} className="text-xs text-blue-700 hover:underline">{u.orderNo}</Link>}
      </td>
      <td className="px-4 py-2.5 align-top"><StatusPill status={u.status} /><span className="block text-xs text-slate-500 mt-1">sejak {hm(u.statusSince)}</span></td>
      <td className="px-4 py-2.5 align-top whitespace-nowrap text-xs">{ago(u.lastPingAt, now)}{u.speedKmh ? <span className="block text-slate-500">{u.speedKmh} km/j</span> : null}
        {u.lat != null && u.lng != null && <a href={gmapsPoint(u.lat, u.lng)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="block text-blue-700 hover:underline">Google Maps ↗</a>}</td>
      <td className="px-4 py-2.5 align-top whitespace-nowrap text-xs">
        {u.etaFirstStop ? <span className={late ? "text-red-700 font-semibold" : "text-slate-800"}>ETA {hm(u.etaFirstStop)}</span> : <span className="text-slate-500">sudah tiba</span>}
        {u.promisedArrival && <span className="block text-slate-500">janji {hm(u.promisedArrival)}</span>}
        {u.etaEnd && <span className="block text-slate-500">kembali ±{hm(u.etaEnd)}</span>}
      </td>
      <td className="px-4 py-2.5 align-top whitespace-nowrap text-xs">{u.stopsDone}/{u.stopsTotal} selesai<span className="block text-slate-500">sisa {Math.max(0, u.stopsTotal - u.stopsDone)}</span></td>
      <td className="px-4 py-2.5 align-top">
        {u.alerts.length === 0 ? <span className="text-xs text-emerald-700">Aman</span> : (
          <span className="flex flex-col gap-1">{u.alerts.map(a => <span key={a.code} className={`text-xs px-2 py-0.5 rounded-full border w-fit ${a.level === "red" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>{a.text}</span>)}</span>
        )}
      </td>
    </tr>
  );
}
