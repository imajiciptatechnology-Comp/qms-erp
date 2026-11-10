"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckSquare, ListChecks, Pencil, Plus, ShieldCheck, Square, Trash2 } from "lucide-react";
import { initTenderChecklist, saveTenderInfo, updateTenderChecklist } from "../../tenderActions";
import { daysBetween, guaranteeState, isExportCustomer, money, rupiah, today, type ChecklistItem } from "../../lib";
import { Card, ErrorNote, History, InfoRow, StatusBadge, btnPrimary, btnPrimarySm, btnSecondary, btnSecondarySm, inputCls, labelCls, useAction } from "../../ui";

type Tender = {
  id: string; opportunityNo: string; title: string; stage: string; source: string; estimatedValue: number; probability: number;
  expectedCloseDate: string | null; salesName: string; notes: string | null; lostReason: string | null; historyJson: string;
  tenderNo: string | null; tenderDeadline: string | null; tenderChecklistJson: string; tkdnRequired: number | null;
  customer: { id: string; name: string; country: string; type: string };
  quotations: { id: string; quotationNo: string; revision: number; status: string; date: string; total: number; currency: string; tkdn: number | null }[];
  guarantees: { id: string; guaranteeNo: string; type: string; issuer: string; amount: number; currency: string; expiryDate: string; status: string }[];
};

