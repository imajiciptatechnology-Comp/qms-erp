"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, CheckCircle2, CheckSquare, Lock, PackageCheck, Pencil, Plus, Send, ShieldQuestion, Ship, Square, X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { EXCEPTION_LABEL, PRODUCTION_LABEL, SHIPMENT_STATUS_LABEL, invoiceState, rupiah, today, type CratePackage } from "@/app/modules/sales/lib";
import { Card, DocLinks, ErrorNote, History, InfoRow, StatusBadge, btnDanger, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "@/app/modules/sales/ui";
import { addShipmentDoc, cancelShipment, decideShipmentException, markArrived, markShipped, releaseShipment, requestShipmentException, toggleShipmentDoc } from "../../actions";

type Shipment = {
  id: string; shipmentNo: string; scope: string; incoterm: string | null; mode: string; forwarder: string | null; origin: string; destination: string;
  etd: string | null; eta: string | null; awbNo: string | null; vessel: string | null; containerNo: string | null; packagesJson: string; docsJson: string;
  status: string; exceptionStatus: string | null; exceptionReason: string | null; exceptionRequestedBy: string | null; exceptionDecidedBy: string | null;
  exceptionDecidedAt: string | null; exceptionNote: string | null; shippedAt: string | null; arrivedAt: string | null; receivedBy: string | null;
  notes: string | null; createdBy: string; createdAt: string; historyJson: string;
  customer: { id: string; name: string };
  salesOrder: {
    id: string; soNo: string; customerPoNo: string; total: number; productionStatus: string; status: string;
    invoices: { id: string; invoiceNo: string; termLabel: string; total: number; paidAmount: number; status: string; dueDate: string }[];
  };
  serviceJobs: { id: string; jobNo: string; status: string; type: string }[];
  payment: { paid: number; remaining: number; fullyPaid: boolean };
};

type Modal = null | "exception" | "ship" | "arrive" | "reject";

export default function ShipmentDetail({ s, canManage, canApprove }: { s: Shipment; canManage: boolean; canApprove: boolean }) {
  const { pending, error, exec } = useAction();
  const modal = useAction();
  const [open, setOpen] = useState<Modal>(null);
  const [newDoc, setNewDoc] = useState("");
  const packages = JSON.parse(s.packagesJson) as CratePackage[];
  const docs = JSON.parse(s.docsJson) as { name: string; done: boolean }[];
  const so = s.salesOrder;
  const exceptionOk = s.exceptionStatus === "Approved";
  const gateOpen = s.payment.fullyPaid || exceptionOk;
  const productionReady = so.productionStatus === "Ready to Ship";
  const totalGross = packages.reduce((t, p) => t + (Number(p.grossKg) || 0), 0);
  const show = (m: Modal) => { modal.setError(null); setOpen(m); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link href="/modules/contract-shipping/shipments" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Shipments</Link>
          <h2 className="text-xl font-bold text-slate-800 mt-1 flex flex-wrap items-center gap-2">{s.shipmentNo} <StatusBadge status={s.status} /></h2>
          <p className="text-sm text-slate-500">{s.customer.name} · <Link href={`/modules/sales/orders/${so.id}`} className="hover:underline">{so.soNo}</Link> · {SHIPMENT_STATUS_LABEL[s.status]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DocLinks kind="packing-list" id={s.id} label="Packing List" formats={["pdf", "docx"]} />
          <DocLinks kind="delivery-order" id={s.id} label="Surat Jalan" formats={["pdf"]} />
          {canManage && ["Draft", "Ready"].includes(s.status) && <Link href={`/modules/contract-shipping/shipments/${s.id}/edit`} className={btnSecondary}><Pencil className="w-4 h-4" /> Edit</Link>}
          {canManage && ["Draft", "Ready"].includes(s.status) && <button className={btnDanger} disabled={pending} onClick={() => { const r = prompt("Alasan pembatalan shipment:"); if (r) exec(() => cancelShipment(s.id, r)); }}><Ban className="w-4 h-4" /> Batalkan</button>}
          {canManage && s.status === "Draft" && <button className={btnPrimary} disabled={pending || !gateOpen || !productionReady} onClick={() => exec(() => releaseShipment(s.id))}><PackageCheck className="w-4 h-4" /> Rilis untuk dikirim</button>}
          {canManage && s.status === "Ready" && <button className={btnPrimary} disabled={pending} onClick={() => show("ship")}><Ship className="w-4 h-4" /> Tandai dikirim</button>}
          {canManage && s.status === "Shipped" && <button className={btnPrimary} disabled={pending} onClick={() => show("arrive")}><CheckCircle2 className="w-4 h-4" /> Tandai tiba di client</button>}
        </div>
      </div>
      <ErrorNote error={error} />

      {/* Gerbang pelunasan */}
      {["Draft", "Ready"].includes(s.status) && (
        <section aria-label="Syarat pengiriman" className={`rounded-xl border p-4 ${gateOpen && productionReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <h3 className="font-semibold text-slate-800 mb-2">Syarat kirim</h3>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-2">
              {s.payment.fullyPaid ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden /> : <Lock className="w-4 h-4 text-red-600 mt-0.5 shrink-0" aria-hidden />}
              <span>{s.payment.fullyPaid ? "Order lunas (termasuk L/C)." : <>Belum lunas: terbayar {rupiah(s.payment.paid)} dari {rupiah(so.total)}, <strong>sisa {rupiah(s.payment.remaining)}</strong>.</>}</span>
            </li>
            {!s.payment.fullyPaid && (
              <li className="flex items-start gap-2">
                {exceptionOk ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden /> : <ShieldQuestion className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" aria-hidden />}
                <span>
                  {s.exceptionStatus ? <><strong>{EXCEPTION_LABEL[s.exceptionStatus]}</strong>{s.exceptionReason ? ` — "${s.exceptionReason}"` : ""}{s.exceptionDecidedBy ? ` · ${s.exceptionDecidedBy} (${s.exceptionDecidedAt})` : ` · diajukan ${s.exceptionRequestedBy}`}{s.exceptionNote ? ` · catatan: ${s.exceptionNote}` : ""}</> : "Kasus khusus? Ajukan izin kirim sebelum lunas ke Sales Manager."}
                  {canManage && s.status === "Draft" && s.exceptionStatus !== "Waiting Approval" && !exceptionOk && <button type="button" className="ml-2 text-blue-700 font-medium hover:underline" onClick={() => show("exception")}>Ajukan izin khusus</button>}
                  {canApprove && s.exceptionStatus === "Waiting Approval" && (
                    <span className="ml-2 inline-flex gap-2">
                      <button type="button" className="text-emerald-700 font-semibold hover:underline" disabled={pending} onClick={() => exec(() => decideShipmentException(s.id, "approve"))}>Setujui</button>
                      <button type="button" className="text-red-700 font-semibold hover:underline" onClick={() => show("reject")}>Tolak</button>
                    </span>
                  )}
                </span>
              </li>
            )}
            <li className="flex items-start gap-2">
              {productionReady ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden /> : <Lock className="w-4 h-4 text-red-600 mt-0.5 shrink-0" aria-hidden />}
              <span>Produksi: {PRODUCTION_LABEL[so.productionStatus]}{!productionReady && <> — ubah di <Link href="/modules/contract-shipping/production" className="text-blue-700 hover:underline">Production Status</Link></>}</span>
            </li>
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title={`Peti / kemasan · ${packages.length} peti${totalGross ? ` · ${totalGross.toLocaleString("id-ID")} kg gross` : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 text-xs uppercase"><tr><th className="pb-2 font-semibold">No. peti</th><th className="pb-2 font-semibold">Isi</th><th className="pb-2 font-semibold">Dimensi</th><th className="pb-2 font-semibold text-right">Gross</th><th className="pb-2 font-semibold text-right">Net</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {packages.map(p => (
                    <tr key={p.crateNo}><td className="py-2 pr-3 font-medium text-slate-800">{p.crateNo}</td><td className="py-2 pr-3">{p.contents}</td><td className="py-2 pr-3">{p.dims || "-"}</td><td className="py-2 text-right tabular-nums">{p.grossKg ?? "-"}</td><td className="py-2 text-right tabular-nums">{p.netKg ?? "-"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={`Dokumen pengiriman · ${docs.filter(d => d.done).length}/${docs.length} lengkap`}>
            <ul className="space-y-1">
              {docs.map((d, i) => {
                const Icon = d.done ? CheckSquare : Square;
                const editable = canManage && s.status !== "Cancelled";
                return (
                  <li key={d.name + i}>
                    <button type="button" disabled={!editable || pending} onClick={() => exec(() => toggleShipmentDoc(s.id, i))} aria-pressed={d.done} className={`w-full flex items-center gap-3 text-left rounded-lg px-2 py-1.5 -mx-2 text-sm ${editable ? "hover:bg-slate-50" : "cursor-default"}`}>
                      <Icon className={`w-5 h-5 shrink-0 ${d.done ? "text-emerald-600" : "text-slate-400"}`} aria-hidden /> {d.name}
                    </button>
                  </li>
                );
              })}
            </ul>
            {canManage && s.status !== "Cancelled" && (
              <form className="flex gap-2 mt-3" onSubmit={e => { e.preventDefault(); exec(() => addShipmentDoc(s.id, newDoc), () => setNewDoc("")); }}>
                <label htmlFor="new-doc" className="sr-only">Dokumen tambahan</label>
                <input id="new-doc" value={newDoc} onChange={e => setNewDoc(e.target.value)} className={inputCls} placeholder="Dokumen lain, mis. Fumigation Certificate" />
                <button type="submit" className={btnSecondary} disabled={pending || !newDoc.trim()}><Plus className="w-4 h-4" /> Tambah</button>
              </form>
            )}
          </Card>

          <Card title="Pembayaran Sales Order" actions={<Link href={`/modules/sales/orders/${so.id}`} className="text-sm text-blue-600 hover:underline">Buka SO</Link>}>
            {so.invoices.length ? (
              <ul className="divide-y divide-slate-100">
                {so.invoices.map(inv => (
                  <li key={inv.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <Link href={`/modules/sales/invoices/${inv.id}`} className="text-blue-700 hover:underline">{inv.invoiceNo} <span className="text-slate-500">· {inv.termLabel}</span></Link>
                    <span className="flex items-center gap-2 tabular-nums">{rupiah(inv.paidAmount)} / {rupiah(inv.total)} <StatusBadge status={invoiceState(inv)} /></span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">Belum ada invoice untuk order ini.</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Info pengiriman">
            <dl className="space-y-3">
              <InfoRow label="Lingkup">{s.scope}{s.incoterm ? ` · ${s.incoterm}` : ""}</InfoRow>
              <InfoRow label="Rute">{`${s.mode}: ${s.origin} → ${s.destination}`}</InfoRow>
              <InfoRow label="Forwarder">{s.forwarder}</InfoRow>
              <InfoRow label="ETD / ETA">{`${s.etd ?? "-"} / ${s.eta ?? "-"}`}</InfoRow>
              <InfoRow label="B/L / AWB / resi">{s.awbNo}</InfoRow>
              <InfoRow label="Kapal / penerbangan">{s.vessel}</InfoRow>
              <InfoRow label="Kontainer">{s.containerNo}</InfoRow>
              <InfoRow label="Dikirim">{s.shippedAt}</InfoRow>
              <InfoRow label="Tiba">{s.arrivedAt ? `${s.arrivedAt} · diterima ${s.receivedBy}` : null}</InfoRow>
              {s.notes && <InfoRow label="Catatan">{s.notes}</InfoRow>}
            </dl>
          </Card>
          {s.serviceJobs.length > 0 && (
            <Card title="Instalasi & training">
              <ul className="space-y-2">
                {s.serviceJobs.map(j => (
                  <li key={j.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/modules/customer-service/jobs/${j.id}`} className="text-blue-700 hover:underline">{j.jobNo} <span className="text-slate-500">· {j.type}</span></Link>
                    <StatusBadge status={j.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Aktivitas"><History json={s.historyJson} /></Card>
        </div>
      </div>

      <ModalShell isOpen={open !== null} onClose={() => setOpen(null)} size="max-w-lg">
        <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const close = () => setOpen(null);
          if (open === "exception") modal.exec(() => requestShipmentException(s.id, String(f.get("reason") || "")), close);
          if (open === "reject") modal.exec(() => decideShipmentException(s.id, "reject", String(f.get("reason") || "")), close);
          if (open === "ship") modal.exec(() => markShipped(s.id, { shippedAt: String(f.get("date")), awbNo: String(f.get("awb") || ""), etd: String(f.get("date")), eta: String(f.get("eta") || "") }), close);
          if (open === "arrive") modal.exec(() => markArrived(s.id, { arrivedAt: String(f.get("date")), receivedBy: String(f.get("receivedBy") || "") }), close);
        }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 id="modal-title" className="font-bold text-slate-800">
              {open === "exception" ? "Izin kirim sebelum lunas" : open === "reject" ? "Tolak izin khusus" : open === "ship" ? "Tandai dikirim" : "Barang tiba di client"}
            </h2>
            <button type="button" onClick={() => setOpen(null)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            {(open === "exception" || open === "reject") && (
              <div>
                <label className={labelCls} htmlFor="mdl-reason">{open === "exception" ? "Alasan kasus khusus" : "Alasan penolakan"}</label>
                <textarea id="mdl-reason" name="reason" rows={4} required className={inputCls} placeholder={open === "exception" ? "Mis. proyek pemerintah: pembayaran cair setelah barang diterima (sesuai kontrak), L/C sudah terbit tapi belum cair" : ""} />
                {open === "exception" && <p className="text-xs text-slate-500 mt-1.5">Permintaan masuk ke Dashboard Persetujuan Sales Manager.</p>}
              </div>
            )}
            {open === "ship" && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls} htmlFor="mdl-date">Tanggal kirim</label><input id="mdl-date" name="date" type="date" required defaultValue={today()} className={inputCls} /></div>
                <div><label className={labelCls} htmlFor="mdl-eta">ETA</label><input id="mdl-eta" name="eta" type="date" defaultValue={s.eta ?? ""} className={inputCls} /></div>
                <div className="col-span-2"><label className={labelCls} htmlFor="mdl-awb">No. B/L / AWB / resi</label><input id="mdl-awb" name="awb" defaultValue={s.awbNo ?? ""} className={inputCls} /></div>
              </div>
            )}
            {open === "arrive" && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls} htmlFor="mdl-adate">Tanggal tiba</label><input id="mdl-adate" name="date" type="date" required defaultValue={today()} className={inputCls} /></div>
                <div><label className={labelCls} htmlFor="mdl-recv">Diterima oleh</label><input id="mdl-recv" name="receivedBy" required className={inputCls} /></div>
                <p className="col-span-2 text-xs text-slate-500">Setelah disimpan, job instalasi & training dibuat otomatis untuk tim Training & Customer Service.</p>
              </div>
            )}
            <ErrorNote error={modal.error} />
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setOpen(null)}>Batal</button>
            <button type="submit" className={open === "reject" ? btnDanger : btnPrimary} disabled={modal.pending}><Send className="w-4 h-4" /> {modal.pending ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
