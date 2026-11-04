"use client";

import { useMemo, useState } from "react";
import { computeCharterPrice, type RateTable } from "../lib";
import { inputCls, labelCls } from "../ui";
import PriceBreakdown from "../PriceBreakdown";

/** Kalkulator cek harga cepat untuk CS (tanpa membuat order). */
export default function QuickQuote({ table }: { table: RateTable }) {
  const [p, setP] = useState({ routeId: table.routes[0]?.id ?? "", truckTypeId: table.truckTypes[0]?.id ?? "", stopCount: 1, overnightDays: 0, tkbm: false, escort: false, insurance: false, returnLoad: false, cargoValue: 0, discountPercent: 0 });
  const price = useMemo(() => computeCharterPrice(table, p), [table, p]);
  const small = table.truckTypes.find(t => t.id === p.truckTypeId)?.sizeClass === "small";
  const set = (patch: Partial<typeof p>) => setP(x => ({ ...x, ...patch }));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="grid grid-cols-2 gap-3 content-start">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls} htmlFor="qq-route">Rute</label>
          <select id="qq-route" value={p.routeId} onChange={e => set({ routeId: e.target.value })} className={inputCls}>
            {table.routes.map(r => <option key={r.id} value={r.id}>{r.code} · {r.destination}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls} htmlFor="qq-type">Jenis truk</label>
          <select id="qq-type" value={p.truckTypeId} onChange={e => { const s = table.truckTypes.find(t => t.id === e.target.value)?.sizeClass === "small"; set({ truckTypeId: e.target.value, escort: s ? false : p.escort }); }} className={inputCls}>
            {table.truckTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="qq-stops">Titik bongkar</label>
          <input id="qq-stops" type="number" min={1} max={10} value={p.stopCount} onChange={e => set({ stopCount: Math.max(1, Number(e.target.value) || 1) })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="qq-night">Menginap (hari)</label>
          <input id="qq-night" type="number" min={0} max={14} value={p.overnightDays} onChange={e => set({ overnightDays: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="qq-value">Nilai barang (Rp)</label>
          <input id="qq-value" type="number" min={0} step={1000000} value={p.cargoValue || ""} onChange={e => set({ cargoValue: Number(e.target.value) || 0 })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="qq-disc">Diskon kontrak (%)</label>
          <input id="qq-disc" type="number" min={0} max={30} value={p.discountPercent} onChange={e => set({ discountPercent: Number(e.target.value) || 0 })} className={inputCls} />
        </div>
        {([["tkbm", "TKBM"], ["escort", "Pengawalan"], ["insurance", "Asuransi"], ["returnLoad", "Muatan balik"]] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={p[k]} disabled={k === "escort" && small} onChange={e => set({ [k]: e.target.checked })} className="w-4 h-4 rounded border-slate-300" /> {label}
          </label>
        ))}
      </div>
      <PriceBreakdown price={price} />
    </div>
  );
}
