"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Check, Clock, Pencil, Receipt, RefreshCw, Send, Upload, X, XCircle } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { decideContract, markContractSent, renewContract, submitContract, terminateContract, uploadSignedContract } from "../../actions";
import { visitSchedule, type Clause } from "../../documents/contractTemplates";
import { contractBillingPeriods, contractState, daysBetween, invoiceState, rupiah, today, type SalesAccess } from "../../lib";
import { Card, DocLinks, ErrorNote, History, InfoRow, StatusBadge, btnDanger, btnPrimary, btnSecondary, labelCls, useAction } from "../../ui";

type C = {
  id: string; contractNo: string; type: string; title: string; startDate: string; endDate: string; value: number; visitsPerYear: number | null;
  coveredItemsJson: string; status: string; picName: string | null; notes: string | null; historyJson: string; scope: string | null; responseTime: string | null;
  paymentTerms: string | null; billingSchedule: string; sparePartDiscount: number | null; signatoryName: string | null; signatoryTitle: string | null;
  clausesJson: string; approvalDueDate: string | null; approvedBy: string | null; approvedAt: string | null; signedFileUrl: string | null;
  customer: { id: string; name: string; contactName: string | null };
  salesOrder: { id: string; soNo: string; bastNo: string | null } | null;
  invoices: { id: string; invoiceNo: string; periodLabel: string | null; total: number; paidAmount: number; status: string; dueDate: string }[];
  renewedFrom: { id: string; contractNo: string } | null;
  renewal: { id: string; contractNo: string; status: string } | null;
};

const FLOW = ["Draft", "Waiting Approval", "Approved", "Sent", "Active"];

