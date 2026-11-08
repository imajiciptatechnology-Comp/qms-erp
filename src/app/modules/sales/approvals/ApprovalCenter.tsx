"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, Check, ClipboardCheck, ExternalLink, FileSignature, Inbox, Percent, Ship, X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { decideContract, decideQuotation } from "../actions";
import { decideShipmentException } from "@/app/modules/contract-shipping/actions";
import { decideServiceJob } from "@/app/modules/customer-service/actions";
import { rupiah, today } from "../lib";
import type { ApprovalItem } from "../server";
import { ErrorNote, btnDanger, btnSecondary, inputCls, labelCls, useAction } from "../ui";

const KIND = {
  quotation: { label: "Diskon penawaran", icon: Percent, tone: "bg-blue-100 text-blue-700" },
  contract: { label: "Kontrak", icon: FileSignature, tone: "bg-indigo-100 text-indigo-700" },
  shipment: { label: "Kirim sebelum lunas", icon: Ship, tone: "bg-red-100 text-red-700" },
  "service-job": { label: "Jadwal instalasi & training", icon: CalendarCheck, tone: "bg-emerald-100 text-emerald-700" },
  "sales-order": { label: "Konfirmasi PO", icon: ClipboardCheck, tone: "bg-amber-100 text-amber-800" },
} as const;

const FILTERS = [
  { id: "all", label: "Semua" },
  { id: "quotation", label: "Diskon" },
  { id: "contract", label: "Kontrak" },
  { id: "shipment", label: "Pengiriman" },
  { id: "service-job", label: "Training" },
  { id: "sales-order", label: "PO masuk" },
] as const;

function decide(item: ApprovalItem, decision: "approve" | "reject", note?: string) {
  switch (item.kind) {
    case "quotation": return decideQuotation(item.id, decision, note);
    case "contract": return decideContract(item.id, decision, note);
    case "shipment": return decideShipmentException(item.id, decision, note);
    case "service-job": return decideServiceJob(item.id, decision, note);
    default: throw new Error("Item ini tidak diputuskan dari dashboard.");
  }
}

export default function ApprovalCenter({ items, canApprove }: { items: ApprovalItem[]; canApprove: boolean }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [rejecting, setRejecting] = useState<ApprovalItem | null>(null);
  const { pending, error, exec } = useAction();
  const reject = useAction();
  const shown = filter === "all" ? items : items.filter(i => i.kind === filter);
  const decidable = items.filter(i => i.decidable).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Semua persetujuan Labtech di satu tempat: diskon penawaran, kontrak, izin kirim sebelum lunas, dan jadwal instalasi & training.
          {!canApprove && " Anda hanya bisa melihat; keputusan oleh Sales Manager."}
        </p>
        <span className="text-sm font-semibold text-slate-700 shrink-0">{decidable} menunggu keputusan</span>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter jenis persetujuan">
        {FILTERS.map(f => {
          const n = f.id === "all" ? items.length : items.filter(i => i.kind === f.id).length;
          return (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filter === f.id ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
              {f.label} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <ErrorNote error={error} />

      {shown.length ? (
        <ul className="space-y-3">
          {shown.map(item => {
            const k = KIND[item.kind];
            const late = item.dueDate && item.dueDate < today();
            return (
              <li key={item.kind + item.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${k.tone}`}><k.icon className="w-5 h-5" aria-hidden /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.label}</p>
                  <p className="font-semibold text-slate-800">{item.title} · <Link href={item.href} className="hover:underline">{item.ref}</Link></p>
                  <p className="text-sm text-slate-600">{item.customer}</p>
                  <p className="text-sm text-slate-500 break-words">{item.detail}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {item.requestedBy ? `Diajukan ${item.requestedBy}` : ""}{item.date ? ` · ${item.date}` : ""}
                    {item.dueDate && <span className={late ? "text-red-600 font-semibold" : ""}> · batas keputusan {item.dueDate}{late ? " (lewat)" : ""}</span>}
                  </p>
                </div>
                {item.amount ? <p className="text-sm font-semibold text-slate-800 tabular-nums lg:text-right shrink-0">{rupiah(item.amount)}</p> : null}
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Link href={item.href} className={btnSecondary}><ExternalLink className="w-4 h-4" /> Buka</Link>
                  {canApprove && item.decidable && <>
                    <button type="button" className={btnDanger} disabled={pending} onClick={() => { reject.setError(null); setRejecting(item); }}><X className="w-4 h-4" /> Tolak</button>
                    <button type="button" disabled={pending} onClick={() => exec(() => decide(item, "approve"))} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm"><Check className="w-4 h-4" /> Setujui</button>
                  </>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
          <Inbox className="w-12 h-12 text-slate-200 mx-auto" aria-hidden />
          <p className="font-semibold text-slate-700 mt-2">Tidak ada yang menunggu persetujuan</p>
        </div>
      )}

      <ModalShell isOpen={!!rejecting} onClose={() => setRejecting(null)} size="max-w-lg">
        {rejecting && (
          <form onSubmit={e => { e.preventDefault(); const note = String(new FormData(e.currentTarget).get("note") || ""); reject.exec(() => decide(rejecting, "reject", note), () => setRejecting(null)); }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 id="modal-title" className="font-bold text-slate-800">Tolak {rejecting.ref}</h2>
              <button type="button" onClick={() => setRejecting(null)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-600">{rejecting.title} — {rejecting.customer}</p>
              <div><label className={labelCls} htmlFor="reject-note">Alasan</label><textarea id="reject-note" name="note" rows={4} required className={inputCls} /></div>
              <ErrorNote error={reject.error} />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setRejecting(null)}>Batal</button>
              <button type="submit" className={btnDanger} disabled={reject.pending}>{reject.pending ? "Menyimpan…" : "Tolak"}</button>
            </div>
          </form>
        )}
      </ModalShell>
    </div>
  );
}
