"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, CheckSquare, FileText, Receipt, Square, Truck, X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { advanceSalesOrder, cancelSalesOrder, createInvoiceFromSchedule, toggleContractReview } from "../../actions";
import { contractState, invoiceState, rupiah, today, type SalesAccess } from "../../lib";
import { Card, DocLinks, ErrorNote, History, InfoRow, StatusBadge, btnDanger, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../../ui";

type SO = {
  id: string; soNo: string; customerPoNo: string; customerPoDate: string; customerPoFile: string | null; orderDate: string; status: string;
  contractReviewJson: string; deliveryAddress: string | null; expectedDelivery: string | null; installationDate: string | null; bastNo: string | null; bastDate: string | null;
  subtotal: number; taxAmount: number; total: number; paymentScheduleJson: string; salesName: string; notes: string | null; historyJson: string;
  customer: { id: string; name: string }; quotation: { id: string; quotationNo: string; revision: number } | null;
  items: { id: string; description: string; qty: number; unit: string; unitPrice: number; lineTotal: number; serialNumbers: string | null }[];
  invoices: { id: string; invoiceNo: string; termLabel: string; invoiceDate: string; dueDate: string; total: number; paidAmount: number; status: string }[];
  contracts: { id: string; contractNo: string; type: string; title: string; endDate: string; status: string }[];
};

const STEPS = ["Contract Review", "Confirmed", "In Delivery", "Installed", "Completed"];
const NEXT_LABEL: Record<string, string> = { "Contract Review": "Konfirmasi order", Confirmed: "Mulai pengiriman", "In Delivery": "Input BAST instalasi", Installed: "Selesaikan order" };

export default function OrderDetail({ so, access }: { so: SO; access: SalesAccess }) {
  const { pending, error, exec } = useAction();
  const bast = useAction();
  const [bastOpen, setBastOpen] = useState(false);
  const review = JSON.parse(so.contractReviewJson) as { item: string; ok: boolean; reviewedBy?: string; date?: string }[];
  const schedule = JSON.parse(so.paymentScheduleJson) as { label: string; percent: number; trigger: string }[];
  const stepIdx = STEPS.indexOf(so.status);
  const m = access.canManage;
  const paid = so.invoices.filter(i => i.status !== "Cancelled").reduce((s, i) => s + i.paidAmount, 0);

  function advance() {
    if (so.status === "In Delivery") { bast.setError(null); setBastOpen(true); return; }
    exec(() => advanceSalesOrder(so.id));
  }
  function cancel() {
    const reason = prompt("Alasan pembatalan Sales Order:");
    if (reason) exec(() => cancelSalesOrder(so.id, reason));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link href="/modules/sales/orders" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Sales Orders</Link>
          <h2 className="text-xl font-bold text-slate-800 mt-1 flex flex-wrap items-center gap-2">{so.soNo} <StatusBadge status={so.status} /></h2>
          <p className="text-sm text-slate-500"><Link href={`/modules/sales/customers/${so.customer.id}`} className="hover:underline">{so.customer.name}</Link> · PO {so.customerPoNo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DocLinks kind="order-confirmation" id={so.id} label="Konfirmasi" formats={["pdf", "docx"]} />
          {["In Delivery", "Installed", "Completed"].includes(so.status) && <DocLinks kind="bast" id={so.id} label="BAST" formats={["pdf", "docx"]} />}
          {access.canApprove && !["Completed", "Cancelled"].includes(so.status) && <button className={btnDanger} disabled={pending} onClick={cancel}><Ban className="w-4 h-4" /> Batalkan</button>}
          {m && NEXT_LABEL[so.status] && <button className={btnPrimary} disabled={pending} onClick={advance}><Truck className="w-4 h-4" /> {NEXT_LABEL[so.status]}</button>}
        </div>
      </div>
      <ErrorNote error={error} />

      {so.status !== "Cancelled" && (
        <ol className="grid grid-cols-5 gap-2" aria-label="Progres order">
          {STEPS.map((s, i) => (
            <li key={s} className={`rounded-lg border px-3 py-2 text-xs font-semibold text-center ${i < stepIdx ? "bg-emerald-50 border-emerald-200 text-emerald-700" : i === stepIdx ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-400"}`}>
              <span className="sr-only">{i < stepIdx ? "Selesai: " : i === stepIdx ? "Sekarang: " : "Berikutnya: "}</span>{s}
            </li>
          ))}
        </ol>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title="Contract review (ISO 9001 Cl. 8.2.3)">
            <ul className="space-y-2">
              {review.map((r, i) => {
                const editable = m && so.status === "Contract Review";
                const Icon = r.ok ? CheckSquare : Square;
                return (
                  <li key={r.item}>
                    <button type="button" disabled={!editable || pending} onClick={() => exec(() => toggleContractReview(so.id, i))} className={`w-full flex items-start gap-3 text-left rounded-lg px-2 py-1.5 -mx-2 ${editable ? "hover:bg-slate-50" : "cursor-default"}`} aria-pressed={r.ok}>
                      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${r.ok ? "text-emerald-600" : "text-slate-400"}`} aria-hidden />
                      <span className="text-sm">
                        <span className="text-slate-800">{r.item}</span>
                        {r.ok && r.reviewedBy && <span className="block text-xs text-slate-500">{r.reviewedBy} · {r.date}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Item">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 text-xs uppercase"><tr><th className="pb-2 font-semibold">Deskripsi</th><th className="pb-2 font-semibold text-right">Qty</th><th className="pb-2 font-semibold text-right">Jumlah</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {so.items.map(it => (
                    <tr key={it.id}>
                      <td className="py-2.5 pr-4"><p className="font-medium text-slate-800">{it.description}</p>{it.serialNumbers && <p className="text-xs text-slate-500">S/N: {it.serialNumbers}</p>}</td>
                      <td className="py-2.5 text-right whitespace-nowrap">{it.qty} {it.unit}</td>
                      <td className="py-2.5 text-right tabular-nums whitespace-nowrap">{rupiah(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto w-full sm:w-72 mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">DPP</dt><dd className="tabular-nums">{rupiah(so.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">PPN</dt><dd className="tabular-nums">{rupiah(so.taxAmount)}</dd></div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5"><dt>Total</dt><dd className="tabular-nums">{rupiah(so.total)}</dd></div>
            </dl>
          </Card>

          <Card title={`Termin & invoice · terbayar ${rupiah(paid)} dari ${rupiah(so.total)}`}>
            <ul className="divide-y divide-slate-100">
              {schedule.map((t, i) => {
                const inv = so.invoices.find(x => x.termLabel === t.label && x.status !== "Cancelled");
                const canInvoice = access.canFinance && !inv && !["Contract Review", "Cancelled"].includes(so.status);
                return (
                  <li key={t.label} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{t.label} <span className="font-normal text-slate-500">· {t.trigger}</span></p>
                      <p className="text-xs text-slate-500 tabular-nums">{rupiah(so.total * t.percent / 100)}</p>
                    </div>
                    {inv ? (
                      <Link href={`/modules/sales/invoices/${inv.id}`} className="flex items-center gap-2 text-sm text-blue-700 hover:underline">
                        <FileText className="w-4 h-4" aria-hidden /> {inv.invoiceNo} <StatusBadge status={invoiceState(inv)} />
                      </Link>
                    ) : canInvoice ? (
                      <button className={btnSecondary} disabled={pending} onClick={() => exec(() => createInvoiceFromSchedule(so.id, i))}><Receipt className="w-4 h-4" /> Terbitkan invoice</button>
                    ) : <span className="text-xs text-slate-400">Belum ditagih</span>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Info order">
            <dl className="space-y-3">
              <InfoRow label="Tanggal PO">{so.customerPoDate}</InfoRow>
              <InfoRow label="File PO">{so.customerPoFile ? <a href={so.customerPoFile} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Lihat file PO</a> : null}</InfoRow>
              <InfoRow label="Penawaran">{so.quotation ? <Link href={`/modules/sales/quotations/${so.quotation.id}`} className="text-blue-700 hover:underline">{so.quotation.quotationNo} Rev.{so.quotation.revision}</Link> : null}</InfoRow>
              <InfoRow label="Sales">{so.salesName}</InfoRow>
              <InfoRow label="Alamat kirim">{so.deliveryAddress}</InfoRow>
              <InfoRow label="Target kirim">{so.expectedDelivery}</InfoRow>
              <InfoRow label="BAST">{so.bastNo ? `${so.bastNo} (${so.bastDate})` : null}</InfoRow>
              {so.notes && <InfoRow label="Catatan">{so.notes}</InfoRow>}
            </dl>
          </Card>
          {so.contracts.length > 0 && (
            <Card title="Kontrak">
              <ul className="space-y-2">
                {so.contracts.map(c => (
                  <li key={c.id} className="text-sm flex items-center justify-between gap-2">
                    <span><span className="font-medium text-slate-800">{c.title}</span><span className="block text-xs text-slate-500">{c.contractNo} · s/d {c.endDate}</span></span>
                    <StatusBadge status={contractState(c)} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Aktivitas"><History json={so.historyJson} /></Card>
        </div>
      </div>

      <ModalShell isOpen={bastOpen} onClose={() => setBastOpen(false)} size="max-w-xl">
        <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const serials = Object.fromEntries(so.items.map(it => [it.id, String(f.get(`sn-${it.id}`) || "")]));
          bast.exec(() => advanceSalesOrder(so.id, { bastNo: String(f.get("bastNo")), bastDate: String(f.get("bastDate")), serials }), () => setBastOpen(false));
        }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 id="modal-title" className="font-bold text-slate-800">BAST instalasi</h2>
            <button type="button" onClick={() => setBastOpen(false)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} htmlFor="bast-no">No. BAST</label><input id="bast-no" name="bastNo" required className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="bast-date">Tanggal BAST</label><input id="bast-date" name="bastDate" type="date" required max={today()} defaultValue={today()} className={inputCls} /></div>
            </div>
            <fieldset className="space-y-3">
              <legend className={labelCls}>Nomor seri alat (pisahkan dengan koma)</legend>
              {so.items.map(it => (
                <div key={it.id}>
                  <label htmlFor={`sn-${it.id}`} className="text-sm text-slate-700">{it.description} <span className="text-slate-500">({it.qty} {it.unit})</span></label>
                  <input id={`sn-${it.id}`} name={`sn-${it.id}`} defaultValue={it.serialNumbers ?? ""} className={`${inputCls} mt-1`} />
                </div>
              ))}
            </fieldset>
            <p className="text-xs text-slate-500">Setelah disimpan, kontrak garansi dibuat otomatis untuk alat yang bergaransi.</p>
            <ErrorNote error={bast.error} />
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setBastOpen(false)}>Batal</button>
            <button type="submit" className={btnPrimary} disabled={bast.pending}>{bast.pending ? "Menyimpan…" : "Simpan BAST"}</button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
