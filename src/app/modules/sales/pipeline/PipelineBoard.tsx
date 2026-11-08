"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { createOpportunity, moveOpportunity } from "../actions";
import { SOURCES, STAGES, rupiahShort, today } from "../lib";
import { ErrorNote, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../ui";

type Opp = {
  id: string; opportunityNo: string; title: string; stage: string; source: string; estimatedValue: number; probability: number;
  expectedCloseDate: string | null; tenderNo?: string | null; tenderDeadline?: string | null; salesName: string; lostReason: string | null; notes: string | null; customer: { id: string; name: string };
};

const COLUMN_ACCENT: Record<string, string> = {
  Lead: "border-t-slate-400", Qualified: "border-t-sky-500", Quotation: "border-t-blue-600",
  Negotiation: "border-t-amber-500", Won: "border-t-emerald-600", Lost: "border-t-red-500",
};

export default function PipelineBoard({ opportunities, customers, canManage }: { opportunities: Opp[]; customers: { id: string; name: string }[]; canManage: boolean }) {
  const [adding, setAdding] = useState(false);
  const { pending, error, setError, exec } = useAction();

  function move(o: Opp, stage: string) {
    if (stage === o.stage) return;
    let reason: string | undefined;
    if (stage === "Lost") {
      reason = prompt(`Alasan ${o.opportunityNo} Lost (mis. harga, spesifikasi, anggaran)?`) ?? undefined;
      if (!reason) return;
    }
    exec(() => moveOpportunity(o.id, stage, reason));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Pindahkan opportunity dengan memilih tahap di kartu. Probabilitas mengikuti tahap.</p>
        {canManage && <button className={btnPrimary} onClick={() => { setError(null); setAdding(true); }}><Plus className="w-4 h-4" /> New Opportunity</button>}
      </div>
      <ErrorNote error={adding ? null : error} />

      <div className="grid grid-cols-1 md:grid-cols-3 2xl:grid-cols-6 gap-4">
        {STAGES.map(stage => {
          const rows = opportunities.filter(o => o.stage === stage);
          return (
            <section key={stage} aria-label={stage} className={`bg-slate-100/70 rounded-xl border border-slate-200 border-t-4 ${COLUMN_ACCENT[stage]} flex flex-col`}>
              <header className="px-3 py-2.5 flex items-baseline justify-between">
                <h2 className="font-semibold text-slate-800 text-sm">{stage} <span className="text-slate-500 font-normal">({rows.length})</span></h2>
                <span className="text-xs font-semibold text-slate-600 tabular-nums">{rupiahShort(rows.reduce((s, o) => s + o.estimatedValue, 0))}</span>
              </header>
              <div className="px-2 pb-2 space-y-2 flex-1">
                {rows.length === 0 && <p className="text-xs text-slate-400 px-1 py-3 text-center">Kosong</p>}
                {rows.map(o => (
                  <article key={o.id} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-400">{o.opportunityNo} · {o.source}</p>
                    <h3 className="text-sm font-semibold text-slate-800 leading-snug mt-0.5">{o.title}</h3>
                    <Link href={`/modules/sales/customers/${o.customer.id}`} className="text-xs text-blue-600 hover:underline block mt-1 truncate">{o.customer.name}</Link>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="font-semibold text-slate-800 tabular-nums">{rupiahShort(o.estimatedValue)}</span>
                      <span className="text-slate-500">{o.probability}%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{o.salesName}{o.expectedCloseDate ? ` · target ${o.expectedCloseDate}` : ""}</p>
                    {o.tenderDeadline && <p className={`text-xs mt-0.5 font-medium ${o.tenderDeadline < today() ? "text-slate-400" : "text-amber-700"}`}>Tender{o.tenderNo ? ` ${o.tenderNo}` : ""} · batas {o.tenderDeadline}</p>}
                    {o.lostReason && <p className="text-xs text-red-700 mt-1">Alasan: {o.lostReason}</p>}
                    {o.notes && !o.lostReason && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{o.notes}</p>}
                    {canManage && (
                      <select aria-label={`Ubah tahap ${o.opportunityNo}`} disabled={pending} value={o.stage} onChange={e => move(o, e.target.value)} className="mt-2 w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700">
                        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <ModalShell isOpen={adding} onClose={() => setAdding(false)}>
        <form
          onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            exec(() => createOpportunity({
              title: String(f.get("title")), customerId: String(f.get("customerId")), source: String(f.get("source")),
              estimatedValue: Number(f.get("estimatedValue")) || 0, expectedCloseDate: String(f.get("expectedCloseDate") || "") || undefined, notes: String(f.get("notes") || "") || undefined,
              tenderNo: String(f.get("tenderNo") || "") || undefined, tenderDeadline: String(f.get("tenderDeadline") || "") || undefined,
            }), () => setAdding(false));
          }}
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 id="modal-title" className="font-bold text-slate-800">New Opportunity</h2>
            <button type="button" onClick={() => setAdding(false)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto">
            <div><label className={labelCls} htmlFor="opp-title">Judul</label><input id="opp-title" name="title" required className={inputCls} placeholder="mis. Spektrofotometer untuk Lab QC" /></div>
            <div><label className={labelCls} htmlFor="opp-cust">Customer</label>
              <select id="opp-cust" name="customerId" required className={inputCls} defaultValue=""><option value="" disabled>Pilih customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} htmlFor="opp-src">Sumber</label><select id="opp-src" name="source" className={inputCls}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label className={labelCls} htmlFor="opp-close">Target closing</label><input id="opp-close" name="expectedCloseDate" type="date" min={today()} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} htmlFor="opp-tno">No. paket tender (opsional)</label><input id="opp-tno" name="tenderNo" className={inputCls} placeholder="LPSE / UNGM ref" /></div>
              <div><label className={labelCls} htmlFor="opp-tdl">Batas pemasukan</label><input id="opp-tdl" name="tenderDeadline" type="date" className={inputCls} /></div>
            </div>
            <div><label className={labelCls} htmlFor="opp-val">Estimasi nilai (Rp)</label><input id="opp-val" name="estimatedValue" type="number" min={0} step={1000} className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="opp-notes">Catatan</label><textarea id="opp-notes" name="notes" rows={2} className={inputCls} /></div>
            <ErrorNote error={error} />
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setAdding(false)}>Batal</button>
            <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
