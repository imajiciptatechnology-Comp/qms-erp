"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Banknote, FileMinus, Loader2, MailWarning, X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { cancelInvoice, createPaymentReminder, recordPayment, updateInvoiceTax } from "../../actions";
import { createCreditNote } from "../../financeActions";
import { daysBetween, invoiceState, roundMoney, today, type SalesAccess, money } from "../../lib";
import { Card, DocLinks, ErrorNote, History, InfoRow, StatusBadge, btnDanger, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../../ui";

type Inv = {
  id: string; invoiceNo: string; termLabel: string; termPercent: number | null; invoiceDate: string; dueDate: string; subtotal: number; taxAmount: number; total: number;
  paidAmount: number; status: string; fakturPajakNo: string | null; historyJson: string; currency: string; exchangeRate: number; taxPercent: number;
  customer: { id: string; name: string; npwp: string | null; address: string | null; paymentTerms: string };
  salesOrder: { id: string; soNo: string; customerPoNo: string } | null;
  contract: { id: string; contractNo: string; title: string } | null;
  periodLabel: string | null;
  payments: { id: string; paymentDate: string; amount: number; method: string; reference: string | null; proofUrl: string | null; receivedBy: string; receiptNo: string | null }[];
  items: { id: string; description: string; qty: number; unit: string; unitPrice: number; lineTotal: number }[];
  reminders: { id: string; letterNo: string; level: number; date: string; subject: string; createdBy: string }[];
  creditNotes: { id: string; creditNoteNo: string; date: string; reason: string; subtotal: number; taxAmount: number; total: number; paymentId: string | null; createdBy: string }[];
};

export default function InvoiceDetail({ inv, access }: { inv: Inv; access: SalesAccess }) {
  const { pending, error, exec } = useAction();
  const pay = useAction();
  const remind = useAction();
  const [payOpen, setPayOpen] = useState(false);
  const cn = useAction();
  const [cnOpen, setCnOpen] = useState(false);
  const [cnDpp, setCnDpp] = useState(0);
  const cnTax = roundMoney(cnDpp * inv.taxPercent / 100, inv.currency);
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
            <button className={btnSecondary} onClick={() => { cn.setError(null); setCnDpp(0); setCnOpen(true); }}><FileMinus className="w-4 h-4" /> Nota kredit</button>
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
                  : inv.contract ? <Link href={`/modules/contract-shipping/contracts/${inv.contract.id}`} className="text-blue-700 hover:underline">{inv.contract.contractNo}{inv.periodLabel ? ` · ${inv.periodLabel}` : ""}</Link>
                  : "Invoice manual"}
              </InfoRow>
            </dl>
            {inv.items.length > 0 && (
              <table className="w-full text-sm mt-5">
                <thead className="text-left text-slate-500 text-xs uppercase"><tr><th className="pb-2 font-semibold">Item</th><th className="pb-2 font-semibold text-right">Qty</th><th className="pb-2 font-semibold text-right">Jumlah</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {inv.items.map(it => (
                    <tr key={it.id}><td className="py-2 pr-4 text-slate-800">{it.description}</td><td className="py-2 text-right whitespace-nowrap">{it.qty} {it.unit}</td><td className="py-2 text-right tabular-nums whitespace-nowrap">{money(it.lineTotal, inv.currency)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <dl className="ml-auto w-full sm:w-80 mt-5 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">DPP{inv.termPercent ? ` (${inv.termPercent}%)` : ""}</dt><dd className="tabular-nums">{money(inv.subtotal, inv.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">PPN {inv.taxPercent}%</dt><dd className="tabular-nums">{money(inv.taxAmount, inv.currency)}</dd></div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5"><dt>Total</dt><dd className="tabular-nums">{money(inv.total, inv.currency)}</dd></div>
              <div className="flex justify-between text-emerald-700"><dt>Terbayar</dt><dd className="tabular-nums">{money(inv.paidAmount, inv.currency)}</dd></div>
              <div className="flex justify-between font-bold text-base"><dt>Sisa</dt><dd className="tabular-nums">{money(inv.status === "Cancelled" ? 0 : remaining, inv.currency)}</dd></div>
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
                        <td className="py-2.5 text-right tabular-nums font-medium">{money(p.amount, inv.currency)}</td>
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">{p.method === "Nota Kredit"
                          ? (() => { const note = inv.creditNotes.find(c => c.paymentId === p.id); return note ? <DocLinks kind="credit-note" id={note.id} label="Nota kredit" formats={["pdf"]} small /> : null; })()
                          : <DocLinks kind="receipt" id={p.id} label="Kwitansi" formats={["pdf"]} small />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {inv.creditNotes.length > 0 && (
            <Card title={`Nota kredit (${inv.creditNotes.length})`}>
              <ul className="divide-y divide-slate-100">
                {inv.creditNotes.map(c => (
                  <li key={c.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <span><span className="font-semibold text-slate-800">{c.creditNoteNo}</span> <span className="text-slate-500">· {c.date} · {c.createdBy}</span><span className="block text-xs text-slate-500">{c.reason}</span></span>
                    <span className="flex items-center gap-3"><span className="tabular-nums font-medium">− {money(c.total, inv.currency)}</span><DocLinks kind="credit-note" id={c.id} small /></span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

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

      <ModalShell isOpen={cnOpen} onClose={() => setCnOpen(false)}>
        <form onSubmit={e => {
          e.preventDefault();
          const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          cn.exec(() => createCreditNote(inv.id, { date: fd.date, subtotal: cnDpp, reason: fd.reason }), () => setCnOpen(false));
        }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 id="modal-title" className="font-bold text-slate-800">Terbitkan nota kredit</h2>
            <button type="button" onClick={() => setCnOpen(false)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto">
            <p className="text-sm text-slate-600">Mengurangi tagihan {inv.invoiceNo} (sisa <b className="tabular-nums">{money(remaining, inv.currency)}</b>), mis. karena retur, koreksi harga, atau potongan. PPN ikut dikoreksi {inv.taxPercent}%.</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} htmlFor="cn-dpp">Nilai DPP ({inv.currency})</label><input id="cn-dpp" type="number" min={0} step="any" required value={cnDpp || ""} onChange={e => setCnDpp(Number(e.target.value))} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="cn-date">Tanggal</label><input id="cn-date" name="date" type="date" required defaultValue={today()} className={inputCls} /></div>
            </div>
            <dl className="text-sm space-y-1 bg-slate-50 rounded-lg px-3 py-2">
              <div className="flex justify-between"><dt className="text-slate-500">PPN {inv.taxPercent}%</dt><dd className="tabular-nums">{money(cnTax, inv.currency)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total nota kredit</dt><dd className="tabular-nums">{money(roundMoney(cnDpp + cnTax, inv.currency), inv.currency)}</dd></div>
            </dl>
            <div><label className={labelCls} htmlFor="cn-reason">Alasan</label><textarea id="cn-reason" name="reason" rows={2} required className={inputCls} placeholder="mis. Retur 1 unit modul sensor rusak saat pengiriman" /></div>
            {inv.taxPercent > 0 && <p className="text-xs text-slate-500">Untuk invoice ber-PPN, buat juga faktur pajak pengganti / retur di Coretax sesuai nilai di atas.</p>}
            <ErrorNote error={cn.error} />
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setCnOpen(false)}>Batal</button>
            <button type="submit" className={btnPrimary} disabled={cn.pending || !(cnDpp > 0)}>{cn.pending ? "Menyimpan…" : "Terbitkan"}</button>
          </div>
        </form>
      </ModalShell>

      <ModalShell isOpen={payOpen} onClose={() => setPayOpen(false)}>
        <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); pay.exec(() => recordPayment(fd), () => setPayOpen(false)); }}>
          <input type="hidden" name="invoiceId" value={inv.id} />
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 id="modal-title" className="font-bold text-slate-800">Catat pembayaran</h2>
            <button type="button" onClick={() => setPayOpen(false)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto">
            <p className="text-sm text-slate-600">Sisa tagihan: <b className="tabular-nums">{money(remaining, inv.currency)}</b></p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} htmlFor="pay-amt">Nominal ({inv.currency})</label><input id="pay-amt" name="amount" type="number" min={inv.currency === "IDR" ? 1 : 0.01} max={roundMoney(remaining, inv.currency)} step="any" required defaultValue={roundMoney(remaining, inv.currency)} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="pay-date">Tanggal terima</label><input id="pay-date" name="paymentDate" type="date" required max={today()} defaultValue={today()} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} htmlFor="pay-method">Metode</label><select id="pay-method" name="method" className={inputCls}><option>Transfer</option><option>L/C</option><option>Giro</option><option>Tunai</option></select></div>
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
