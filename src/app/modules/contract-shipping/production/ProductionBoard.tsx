"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Factory, Lock, Pencil, X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { PRODUCTION_LABEL, PRODUCTION_STATUSES, rupiah, today } from "@/app/modules/sales/lib";
import { ErrorNote, StatusBadge, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "@/app/modules/sales/ui";
import { updateProduction } from "../actions";

type Order = {
  id: string; soNo: string; customerPoNo: string; status: string; total: number; expectedDelivery: string | null;
  productionStatus: string; productionStart: string | null; productionTarget: string | null; productionNotes: string | null;
  customer: { id: string; name: string; city: string | null };
  items: { description: string; qty: number; unit: string }[];
  salesShipments: { id: string; shipmentNo: string; status: string; exceptionStatus: string | null }[];
  payment: { paid: number; remaining: number; fullyPaid: boolean };
};

export default function ProductionBoard({ orders, canManage }: { orders: Order[]; canManage: boolean }) {
  const [editing, setEditing] = useState<Order | null>(null);
  const { pending, error, setError, exec } = useAction();
  const columns = PRODUCTION_STATUSES.map(s => ({ status: s, orders: orders.filter(o => o.productionStatus === s && o.status === "Confirmed") }));
  const shipped = orders.filter(o => o.status !== "Confirmed");

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Status produksi diisi manual oleh admin (belum ada modul produksi). Order yang <strong>Siap kirim</strong> baru bisa dikirim setelah lunas, atau dengan izin khusus Sales Manager.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map(col => (
          <section key={col.status} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3" aria-label={PRODUCTION_LABEL[col.status]}>
            <h2 className="text-sm font-semibold text-slate-700 flex items-center justify-between px-1">
              {PRODUCTION_LABEL[col.status]} <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">{col.orders.length}</span>
            </h2>
            {col.orders.length ? col.orders.map(o => {
              const exception = o.salesShipments.some(s => s.exceptionStatus === "Approved");
              return (
                <article key={o.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/modules/sales/orders/${o.id}`} className="font-semibold text-sm text-slate-800 hover:underline">{o.soNo}</Link>
                      <p className="text-xs text-slate-500 truncate">{o.customer.name}</p>
                    </div>
                    {canManage && (
                      <button type="button" onClick={() => { setError(null); setEditing(o); }} className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50" aria-label={`Ubah status produksi ${o.soNo}`}>
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <ul className="text-xs text-slate-600 space-y-0.5">
                    {o.items.slice(0, 3).map((it, i) => <li key={i} className="truncate">{it.qty}× {it.description.split(" — ")[0]}</li>)}
                    {o.items.length > 3 && <li className="text-slate-400">+{o.items.length - 3} item lain</li>}
                  </ul>
                  {o.productionTarget && <p className={`text-xs ${o.productionTarget < today() && col.status !== "Ready to Ship" ? "text-red-600 font-semibold" : "text-slate-500"}`}>Target selesai {o.productionTarget}</p>}
                  {col.status === "Ready to Ship" && (
                    o.payment.fullyPaid || exception ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> {o.payment.fullyPaid ? "Lunas" : "Izin khusus"}</span>
                        {canManage && !o.salesShipments.some(s => s.status !== "Cancelled") && <Link href={`/modules/contract-shipping/shipments/new?so=${o.id}`} className="text-xs font-semibold text-blue-700 hover:underline">Buat shipment</Link>}
                      </div>
                    ) : (
                      <p className="text-xs text-red-700 flex items-center gap-1"><Lock className="w-3.5 h-3.5" aria-hidden /> Belum lunas · sisa {rupiah(o.payment.remaining)}</p>
                    )
                  )}
                </article>
              );
            }) : <p className="text-xs text-slate-400 px-1 py-4 text-center">Kosong</p>}
          </section>
        ))}
      </div>

      {shipped.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <h2 className="px-5 py-3.5 border-b border-slate-100 font-semibold text-slate-800 flex items-center gap-2"><Factory className="w-4 h-4 text-slate-400" aria-hidden /> Sudah dikirim / terpasang</h2>
          <ul className="divide-y divide-slate-100">
            {shipped.map(o => (
              <li key={o.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                <span><Link href={`/modules/sales/orders/${o.id}`} className="font-semibold text-slate-800 hover:underline">{o.soNo}</Link><span className="block text-xs text-slate-500">{o.customer.name}</span></span>
                <span className="flex items-center gap-2">
                  {o.salesShipments.filter(s => s.status !== "Cancelled").map(s => <Link key={s.id} href={`/modules/contract-shipping/shipments/${s.id}`} className="text-xs text-blue-700 hover:underline">{s.shipmentNo}</Link>)}
                  <StatusBadge status={o.status} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ModalShell isOpen={!!editing} onClose={() => setEditing(null)} size="max-w-lg">
        {editing && (
          <form onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            exec(() => updateProduction(editing.id, { status: String(f.get("status")), start: String(f.get("start") || ""), target: String(f.get("target") || ""), notes: String(f.get("notes") || "") }), () => setEditing(null));
          }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 id="modal-title" className="font-bold text-slate-800">Status produksi {editing.soNo}</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls} htmlFor="prod-status">Status</label>
                <select id="prod-status" name="status" defaultValue={editing.productionStatus} className={inputCls}>
                  {PRODUCTION_STATUSES.map(s => <option key={s} value={s}>{PRODUCTION_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls} htmlFor="prod-start">Mulai produksi</label><input id="prod-start" name="start" type="date" defaultValue={editing.productionStart ?? ""} className={inputCls} /></div>
                <div><label className={labelCls} htmlFor="prod-target">Target selesai</label><input id="prod-target" name="target" type="date" defaultValue={editing.productionTarget ?? editing.expectedDelivery ?? ""} className={inputCls} /></div>
              </div>
              <div><label className={labelCls} htmlFor="prod-notes">Catatan</label><textarea id="prod-notes" name="notes" rows={3} defaultValue={editing.productionNotes ?? ""} className={inputCls} placeholder="Mis. menunggu komponen kompresor, QC dijadwalkan 12 Nov" /></div>
              <ErrorNote error={error} />
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
