"use client";

import { useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { updateRate, updateSurcharge } from "../actions";
import { rupiah, type RateTable } from "../lib";
import { Card, ErrorNote, btnPrimary, btnSecondary, useAction } from "../ui";

const fmt = (n: number) => Math.round(n).toLocaleString("id-ID");

/** Tabel tarif rute × jenis truk + biaya tambahan. Bisa diedit oleh Operations Manager / Direktur (izin logistics_rates). */
export default function RatesEditor({ table, canEdit }: { table: RateTable; canEdit: boolean }) {
  const { pending, error, exec } = useAction();
  const [editing, setEditing] = useState<{ routeId: string; truckTypeId: string; value: string } | null>(null);
  const [scEdit, setScEdit] = useState<{ code: string; small: string; large: string; percent: string; min: string } | null>(null);
  const priceOf = (routeId: string, truckTypeId: string) => table.rates.find(r => r.routeId === routeId && r.truckTypeId === truckTypeId)?.price;
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(/\./g, "").replace(",", ".")));

  return (
    <>
      <Card title="Charter rates (one way, all-in fuel + toll + driver, excl. VAT)"
        actions={<span className="text-xs text-slate-500">{canEdit ? "Klik angka untuk mengubah tarif" : "Hanya Operations Manager / Direktur yang bisa mengubah tarif"}</span>}>
        <ErrorNote error={error} />
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-slate-50">
              <tr>
                <th className="text-left font-semibold px-5 py-2.5">Rute</th>
                {table.truckTypes.map(t => <th key={t.id} className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">{t.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.routes.map(r => (
                <tr key={r.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap"><b>{r.code}</b> <span className="text-slate-500">· {r.destination}</span></td>
                  {table.truckTypes.map(t => {
                    const p = priceOf(r.id, t.id);
                    const isEditing = editing?.routeId === r.id && editing.truckTypeId === t.id;
                    return (
                      <td key={t.id} className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                        {isEditing ? (
                          <span className="inline-flex items-center gap-1">
                            <input autoFocus aria-label={`Tarif ${r.code} ${t.name}`} value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })}
                              className="w-28 px-2 py-1 border border-blue-300 rounded text-right text-sm" />
                            <button type="button" aria-label="Simpan" disabled={pending} className="p-1 text-emerald-700"
                              onClick={() => exec(() => updateRate(r.id, t.id, num(editing.value) ?? 0), () => setEditing(null))}><Save className="w-4 h-4" /></button>
                            <button type="button" aria-label="Batal" className="p-1 text-slate-400" onClick={() => setEditing(null)}><X className="w-4 h-4" /></button>
                          </span>
                        ) : canEdit ? (
                          <button type="button" className="hover:text-blue-700 hover:underline" onClick={() => setEditing({ routeId: r.id, truckTypeId: t.id, value: p ? fmt(p) : "" })}>
                            {p ? fmt(p) : "—"}
                          </button>
                        ) : (p ? fmt(p) : "—")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Surcharges">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-slate-50">
              <tr>{["Komponen", "Satuan", "Kecil (CDE/CDD)", "Besar (Fuso/Tronton/Trailer)", ""].map(h => <th key={h} className="text-left font-semibold px-5 py-2.5 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.surcharges.map(s => {
                const isEditing = scEdit?.code === s.code;
                const isPct = s.kind !== "flat";
                return (
                  <tr key={s.code}>
                    <td className="px-5 py-2.5">{s.name}</td>
                    <td className="px-5 py-2.5 text-slate-500 whitespace-nowrap">{s.unit}</td>
                    {isEditing ? (
                      isPct ? (
                        <td colSpan={2} className="px-5 py-2">
                          <span className="inline-flex items-center gap-2 text-sm">
                            <input aria-label="Persen" value={scEdit.percent} onChange={e => setScEdit({ ...scEdit, percent: e.target.value })} className="w-20 px-2 py-1 border border-blue-300 rounded" /> %
                            {s.kind === "percent" && <>min. Rp <input aria-label="Minimal" value={scEdit.min} onChange={e => setScEdit({ ...scEdit, min: e.target.value })} className="w-28 px-2 py-1 border border-blue-300 rounded" /></>}
                          </span>
                        </td>
                      ) : (
                        <>
                          <td className="px-5 py-2"><input aria-label="Kecil" value={scEdit.small} onChange={e => setScEdit({ ...scEdit, small: e.target.value })} placeholder="tidak tersedia" className="w-28 px-2 py-1 border border-blue-300 rounded" /></td>
                          <td className="px-5 py-2"><input aria-label="Besar" value={scEdit.large} onChange={e => setScEdit({ ...scEdit, large: e.target.value })} className="w-28 px-2 py-1 border border-blue-300 rounded" /></td>
                        </>
                      )
                    ) : isPct ? (
                      <td colSpan={2} className="px-5 py-2.5">{String(s.percent ?? 0).replace(".", ",")}% {s.kind === "percent" ? `× nilai barang (min. ${rupiah(s.minAmount ?? 0)})` : "× tarif rute"}</td>
                    ) : (
                      <>
                        <td className="px-5 py-2.5 tabular-nums">{s.smallAmount == null ? "—" : rupiah(s.smallAmount)}</td>
                        <td className="px-5 py-2.5 tabular-nums">{s.largeAmount == null ? "—" : rupiah(s.largeAmount)}</td>
                      </>
                    )}
                    <td className="px-5 py-2 text-right whitespace-nowrap">
                      {canEdit && (isEditing ? (
                        <span className="inline-flex gap-2">
                          <button type="button" className={btnPrimary} disabled={pending} onClick={() => exec(() => updateSurcharge(s.code, {
                            smallAmount: isPct ? null : num(scEdit.small), largeAmount: isPct ? null : num(scEdit.large),
                            percent: isPct ? num(scEdit.percent) : null, minAmount: s.kind === "percent" ? num(scEdit.min) : null,
                          }), () => setScEdit(null))}>Save</button>
                          <button type="button" className={btnSecondary} onClick={() => setScEdit(null)}>Cancel</button>
                        </span>
                      ) : (
                        <button type="button" aria-label={`Ubah ${s.name}`} className="p-1.5 text-slate-400 hover:text-blue-700"
                          onClick={() => setScEdit({ code: s.code, small: s.smallAmount == null ? "" : fmt(s.smallAmount), large: s.largeAmount == null ? "" : fmt(s.largeAmount), percent: String(s.percent ?? ""), min: s.minAmount == null ? "" : fmt(s.minAmount) })}>
                          <Pencil className="w-4 h-4" />
                        </button>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3">PPN 11% (dummy — jasa logistik tertentu memakai PPN besaran tertentu, cek konsultan pajak). Diskon kontrak korporat 5–10% diatur per klien.</p>
      </Card>
    </>
  );
}
