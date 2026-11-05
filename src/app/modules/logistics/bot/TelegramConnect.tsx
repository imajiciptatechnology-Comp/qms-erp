"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Loader2, Send, Unlink } from "lucide-react";
import { btnPrimary, btnSecondary } from "../ui";
import { createTelegramInvite, sendDriverMessage, unlinkTelegram } from "./actions";

/** Hubungkan sopir ke bot Telegram (rancangan 10.3 langkah 1): link undangan sekali pakai. */
export default function TelegramConnect({ driverId, driverName, linked, configured, canManage }: {
  driverId: string; driverName: string; configured: boolean; canManage: boolean;
  linked: { chatName: string | null; chatUsername: string | null; linkedAt: string } | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const invite = () => start(async () => {
    setError(null);
    const r = await createTelegramInvite(driverId);
    if (r.ok) setUrl(r.url); else setError(r.error);
  });

  return (
    <div className="space-y-3 text-sm">
      {linked ? (
        <p className="flex items-center gap-2 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <Send className="w-4 h-4" aria-hidden /> Terhubung sejak {linked.linkedAt.slice(0, 10)} · {linked.chatName ?? ""}{linked.chatUsername ? ` (@${linked.chatUsername})` : ""}
        </p>
      ) : (
        <p className="text-slate-600">{driverName} belum terhubung ke bot Telegram. Sopir tidak perlu login ERP: cukup buka link undangan dari HP-nya.</p>
      )}
      {!configured && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Bot Telegram belum dikonfigurasi di server (env TELEGRAM_BOT_TOKEN & TELEGRAM_WEBHOOK_SECRET).</p>}
      {canManage && configured && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={invite} disabled={pending} className={btnPrimary}>{pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} {linked ? "New invite link" : "Connect Telegram"}</button>
          {linked && (
            <button type="button" disabled={pending} className={btnSecondary} onClick={() => start(async () => { const r = await unlinkTelegram(driverId); if (r.ok) router.refresh(); else setError(r.error); })}>
              <Unlink className="w-4 h-4" /> Disconnect
            </button>
          )}
        </div>
      )}
      {url && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
          <p className="text-xs text-slate-600">Kirim link ini ke HP sopir (WA/SMS). Berlaku 7 hari, sekali pakai:</p>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="font-mono text-xs text-blue-700 break-all hover:underline">{url}</a>
            <button type="button" aria-label="Salin link" className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 shrink-0" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); }}><Copy className="w-3.5 h-3.5" /></button>
            {copied && <span className="text-xs text-emerald-700">Tersalin</span>}
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}

/** Kirim pesan ke chat pribadi sopir (lewat bot Telegram / Driver simulator). */
export function PersonalMessageForm({ driverId }: { driverId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <form className="mt-3 space-y-1.5" onSubmit={e => { e.preventDefault(); start(async () => { setError(null); const r = await sendDriverMessage(driverId, text, true); if (r.ok) { setText(""); router.refresh(); } else setError(r.error); }); }}>
      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} maxLength={1000} placeholder="Pesan pribadi ke sopir…" aria-label="Pesan pribadi ke sopir" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        <button type="submit" disabled={busy || !text.trim()} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60">Send</button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
