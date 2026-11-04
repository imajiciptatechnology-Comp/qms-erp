"use client";

import { useState } from "react";
import { FileCheck2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { ErrorNote, btnDanger, btnPrimary, inputCls, useAction } from "../../ui";
import { cancelTrip, issueSj, overrideCondition } from "../../dispatch/actions";

export function TripActions({ tripId, canIssue, canCancel }: { tripId: string; canIssue: boolean; canCancel: boolean }) {
  const { pending, error, exec } = useAction();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {canIssue && <button type="button" disabled={pending} onClick={() => exec(() => issueSj(tripId))} className={btnPrimary}>{pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />} Issue Surat Jalan</button>}
        {canCancel && !cancelling && <button type="button" onClick={() => setCancelling(true)} className={btnDanger}><XCircle className="w-4 h-4" /> Cancel trip</button>}
      </div>
      {cancelling && (
        <div className="flex gap-2 w-full max-w-md">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Alasan pembatalan" aria-label="Alasan pembatalan" className={inputCls} />
          <button type="button" disabled={pending || !reason.trim()} onClick={() => exec(() => cancelTrip(tripId, reason))} className={btnDanger}>Confirm</button>
        </div>
      )}
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
