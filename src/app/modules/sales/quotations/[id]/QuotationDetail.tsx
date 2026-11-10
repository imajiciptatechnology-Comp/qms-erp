"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CopyPlus, FileDown, Pencil, Send, ShoppingCart, Trash2, X, XCircle } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import {
  createSalesOrderFromQuotation, decideQuotation, deleteQuotation, reviseQuotation, setQuotationStatus, submitQuotation,
} from "../../actions";
import { PAYMENT_SCHEDULES, addDays, needsApproval, today, type SalesAccess, money } from "../../lib";
import { Card, ErrorNote, History, InfoRow, StatusBadge, btnDanger, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../../ui";

type Item = { id: string; description: string; specs: string | null; qty: number; unit: string; unitPrice: number; discountPercent: number; lineTotal: number };
type Q = {
  id: string; quotationNo: string; revision: number; date: string; validUntil: string; status: string; subject: string; attention: string | null;
  introText: string | null; closingText: string | null; subtotal: number; discountPercent: number; discountAmount: number; taxPercent: number; taxAmount: number; total: number;
  paymentTerms: string | null; deliveryTerms: string | null; warrantyTerms: string | null; notes: string | null; salesName: string; approvedBy: string | null; approvedAt: string | null;
  historyJson: string; currency: string; exchangeRate: number; customer: { id: string; name: string; address: string | null; city: string | null; paymentTerms: string; country: string };
  opportunity: { opportunityNo: string; title: string } | null; items: Item[]; salesOrders: { id: string; soNo: string }[];
  revisions: { id: string; revision: number; status: string; date: string; total: number; currency: string }[];
};

export default function QuotationDetail({ q, access }: { q: Q; access: SalesAccess }) {
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const [soOpen, setSoOpen] = useState(false);
  const so = useAction();
  const m = access.canManage;
  const isLatest = q.revisions[q.revisions.length - 1]?.id === q.id;

  const reject = () => {
    const note = prompt("Alasan penolakan (penawaran kembali ke Draft):");
    if (note) exec(() => decideQuotation(q.id, "reject", note));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link href="/modules/sales/quotations" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Quotations</Link>
          <h2 className="text-xl font-bold text-slate-800 mt-1 flex flex-wrap items-center gap-2">{q.quotationNo} <span className="text-slate-500 font-medium text-base">Rev.{q.revision}</span> <StatusBadge status={q.status} /></h2>
          <p className="text-sm text-slate-500">{q.subject}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/modules/sales/quotations/${q.id}/export?format=pdf`} target="_blank" rel="noreferrer" className={btnSecondary}><FileDown className="w-4 h-4" /> PDF</a>
          <a href={`/modules/sales/quotations/${q.id}/export?format=docx`} className={btnSecondary}><FileDown className="w-4 h-4" /> Word</a>
          {q.status === "Draft" && m && <>
            <Link href={`/modules/sales/quotations/${q.id}/edit`} className={btnSecondary}><Pencil className="w-4 h-4" /> Edit</Link>
            {q.revision === 0 && <button className={btnDanger} disabled={pending} onClick={() => confirm("Hapus penawaran Draft ini?") && exec(() => deleteQuotation(q.id), () => router.push("/modules/sales/quotations"))}><Trash2 className="w-4 h-4" /> Hapus</button>}
            <button className={btnPrimary} disabled={pending} onClick={() => exec(() => submitQuotation(q.id))}>
              <Send className="w-4 h-4" /> {needsApproval(q.discountPercent, q.items) ? "Ajukan persetujuan" : "Ajukan"}
            </button>
          </>}
          {q.status === "Waiting Approval" && access.canApprove && <>
            <button className={btnDanger} disabled={pending} onClick={reject}><XCircle className="w-4 h-4" /> Tolak</button>
            <button className={btnPrimary} disabled={pending} onClick={() => exec(() => decideQuotation(q.id, "approve"))}><Check className="w-4 h-4" /> Setujui diskon</button>
          </>}
          {q.status === "Approved" && m && <button className={btnPrimary} disabled={pending} onClick={() => exec(() => setQuotationStatus(q.id, "Sent"))}><Send className="w-4 h-4" /> Tandai terkirim ke customer</button>}
          {q.status === "Sent" && m && <>
            <button className={btnDanger} disabled={pending} onClick={() => confirm("Customer menolak penawaran ini?") && exec(() => setQuotationStatus(q.id, "Rejected"))}><X className="w-4 h-4" /> Ditolak customer</button>
            <button className={btnPrimary} disabled={pending} onClick={() => exec(() => setQuotationStatus(q.id, "Accepted"))}><Check className="w-4 h-4" /> Diterima customer</button>
          </>}
          {["Waiting Approval", "Approved", "Sent", "Rejected"].includes(q.status) && m && isLatest && (
            <button className={btnSecondary} disabled={pending} onClick={() => exec(() => reviseQuotation(q.id), id => router.push(`/modules/sales/quotations/${id}`))}><CopyPlus className="w-4 h-4" /> Buat revisi</button>
          )}
          {q.status === "Accepted" && (q.salesOrders.length
            ? <Link href={`/modules/sales/orders/${q.salesOrders[0].id}`} className={btnSecondary}><ShoppingCart className="w-4 h-4" /> {q.salesOrders[0].soNo}</Link>
            : m && <button className={btnPrimary} onClick={() => { so.setError(null); setSoOpen(true); }}><ShoppingCart className="w-4 h-4" /> Input PO → Sales Order</button>)}
        </div>
      </div>
      <ErrorNote error={error} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Isi penawaran, mengikuti urutan surat */}
        <Card className="xl:col-span-2">
          <div className="space-y-5 text-sm text-slate-800">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kepada Yth.</p>
                <Link href={`/modules/sales/customers/${q.customer.id}`} className="font-semibold text-blue-700 hover:underline">{q.customer.name}</Link>
                {q.attention && <p>UP: {q.attention}</p>}
                <p className="text-slate-500">{q.customer.address}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <InfoRow label="Tanggal">{q.date}</InfoRow>
                <InfoRow label="Berlaku s/d">{q.validUntil}</InfoRow>
              </dl>
            </div>
            <p className="whitespace-pre-line leading-relaxed">{q.introText}</p>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-700 text-left">
                  <tr><th className="px-3 py-2.5 font-semibold w-8">No</th><th className="px-3 py-2.5 font-semibold">Deskripsi</th><th className="px-3 py-2.5 font-semibold text-right">Qty</th><th className="px-3 py-2.5 font-semibold text-right">Harga</th><th className="px-3 py-2.5 font-semibold text-right">Jumlah</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {q.items.map((it, i) => (
                    <tr key={it.id} className="align-top">
                      <td className="px-3 py-2.5 text-slate-500">{i + 1}</td>
                      <td className="px-3 py-2.5"><p className="font-medium">{it.description}</p>{it.specs && <p className="text-xs text-slate-500 mt-0.5">{it.specs}</p>}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{it.qty} {it.unit}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{money(it.unitPrice, q.currency)}{it.discountPercent > 0 && <span className="block text-xs text-amber-700">diskon {it.discountPercent}%</span>}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums font-medium">{money(it.lineTotal, q.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto w-full sm:w-80 space-y-1.5">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{money(q.subtotal, q.currency)}</dd></div>
              {q.discountAmount > 0 && <div className="flex justify-between"><dt className="text-slate-500">Diskon {q.discountPercent}%</dt><dd className="tabular-nums">− {money(q.discountAmount, q.currency)}</dd></div>}
              <div className="flex justify-between"><dt className="text-slate-500">PPN {q.taxPercent}%</dt><dd className="tabular-nums">{money(q.taxAmount, q.currency)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-base"><dt>Total</dt><dd className="tabular-nums">{money(q.total, q.currency)}</dd></div>
            </dl>

            <dl className="grid sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
              <InfoRow label="Pembayaran">{q.paymentTerms}</InfoRow>
              <InfoRow label="Pengiriman">{q.deliveryTerms}</InfoRow>
              <InfoRow label="Garansi">{q.warrantyTerms}</InfoRow>
            </dl>
            <p className="whitespace-pre-line leading-relaxed">{q.closingText}</p>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Info">
            <dl className="space-y-3">
              <InfoRow label="Sales">{q.salesName}</InfoRow>
              <InfoRow label="Opportunity">{q.opportunity ? `${q.opportunity.opportunityNo} · ${q.opportunity.title}` : null}</InfoRow>
              <InfoRow label="Persetujuan">{q.approvedBy ? `${q.approvedBy} (${q.approvedAt})` : null}</InfoRow>
              {q.notes && <InfoRow label="Catatan internal">{q.notes}</InfoRow>}
            </dl>
          </Card>
          {q.revisions.length > 1 && (
            <Card title="Riwayat revisi">
              <ul className="space-y-2">
                {q.revisions.map(r => (
                  <li key={r.id}>
                    <Link href={`/modules/sales/quotations/${r.id}`} className={`flex items-center justify-between gap-2 text-sm rounded-lg px-2 py-1.5 -mx-2 ${r.id === q.id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                      <span className="font-medium text-slate-800">Rev.{r.revision} <span className="text-slate-500 font-normal">· {r.date}</span></span>
                      <span className="flex items-center gap-2"><span className="tabular-nums text-slate-700">{money(r.total, r.currency)}</span><StatusBadge status={r.status} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Aktivitas"><History json={q.historyJson} /></Card>
        </div>
      </div>

      <ModalShell isOpen={soOpen} onClose={() => setSoOpen(false)}>
        <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); so.exec(() => createSalesOrderFromQuotation(f), id => router.push(`/modules/sales/orders/${id}`)); }}>
          <input type="hidden" name="quotationId" value={q.id} />
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 id="modal-title" className="font-bold text-slate-800">Input PO customer</h2>
            <button type="button" onClick={() => setSoOpen(false)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto">
            <p className="text-sm text-slate-600">Sales Order dibuat dari {q.quotationNo} Rev.{q.revision} ({money(q.total, q.currency)}) dan masuk tahap <b>Contract Review</b>.</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} htmlFor="po-no">No. PO customer</label><input id="po-no" name="customerPoNo" required className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="po-date">Tanggal PO</label><input id="po-date" name="customerPoDate" type="date" required max={today()} defaultValue={today()} className={inputCls} /></div>
            </div>
            <div><label className={labelCls} htmlFor="po-file">File PO (PDF/gambar, opsional)</label><input id="po-file" name="poFile" type="file" accept=".pdf,image/*" className="block w-full text-sm text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} htmlFor="po-sched">Termin pembayaran</label>
                <select id="po-sched" name="schedule" className={inputCls} defaultValue={q.paymentTerms?.startsWith("100%") ? "100% setelah BAST" : "DP 30% / 70%"}>{Object.keys(PAYMENT_SCHEDULES).map(k => <option key={k}>{k}</option>)}</select>
              </div>
              <div><label className={labelCls} htmlFor="po-del">Target pengiriman</label><input id="po-del" name="expectedDelivery" type="date" defaultValue={addDays(today(), 21)} className={inputCls} /></div>
            </div>
            <ErrorNote error={so.error} />
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setSoOpen(false)}>Batal</button>
            <button type="submit" className={btnPrimary} disabled={so.pending}>{so.pending ? "Menyimpan…" : "Buat Sales Order"}</button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
