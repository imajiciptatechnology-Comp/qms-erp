"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileSignature, PenLine, Plus, Receipt, Trash2 } from "lucide-react";
import { Tab, TabNav } from "@/components/ui/TabNav";
import { createInvoiceFromContract, createManualInvoice } from "../../actions";
import { TAX_PERCENT, computeTotals, lineTotal, rupiah, today, type LineInput } from "../../lib";
import { Card, ErrorNote, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../../ui";

type Customer = { id: string; name: string; paymentTerms: string };
type Product = { id: string; sku: string; name: string; brand: string; model: string | null; unit: string; price: number; category: string };
type ContractRow = {
  id: string; contractNo: string; title: string; type: string; value: number; customer: string;
  periods: { index: number; label: string; percent: number; amount: number; invoice: { id: string; invoiceNo: string } | null }[];
};

const emptyLine = (): LineInput => ({ productId: null, description: "", qty: 1, unit: "Unit", unitPrice: 0 });

export default function NewInvoiceForm({ customers, products, contracts }: { customers: Customer[]; products: Product[]; contracts: ContractRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"contract" | "manual">(contracts.length ? "contract" : "manual");
  const { pending, error, exec } = useAction();
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [termLabel, setTermLabel] = useState("Tagihan");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineInput[]>([emptyLine()]);
  const setLine = (i: number, patch: Partial<LineInput>) => setItems(list => list.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const totals = computeTotals(items.filter(l => l.description));
  const goTo = (id?: string) => id && router.push(`/modules/sales/invoices/${id}`);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/modules/sales/invoices" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Invoices</Link>
        <h2 className="text-xl font-bold text-slate-800 mt-1">Invoice baru</h2>
        <p className="text-sm text-slate-500">Invoice per termin Sales Order diterbitkan dari halaman Sales Order. Di sini: tagihan kontrak atau tagihan manual.</p>
      </div>

      <TabNav>
        <Tab active={tab === "contract"} onClick={() => setTab("contract")}><FileSignature className="w-4 h-4" /> Dari kontrak</Tab>
        <Tab active={tab === "manual"} onClick={() => setTab("manual")}><PenLine className="w-4 h-4" /> Manual</Tab>
      </TabNav>
      <ErrorNote error={error} />

      {tab === "contract" ? (
        <Card title="Kontrak yang bisa ditagih">
          {contracts.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada kontrak AMC/Kalibrasi/Service yang sudah disetujui dan bernilai.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {contracts.map(c => (
                <li key={c.id} className="py-4 first:pt-0">
                  <p className="font-semibold text-slate-800">{c.title}</p>
                  <p className="text-xs text-slate-500">{c.contractNo} · {c.type} · {c.customer} · nilai {rupiah(c.value)} (belum PPN)</p>
                  <ul className="mt-2 space-y-1.5">
                    {c.periods.map(p => (
                      <li key={p.index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{p.label} · <b className="tabular-nums">{rupiah(p.amount)}</b> + PPN</span>
                        {p.invoice ? (
                          <Link href={`/modules/sales/invoices/${p.invoice.id}`} className="text-blue-700 hover:underline text-sm">Sudah ditagih: {p.invoice.invoiceNo}</Link>
                        ) : (
                          <button className={btnSecondary} disabled={pending} onClick={() => exec(() => createInvoiceFromContract(c.id, p.index), goTo)}>
                            <Receipt className="w-4 h-4" /> Terbitkan invoice
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <form className="space-y-6" onSubmit={e => { e.preventDefault(); exec(() => createManualInvoice({ customerId, invoiceDate, termLabel, notes, items }), goTo); }}>
          <Card title="Data tagihan">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls} htmlFor="mi-cust">Customer</label>
                <select id="mi-cust" required value={customerId} onChange={e => setCustomerId(e.target.value)} className={inputCls}>
                  <option value="" disabled>Pilih customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.paymentTerms})</option>)}
                </select>
              </div>
              <div><label className={labelCls} htmlFor="mi-date">Tanggal invoice</label><input id="mi-date" type="date" required value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="mi-term">Keterangan tagihan</label><input id="mi-term" value={termLabel} onChange={e => setTermLabel(e.target.value)} className={inputCls} placeholder="mis. Penggantian suku cadang" /></div>
              <div className="md:col-span-3"><label className={labelCls} htmlFor="mi-notes">Catatan internal</label><input id="mi-notes" value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} /></div>
            </div>
          </Card>

          <Card title="Item" actions={<button type="button" className={btnSecondary} onClick={() => setItems([...items, emptyLine()])}><Plus className="w-4 h-4" /> Tambah item</button>}>
            <div className="space-y-3">
              {items.map((l, i) => (
                <div key={i} className="grid grid-cols-2 md:grid-cols-12 gap-3 items-end border border-slate-200 rounded-lg p-3">
                  <div className="col-span-2 md:col-span-4">
                    <label className={labelCls} htmlFor={`mi-p-${i}`}>Produk (opsional)</label>
                    <select id={`mi-p-${i}`} value={l.productId ?? ""} className={inputCls} onChange={e => {
                      const p = products.find(x => x.id === e.target.value);
                      setLine(i, p ? { productId: p.id, description: p.model ? `${p.name} — ${p.brand} ${p.model}` : `${p.name} — ${p.brand}`, unit: p.unit, unitPrice: p.price } : { productId: null });
                    }}>
                      <option value="">— Item bebas —</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 md:col-span-4"><label className={labelCls} htmlFor={`mi-d-${i}`}>Deskripsi</label><input id={`mi-d-${i}`} value={l.description} onChange={e => setLine(i, { description: e.target.value })} className={inputCls} required={i === 0} /></div>
                  <div className="md:col-span-1"><label className={labelCls} htmlFor={`mi-q-${i}`}>Qty</label><input id={`mi-q-${i}`} type="number" min={0.01} step="any" value={l.qty} onChange={e => setLine(i, { qty: Number(e.target.value) })} className={inputCls} /></div>
                  <div className="md:col-span-2"><label className={labelCls} htmlFor={`mi-pr-${i}`}>Harga satuan</label><input id={`mi-pr-${i}`} type="number" min={0} step={1000} value={l.unitPrice} onChange={e => setLine(i, { unitPrice: Number(e.target.value) })} className={inputCls} /></div>
                  <div className="md:col-span-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold tabular-nums text-slate-800 sr-only md:not-sr-only">{rupiah(lineTotal(l))}</span>
                    {items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-md" aria-label={`Hapus item ${i + 1}`}><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
              ))}
            </div>
            <dl className="ml-auto w-full sm:w-80 mt-5 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">DPP</dt><dd className="tabular-nums">{rupiah(totals.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">PPN {TAX_PERCENT}%</dt><dd className="tabular-nums">{rupiah(totals.taxAmount)}</dd></div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5"><dt>Total</dt><dd className="tabular-nums">{rupiah(totals.total)}</dd></div>
            </dl>
          </Card>

          <div className="flex justify-end gap-2">
            <Link href="/modules/sales/invoices" className={btnSecondary}>Batal</Link>
            <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Terbitkan invoice"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
