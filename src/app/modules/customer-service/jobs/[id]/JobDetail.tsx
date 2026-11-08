"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Check, ClipboardCheck, Pencil, Play, Plus, Save, Send, Trash2, X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { JOB_STATUS_LABEL, today, type ChecklistRow, type Participant } from "@/app/modules/sales/lib";
import { Card, DocLinks, ErrorNote, History, InfoRow, StatusBadge, btnDanger, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "@/app/modules/sales/ui";
import { cancelJob, completeJob, decideServiceJob, saveChecklist, saveParticipants, startJob, submitJob } from "../../actions";

type Job = {
  id: string; jobNo: string; type: string; mode: string; location: string | null; startDate: string | null; endDate: string | null;
  technicians: string | null; trainerName: string | null; topics: string | null; status: string; checklistJson: string; participantsJson: string;
  feedbackScore: number | null; feedbackNote: string | null; bastNo: string | null; bastDate: string | null; approvedBy: string | null; approvedAt: string | null;
  decisionNote: string | null; notes: string | null; historyJson: string;
  customer: { id: string; name: string };
  salesOrder: { id: string; soNo: string; customerPoNo: string; status: string; bastNo: string | null } | null;
  shipment: { id: string; shipmentNo: string; arrivedAt: string | null } | null;
};

export default function JobDetail({ job, canManage, canApprove }: { job: Job; canManage: boolean; canApprove: boolean }) {
  const { pending, error, exec } = useAction();
  const modal = useAction();
  const [checklist, setChecklist] = useState<ChecklistRow[]>(() => JSON.parse(job.checklistJson));
  const [people, setPeople] = useState<Participant[]>(() => JSON.parse(job.participantsJson));
  const [dirtyC, setDirtyC] = useState(false);
  const [dirtyP, setDirtyP] = useState(false);
  const [open, setOpen] = useState<null | "complete" | "reject">(null);
  const editable = canManage && !["Completed", "Cancelled"].includes(job.status);
  const savedPeople = JSON.parse(job.participantsJson) as Participant[];
  const attended = people.filter(p => p.attended);
  const avg = (k: "pre" | "post") => { const v = attended.map(p => p[k]).filter((x): x is number => typeof x === "number"); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const installedCount = checklist.filter(r => r.installed && r.tested).length;

  const setRow = (i: number, patch: Partial<ChecklistRow>) => { setChecklist(c => c.map((r, idx) => (idx === i ? { ...r, ...patch } : r))); setDirtyC(true); };
  const setPerson = (i: number, patch: Partial<Participant>) => { setPeople(c => c.map((r, idx) => (idx === i ? { ...r, ...patch } : r))); setDirtyP(true); };
  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link href="/modules/customer-service/jobs" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Installation & Training</Link>
          <h2 className="text-xl font-bold text-slate-800 mt-1 flex flex-wrap items-center gap-2">{job.jobNo} <StatusBadge status={job.status} /></h2>
          <p className="text-sm text-slate-500">{job.type} · {job.customer.name} · {JOB_STATUS_LABEL[job.status]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {job.type !== "Commissioning" && savedPeople.length > 0 && <DocLinks kind="training-report" id={job.id} label="Laporan training" formats={["pdf", "docx"]} />}
          {job.salesOrder && job.status === "Completed" && <DocLinks kind="bast" id={job.salesOrder.id} label="BAST" formats={["pdf"]} />}
          {canManage && ["Draft", "Scheduled"].includes(job.status) && <Link href={`/modules/customer-service/jobs/${job.id}/edit`} className={btnSecondary}><Pencil className="w-4 h-4" /> Edit</Link>}
          {editable && <button className={btnDanger} disabled={pending} onClick={() => { const r = prompt("Alasan pembatalan job:"); if (r) exec(() => cancelJob(job.id, r)); }}><Ban className="w-4 h-4" /> Batalkan</button>}
          {canManage && job.status === "Draft" && <button className={btnPrimary} disabled={pending} onClick={() => exec(() => submitJob(job.id))}><Send className="w-4 h-4" /> Ajukan jadwal</button>}
          {canApprove && job.status === "Waiting Approval" && <>
            <button className={btnDanger} disabled={pending} onClick={() => { modal.setError(null); setOpen("reject"); }}><X className="w-4 h-4" /> Tolak</button>
            <button className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm" disabled={pending} onClick={() => exec(() => decideServiceJob(job.id, "approve"))}><Check className="w-4 h-4" /> Setujui jadwal</button>
          </>}
          {canManage && job.status === "Scheduled" && <button className={btnPrimary} disabled={pending} onClick={() => exec(() => startJob(job.id))}><Play className="w-4 h-4" /> Mulai di lokasi</button>}
          {canManage && job.status === "In Progress" && <button className={btnPrimary} disabled={pending || dirtyC || dirtyP} title={dirtyC || dirtyP ? "Simpan checklist / daftar hadir dulu" : undefined} onClick={() => { modal.setError(null); setOpen("complete"); }}><ClipboardCheck className="w-4 h-4" /> Selesai & BAST</button>}
        </div>
      </div>
      <ErrorNote error={error} />
      {job.decisionNote && job.status === "Draft" && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Dikembalikan Sales Manager: {job.decisionNote}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {job.type !== "Training" && (
            <Card title={`Checklist instalasi & uji fungsi · ${installedCount}/${checklist.length} unit`} actions={editable ? <button type="button" className="text-sm text-blue-600 hover:underline flex items-center gap-1" onClick={() => { setChecklist(c => [...c, { item: "", serial: "", installed: false, tested: false }]); setDirtyC(true); }}><Plus className="w-4 h-4" /> Tambah unit</button> : undefined}>
              {checklist.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="pb-2 pr-2 font-semibold">Unit</th><th className="pb-2 pr-2 font-semibold">No. seri</th><th className="pb-2 pr-2 font-semibold text-center">Terpasang</th><th className="pb-2 pr-2 font-semibold text-center">Uji fungsi OK</th><th className="pb-2 pr-2 font-semibold">Catatan</th><th /></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {checklist.map((r, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-2 min-w-56">{r.itemId ? <span className="text-slate-800">{r.item}</span> : <input aria-label={`Unit baris ${i + 1}`} disabled={!editable} value={r.item} onChange={e => setRow(i, { item: e.target.value })} className={inputCls} />}</td>
                          <td className="py-1.5 pr-2 w-40"><input aria-label={`No. seri baris ${i + 1}`} disabled={!editable} value={r.serial} onChange={e => setRow(i, { serial: e.target.value })} className={inputCls} /></td>
                          <td className="py-1.5 pr-2 text-center"><input type="checkbox" aria-label={`Terpasang baris ${i + 1}`} disabled={!editable} checked={r.installed} onChange={e => setRow(i, { installed: e.target.checked })} className="w-4 h-4" /></td>
                          <td className="py-1.5 pr-2 text-center"><input type="checkbox" aria-label={`Uji fungsi baris ${i + 1}`} disabled={!editable} checked={r.tested} onChange={e => setRow(i, { tested: e.target.checked })} className="w-4 h-4" /></td>
                          <td className="py-1.5 pr-2 min-w-40"><input aria-label={`Catatan baris ${i + 1}`} disabled={!editable} value={r.note ?? ""} onChange={e => setRow(i, { note: e.target.value })} className={inputCls} /></td>
                          <td className="py-1.5">{editable && !r.itemId && <button type="button" onClick={() => { setChecklist(c => c.filter((_, idx) => idx !== i)); setDirtyC(true); }} className="p-2 text-slate-400 hover:text-red-600" aria-label={`Hapus baris ${i + 1}`}><Trash2 className="w-4 h-4" /></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-slate-500">Belum ada unit. Pilih Sales Order di Edit, atau tambah unit manual.</p>}
              {editable && dirtyC && <div className="flex justify-end mt-3"><button className={btnPrimary} disabled={pending} onClick={() => exec(() => saveChecklist(job.id, checklist), () => setDirtyC(false))}><Save className="w-4 h-4" /> Simpan checklist</button></div>}
            </Card>
          )}

          {job.type !== "Commissioning" && (
            <Card title={`Peserta training · ${attended.length} hadir${avg("pre") !== null ? ` · pre ${avg("pre")} → post ${avg("post") ?? "-"}` : ""}`} actions={editable ? <button type="button" className="text-sm text-blue-600 hover:underline flex items-center gap-1" onClick={() => { setPeople(c => [...c, { name: "", title: "", attended: true, pre: null, post: null }]); setDirtyP(true); }}><Plus className="w-4 h-4" /> Tambah peserta</button> : undefined}>
              {people.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="pb-2 pr-2 font-semibold">Nama</th><th className="pb-2 pr-2 font-semibold">Jabatan</th><th className="pb-2 pr-2 font-semibold text-center">Hadir</th><th className="pb-2 pr-2 font-semibold">Pre-test</th><th className="pb-2 pr-2 font-semibold">Post-test</th><th className="pb-2 pr-2 font-semibold">Sertifikat</th><th /></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {people.map((p, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-2 min-w-44"><input aria-label={`Nama peserta ${i + 1}`} disabled={!editable} value={p.name} onChange={e => setPerson(i, { name: e.target.value })} className={inputCls} /></td>
                          <td className="py-1.5 pr-2 min-w-36"><input aria-label={`Jabatan peserta ${i + 1}`} disabled={!editable} value={p.title ?? ""} onChange={e => setPerson(i, { title: e.target.value })} className={inputCls} placeholder="Guru / dosen / teknisi" /></td>
                          <td className="py-1.5 pr-2 text-center"><input type="checkbox" aria-label={`Hadir peserta ${i + 1}`} disabled={!editable} checked={p.attended} onChange={e => setPerson(i, { attended: e.target.checked })} className="w-4 h-4" /></td>
                          <td className="py-1.5 pr-2 w-24"><input aria-label={`Pre-test peserta ${i + 1}`} type="number" min={0} max={100} disabled={!editable} value={p.pre ?? ""} onChange={e => setPerson(i, { pre: num(e.target.value) })} className={inputCls} /></td>
                          <td className="py-1.5 pr-2 w-24"><input aria-label={`Post-test peserta ${i + 1}`} type="number" min={0} max={100} disabled={!editable} value={p.post ?? ""} onChange={e => setPerson(i, { post: num(e.target.value) })} className={inputCls} /></td>
                          <td className="py-1.5 pr-2 whitespace-nowrap">{job.status === "Completed" && savedPeople[i]?.attended ? <DocLinks kind="training-certificate" id={`${job.id}~${i}`} formats={["pdf"]} small /> : <span className="text-xs text-slate-400">setelah BAST</span>}</td>
                          <td className="py-1.5">{editable && <button type="button" onClick={() => { setPeople(c => c.filter((_, idx) => idx !== i)); setDirtyP(true); }} className="p-2 text-slate-400 hover:text-red-600" aria-label={`Hapus peserta ${i + 1}`}><Trash2 className="w-4 h-4" /></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-slate-500">Belum ada peserta. Isi daftar hadir guru / dosen / teknisi client.</p>}
              {editable && dirtyP && <div className="flex justify-end mt-3"><button className={btnPrimary} disabled={pending} onClick={() => exec(() => saveParticipants(job.id, people), () => setDirtyP(false))}><Save className="w-4 h-4" /> Simpan daftar hadir</button></div>}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Info job">
            <dl className="space-y-3">
              <InfoRow label="Jadwal">{job.startDate ? `${job.startDate}${job.endDate && job.endDate !== job.startDate ? ` s/d ${job.endDate}` : ""}` : null}</InfoRow>
              <InfoRow label="Mode & lokasi">{`${job.mode}${job.location ? ` · ${job.location}` : ""}`}</InfoRow>
              <InfoRow label="Trainer">{job.trainerName}</InfoRow>
              <InfoRow label="Teknisi">{job.technicians}</InfoRow>
              <InfoRow label="Materi">{job.topics}</InfoRow>
              <InfoRow label="Sales Order">{job.salesOrder ? <Link href={`/modules/sales/orders/${job.salesOrder.id}`} className="text-blue-700 hover:underline">{job.salesOrder.soNo} (PO {job.salesOrder.customerPoNo})</Link> : null}</InfoRow>
              <InfoRow label="Shipment">{job.shipment ? <Link href={`/modules/contract-shipping/shipments/${job.shipment.id}`} className="text-blue-700 hover:underline">{job.shipment.shipmentNo}{job.shipment.arrivedAt ? ` · tiba ${job.shipment.arrivedAt}` : ""}</Link> : null}</InfoRow>
              <InfoRow label="Disetujui">{job.approvedBy ? `${job.approvedBy} (${job.approvedAt})` : null}</InfoRow>
              <InfoRow label="BAST">{job.bastNo ? `${job.bastNo} (${job.bastDate})` : null}</InfoRow>
              <InfoRow label="Kepuasan client">{job.feedbackScore ? `${job.feedbackScore}/5${job.feedbackNote ? ` — ${job.feedbackNote}` : ""}` : null}</InfoRow>
              {job.notes && <InfoRow label="Catatan">{job.notes}</InfoRow>}
            </dl>
          </Card>
          <Card title="Aktivitas"><History json={job.historyJson} /></Card>
        </div>
      </div>

      <ModalShell isOpen={open !== null} onClose={() => setOpen(null)} size="max-w-lg">
        <form onSubmit={e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const close = () => setOpen(null);
          if (open === "reject") modal.exec(() => decideServiceJob(job.id, "reject", String(f.get("note") || "")), close);
          if (open === "complete") modal.exec(() => completeJob(job.id, { bastNo: String(f.get("bastNo") || ""), bastDate: String(f.get("bastDate") || ""), feedbackScore: f.get("score") ? Number(f.get("score")) : null, feedbackNote: String(f.get("feedback") || "") }), close);
        }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 id="modal-title" className="font-bold text-slate-800">{open === "reject" ? "Kembalikan jadwal" : "Selesai — BAST instalasi & training"}</h2>
            <button type="button" onClick={() => setOpen(null)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            {open === "reject" ? (
              <div><label className={labelCls} htmlFor="rej-note">Alasan</label><textarea id="rej-note" name="note" rows={4} required className={inputCls} /></div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls} htmlFor="bast-no">No. BAST</label><input id="bast-no" name="bastNo" required className={inputCls} /></div>
                  <div><label className={labelCls} htmlFor="bast-date">Tanggal BAST</label><input id="bast-date" name="bastDate" type="date" required max={today()} defaultValue={today()} className={inputCls} /></div>
                </div>
                <div>
                  <label className={labelCls} htmlFor="fb-score">Kepuasan client (1–5)</label>
                  <select id="fb-score" name="score" className={inputCls} defaultValue=""><option value="">— belum diisi —</option>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n}</option>)}</select>
                </div>
                <div><label className={labelCls} htmlFor="fb-note">Catatan client</label><textarea id="fb-note" name="feedback" rows={3} className={inputCls} /></div>
                {job.salesOrder?.status === "In Delivery" && <p className="text-xs text-slate-500">Nomor seri dari checklist disimpan ke Sales Order {job.salesOrder.soNo}, status order menjadi Installed, dan kontrak garansi dibuat otomatis.</p>}
              </>
            )}
            <ErrorNote error={modal.error} />
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setOpen(null)}>Batal</button>
            <button type="submit" className={open === "reject" ? btnDanger : btnPrimary} disabled={modal.pending}>{modal.pending ? "Menyimpan…" : open === "reject" ? "Kembalikan" : "Simpan BAST"}</button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
