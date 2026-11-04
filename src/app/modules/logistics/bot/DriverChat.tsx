"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Image as ImageIcon, Loader2, MapPin, MessageCircle, Mic, PlayCircle, Send, Webhook } from "lucide-react";
import { Card, btnPrimary, btnSecondary, inputCls, labelCls } from "../ui";
import { getChatFeed, registerTelegramWebhook, sendDriverMessage, startLiveTrip, type ChatFeedItem } from "./actions";

type Opt = { id: string; label: string };

/** Kartu "Driver chat" di Fleet Tracking: riwayat bot ↔ sopir, kirim pesan, trip live untuk demo, daftar webhook. */
export default function DriverChat({ configured, botUsername, canDispatch, isSuperAdmin, drivers, vehicles, orders, routes }: {
  configured: boolean; botUsername: string | null; canDispatch: boolean; isSuperAdmin: boolean;
  drivers: (Opt & { linked: boolean })[]; vehicles: Opt[]; orders: Opt[]; routes: Opt[];
}) {
  const linked = drivers.filter(d => d.linked);
  const [driverId, setDriverId] = useState<string>(linked[0]?.id ?? "");
  const [items, setItems] = useState<ChatFeedItem[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [showTrip, setShowTrip] = useState(false);
  const [trip, setTrip] = useState({ driverId: linked[0]?.id ?? "", vehicleId: "", orderId: "", routeId: "" });
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await getChatFeed(driverId || null);
    if (r.ok) setItems(r.items);
  }, [driverId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [items]);

  const icon = (k: string) => k === "photo" ? <ImageIcon className="w-3 h-3" /> : k === "voice" ? <Mic className="w-3 h-3" /> : k === "location" ? <MapPin className="w-3 h-3" /> : null;

  return (
    <Card title={<span className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-sky-600" /> Driver chat (Telegram)</span>}
      actions={configured && botUsername ? <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="text-xs text-blue-700 hover:underline">@{botUsername}</a> : null}>
      <div className="space-y-3">
        {!configured ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Bot Telegram belum aktif: isi env <code>TELEGRAM_BOT_TOKEN</code> & <code>TELEGRAM_WEBHOOK_SECRET</code> di Vercel lalu deploy. Fitur lain tetap jalan.</p>
        ) : isSuperAdmin && (
          <button type="button" disabled={busy} className={btnSecondary} onClick={() => start(async () => { setError(null); const r = await registerTelegramWebhook(); if (r.ok) setInfo(`Webhook terdaftar: ${r.url}`); else setError(r.error); })}>
            <Webhook className="w-4 h-4" /> Register webhook
          </button>
        )}

        {canDispatch && (
          <div className="rounded-lg border border-slate-200 p-3">
            <button type="button" onClick={() => setShowTrip(v => !v)} className="text-sm font-semibold text-slate-700 flex items-center gap-2"><PlayCircle className="w-4 h-4 text-blue-600" /> Start live trip (demo bot)</button>
            {showTrip && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label><span className={labelCls}>Sopir</span>
                  <select value={trip.driverId} onChange={e => setTrip({ ...trip, driverId: e.target.value })} className={inputCls}>
                    <option value="">— pilih —</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.label}{d.linked ? " · Telegram ✓" : ""}</option>)}
                  </select></label>
                <label><span className={labelCls}>Truk</span>
                  <select value={trip.vehicleId} onChange={e => setTrip({ ...trip, vehicleId: e.target.value })} className={inputCls}>
                    <option value="">— pilih —</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select></label>
                <label><span className={labelCls}>Order Confirmed</span>
                  <select value={trip.orderId} onChange={e => setTrip({ ...trip, orderId: e.target.value })} className={inputCls}>
                    <option value="">— tanpa order (pilih rute) —</option>{orders.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select></label>
                {!trip.orderId && <label><span className={labelCls}>Rute</span>
                  <select value={trip.routeId} onChange={e => setTrip({ ...trip, routeId: e.target.value })} className={inputCls}>
                    <option value="">— pilih —</option>{routes.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select></label>}
                <div className="sm:col-span-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">Sementara sebelum papan dispatch (Tahap 2). Truk/sopir tidak layak ditolak; unit simulasi diambil alih.</p>
                  <button type="button" disabled={busy || !trip.driverId || !trip.vehicleId || (!trip.orderId && !trip.routeId)} className={btnPrimary}
                    onClick={() => start(async () => { setError(null); const r = await startLiveTrip({ driverId: trip.driverId, vehicleId: trip.vehicleId, orderId: trip.orderId || null, routeId: trip.routeId || null }); if (r.ok) { setInfo(`Trip ${r.tripNo} dibuat${r.notified ? " — sopir dikabari lewat Telegram" : " (sopir belum terhubung Telegram)"}. Unit muncul di peta setelah lokasi pertama masuk.`); setShowTrip(false); } else setError(r.error); })}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />} Start trip
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <label className="block"><span className={labelCls}>Percakapan</span>
          <select value={driverId} onChange={e => setDriverId(e.target.value)} className={inputCls}>
            <option value="">Semua sopir</option>{linked.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select></label>
        <div ref={listRef} className="h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2" aria-live="polite">
          {items.length === 0 ? <p className="text-sm text-slate-500">Belum ada pesan.</p> : items.map(m => (
            <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${m.direction === "out" ? "ml-auto bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-800"}`}>
              <p className={`text-[10px] flex items-center gap-1 ${m.direction === "out" ? "text-blue-100" : "text-slate-500"}`}>
                {icon(m.kind)}{m.direction === "out" ? (m.sentBy ?? "Bot") : m.driverName ?? "Sopir"} · {new Date(m.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}{!driverId && m.direction === "out" && m.driverName ? ` → ${m.driverName}` : ""}
              </p>
              {m.fileUrl && <a href={m.fileUrl} target="_blank" rel="noreferrer" className="underline text-xs">Lihat foto</a>}
              {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
            </div>
          ))}
        </div>
        {canDispatch && configured && (
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (!driverId) { setError("Pilih sopir dulu."); return; } start(async () => { setError(null); const r = await sendDriverMessage(driverId, text); if (r.ok) { setText(""); load(); } else setError(r.error); }); }}>
            <input value={text} onChange={e => setText(e.target.value)} placeholder={driverId ? "Kirim pesan ke sopir…" : "Pilih sopir untuk mengirim pesan"} className={inputCls} maxLength={1000} aria-label="Pesan ke sopir" />
            <button type="submit" disabled={busy || !text.trim()} className={btnPrimary}><Send className="w-4 h-4" /> Send</button>
          </form>
        )}
        {info && <p role="status" className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{info}</p>}
        {error && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Card>
  );
}
