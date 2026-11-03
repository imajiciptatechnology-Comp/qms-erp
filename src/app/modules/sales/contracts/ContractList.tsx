"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw, X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { createContract, renewContract, terminateContract } from "../actions";
import { CONTRACT_TYPES, addDays, contractState, daysBetween, rupiah, today, type SalesAccess } from "../lib";
import { ErrorNote, StatusBadge, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../ui";

type Contract = {
  id: string; contractNo: string; type: string; title: string; startDate: string; endDate: string; value: number; visitsPerYear: number | null;
  coveredItemsJson: string; status: string; picName: string | null; notes: string | null; customer: { name: string }; salesOrder: { id: string; soNo: string } | null;
};

const FILTERS = ["Perlu perhatian", "Active", "Expiring", "Expired", "Renewed", "Terminated", "Semua"];

export default function ContractList({ contracts, customers, access }: { contracts: Contract[]; customers: { id: string; name: string }[]; access: SalesAccess }) {
  const [filter, setFilter] = useState("Semua");
  const [adding, setAdding] = useState(false);
  const [renewing, setRenewing] = useState<Contract | null>(null);
  const { pending, error, exec } = useAction();
  const form = useAction();
  const rows = contracts.map(c => ({ ...c, state: contractState(c) }));
  const filtered = rows.filter(r => filter === "Semua" || (filter === "Perlu perhatian" ? ["Expiring", "Expired"].includes(r.state) : r.state === filter));

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 sm:items-center">
        <select aria-label="Filter kontrak" value={filter} onChange={e => setFilter(e.target.value)} className={`${inputCls} sm:w-56`}>{FILTERS.map(f => <option key={f}>{f}</option>)}</select>
        <p className="text-sm text-slate-500">“Expiring” = berakhir dalam 60 hari. Garansi dibuat otomatis saat BAST.</p>
        {access.canManage && <button className={`${btnPrimary} sm:ml-auto justify-center`} onClick={() => { form.setError(null); setAdding(true); }}><Plus className="w-4 h-4" /> New Contract</button>}
      </div>
      <ErrorNote error={error} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.length === 0 && <p className="text-sm text-slate-500 col-span-full bg-white border border-slate-200 rounded-xl p-8 text-center">Tidak ada kontrak untuk filter ini.</p>}
        {filtered.map(c => {
          const items = JSON.parse(c.coveredItemsJson) as { product: string; serialNumber: string }[];
          const left = daysBetween(today(), c.endDate);
          return (
            <article key={c.id} className={`bg-white rounded-xl border shadow-sm p-5 ${c.state === "Expiring" ? "border-amber-300" : c.state === "Expired" ? "border-red-200" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-400">{c.contractNo} · {c.type}</p>
                  <h3 className="font-semibold text-slate-800 mt-0.5">{c.title}</h3>
                  <p className="text-sm text-slate-600">{c.customer.name}</p>
                </div>
                <StatusBadge status={c.state} />
              </div>
              <dl className="grid grid-cols-3 gap-3 mt-4 text-sm">
                <div><dt className="text-xs text-slate-500">Periode</dt><dd className="text-slate-800">{c.startDate} – {c.endDate}</dd></div>
                <div><dt className="text-xs text-slate-500">Sisa</dt><dd className={left < 0 ? "text-red-700" : left <= 60 ? "text-amber-700" : "text-slate-800"}>{left < 0 ? `lewat ${-left} hari` : `${left} hari`}</dd></div>
                <div><dt className="text-xs text-slate-500">Nilai</dt><dd className="text-slate-800 tabular-nums">{c.value ? rupiah(c.value) : "—"}{c.visitsPerYear ? ` · ${c.visitsPerYear}×/th` : ""}</dd></div>
              </dl>
              {items.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-slate-600">{items.length} alat dicakup</summary>
                  <ul className="mt-2 space-y-1 text-slate-700">{items.map((it, i) => <li key={i}>{it.product} <span className="text-slate-500">· S/N {it.serialNumber}</span></li>)}</ul>
                </details>
              )}
              {(c.notes || c.picName || c.salesOrder) && (
                <p className="text-xs text-slate-500 mt-3">
                  {c.picName}{c.salesOrder && <> · <Link href={`/modules/sales/orders/${c.salesOrder.id}`} className="text-blue-700 hover:underline">{c.salesOrder.soNo}</Link></>}
                  {c.notes && <span className="block mt-0.5 text-slate-600">{c.notes}</span>}
                </p>
              )}
              {["Active", "Expiring", "Expired"].includes(c.state) && (access.canManage || access.canApprove) && (
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100">
                  {access.canManage && <button className={btnSecondary} onClick={() => { form.setError(null); setRenewing(c); }}><RefreshCw className="w-4 h-4" /> {c.type === "Garansi" ? "Tawarkan AMC" : "Perpanjang"}</button>}
                  {access.canApprove && c.state !== "Expired" && <button className="text-sm text-slate-500 hover:text-red-600 px-2" disabled={pending} onClick={() => { const r = prompt("Alasan menghentikan kontrak:"); if (r) exec(() => terminateContract(c.id, r)); }}>Hentikan</button>}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <ModalShell isOpen={adding} onClose={() => setAdding(false)} size="max-w-xl">
        <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const coveredItems = String(f.get("covered") || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => { const [product, serialNumber = "-"] = l.split(";").map(s => s.trim()); return { product, serialNumber }; });
          form.exec(() => createContract({
            customerId: String(f.get("customerId")), type: String(f.get("type")), title: String(f.get("title")), startDate: String(f.get("startDate")), endDate: String(f.get("endDate")),
            value: Number(f.get("value")) || 0, visitsPerYear: Number(f.get("visits")) || null, coveredItems, picName: String(f.get("pic") || "") || undefined, notes: String(f.get("notes") || "") || undefined,
          }), () => setAdding(false));
        }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 id="modal-title" className="font-bold text-slate-800">New Contract</h2>
            <button type="button" onClick={() => setAdding(false)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto">
            <div><label className={labelCls} htmlFor="c-cust">Customer</label><select id="c-cust" name="customerId" required defaultValue="" className={inputCls}><option value="" disabled>Pilih customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className={labelCls} htmlFor="c-type">Jenis</label><select id="c-type" name="type" className={inputCls}>{CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div className="col-span-2"><label className={labelCls} htmlFor="c-title">Judul</label><input id="c-title" name="title" required className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} htmlFor="c-start">Mulai</label><input id="c-start" name="startDate" type="date" required defaultValue={today()} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="c-end">Berakhir</label><input id="c-end" name="endDate" type="date" required defaultValue={addDays(today(), 365)} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2"><label className={labelCls} htmlFor="c-val">Nilai kontrak (Rp)</label><input id="c-val" name="value" type="number" min={0} step={1000} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="c-visits">Kunjungan/th</label><input id="c-visits" name="visits" type="number" min={0} className={inputCls} /></div>
            </div>
            <div><label className={labelCls} htmlFor="c-cov">Alat dicakup — satu per baris: nama; nomor seri</label><textarea id="c-cov" name="covered" rows={3} className={inputCls} placeholder={"CentriMax CR-16R; CR16-2402-0089"} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} htmlFor="c-pic">PIC / teknisi</label><input id="c-pic" name="pic" className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="c-notes">Catatan</label><input id="c-notes" name="notes" className={inputCls} /></div>
            </div>
            <ErrorNote error={form.error} />
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setAdding(false)}>Batal</button>
            <button type="submit" className={btnPrimary} disabled={form.pending}>{form.pending ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </form>
      </ModalShell>

      <ModalShell isOpen={!!renewing} onClose={() => setRenewing(null)}>
        {renewing && (
          <form onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            form.exec(() => renewContract(renewing.id, { startDate: String(f.get("startDate")), endDate: String(f.get("endDate")), value: Number(f.get("value")) || 0 }), () => setRenewing(null));
          }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 id="modal-title" className="font-bold text-slate-800">{renewing.type === "Garansi" ? "Lanjutkan ke kontrak AMC" : "Perpanjang kontrak"}</h2>
              <button type="button" onClick={() => setRenewing(null)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">{renewing.title} — {renewing.customer.name}. Kontrak lama akan ditandai <b>Renewed</b>.</p>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls} htmlFor="r-start">Mulai</label><input id="r-start" name="startDate" type="date" required defaultValue={renewing.endDate < today() ? today() : addDays(renewing.endDate, 1)} className={inputCls} /></div>
                <div><label className={labelCls} htmlFor="r-end">Berakhir</label><input id="r-end" name="endDate" type="date" required defaultValue={addDays(renewing.endDate < today() ? today() : addDays(renewing.endDate, 1), 364)} className={inputCls} /></div>
              </div>
              <div><label className={labelCls} htmlFor="r-val">Nilai (Rp)</label><input id="r-val" name="value" type="number" min={0} step={1000} defaultValue={renewing.value || 9500000 * (JSON.parse(renewing.coveredItemsJson) as unknown[]).length} className={inputCls} /></div>
              <ErrorNote error={form.error} />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setRenewing(null)}>Batal</button>
              <button type="submit" className={btnPrimary} disabled={form.pending}>{form.pending ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </form>
        )}
      </ModalShell>
    </div>
  );
}
