"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Plus, Trash2 } from "lucide-react";
import { INCOTERMS, PRODUCTION_LABEL, SHIPMENT_MODES, SHIPMENT_SCOPES, type CratePackage, money } from "@/app/modules/sales/lib";
import { Card, ErrorNote, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "@/app/modules/sales/ui";
import { createShipment, updateShipment, type ShipmentInput } from "../actions";

type OrderOption = {
  id: string; soNo: string; customerPoNo: string; customer: string; deliveryAddress: string; productionStatus: string; currency: string;
  payment: { paid: number; remaining: number; fullyPaid: boolean }; items: { description: string; qty: number; unit: string }[];
};

const packagesFor = (o?: OrderOption): CratePackage[] =>
  o ? o.items.filter(i => !/^(Jasa|Instalasi|Kontrak)/i.test(i.description)).map((i, idx) => ({ crateNo: `C-${String(idx + 1).padStart(2, "0")}`, contents: `${i.qty} ${i.unit} ${i.description.split(" — ")[0]}`, dims: "", grossKg: null, netKg: null })) : [];

export default function ShipmentForm({ orders, initial, shipmentId }: { orders: OrderOption[]; initial?: ShipmentInput; shipmentId?: string }) {
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const [form, setForm] = useState<ShipmentInput>(() => {
    if (initial) return initial;
    const o = orders[0];
    return { salesOrderId: o?.id ?? "", scope: "Domestik", incoterm: "Franco", mode: "Laut", forwarder: "", origin: "Batam", destination: o?.deliveryAddress ?? "", etd: "", eta: "", awbNo: "", vessel: "", containerNo: "", notes: "", packages: packagesFor(o) };
  });
  const set = <K extends keyof ShipmentInput>(k: K, v: ShipmentInput[K]) => setForm(f => ({ ...f, [k]: v }));
  const order = orders.find(o => o.id === form.salesOrderId);

  function pickOrder(id: string) {
    const o = orders.find(x => x.id === id);
    setForm(f => ({ ...f, salesOrderId: id, destination: o?.deliveryAddress ?? f.destination, packages: packagesFor(o) }));
  }
  function setPkg(i: number, patch: Partial<CratePackage>) {
    setForm(f => ({ ...f, packages: f.packages.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }));
  }

  return (
    <form className="space-y-6" onSubmit={e => {
      e.preventDefault();
      exec(() => (shipmentId ? updateShipment(shipmentId, form) : createShipment(form)), id => router.push(`/modules/contract-shipping/shipments/${id ?? shipmentId}`));
    }}>
      <Card title="Sales Order">
        {orders.length === 0 && !shipmentId ? <p className="text-sm text-slate-500">Belum ada Sales Order berstatus Confirmed / In Delivery.</p> : (
          <div className="space-y-3">
            <div>
              <label className={labelCls} htmlFor="ship-so">Sales Order</label>
              <select id="ship-so" value={form.salesOrderId} onChange={e => pickOrder(e.target.value)} disabled={!!shipmentId} className={inputCls}>
                {orders.map(o => <option key={o.id} value={o.id}>{o.soNo} — {o.customer} (PO {o.customerPoNo})</option>)}
              </select>
            </div>
            {order && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-slate-600">Produksi: <strong>{PRODUCTION_LABEL[order.productionStatus]}</strong></span>
                {order.payment.fullyPaid
                  ? <span className="text-emerald-700 font-medium">Lunas — boleh dikirim</span>
                  : <span className="text-red-700 font-medium flex items-center gap-1"><Lock className="w-4 h-4" aria-hidden /> Belum lunas (sisa {money(order.payment.remaining, order.currency)}) — shipment bisa disiapkan, tapi rilis terkunci</span>}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Pengiriman">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className={labelCls} htmlFor="ship-scope">Lingkup</label><select id="ship-scope" value={form.scope} onChange={e => { set("scope", e.target.value); set("incoterm", e.target.value === "Ekspor" ? "FOB" : "Franco"); }} className={inputCls}>{SHIPMENT_SCOPES.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label className={labelCls} htmlFor="ship-inco">Incoterms</label><select id="ship-inco" value={form.incoterm ?? ""} onChange={e => set("incoterm", e.target.value)} className={inputCls}>{INCOTERMS.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label className={labelCls} htmlFor="ship-mode">Moda</label><select id="ship-mode" value={form.mode} onChange={e => set("mode", e.target.value)} className={inputCls}>{SHIPMENT_MODES.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label className={labelCls} htmlFor="ship-origin">Asal</label><input id="ship-origin" value={form.origin ?? ""} onChange={e => set("origin", e.target.value)} className={inputCls} /></div>
          <div className="md:col-span-2"><label className={labelCls} htmlFor="ship-dest">Tujuan</label><input id="ship-dest" required value={form.destination} onChange={e => set("destination", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="ship-fwd">Forwarder / ekspedisi</label><input id="ship-fwd" value={form.forwarder ?? ""} onChange={e => set("forwarder", e.target.value)} className={inputCls} placeholder="Mis. PT Samudera Logistik" /></div>
          <div><label className={labelCls} htmlFor="ship-etd">ETD</label><input id="ship-etd" type="date" value={form.etd ?? ""} onChange={e => set("etd", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="ship-eta">ETA</label><input id="ship-eta" type="date" value={form.eta ?? ""} onChange={e => set("eta", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="ship-awb">No. B/L / AWB / resi</label><input id="ship-awb" value={form.awbNo ?? ""} onChange={e => set("awbNo", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="ship-vessel">Kapal / penerbangan</label><input id="ship-vessel" value={form.vessel ?? ""} onChange={e => set("vessel", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="ship-cont">No. kontainer</label><input id="ship-cont" value={form.containerNo ?? ""} onChange={e => set("containerNo", e.target.value)} className={inputCls} /></div>
          <div className="md:col-span-3"><label className={labelCls} htmlFor="ship-notes">Catatan</label><textarea id="ship-notes" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} className={inputCls} /></div>
        </div>
      </Card>

      <Card title="Peti / kemasan (Packing List)" actions={<button type="button" className="text-sm text-blue-600 hover:underline flex items-center gap-1" onClick={() => set("packages", [...form.packages, { crateNo: `C-${String(form.packages.length + 1).padStart(2, "0")}`, contents: "", dims: "", grossKg: null, netKg: null }])}><Plus className="w-4 h-4" /> Tambah peti</button>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="pb-2 pr-2 font-semibold">No. peti</th><th className="pb-2 pr-2 font-semibold">Isi</th><th className="pb-2 pr-2 font-semibold">Dimensi (cm)</th><th className="pb-2 pr-2 font-semibold">Gross kg</th><th className="pb-2 pr-2 font-semibold">Net kg</th><th /></tr></thead>
            <tbody>
              {form.packages.map((p, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2 w-24"><input aria-label={`No. peti baris ${i + 1}`} value={p.crateNo} onChange={e => setPkg(i, { crateNo: e.target.value })} className={inputCls} /></td>
                  <td className="py-1 pr-2 min-w-64"><input aria-label={`Isi peti baris ${i + 1}`} value={p.contents} onChange={e => setPkg(i, { contents: e.target.value })} className={inputCls} /></td>
                  <td className="py-1 pr-2 w-36"><input aria-label={`Dimensi baris ${i + 1}`} value={p.dims ?? ""} onChange={e => setPkg(i, { dims: e.target.value })} className={inputCls} placeholder="120×80×100" /></td>
                  <td className="py-1 pr-2 w-24"><input aria-label={`Gross kg baris ${i + 1}`} type="number" min={0} step="0.1" value={p.grossKg ?? ""} onChange={e => setPkg(i, { grossKg: e.target.value ? Number(e.target.value) : null })} className={inputCls} /></td>
                  <td className="py-1 pr-2 w-24"><input aria-label={`Net kg baris ${i + 1}`} type="number" min={0} step="0.1" value={p.netKg ?? ""} onChange={e => setPkg(i, { netKg: e.target.value ? Number(e.target.value) : null })} className={inputCls} /></td>
                  <td className="py-1"><button type="button" onClick={() => set("packages", form.packages.filter((_, idx) => idx !== i))} className="p-2 text-slate-400 hover:text-red-600" aria-label={`Hapus peti baris ${i + 1}`}><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <Link href={shipmentId ? `/modules/contract-shipping/shipments/${shipmentId}` : "/modules/contract-shipping/shipments"} className={btnSecondary}>Batal</Link>
        <button type="submit" className={btnPrimary} disabled={pending || !form.salesOrderId}>{pending ? "Menyimpan…" : shipmentId ? "Simpan perubahan" : "Buat shipment"}</button>
      </div>
    </form>
  );
}
