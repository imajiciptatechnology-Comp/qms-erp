"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Banknote, Loader2, MailWarning, X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { cancelInvoice, createPaymentReminder, recordPayment, updateInvoiceTax } from "../../actions";
import { daysBetween, invoiceState, rupiah, today, type SalesAccess } from "../../lib";
import { Card, DocLinks, ErrorNote, History, InfoRow, StatusBadge, btnDanger, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../../ui";

type Inv = {
  id: string; invoiceNo: string; termLabel: string; termPercent: number | null; invoiceDate: string; dueDate: string; subtotal: number; taxAmount: number; total: number;
  paidAmount: number; status: string; fakturPajakNo: string | null; historyJson: string;
  customer: { id: string; name: string; npwp: string | null; address: string | null; paymentTerms: string };
  salesOrder: { id: string; soNo: string; customerPoNo: string } | null;
  contract: { id: string; contractNo: string; title: string } | null;
  periodLabel: string | null;
  payments: { id: string; paymentDate: string; amount: number; method: string; reference: string | null; proofUrl: string | null; receivedBy: string; receiptNo: string | null }[];
  items: { id: string; description: string; qty: number; unit: string; unitPrice: number; lineTotal: number }[];
  reminders: { id: string; letterNo: string; level: number; date: string; subject: string; createdBy: string }[];
};

export default function InvoiceDetail({ inv, access }: { inv: Inv; access: SalesAccess }) {
  const { pending, error, exec } = useAction();
  const pay = useAction();
  const remind = useAction();
  const [payOpen, setPayOpen] = useState(false);
  const state = invoiceState(inv);
  const remaining = inv.total - inv.paidAmount;
  const f = access.canFinance;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link href="/modules/sales/invoices" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Invoices</Link>
          <h2 className="text-xl font-bold text-slate-800 mt-1 flex flex-wrap items-center gap-2">{inv.invoiceNo} <StatusBadge status={state} /></h2>
          <p className="text-sm text-slate-500"><Link href={`/modules/sales/customers/${inv.customer.id}`} className="hover:underline">{inv.customer.name}</Link> · {inv.termLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DocLinks kind="invoice" id={inv.id} />
          {f && !["Paid", "Cancelled"].includes(inv.status) && <>
            {inv.paidAmount === 0 && <button className={btnDanger} disabled={pending} onClick={() => { const r = prompt("Alasan pembatalan invoice:"); if (r) exec(() => cancelInvoice(inv.id, r)); }}><Ban className="w-4 h-4" /> Batalkan</button>}
            <button className={btnPrimary} onClick={() => { pay.setError(null); setPayOpen(true); }}><Banknote className="w-4 h-4" /> Catat pembayaran</button>
          </>}
        </div>
      </div>
      <ErrorNote error={error} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title="Tagihan">
            <dl className="grid sm:grid-cols-3 gap-4">
              <InfoRow label="Tanggal invoice">{inv.invoiceDate}</InfoRow>
              <InfoRow label="Jatuh tempo">{inv.dueDate}{state === "Overdue" ? ` — ${daysBetween(inv.dueDate, today())} hari lewat` : ""}</InfoRow>
              <InfoRow label="Referensi">
                {inv.salesOrder ? <Link href={`/modules/sales/orders/${inv.salesOrder.id}`} className="text-blue-700 hover:underline">{inv.salesOrder.soNo} (PO {inv.salesOrder.customerPoNo})</Link>
                  : inv.contract ? <Link href={`/modules/sales/contracts/${inv.contract.id}`} className="text-blue-700 hover:underline">{inv.contract.contractNo}{inv.periodLabel ? ` · ${inv.periodLabel}` : ""}</Link>
                  : "Invoice manual"}
              </InfoRow>
            </dl>
            {inv.items.length > 0 && (
              <table className="w-full text-sm mt-5">
                <thead className="text-left text-slate-500 text-xs uppercase"><tr><th className="pb-2 font-semibold">Item</th><th className="pb-2 font-semibold text-right">Qty</th><th className="pb-2 font-semibold text-right">Jumlah</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {inv.items.map(it => (
                    <tr key={it.id}><td className="py-2 pr-4 text-slate-800">{it.description}</td><td className="py-2 text-right whitespace-nowrap">{it.qty} {it.unit}</td><td className="py-2 text-right tabular-nums whitespace-nowrap">{rupiah(it.lineTotal)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <dl className="ml-auto w-full sm:w-80 mt-5 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">DPP{inv.termPercent ? ` (${inv.termPercent}%)` : ""}</dt><dd className="tabular-nums">{rupiah(inv.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">PPN</dt><dd className="tabular-nums">{rupiah(inv.taxAmount)}</dd></div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5"><dt>Total</dt><dd className="tabular-nums">{rupiah(inv.total)}</dd></div>
              <div className="flex justify-between text-emerald-700"><dt>Terbayar</dt><dd className="tabular-nums">{rupiah(inv.paidAmount)}</dd></div>
              <div className="flex justify-between font-bold text-base"><dt>Sisa</dt><dd className="tabular-nums">{rupiah(inv.status === "Cancelled" ? 0 : remaining)}</dd></div>
            </dl>
          </Card>

          <Card title={`Pembayaran (${inv.payments.length})`}>
            {inv.payments.length === 0 ? <p className="text-sm text-slate-500">Belum ada pembayaran.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500 text-xs uppercase"><tr><th className="pb-2 font-semibold">Tanggal</th><th className="pb-2 font-semibold">Metode / Referensi</th><th className="pb-2 font-semibold">Dicatat</th><th className="pb-2 font-semibold text-right">Nominal</th><th className="pb-2"><span className="sr-only">Kwitansi</span></th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {inv.payments.map(p => (
                      <tr key={p.id}>
                        <td className="py-2.5 whitespace-nowrap">{p.paymentDate}</td>
                        <td className="py-2.5">{p.method}{p.reference ? ` · ${p.reference}` : ""}{p.proofUrl && <a href={p.proofUrl} target="_blank" rel="noreferrer" className="ml-2 text-blue-700 hover:underline">bukti</a>}</td>
                        <td className="py-2.5 text-slate-500">{p.receivedBy}</td>
                        <td className="py-2.5 text-right tabular-nums font-medium">{rupiah(p.amount)}</td>
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap"><DocLinks kind="receipt" id={p.id} label="Kwitansi" formats={["pdf"]} small /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {(state === "Overdue" || inv.reminders.length > 0) && (
            <Card title={`Surat pengingat pembayaran (${inv.reminders.length})`} actions={f && state === "Overdue" ? (
              <button className={btnSecondary} disabled={remind.pending} onClick={() => remind.exec(() => createPaymentReminder(inv.id))}>
                {remind.pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailWarning className="w-4 h-4" />} {remind.pending ? "AI menyusun surat…" : "Buat surat dengan AI"}
              </button>
            ) : undefined}>
              <ErrorNote error={remind.error} />
              {inv.reminders.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada surat. Tingkat surat dipilih otomatis: pengingat (≤30 hari), peringatan (31–60 hari), peringatan terakhir (&gt;60 hari), dan selalu naik dari surat sebelumnya.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {inv.reminders.map(r => (
                    <li key={r.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                      <span><span className="font-semibold text-slate-800">{r.letterNo}</span> <span className="text-slate-500">· {r.date} · {["", "Pengingat", "Peringatan", "Peringatan terakhir"][r.level]} · {r.createdBy}</span><span className="block text-xs text-slate-500">{r.subject}</span></span>
                      <span className="flex gap-3"><DocLinks kind="reminder" id={r.id} small /></span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Pajak & customer">
            <dl className="space-y-3">
              <InfoRow label="NPWP customer">{inv.customer.npwp}</InfoRow>
              <InfoRow label="Alamat">{inv.customer.address}</InfoRow>
              <InfoRow label="Termin customer">{inv.customer.paymentTerms}</InfoRow>
            </dl>
            <form className="mt-4" onSubmit={e => { e.preventDefault(); exec(() => updateInvoiceTax(inv.id, String(new FormData(e.currentTarget).get("faktur") || ""))); }}>
              <label className={labelCls} htmlFor="faktur">No. faktur pajak</label>
              <div className="flex gap-2">
                <input id="faktur" name="faktur" defaultValue={inv.fakturPajakNo ?? ""} disabled={!f} className={inputCls} placeholder="010.000-26.00000000" />
                {f && <button type="submit" className={btnSecondary} disabled={pending}>Simpan</button>}
              </div>
            </form>
          </Card>
          <Card title="Aktivitas"><History json={inv.historyJson} /></Card>
        </div>
      </div>

      <ModalShell isOpen={payOpen} onClose={() => setPayOpen(false)}>
        <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); pay.exec(() => recordPayment(fd), () => setPayOpen(false)); }}>
          <input type="hidden" name="invoiceId" value={inv.id} />
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 id="modal-title" className="font-bold text-slate-800">Catat pembayaran</h2>
            <button type="button" onClick={() => setPayOpen(false)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto">
            <p className="text-sm text-slate-600">Sisa tagihan: <b className="tabular-nums">{rupiah(remaining)}</b></p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} htmlFor="pay-amt">Nominal (Rp)</label><input id="pay-amt" name="amount" type="number" min={1} max={Math.ceil(remaining)} step="any" required defaultValue={Math.round(remaining)} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="pay-date">Tanggal terima</label><input id="pay-date" name="paymentDate" type="date" required max={today()} defaultValue={today()} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} htmlFor="pay-method">Metode</label><select id="pay-method" name="method" className={inputCls}><option>Transfer</option><option>Giro</option><option>Tunai</option></select></div>
              <div><label className={labelCls} htmlFor="pay-ref">Referensi</label><input id="pay-ref" name="reference" className={inputCls} placeholder="mis. TRF BNI 1103" /></div>
            </div>
            <div><label className={labelCls} htmlFor="pay-proof">Bukti transfer (opsional)</label><input id="pay-proof" name="proof" type="file" accept=".pdf,image/*" className="block w-full text-sm text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700" /></div>
            <ErrorNote error={pay.error} />
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setPayOpen(false)}>Batal</button>
            <button type="submit" className={btnPrimary} disabled={pay.pending}>{pay.pending ? "Menyimpan…" : "Simpan pembayaran"}</button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
