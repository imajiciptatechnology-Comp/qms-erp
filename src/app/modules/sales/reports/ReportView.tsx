"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Pencil, Target, TrendingUp, X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { saveSalesTargets } from "../financeActions";
import type { SalesReport } from "../reportActions";
import { MONTHS_ID, rupiah, rupiahShort } from "../lib";
import { Card, ErrorNote, StatCard, btnPrimary, btnSecondary, btnSecondarySm, inputCls, labelCls, useAction } from "../ui";

// Palet tervalidasi (dataviz): realisasi = biru, target = oranye (penanda garis).
const ACTUAL = "#2a78d6";
const TARGET = "#eb6834";
const pct = (a: number, t: number) => (t > 0 ? Math.round(a / t * 100) : null);

export default function ReportView({ report, canEditTargets }: { report: SalesReport; canEditTargets: boolean }) {
  const router = useRouter();
  const [hover, setHover] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ salesName: string; amounts: number[] } | null>(null);
  const { pending, error, setError, exec } = useAction();
  const { totals, months } = report;
  const max = Math.max(1, ...months.map(m => Math.max(m.actual, m.target)));
  const achievement = pct(totals.actual, totals.target);
  const maxCountry = Math.max(1, ...report.countries.map(c => c.value));
  const maxCat = Math.max(1, ...report.categories.map(c => c.value));
  const hasTarget = months.some(m => m.target > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="r-year" className="text-sm text-slate-600">Tahun</label>
          <select id="r-year" value={report.year} onChange={e => router.push(`/modules/sales/reports?year=${e.target.value}`)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800">
            {report.years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-500 sm:ml-auto">Realisasi = nilai Sales Order (DPP, tanpa PPN) menurut tanggal order. Valuta asing dikonversi ke Rupiah dengan kurs di SO.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Realisasi" value={rupiahShort(totals.actual)} sub={`${totals.orders} sales order`} icon={<TrendingUp className="w-6 h-6" />} tone="blue" />
        <StatCard label="Target tim" value={totals.target ? rupiahShort(totals.target) : "—"} sub={achievement !== null ? `Tercapai ${achievement}%` : "Belum ada target"} icon={<Target className="w-6 h-6" />} tone={achievement !== null && achievement >= 100 ? "emerald" : "amber"} />
        <StatCard label="Kas masuk" value={rupiahShort(totals.collected)} sub="Pembayaran diterima (tanpa nota kredit)" icon={<Banknote className="w-6 h-6" />} tone="emerald" />
      </div>

      <Card title="Target vs realisasi per bulan" actions={canEditTargets ? <button className={btnSecondarySm} onClick={() => { setError(null); setEditing({ salesName: "", amounts: [...report.teamTargets] }); }}><Pencil className="w-3.5 h-3.5" aria-hidden /> Atur target tim</button> : undefined}>
        <div className="flex items-center gap-4 text-xs text-slate-600 mb-3" aria-hidden>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: ACTUAL }} /> Realisasi</span>
          {hasTarget && <span className="flex items-center gap-1.5"><span className="w-4 h-0.5" style={{ background: TARGET }} /> Target</span>}
        </div>
        <div className="relative" onMouseLeave={() => setHover(null)}>
          <div className="h-56 grid grid-cols-12 gap-1 sm:gap-2 items-end border-b border-slate-200" role="img" aria-label={`Grafik target vs realisasi ${report.year}; rincian ada di tabel di bawah`}>
            {months.map(m => (
              <div key={m.month} className="relative h-full flex items-end justify-center cursor-default" onMouseEnter={() => setHover(m.month)} onMouseMove={() => hover !== m.month && setHover(m.month)} onFocus={() => setHover(m.month)} tabIndex={0}>
                <div className="w-3/5 max-w-8 rounded-t" style={{ height: `${m.actual / max * 100}%`, minHeight: m.actual ? 2 : 0, background: ACTUAL, opacity: hover === null || hover === m.month ? 1 : 0.55 }} />
                {m.target > 0 && <div className="absolute left-[10%] right-[10%] h-0.5 rounded-full" style={{ bottom: `${m.target / max * 100}%`, background: TARGET }} />}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-12 gap-1 sm:gap-2 mt-1.5">
            {months.map(m => <span key={m.month} className="text-[11px] text-slate-500 text-center">{MONTHS_ID[m.month]}</span>)}
          </div>
          {hover !== null && (
            <div className="absolute top-0 z-10 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none" style={{ left: `clamp(0px, calc(${(hover + 0.5) / 12 * 100}% - 80px), calc(100% - 170px))`, width: 170 }}>
              <p className="font-semibold text-slate-800 mb-1">{MONTHS_ID[hover]} {report.year}</p>
              <p className="flex justify-between gap-2"><span className="text-slate-500">Realisasi</span><span className="tabular-nums text-slate-800">{rupiahShort(months[hover].actual)}</span></p>
              <p className="flex justify-between gap-2"><span className="text-slate-500">Target</span><span className="tabular-nums text-slate-800">{months[hover].target ? rupiahShort(months[hover].target) : "—"}</span></p>
              <p className="flex justify-between gap-2"><span className="text-slate-500">Kas masuk</span><span className="tabular-nums text-slate-800">{rupiahShort(months[hover].collected)}</span></p>
            </div>
          )}
        </div>

        <details className="mt-4">
          <summary className="text-sm text-blue-700 cursor-pointer">Tabel per bulan</summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 text-xs uppercase"><tr><th className="py-2 font-semibold">Bulan</th><th className="py-2 font-semibold text-right">Target</th><th className="py-2 font-semibold text-right">Realisasi</th><th className="py-2 font-semibold text-right">Capaian</th><th className="py-2 font-semibold text-right">Kas masuk</th></tr></thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {months.map(m => (
                  <tr key={m.month}><td className="py-2">{MONTHS_ID[m.month]}</td><td className="py-2 text-right">{m.target ? rupiah(m.target) : "—"}</td><td className="py-2 text-right">{rupiah(m.actual)}</td><td className="py-2 text-right">{pct(m.actual, m.target) !== null ? `${pct(m.actual, m.target)}%` : "—"}</td><td className="py-2 text-right">{rupiah(m.collected)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card title="Per sales">
          <ul className="space-y-3">
            {report.salesPeople.map(s => {
              const p = pct(s.actual, s.target);
              return (
                <li key={s.name} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{s.name}</span>
                    <span className="flex items-center gap-1">
                      <span className="tabular-nums text-slate-700">{rupiahShort(s.actual)}{s.target ? ` / ${rupiahShort(s.target)}` : ""}</span>
                      {canEditTargets && <button onClick={() => { setError(null); setEditing({ salesName: s.name, amounts: [...s.targets] }); }} className="p-1 text-slate-400 hover:text-blue-700 rounded" aria-label={`Atur target ${s.name}`}><Pencil className="w-3.5 h-3.5" /></button>}
                    </span>
                  </div>
                  {s.target > 0 && (
                    <>
                      <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden" aria-hidden><div className="h-full rounded-full" style={{ width: `${Math.min(100, p ?? 0)}%`, background: ACTUAL }} /></div>
                      <p className="text-xs text-slate-500 mt-0.5">Capaian {p}%</p>
                    </>
                  )}
                </li>
              );
            })}
            {report.salesPeople.length === 0 && <li className="text-sm text-slate-500">Belum ada penjualan.</li>}
          </ul>
        </Card>

        <Card title="Per negara">
          <ul className="space-y-2.5">
            {report.countries.map(c => (
              <li key={c.country} className="text-sm">
                <div className="flex justify-between gap-2"><span className="text-slate-800">{c.country} <span className="text-xs text-slate-500">· {c.orders} SO</span></span><span className="tabular-nums text-slate-700">{rupiahShort(c.value)}</span></div>
                <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden" aria-hidden><div className="h-full rounded-full" style={{ width: `${c.value / maxCountry * 100}%`, background: ACTUAL }} /></div>
              </li>
            ))}
            {report.countries.length === 0 && <li className="text-sm text-slate-500">Belum ada penjualan.</li>}
          </ul>
        </Card>

        <Card title="Per kategori produk">
          <ul className="space-y-2.5">
            {report.categories.map(c => (
              <li key={c.category} className="text-sm">
                <div className="flex justify-between gap-2"><span className="text-slate-800">{c.category}</span><span className="tabular-nums text-slate-700">{rupiahShort(c.value)}</span></div>
                <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden" aria-hidden><div className="h-full rounded-full" style={{ width: `${c.value / maxCat * 100}%`, background: ACTUAL }} /></div>
              </li>
            ))}
            {report.categories.length === 0 && <li className="text-sm text-slate-500">Belum ada penjualan.</li>}
          </ul>
        </Card>
      </div>

      <ModalShell isOpen={!!editing} onClose={() => setEditing(null)} size="max-w-2xl">
        {editing && (
          <form onSubmit={e => { e.preventDefault(); exec(() => saveSalesTargets(report.year, editing.salesName, editing.amounts), () => setEditing(null)); }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 id="modal-title" className="font-bold text-slate-800">Target {report.year} · {editing.salesName || "tim"}</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-48"><label className={labelCls} htmlFor="t-all">Isi semua bulan (Rp)</label><input id="t-all" type="number" min={0} step={1000000} placeholder="mis. 1000000000" className={inputCls} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const v = Number((e.target as HTMLInputElement).value); setEditing({ ...editing, amounts: Array(12).fill(v) }); } }} /></div>
                <p className="text-xs text-slate-500 pb-2">Tekan Enter untuk mengisi ke 12 bulan.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {editing.amounts.map((a, i) => (
                  <div key={i}><label className={labelCls} htmlFor={`t-${i}`}>{MONTHS_ID[i]}</label>
                    <input id={`t-${i}`} type="number" min={0} step={1000000} value={a || ""} onChange={e => setEditing({ ...editing, amounts: editing.amounts.map((x, j) => (j === i ? Number(e.target.value) : x)) })} className={inputCls} />
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-600">Total setahun: <b className="tabular-nums">{rupiah(editing.amounts.reduce((t, n) => t + n, 0))}</b></p>
              <ErrorNote error={error} />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setEditing(null)}>Batal</button>
              <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Simpan target"}</button>
            </div>
          </form>
        )}
      </ModalShell>
    </div>
  );
}
