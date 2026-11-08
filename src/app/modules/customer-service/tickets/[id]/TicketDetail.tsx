"use client";

import Link from "next/link";
import { AlertOctagon, ArrowLeft, Save } from "lucide-react";
import { PRIORITY_COLORS, TICKET_STATUSES, ticketOverdue } from "@/app/modules/sales/lib";
import { Card, ErrorNote, History, InfoRow, StatusBadge, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "@/app/modules/sales/ui";
import { escalateTicketToComplaint, updateTicket } from "../../actions";

type Ticket = {
  id: string; ticketNo: string; category: string; priority: string; channel: string; subject: string; description: string;
  productName: string | null; serialNumber: string | null; underWarranty: boolean; status: string; assignedTo: string | null;
  reportedBy: string | null; contactPhone: string | null; responseDueAt: string; firstResponseAt: string | null; resolvedAt: string | null;
  resolution: string | null; complaintId: string | null; createdBy: string; createdAt: string; historyJson: string;
  customer: { id: string; name: string };
};

const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : null);

export default function TicketDetail({ t, canManage }: { t: Ticket; canManage: boolean }) {
  const { pending, error, exec } = useAction();
  const late = ticketOverdue(t);
  const editable = canManage && t.status !== "Closed";

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link href="/modules/customer-service/tickets" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Service Tickets</Link>
          <h2 className="text-xl font-bold text-slate-800 mt-1 flex flex-wrap items-center gap-2">
            {t.ticketNo} <StatusBadge status={t.status} />
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
          </h2>
          <p className="text-sm text-slate-500">{t.customer.name} · {t.subject}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {t.complaintId ? <Link href="/modules/complaint" className={btnSecondary}><AlertOctagon className="w-4 h-4" /> Sudah di Customer Complaint</Link>
            : editable && <button className={btnSecondary} disabled={pending} onClick={() => { if (confirm("Teruskan tiket ini ke modul Customer Complaint (QMS) untuk analisa akar masalah?")) exec(() => escalateTicketToComplaint(t.id)); }}><AlertOctagon className="w-4 h-4" /> Teruskan ke Customer Complaint</button>}
        </div>
      </div>
      <ErrorNote error={error} />
      {late && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Lewat batas respon pertama ({dt(t.responseDueAt)}). Segera hubungi customer.</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title="Uraian">
            <p className="text-sm text-slate-800 whitespace-pre-line">{t.description}</p>
            {t.resolution && <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3"><p className="text-xs font-semibold uppercase text-emerald-800">Penyelesaian</p><p className="text-sm text-slate-800 whitespace-pre-line mt-1">{t.resolution}</p></div>}
          </Card>

          {editable && (
            <Card title="Tindak lanjut">
              <form className="space-y-4" onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const form = e.currentTarget;
                exec(() => updateTicket(t.id, { status: String(f.get("status")), assignedTo: String(f.get("assignedTo") ?? ""), note: String(f.get("note") || ""), resolution: String(f.get("resolution") || "") }), () => form.reset());
              }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className={labelCls} htmlFor="tk-status">Status</label><select id="tk-status" name="status" defaultValue={t.status} className={inputCls}>{TICKET_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><label className={labelCls} htmlFor="tk-pic">PIC / teknisi</label><input id="tk-pic" name="assignedTo" defaultValue={t.assignedTo ?? ""} className={inputCls} /></div>
                </div>
                <div><label className={labelCls} htmlFor="tk-note">Catatan tindak lanjut</label><textarea id="tk-note" name="note" rows={3} className={inputCls} placeholder="Mis. Sudah telepon guru pengampu, dijadwalkan kunjungan teknisi Kamis" /></div>
                <div><label className={labelCls} htmlFor="tk-res">Penyelesaian (wajib saat Resolved)</label><textarea id="tk-res" name="resolution" rows={3} className={inputCls} /></div>
                <div className="flex justify-end"><button type="submit" className={btnPrimary} disabled={pending}><Save className="w-4 h-4" /> {pending ? "Menyimpan…" : "Simpan"}</button></div>
              </form>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Info tiket">
            <dl className="space-y-3">
              <InfoRow label="Kategori · kanal">{`${t.category} · ${t.channel}`}</InfoRow>
              <InfoRow label="Pelapor">{[t.reportedBy, t.contactPhone].filter(Boolean).join(" · ")}</InfoRow>
              <InfoRow label="Unit">{t.productName ? `${t.productName}${t.serialNumber ? ` · S/N ${t.serialNumber}` : ""}` : null}</InfoRow>
              <InfoRow label="Garansi">{t.underWarranty ? <span className="text-emerald-700 font-medium">Dalam garansi — tanpa biaya jasa & suku cadang</span> : "Di luar garansi / tidak diketahui"}</InfoRow>
              <InfoRow label="PIC">{t.assignedTo}</InfoRow>
              <InfoRow label="Dibuat">{`${dt(t.createdAt)} · ${t.createdBy}`}</InfoRow>
              <InfoRow label="Batas respon">{dt(t.responseDueAt)}</InfoRow>
              <InfoRow label="Respon pertama">{dt(t.firstResponseAt)}</InfoRow>
              <InfoRow label="Selesai">{dt(t.resolvedAt)}</InfoRow>
            </dl>
          </Card>
          <Card title="Aktivitas"><History json={t.historyJson} /></Card>
        </div>
      </div>
    </div>
  );
}
