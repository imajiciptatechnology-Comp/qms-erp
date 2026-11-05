"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, FileCheck2, Loader2, MapPin, Share2, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { ErrorNote, btnDanger, btnPrimary, btnSecondary, inputCls, useAction } from "../../ui";
import { cancelTrip, deleteP2H, deleteTrip, handOverSj, issueSj, overrideCondition } from "../../dispatch/actions";

export function TripActions({ tripId, tripNo, canIssue, canCancel, canDelete }: { tripId: string; tripNo: string; canIssue: boolean; canCancel: boolean; canDelete: boolean }) {
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const [mode, setMode] = useState<"cancel" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const done = (what: "cancelled" | "deleted") => () => { setMode(null); router.push(`/modules/logistics/trips?${what}=${encodeURIComponent(tripNo)}`); };
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {canIssue && <button type="button" disabled={pending} onClick={() => exec(() => issueSj(tripId))} className={btnPrimary}>{pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />} Issue Surat Jalan</button>}
        {canCancel && mode !== "cancel" && <button type="button" onClick={() => { setMode("cancel"); setReason(""); }} className={btnDanger}><XCircle className="w-4 h-4" /> Cancel trip</button>}
        {canDelete && mode !== "delete" && <button type="button" onClick={() => { setMode("delete"); setReason(""); }} className={btnSecondary}><Trash2 className="w-4 h-4" /> Delete trip</button>}
      </div>
      {mode && (
        <div className="w-full max-w-md space-y-1.5">
          <p className="text-xs text-slate-600">{mode === "cancel" ? "Trip dibatalkan, order kembali ke antrean dispatch, sopir dikabari." : "Trip dihapus permanen beserta timeline & P2H-nya. Direktur Operasional diberi tahu."}</p>
          <div className="flex gap-2">
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder={mode === "cancel" ? "Alasan pembatalan" : "Alasan penghapusan"} aria-label={mode === "cancel" ? "Alasan pembatalan" : "Alasan penghapusan"} className={inputCls} autoFocus />
            <button type="button" disabled={pending || reason.trim().length < (mode === "delete" ? 5 : 1)}
              onClick={() => exec(() => (mode === "cancel" ? cancelTrip(tripId, reason) : deleteTrip(tripId, reason)), done(mode === "cancel" ? "cancelled" : "deleted"))} className={btnDanger}>
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirm
            </button>
            <button type="button" disabled={pending} onClick={() => setMode(null)} className={btnSecondary}>Back</button>
          </div>
        </div>
      )}
      <ErrorNote error={error} />
    </div>
  );
}

/** Serah terima Surat Jalan di kantor: sopir tanda tangan & ambil SJ, dokumen order, uang jalan, segel. */
export function SjHandoverForm({ tripId, suratJalanNo, driverName }: { tripId: string; suratJalanNo: string; driverName: string }) {
  const { pending, error, exec } = useAction();
  return (
    <form className="space-y-2.5" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); fd.set("tripId", tripId); exec(() => handOverSj(fd)); }}>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="signed" required className="mt-0.5" /> <span>Surat Jalan <b>{suratJalanNo}</b> sudah dicetak, ditandatangani <b>{driverName}</b>, dan diserahkan</span></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="orderDocs" className="mt-0.5" /> <span>Dokumen order klien (DO/PO) ikut diserahkan</span></label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-xs text-slate-500">Uang jalan (Rp, opsional)<input name="allowance" inputMode="numeric" placeholder="mis. 1.500.000" className={`${inputCls} mt-0.5`} /></label>
        <label className="text-xs text-slate-500">Nomor segel (opsional)<input name="sealNo" maxLength={40} className={`${inputCls} mt-0.5`} /></label>
      </div>
      <label className="block text-xs text-slate-500">Catatan<input name="notes" maxLength={300} className={`${inputCls} mt-0.5`} /></label>
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />} Record handover &amp; allow departure</button>
      <ErrorNote error={error} />
    </form>
  );
}