export default function TenderDetail({ o, canManage, canGuarantee }: { o: Tender; canManage: boolean; canGuarantee: boolean }) {
  const { pending, error, exec } = useAction();
  const [editing, setEditing] = useState(false);
  const [newItem, setNewItem] = useState("");
  const list = JSON.parse(o.tenderChecklistJson || "[]") as ChecklistItem[];
  const done = list.filter(i => i.done).length;
  const daysLeft = o.tenderDeadline ? daysBetween(today(), o.tenderDeadline) : null;
  const intl = isExportCustomer(o.customer);
  const latest = o.quotations.find(q => q.status !== "Superseded") ?? o.quotations[0];
  const tkdnShort = o.tkdnRequired != null && latest?.tkdn != null && latest.tkdn < o.tkdnRequired;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link href="/modules/sales/pipeline" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Pipeline & Tender</Link>
          <h2 className="text-xl font-bold text-slate-800 mt-1 flex flex-wrap items-center gap-2">{o.title} <StatusBadge status={o.stage} /></h2>
          <p className="text-sm text-slate-500">{o.opportunityNo} · {o.source} · <Link href={`/modules/sales/customers/${o.customer.id}`} className="hover:underline">{o.customer.name}</Link>{intl ? ` · ${o.customer.country}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && <Link href={`/modules/sales/quotations/new?opportunity=${o.id}&customer=${o.customer.id}`} className={btnSecondary}><Plus className="w-4 h-4" /> Buat penawaran</Link>}
          {canGuarantee && <Link href={`/modules/sales/guarantees?new=1&opportunity=${o.id}&customer=${o.customer.id}`} className={btnSecondary}><ShieldCheck className="w-4 h-4" /> Catat jaminan</Link>}
        </div>
      </div>
      <ErrorNote error={error} />

      {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && list.some(i => !i.done) && (
        <p role="alert" className="text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden /> Batas pemasukan {daysLeft === 0 ? "hari ini" : `${daysLeft} hari lagi`} dan masih ada {list.length - done} dokumen belum siap.
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title={<span className="flex items-center gap-2"><ListChecks className="w-4 h-4 text-slate-500" aria-hidden /> Dokumen tender · {done}/{list.length} siap</span>}>
            {list.length === 0 ? (
              <div className="text-sm text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p>Belum ada checklist dokumen.</p>
                {canManage && <button className={btnPrimarySm} disabled={pending} onClick={() => exec(() => initTenderChecklist(o.id))}><ListChecks className="w-3.5 h-3.5" aria-hidden /> Buat checklist {intl ? "tender internasional" : "tender pemerintah"}</button>}
              </div>
            ) : (
              <>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4" aria-hidden><div className="h-full bg-emerald-500" style={{ width: `${Math.round(done / list.length * 100)}%` }} /></div>
                <ul className="space-y-1">
                  {list.map((it, i) => {
                    const Icon = it.done ? CheckSquare : Square;
                    return (
                      <li key={`${it.name}-${i}`} className="flex items-center gap-2 group">
                        <button type="button" disabled={!canManage || pending} onClick={() => exec(() => updateTenderChecklist(o.id, { kind: "toggle", index: i }))} aria-pressed={it.done}
                          className={`flex-1 flex items-center gap-3 text-left rounded-lg px-2 py-1.5 -mx-2 ${canManage ? "hover:bg-slate-50" : "cursor-default"}`}>
                          <Icon className={`w-5 h-5 shrink-0 ${it.done ? "text-emerald-600" : "text-slate-400"}`} aria-hidden />
                          <span className={`text-sm ${it.done ? "text-slate-500 line-through" : "text-slate-800"}`}>{it.name}</span>
                        </button>
                        {canManage && <button type="button" disabled={pending} onClick={() => exec(() => updateTenderChecklist(o.id, { kind: "remove", index: i }))} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Hapus ${it.name}`}><Trash2 className="w-4 h-4" /></button>}
                      </li>
                    );
                  })}
                </ul>
                {canManage && (
                  <form className="flex gap-2 mt-4" onSubmit={e => { e.preventDefault(); exec(() => updateTenderChecklist(o.id, { kind: "add", name: newItem }), () => setNewItem("")); }}>
                    <input aria-label="Dokumen tambahan" value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Tambah dokumen, mis. Surat referensi bank" className={inputCls} />
                    <button type="submit" className={btnSecondary} disabled={pending || !newItem.trim()}><Plus className="w-4 h-4" /> Tambah</button>
                  </form>
                )}
              </>
            )}
          </Card>

          <Card title="Penawaran untuk tender ini">
            {o.quotations.length === 0 ? <p className="text-sm text-slate-500">Belum ada penawaran.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500 text-xs uppercase"><tr><th className="pb-2 font-semibold">Penawaran</th><th className="pb-2 font-semibold">Status</th><th className="pb-2 font-semibold text-right">Nilai</th><th className="pb-2 font-semibold text-right">TKDN</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {o.quotations.map(q => (
                      <tr key={q.id}>
                        <td className="py-2.5 pr-4"><Link href={`/modules/sales/quotations/${q.id}`} className="font-medium text-blue-700 hover:underline">{q.quotationNo} Rev.{q.revision}</Link><span className="block text-xs text-slate-500">{q.date}</span></td>
                        <td className="py-2.5"><StatusBadge status={q.status} /></td>
                        <td className="py-2.5 text-right tabular-nums whitespace-nowrap">{money(q.total, q.currency)}</td>
                        <td className={`py-2.5 text-right tabular-nums ${o.tkdnRequired != null && q.tkdn != null && q.tkdn < o.tkdnRequired ? "text-red-700 font-semibold" : "text-slate-700"}`}>{q.tkdn != null ? `${q.tkdn}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {o.tkdnRequired != null && (
              <p className={`mt-3 text-xs ${tkdnShort ? "text-red-700" : "text-slate-500"}`}>
                TKDN penawaran = rata-rata TKDN produk dibobot nilai item (jasa & produk tanpa sertifikat dihitung 0%). Syarat paket: minimal {o.tkdnRequired}%.
                {tkdnShort ? " Penawaran terakhir belum memenuhi syarat." : ""}
              </p>
            )}
          </Card>

          <Card title="Jaminan">
            {o.guarantees.length === 0 ? <p className="text-sm text-slate-500">Belum ada jaminan penawaran / pelaksanaan yang dicatat.</p> : (
              <ul className="divide-y divide-slate-100">
                {o.guarantees.map(g => {
                  const st = guaranteeState(g);
                  return (
                    <li key={g.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                      <span><span className="font-medium text-slate-800">{g.type}</span><span className="block text-xs text-slate-500">{g.guaranteeNo} · {g.issuer} · s/d {g.expiryDate}</span></span>
                      <span className="flex items-center gap-2 shrink-0"><span className="tabular-nums">{money(g.amount, g.currency)}</span><StatusBadge status={st} /></span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link href="/modules/sales/guarantees" className="inline-block mt-3 text-sm text-blue-700 hover:underline">Semua jaminan →</Link>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Data tender" actions={canManage && !editing ? <button type="button" onClick={() => setEditing(true)} className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md" aria-label="Edit data tender"><Pencil className="w-4 h-4" /></button> : undefined}>
            {editing ? (
              <form className="space-y-3" onSubmit={e => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
                exec(() => saveTenderInfo(o.id, { tenderNo: f.tenderNo, tenderDeadline: f.tenderDeadline, tkdnRequired: f.tkdnRequired ? Number(f.tkdnRequired) : null }), () => setEditing(false));
              }}>
                <div><label className={labelCls} htmlFor="t-no">No. paket / RFP</label><input id="t-no" name="tenderNo" defaultValue={o.tenderNo ?? ""} className={inputCls} /></div>
                <div><label className={labelCls} htmlFor="t-dl">Batas pemasukan</label><input id="t-dl" name="tenderDeadline" type="date" defaultValue={o.tenderDeadline ?? ""} className={inputCls} /></div>
                <div><label className={labelCls} htmlFor="t-tkdn">Syarat TKDN minimal (%)</label><input id="t-tkdn" name="tkdnRequired" type="number" min={0} max={100} step={0.01} defaultValue={o.tkdnRequired ?? ""} placeholder="Kosongkan bila tidak disyaratkan" className={inputCls} /></div>
                <div className="flex justify-end gap-2">
                  <button type="button" className={btnSecondarySm} onClick={() => setEditing(false)}>Batal</button>
                  <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
                </div>
              </form>
            ) : (
              <dl className="space-y-3">
                <InfoRow label="No. paket / RFP">{o.tenderNo}</InfoRow>
                <InfoRow label="Batas pemasukan">{o.tenderDeadline ? `${o.tenderDeadline}${daysLeft !== null ? (daysLeft < 0 ? " · sudah lewat" : ` · ${daysLeft} hari lagi`) : ""}` : null}</InfoRow>
                <InfoRow label="Syarat TKDN">{o.tkdnRequired != null ? `minimal ${o.tkdnRequired}%` : "Tidak disyaratkan"}</InfoRow>
                <InfoRow label="Estimasi nilai">{rupiah(o.estimatedValue)} · {o.probability}%</InfoRow>
                <InfoRow label="Target closing">{o.expectedCloseDate}</InfoRow>
                <InfoRow label="Sales">{o.salesName}</InfoRow>
                {o.notes && <InfoRow label="Catatan">{o.notes}</InfoRow>}
                {o.lostReason && <InfoRow label="Alasan lost">{o.lostReason}</InfoRow>}
              </dl>
            )}
          </Card>
          <Card title="Aktivitas"><History json={o.historyJson} /></Card>
        </div>
      </div>
    </div>
  );
}

