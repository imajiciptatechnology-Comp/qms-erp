import { rupiah, type PriceLine } from "./lib";

/** Rincian harga charter (dipakai form order, kalkulator tarif, dan detail order). */
export default function PriceBreakdown({ price }: {
  price: { ok?: boolean; issues?: string[]; lines: PriceLine[]; discountPercent: number; discountAmount: number; subtotal: number; taxPercent: number; taxAmount: number; total: number };
}) {
  if (price.lines.length === 0) {
    return <p className="text-sm text-slate-500">{price.issues?.[0] ?? "Pilih rute dan jenis truk untuk melihat harga."}</p>;
  }
  return (
    <div className="text-sm space-y-3">
      <ul className="space-y-2">
        {price.lines.map(l => (
          <li key={l.code} className="flex justify-between gap-3">
            <div className="min-w-0">
              <p className="text-slate-800">{l.label}</p>
              <p className="text-xs text-slate-500">{l.detail}</p>
            </div>
            <span className={`whitespace-nowrap tabular-nums ${l.amount < 0 ? "text-emerald-700" : "text-slate-800"}`}>{l.amount < 0 ? "− " + rupiah(-l.amount) : rupiah(l.amount)}</span>
          </li>
        ))}
      </ul>
      <dl className="border-t border-slate-100 pt-2 space-y-1">
        {price.discountAmount > 0 && (
          <div className="flex justify-between text-emerald-700"><dt>Diskon kontrak {price.discountPercent}%</dt><dd className="tabular-nums">− {rupiah(price.discountAmount)}</dd></div>
        )}
        <div className="flex justify-between text-slate-600"><dt>Subtotal (DPP)</dt><dd className="tabular-nums">{rupiah(price.subtotal)}</dd></div>
        <div className="flex justify-between text-slate-600"><dt>PPN {price.taxPercent}% <span className="text-[11px] text-slate-400">(dummy)</span></dt><dd className="tabular-nums">{rupiah(price.taxAmount)}</dd></div>
        <div className="flex justify-between font-bold text-slate-900 text-base pt-1 border-t border-slate-100"><dt>Total</dt><dd className="tabular-nums">{rupiah(price.total)}</dd></div>
      </dl>
      {price.issues && price.issues.length > 0 && (
        <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
          {price.issues.map((i, k) => <li key={k}>⚠ {i}</li>)}
        </ul>
      )}
    </div>
  );
}
