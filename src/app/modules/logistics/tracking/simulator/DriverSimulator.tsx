"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Camera, Loader2, MapPin, PlayCircle, RotateCcw, Send, Smartphone } from "lucide-react";
import { compressImage } from "@/components/ScanDocumentButton";
import { Card, btnPrimary, btnSecondary, inputCls, labelCls } from "../../ui";
import { TRIP_STATUSES } from "../../trackingLib";
import type { DeployedUnit } from "../../tracking";
import { fetchFleetSnapshot } from "../actions";
import { startLiveTrip } from "../../bot/actions";
import { simConnect, simFeed, simLiveTick, simReset, simSend, type SimInput, type SimMessage } from "../../bot/simActions";

const FleetMap = dynamic(() => import("../FleetMap"), { ssr: false, loading: () => <div className="h-[420px] rounded-lg bg-slate-50 animate-pulse" /> });

type Opt = { id: string; label: string };
const hm = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/** Layar "HP sopir" tiruan: chat bot yang sama dengan Telegram, berdampingan dengan peta Fleet Tracking. */
export default function DriverSimulator({ drivers, vehicles, orders, routes }: { drivers: Opt[]; vehicles: Opt[]; orders: Opt[]; routes: Opt[] }) {
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? "");
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [unit, setUnit] = useState<DeployedUnit | null>(null);
  const [text, setText] = useState("");
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [trip, setTrip] = useState({ vehicleId: "", orderId: "", routeId: "" });
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!driverId) return;
    const [f, s] = await Promise.all([simFeed(driverId), fetchFleetSnapshot()]);
    if (f.ok) setMessages(f.messages);
    if (s.ok) setUnit(s.snapshot.units.find(u => u.driverId === driverId && !u.isSimulated) ?? null);
  }, [driverId]);

  useEffect(() => {
    if (driverId) simConnect(driverId);
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 4000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [refresh]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages.length]);

  // Lokasi live: kirim posisi berikutnya tiap 5 detik selama aktif.
  useEffect(() => {
    if (!live || !driverId) return;
    const t = setInterval(async () => { const r = await simLiveTick(driverId); if (!r.ok) setError(r.error); }, 5000);
    return () => clearInterval(t);
  }, [live, driverId]);

  const send = (input: SimInput) => start(async () => {
    setError(null);
    const r = await simSend(driverId, input);
    if (!r.ok) setError(r.error);
    await refresh();
  });

  // Tombol hanya aktif di pesan bot terakhir yang punya tombol (seperti status trip terkini).
  const lastButtons = [...messages].reverse().find(m => m.direction === "out" && m.buttons.length > 0)?.id;
  const mapUnits = unit && unit.lat != null ? [{ id: unit.id, plateNo: unit.plateNo, status: unit.status, lat: unit.lat, lng: unit.lng, path: unit.path, popupHtml: unit.plateNo }] : [];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
          <div>
            <Link href="/modules/logistics/tracking" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> Fleet Tracking</Link>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mt-1"><Smartphone className="w-5 h-5 text-sky-600" /> Driver simulator</h2>
            <p className="text-sm text-slate-500">Demo tanpa HP: layar kiri = chat bot sopir (logika sama dengan Telegram), kanan = yang dilihat kantor. Data tercatat sungguhan di trip.</p>
          </div>
          <label className="block min-w-64"><span className={labelCls}>Sopir</span>
            <select value={driverId} onChange={e => { setDriverId(e.target.value); setLive(false); setMessages([]); setUnit(null); }} className={inputCls}>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select></label>
        </div>
      </Card>

      {!unit && (
        <Card title="1. Assign a trip to this driver">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
            <label><span className={labelCls}>Truk</span>
              <select value={trip.vehicleId} onChange={e => setTrip({ ...trip, vehicleId: e.target.value })} className={inputCls}><option value="">— pilih —</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
            <label><span className={labelCls}>Order Confirmed</span>
              <select value={trip.orderId} onChange={e => setTrip({ ...trip, orderId: e.target.value })} className={inputCls}><option value="">— tanpa order —</option>{orders.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
            {!trip.orderId ? <label><span className={labelCls}>Rute</span>
              <select value={trip.routeId} onChange={e => setTrip({ ...trip, routeId: e.target.value })} className={inputCls}><option value="">— pilih —</option>{routes.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label> : <div />}
            <button type="button" disabled={busy || !trip.vehicleId || (!trip.orderId && !trip.routeId)} className={btnPrimary}
              onClick={() => start(async () => { setError(null); const r = await startLiveTrip({ driverId, vehicleId: trip.vehicleId, orderId: trip.orderId || null, routeId: trip.routeId || null }); if (!r.ok) setError(r.error); await refresh(); })}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />} Assign trip
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Jenis truk harus sesuai order; truk/sopir tidak layak ditolak (aturan 3.5). Sopir menerima pesan &quot;Tugas baru&quot; di chat kiri.</p>
        </Card>
      )}
      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 items-start">
        {/* HP sopir */}
        <div className="mx-auto w-full max-w-[380px] rounded-[2rem] border-8 border-slate-800 bg-slate-800 shadow-xl overflow-hidden">
          <div className="bg-[#517da2] text-white px-4 py-3 flex items-center justify-between">
            <div><p className="font-semibold text-sm">Arunika Trans Bot</p><p className="text-[11px] text-white/80">{live ? "📍 berbagi lokasi live" : "bot"}</p></div>
            <button type="button" title="Mulai ulang percakapan" aria-label="Mulai ulang percakapan" onClick={() => start(async () => { await simReset(driverId); setLive(false); await refresh(); })} className="p-1 rounded hover:bg-white/10"><RotateCcw className="w-4 h-4" /></button>
          </div>
          <div ref={listRef} className="h-[460px] overflow-y-auto bg-[#e6ebee] p-3 space-y-2">
            {messages.length === 0 && <p className="text-center text-xs text-slate-500 mt-10">Tekan ❓ Bantuan atau 📋 Tugas saya untuk mulai.</p>}
            {messages.map(m => (
              <div key={m.id} className={m.direction === "out" ? "max-w-[88%]" : "max-w-[88%] ml-auto"}>
                <div className={`rounded-xl px-3 py-2 text-[13px] shadow-sm ${m.direction === "out" ? "bg-white text-slate-800" : "bg-[#effdde] text-slate-800"}`}>
                  {m.fileUrl && <a href={m.fileUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-700 underline mb-1">📷 foto</a>}
                  {m.kind === "location" && <span className="text-xs text-slate-500">📍 </span>}
                  <span className="whitespace-pre-wrap">{m.text}</span>
                  <span className="block text-right text-[10px] text-slate-400 mt-0.5">{hm(m.at)}</span>
                </div>
                {m.buttons.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {m.buttons.flat().map(b => (
                      <button key={b.callback_data ?? b.text} type="button" disabled={busy || m.id !== lastButtons && !b.callback_data?.startsWith("task")}
                        onClick={() => b.callback_data && send({ type: "button", data: b.callback_data })}
                        className="w-full rounded-lg bg-white/80 hover:bg-white text-[#3a6d99] text-[13px] font-medium py-1.5 disabled:opacity-40">{b.text}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <p className="text-xs text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> bot sedang memproses…</p>}
          </div>
          <div className="bg-white p-2 space-y-2">
            <form className="flex gap-1.5" onSubmit={e => { e.preventDefault(); if (text.trim()) { send({ type: "text", text }); setText(""); } }}>
              <button type="button" aria-label="Kirim foto" onClick={() => fileRef.current?.click()} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><Camera className="w-5 h-5" /></button>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Pesan (mis. ban bocor di tol km 120)" aria-label="Pesan sopir" className="flex-1 px-3 py-2 rounded-lg bg-slate-100 text-sm outline-none" />
              <button type="submit" aria-label="Kirim" disabled={busy || !text.trim()} className="p-2 rounded-lg text-[#517da2] hover:bg-slate-100 disabled:opacity-40"><Send className="w-5 h-5" /></button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { send({ type: "photo", dataUrl: await compressImage(f) }); } catch { setError("Gagal membaca foto."); } }} />
            </form>
            <div className="grid grid-cols-2 gap-1.5 text-[13px]">
              {["📋 Tugas saya", "✅ P2H"].map(t => <button key={t} type="button" disabled={busy} onClick={() => send({ type: "text", text: t })} className="rounded-md bg-slate-100 hover:bg-slate-200 py-2">{t}</button>)}
              <button type="button" disabled={busy} onClick={() => { if (!live) send({ type: "location" }); setLive(v => !v); }} className={`rounded-md py-2 flex items-center justify-center gap-1 ${live ? "bg-emerald-600 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>
                <MapPin className="w-3.5 h-3.5" /> {live ? "Stop lokasi live" : "Bagikan lokasi live"}
              </button>
              <button type="button" disabled={busy} onClick={() => send({ type: "text", text: "❓ Bantuan" })} className="rounded-md bg-slate-100 hover:bg-slate-200 py-2">❓ Bantuan</button>
            </div>
          </div>
        </div>

        {/* Sisi kantor */}
        <div className="space-y-6">
          <Card title={unit ? `${unit.plateNo} · ${unit.tripNo}` : "Office view"} actions={<Link href="/modules/logistics/tracking" target="_blank" className={btnSecondary}>Open Fleet Tracking</Link>}>
            {unit ? (
              <>
                <div className="flex flex-wrap gap-3 text-sm mb-3">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: TRIP_STATUSES[unit.status]?.color }} />{unit.statusLabel}</span>
                  <span className="text-slate-500">Bongkar {unit.stopsDone}/{unit.stopsTotal}</span>
                  {unit.speedKmh ? <span className="text-slate-500">{unit.speedKmh} km/j</span> : null}
                  {unit.etaFirstStop && <span className="text-slate-500">ETA {hm(unit.etaFirstStop)}{unit.promisedArrival ? ` (janji ${hm(unit.promisedArrival)})` : ""}</span>}
                  {unit.alerts.map(a => <span key={a.code} className={`text-xs px-2 py-0.5 rounded-full border ${a.level === "red" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>{a.text}</span>)}
                </div>
                {mapUnits.length ? <FleetMap units={mapUnits} height={420} fitKey={unit.id} /> : <p className="text-sm text-slate-500 rounded-lg bg-slate-50 p-6 text-center">Belum ada lokasi. Tekan &quot;Bagikan lokasi live&quot; di HP sopir.</p>}
              </>
            ) : <p className="text-sm text-slate-500">Sopir ini belum punya trip aktif. Assign trip di atas.</p>}
          </Card>
          {unit && (
            <Card title="Trip timeline">
              <ol className="relative border-l border-slate-200 ml-2 space-y-2.5">
                {unit.timeline.map((e, i) => (
                  <li key={i} className="ml-4 text-sm">
                    <span className="absolute -left-1.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: TRIP_STATUSES[e.status]?.color ?? "#94a3b8" }} />
                    {e.label} <span className="text-xs text-slate-500">· {hm(e.at)} · {e.source}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
