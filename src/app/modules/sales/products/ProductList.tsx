"use client";

import { useState } from "react";
import { Package, Pencil, Plus, Search, X } from "lucide-react";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import ModalShell from "@/components/ui/ModalShell";
import TableFooter from "@/components/ui/TableFooter";
import { saveProduct, type ProductInput } from "../actions";
import { rupiah } from "../lib";
import { ErrorNote, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../ui";

type P = Omit<ProductInput, "model" | "specs" | "hsCode"> & { hsCode: string | null; id: string; model: string | null; specs: string | null; leadTimeWeeks: number | null; calibrationIntervalMonths: number | null };

export default function ProductList({ products, canManage }: { products: P[]; canManage: boolean }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [editing, setEditing] = useState<Partial<P> | null>(null);
  const { pending, error, setError, exec } = useAction();
  const categories = [...new Set(products.map(p => p.category))];
  const filtered = products.filter(p => (cat === "All" || p.category === cat) && `${p.sku} ${p.name} ${p.brand} ${p.model ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const open = (p: Partial<P>) => { setError(null); setEditing(p); };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input aria-label="Cari produk" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari kode, nama, merek…" className={`${inputCls} pl-9`} />
        </div>
        <select aria-label="Filter kategori" value={cat} onChange={e => setCat(e.target.value)} className={`${inputCls} sm:w-52`}><option value="All">Semua kategori</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
        {canManage && <button className={`${btnPrimary} sm:ml-auto justify-center`} onClick={() => open({ unit: "Unit", availability: "Ready", warrantyMonths: 12, requiresCalibration: false, isActive: true })}><Plus className="w-4 h-4" /> New Product</button>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr><th className="px-6 py-4 font-semibold">Produk</th><th className="px-6 py-4 font-semibold">Kategori</th><th className="px-6 py-4 font-semibold text-right">Harga</th><th className="px-6 py-4 font-semibold">Ketersediaan</th><th className="px-6 py-4 font-semibold">Garansi / Kalibrasi</th>{canManage && <th className="px-6 py-4"><span className="sr-only">Aksi</span></th>}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length ? filtered.map(p => (
                <tr key={p.id} className={p.isActive ? "" : "opacity-60"}>
                  <td className="px-6 py-4"><p className="font-semibold text-slate-800">{p.name}</p><p className="text-xs text-slate-500">{p.sku} · {p.brand}{p.model ? ` ${p.model}` : ""}{p.hsCode ? ` · HS ${p.hsCode}` : ""}{!p.isActive && " · nonaktif"}</p></td>
                  <td className="px-6 py-4">{p.category}</td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">{rupiah(p.price)}<span className="block text-xs font-normal text-slate-500">/ {p.unit}</span></td>
                  <td className="px-6 py-4">{p.availability === "Indent" ? <span className="text-amber-700">Indent {p.leadTimeWeeks ? `${p.leadTimeWeeks} mgg` : ""}</span> : <span className="text-emerald-700">Ready</span>}</td>
                  <td className="px-6 py-4 text-xs">{p.warrantyMonths ? `${p.warrantyMonths} bln` : "—"}{p.requiresCalibration ? ` · kalibrasi ${p.calibrationIntervalMonths ?? 12} bln` : ""}</td>
                  {canManage && <td className="px-6 py-4 text-right"><button onClick={() => open(p)} className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md" aria-label={`Edit ${p.name}`}><Pencil className="w-4 h-4" /></button></td>}
                </tr>
              )) : <EmptyTableRow colSpan={canManage ? 6 : 5} icon={<Package className="w-12 h-12 text-slate-200" />} title="Tidak ada produk" />}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={products.length} label="produk" />
      </div>

      <ModalShell isOpen={!!editing} onClose={() => setEditing(null)} size="max-w-2xl">
        {editing && (
          <form onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const num = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
            exec(() => saveProduct(editing.id ?? null, {
              sku: String(f.get("sku")), name: String(f.get("name")), category: String(f.get("category")), brand: String(f.get("brand")), model: String(f.get("model") || "") || undefined,
              unit: String(f.get("unit") || "Unit"), price: Number(f.get("price")), availability: String(f.get("availability")), leadTimeWeeks: num("leadTimeWeeks"),
              warrantyMonths: Number(f.get("warrantyMonths")) || 0, requiresCalibration: f.get("requiresCalibration") === "on", calibrationIntervalMonths: num("calibrationIntervalMonths"),
              specs: String(f.get("specs") || "") || undefined, isActive: f.get("isActive") === "on", hsCode: String(f.get("hsCode") || "") || null,
            }), () => setEditing(null));
          }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 id="modal-title" className="font-bold text-slate-800">{editing.id ? "Edit produk" : "New Product"}</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 overflow-y-auto">
              <div><label className={labelCls} htmlFor="pr-sku">Kode</label><input id="pr-sku" name="sku" required defaultValue={editing.sku} className={inputCls} /></div>
              <div className="col-span-1 sm:col-span-3"><label className={labelCls} htmlFor="pr-name">Nama</label><input id="pr-name" name="name" required defaultValue={editing.name} className={inputCls} /></div>
              <div className="col-span-2"><label className={labelCls} htmlFor="pr-cat">Kategori</label><input id="pr-cat" name="category" required list="pr-cats" defaultValue={editing.category} className={inputCls} /><datalist id="pr-cats">{categories.map(c => <option key={c} value={c} />)}</datalist></div>
              <div><label className={labelCls} htmlFor="pr-brand">Merek</label><input id="pr-brand" name="brand" required defaultValue={editing.brand} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="pr-model">Model</label><input id="pr-model" name="model" defaultValue={editing.model ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="pr-hs">Kode HS (ekspor)</label><input id="pr-hs" name="hsCode" placeholder="9023.00.00" defaultValue={editing.hsCode ?? ""} className={inputCls} /></div>
              <div className="col-span-2"><label className={labelCls} htmlFor="pr-price">Harga (Rp, belum PPN)</label><input id="pr-price" name="price" type="number" min={0} step={1000} required defaultValue={editing.price} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="pr-unit">Satuan</label><input id="pr-unit" name="unit" defaultValue={editing.unit} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="pr-war">Garansi (bln)</label><input id="pr-war" name="warrantyMonths" type="number" min={0} defaultValue={editing.warrantyMonths} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="pr-av">Ketersediaan</label><select id="pr-av" name="availability" defaultValue={editing.availability} className={inputCls}><option>Ready</option><option>Indent</option></select></div>
              <div><label className={labelCls} htmlFor="pr-lead">Indent (mgg)</label><input id="pr-lead" name="leadTimeWeeks" type="number" min={0} defaultValue={editing.leadTimeWeeks ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="pr-cal">Interval kalibrasi (bln)</label><input id="pr-cal" name="calibrationIntervalMonths" type="number" min={0} defaultValue={editing.calibrationIntervalMonths ?? ""} className={inputCls} /></div>
              <div className="flex flex-col justify-end gap-2 text-sm text-slate-700">
                <label className="flex items-center gap-2"><input type="checkbox" name="requiresCalibration" defaultChecked={editing.requiresCalibration} /> Perlu kalibrasi</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={editing.isActive} /> Aktif dijual</label>
              </div>
              <div className="col-span-2 sm:col-span-4"><label className={labelCls} htmlFor="pr-specs">Spesifikasi</label><textarea id="pr-specs" name="specs" rows={3} defaultValue={editing.specs ?? ""} className={inputCls} /></div>
              <div className="col-span-2 sm:col-span-4"><ErrorNote error={error} /></div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setEditing(null)}>Batal</button>
              <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </form>
        )}
      </ModalShell>
    </div>
  );
}