/** Bagikan posisi truk: salin teks atau kirim lewat WhatsApp (Google Maps + link tracking klien). */
export function ShareLocation({ plateNo, tripNo, mapsUrl, at, trackingPath }: { plateNo: string; tripNo: string; mapsUrl: string; at: string; trackingPath: string | null }) {
  const [copied, setCopied] = useState(false);
  const text = () => [
    `Posisi truk ${plateNo} (${tripNo}) — ${at} WIB:`,
    mapsUrl,
    trackingPath ? `Lacak live: ${window.location.origin}${trackingPath}` : "",
  ].filter(Boolean).join("\n");
  return (
    <div className="flex flex-wrap gap-2">
      <a href={mapsUrl} target="_blank" rel="noreferrer" className={btnSecondary}><MapPin className="w-4 h-4" /> Google Maps</a>
      <button type="button" className={btnSecondary} onClick={async () => { try { await navigator.clipboard.writeText(text()); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("Salin teks ini:", text()); } }}>
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copied" : "Copy location"}
      </button>
      <button type="button" className={btnSecondary} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text())}`, "_blank", "noopener")}><Share2 className="w-4 h-4" /> WhatsApp</button>
    </div>
  );
}

/** Hapus satu catatan P2H (alasan wajib) lalu kembali ke daftar P2H. */
export function DeleteP2HButton({ id }: { id: string }) {
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={btnSecondary}><Trash2 className="w-4 h-4" /> Delete P2H record</button>;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-slate-600">Catatan P2H dihapus permanen (foto ikut terhapus). Status P2H trip dihitung ulang dari P2H lain. Direktur Operasional diberi tahu.</p>
      <div className="flex gap-2">
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Alasan penghapusan" aria-label="Alasan penghapusan" className={inputCls} autoFocus />
        <button type="button" disabled={pending || reason.trim().length < 5} onClick={() => exec(() => deleteP2H(id, reason), () => router.push("/modules/logistics/p2h?deleted=1"))} className={btnDanger}>{pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirm</button>
        <button type="button" disabled={pending} onClick={() => setOpen(false)} className={btnSecondary}>Back</button>
      </div>
      <ErrorNote error={error} />
    </div>
  );
}

export function OverrideForm({ tripId, condKey, needsEvidence, actions }: { tripId: string; condKey: string; needsEvidence: boolean; actions: string[] }) {
  const [open, setOpen] = useState(false);
  const { pending, error, exec } = useAction();
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"><ShieldCheck className="w-3.5 h-3.5" /> Override this condition</button>;
  return (
    <form className="mt-2 space-y-2" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); fd.set("tripId", tripId); fd.set("key", condKey); exec(() => overrideCondition(fd)); }}>
      <textarea name="reason" required minLength={10} rows={2} placeholder="Alasan override (wajib, min. 10 karakter)" aria-label="Alasan override" className={inputCls} />
      <select name="controlAction" required defaultValue="" aria-label="Tindakan pengendalian" className={inputCls}>
        <option value="" disabled>— tindakan pengendalian —</option>
        {actions.map(a => <option key={a}>{a}</option>)}
      </select>
      <label className="block text-xs text-slate-600">Bukti {needsEvidence ? <b className="text-red-700">(wajib, mis. tanda terima perpanjangan)</b> : "(opsional)"}
        <input name="file" type="file" accept="image/*,application/pdf" required={needsEvidence} className="block mt-1 text-xs" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending && <Loader2 className="w-4 h-4 animate-spin" />} Confirm override</button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-800">Batal</button>
      </div>
      <p className="text-[11px] text-slate-500">Tercatat di riwayat trip & kendaraan, muncul di &quot;Override bulan ini&quot;, dan diberitahukan ke Direktur Operasional.</p>
      <ErrorNote error={error} />
    </form>
  );
}