export default function ContractDetail({ c, access }: { c: C; access: SalesAccess }) {
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const upload = useAction();
  const [uploadOpen, setUploadOpen] = useState(false);
  const state = contractState(c);
  const items = JSON.parse(c.coveredItemsJson || "[]") as { product: string; serialNumber: string; location?: string }[];
  const clauses = JSON.parse(c.clausesJson || "[]") as Clause[];
  const schedule = visitSchedule(c.startDate, c.endDate, c.visitsPerYear);
  const isWarranty = c.type === "Garansi";
  const m = access.canManage;
  const lateApproval = c.status === "Waiting Approval" && !!c.approvalDueDate && today() > c.approvalDueDate;
  const billable = !isWarranty && c.value > 0 && ["Approved", "Sent", "Active"].includes(c.status);
  const periods = billable ? contractBillingPeriods(c) : [];
  const stepIdx = FLOW.indexOf(c.status);

  const reject = () => {
    const note = prompt("Alasan penolakan (kontrak kembali ke Draft):");
    if (note) exec(() => decideContract(c.id, "reject", note));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link href="/modules/sales/contracts" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Contracts</Link>
          <h2 className="text-xl font-bold text-slate-800 mt-1 flex flex-wrap items-center gap-2">{c.contractNo} <StatusBadge status={state} /></h2>
          <p className="text-sm text-slate-500">{c.title} · <Link href={`/modules/sales/customers/${c.customer.id}`} className="hover:underline">{c.customer.name}</Link></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DocLinks kind="contract" id={c.id} label={isWarranty ? "Sertifikat" : "Perjanjian"} formats={isWarranty ? ["pdf"] : ["pdf", "docx"]} />
          {c.status === "Draft" && m && <>
            <Link href={`/modules/sales/contracts/${c.id}/edit`} className={btnSecondary}><Pencil className="w-4 h-4" /> Edit</Link>
            <button className={btnPrimary} disabled={pending} onClick={() => exec(() => submitContract(c.id))}><Send className="w-4 h-4" /> Ajukan persetujuan</button>
          </>}
          {c.status === "Waiting Approval" && access.canApprove && <>
            <button className={btnDanger} disabled={pending} onClick={reject}><XCircle className="w-4 h-4" /> Tolak</button>
            <button className={btnPrimary} disabled={pending} onClick={() => exec(() => decideContract(c.id, "approve"))}><Check className="w-4 h-4" /> Setujui</button>
          </>}
          {c.status === "Approved" && m && <button className={btnSecondary} disabled={pending} onClick={() => exec(() => markContractSent(c.id))}><Send className="w-4 h-4" /> Tandai terkirim</button>}
          {["Approved", "Sent"].includes(c.status) && m && <button className={btnPrimary} onClick={() => { upload.setError(null); setUploadOpen(true); }}><Upload className="w-4 h-4" /> Upload scan bertanda tangan</button>}
          {["Active", "Expired"].includes(c.status) && m && !c.renewal && (
            <button className={btnSecondary} disabled={pending} onClick={() => exec(() => renewContract(c.id), id => id && router.push(`/modules/sales/contracts/${id}`))}>
              <RefreshCw className="w-4 h-4" /> {isWarranty ? "Lanjutkan ke AMC" : "Perpanjang"}
            </button>
          )}
          {c.renewal && <Link href={`/modules/sales/contracts/${c.renewal.id}`} className={btnSecondary}><RefreshCw className="w-4 h-4" /> Perpanjangan: {c.renewal.contractNo}</Link>}
          {access.canApprove && ["Active", "Approved", "Sent"].includes(c.status) && (
            <button className={btnDanger} disabled={pending} onClick={() => { const r = prompt("Alasan menghentikan kontrak:"); if (r) exec(() => terminateContract(c.id, r)); }}><Ban className="w-4 h-4" /> Hentikan</button>
          )}
        </div>
      </div>
      <ErrorNote error={error} />

      {!isWarranty && stepIdx >= 0 && (
        <ol className="grid grid-cols-5 gap-2" aria-label="Progres kontrak">
          {FLOW.map((s, i) => (
            <li key={s} className={`rounded-lg border px-3 py-2 text-xs font-semibold text-center ${i < stepIdx ? "bg-emerald-50 border-emerald-200 text-emerald-700" : i === stepIdx ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-400"}`}>
              <span className="sr-only">{i < stepIdx ? "Selesai: " : i === stepIdx ? "Sekarang: " : "Berikutnya: "}</span>{s}
            </li>
          ))}
        </ol>
      )}

      {c.status === "Waiting Approval" && c.approvalDueDate && (
        <p className={`text-sm rounded-lg border px-3 py-2 flex items-center gap-2 ${lateApproval ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
          <Clock className="w-4 h-4 shrink-0" aria-hidden />
          {lateApproval
            ? <>Batas approval <b>{c.approvalDueDate}</b> sudah lewat {daysBetween(c.approvalDueDate, today())} hari. Mohon segera diputuskan.</>
            : <>Menunggu persetujuan Sales Manager, batas <b>{c.approvalDueDate}</b> (7 hari kerja sejak diajukan).</>}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title={`Alat dicakup (${items.length})`}>
            {items.length === 0 ? <p className="text-sm text-slate-500">Belum ada alat.</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 text-xs uppercase"><tr><th className="pb-2 font-semibold">Alat</th><th className="pb-2 font-semibold">No. Seri</th><th className="pb-2 font-semibold">Lokasi</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{items.map((it, i) => <tr key={i}><td className="py-2 pr-3 font-medium text-slate-800">{it.product}</td><td className="py-2 pr-3">{it.serialNumber}</td><td className="py-2">{it.location || "—"}</td></tr>)}</tbody>
              </table>
            )}
          </Card>

          {schedule.length > 0 && (
            <Card title="Rencana jadwal kunjungan">
              <ul className="grid sm:grid-cols-2 gap-2 text-sm">{schedule.map((d, i) => <li key={d} className="bg-slate-50 rounded-lg px-3 py-2">Kunjungan {i + 1} · <b>{d.slice(0, 7)}</b></li>)}</ul>
            </Card>
          )}

          {billable && (
            <Card title="Tagihan kontrak" actions={access.canFinance ? <Link href="/modules/sales/invoices/new" className="text-sm text-blue-600 hover:underline flex items-center gap-1"><Receipt className="w-4 h-4" /> Terbitkan invoice</Link> : undefined}>
              <ul className="divide-y divide-slate-100">
                {periods.map(p => {
                  const inv = c.invoices.find(i => i.periodLabel === p.label && i.status !== "Cancelled");
                  return (
                    <li key={p.index} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-700">{p.label} · <span className="tabular-nums">{rupiah(c.value * p.percent / 100)}</span> + PPN</span>
                      {inv ? <Link href={`/modules/sales/invoices/${inv.id}`} className="flex items-center gap-2 text-blue-700 hover:underline">{inv.invoiceNo} <StatusBadge status={invoiceState(inv)} /></Link> : <span className="text-xs text-slate-400">Belum ditagih</span>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {!isWarranty && clauses.length > 0 && (
            <Card title="Pasal perjanjian">
              <ol className="space-y-3 text-sm">
                {clauses.map((cl, i) => (
                  <li key={i}><p className="font-semibold text-slate-800">Pasal {i + 1} — {cl.title}</p><p className="text-slate-600 whitespace-pre-line mt-0.5">{cl.body}</p></li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Info kontrak">
            <dl className="space-y-3">
              <InfoRow label="Jenis">{c.type}</InfoRow>
              <InfoRow label="Periode">{c.startDate} – {c.endDate}</InfoRow>
              {!isWarranty && <InfoRow label="Nilai (belum PPN)">{rupiah(c.value)} · {c.billingSchedule === "Quarterly" ? "tagih per triwulan" : "tagih 100% di awal"}</InfoRow>}
              <InfoRow label="Kunjungan / respon">{[c.visitsPerYear ? `${c.visitsPerYear}× per tahun` : null, c.responseTime].filter(Boolean).join(" · ") || null}</InfoRow>
              {c.sparePartDiscount ? <InfoRow label="Diskon suku cadang">{c.sparePartDiscount}%</InfoRow> : null}
              <InfoRow label="Penandatangan customer">{c.signatoryName ? `${c.signatoryName}${c.signatoryTitle ? ` — ${c.signatoryTitle}` : ""}` : null}</InfoRow>
              <InfoRow label="Persetujuan">{c.approvedBy ? `${c.approvedBy} (${c.approvedAt})` : null}</InfoRow>
              <InfoRow label="Scan bertanda tangan">{c.signedFileUrl ? <a href={c.signedFileUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Lihat file</a> : null}</InfoRow>
              {c.salesOrder && <InfoRow label="Sales Order"><Link href={`/modules/sales/orders/${c.salesOrder.id}`} className="text-blue-700 hover:underline">{c.salesOrder.soNo}</Link></InfoRow>}
              {c.renewedFrom && <InfoRow label="Perpanjangan dari"><Link href={`/modules/sales/contracts/${c.renewedFrom.id}`} className="text-blue-700 hover:underline">{c.renewedFrom.contractNo}</Link></InfoRow>}
              {c.picName && <InfoRow label="PIC">{c.picName}</InfoRow>}
              {c.notes && <InfoRow label="Catatan">{c.notes}</InfoRow>}
            </dl>
          </Card>
          <Card title="Aktivitas"><History json={c.historyJson} /></Card>
        </div>
      </div>

      <ModalShell isOpen={uploadOpen} onClose={() => setUploadOpen(false)}>
        <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); upload.exec(() => uploadSignedContract(fd), () => setUploadOpen(false)); }}>
          <input type="hidden" name="contractId" value={c.id} />
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 id="modal-title" className="font-bold text-slate-800">Upload perjanjian bertanda tangan</h2>
            <button type="button" onClick={() => setUploadOpen(false)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">Unggah scan perjanjian yang sudah ditandatangani kedua pihak dan bermeterai. Setelah diunggah, kontrak berstatus <b>Active</b>{c.renewedFrom ? ` dan kontrak ${c.renewedFrom.contractNo} ditandai Renewed` : ""}.</p>
            <div><label className={labelCls} htmlFor="signed-file">File scan (PDF/gambar)</label><input id="signed-file" name="file" type="file" required accept=".pdf,image/*" className="block w-full text-sm text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700" /></div>
            <ErrorNote error={upload.error} />
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setUploadOpen(false)}>Batal</button>
            <button type="submit" className={btnPrimary} disabled={upload.pending}>{upload.pending ? "Mengunggah…" : "Aktifkan kontrak"}</button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
