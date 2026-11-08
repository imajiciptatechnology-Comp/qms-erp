"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JOB_MODES, JOB_TYPES } from "@/app/modules/sales/lib";
import { Card, ErrorNote, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "@/app/modules/sales/ui";
import { createJob, updateJob, type JobInput } from "../actions";

type FormData = {
  customers: { id: string; name: string; address: string | null; city: string | null }[];
  orders: { id: string; soNo: string; customerId: string; deliveryAddress: string | null; status: string }[];
};

export default function JobForm({ data, initial, jobId }: { data: FormData; initial?: JobInput; jobId?: string }) {
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const [form, setForm] = useState<JobInput>(initial ?? { customerId: "", salesOrderId: "", type: "Training", mode: "Onsite", location: "", startDate: "", endDate: "", technicians: "", trainerName: "", topics: "", notes: "" });
  const set = <K extends keyof JobInput>(k: K, v: JobInput[K]) => setForm(f => ({ ...f, [k]: v }));
  const orders = data.orders.filter(o => o.customerId === form.customerId);

  return (
    <form className="space-y-6" onSubmit={e => { e.preventDefault(); exec(() => (jobId ? updateJob(jobId, form) : createJob(form)), id => router.push(`/modules/customer-service/jobs/${id ?? jobId}`)); }}>
      <Card title="Customer & order">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="job-cust">Customer</label>
            <select id="job-cust" required value={form.customerId} onChange={e => { const c = data.customers.find(x => x.id === e.target.value); setForm(f => ({ ...f, customerId: e.target.value, salesOrderId: "", location: f.location || c?.address || c?.city || "" })); }} className={inputCls}>
              <option value="">— pilih —</option>
              {data.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="job-so">Sales Order (opsional)</label>
            <select id="job-so" value={form.salesOrderId ?? ""} onChange={e => { const o = orders.find(x => x.id === e.target.value); setForm(f => ({ ...f, salesOrderId: e.target.value, location: o?.deliveryAddress || f.location })); }} className={inputCls}>
              <option value="">— tanpa SO (training tambahan / ulang) —</option>
              {orders.map(o => <option key={o.id} value={o.id}>{o.soNo} · {o.status}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card title="Jadwal & tim">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className={labelCls} htmlFor="job-type">Jenis</label><select id="job-type" value={form.type} onChange={e => set("type", e.target.value)} className={inputCls}>{JOB_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className={labelCls} htmlFor="job-mode">Mode</label><select id="job-mode" value={form.mode} onChange={e => set("mode", e.target.value)} className={inputCls}>{JOB_MODES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className={labelCls} htmlFor="job-loc">Lokasi</label><input id="job-loc" value={form.location ?? ""} onChange={e => set("location", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="job-start">Mulai</label><input id="job-start" type="date" value={form.startDate ?? ""} onChange={e => set("startDate", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="job-end">Selesai</label><input id="job-end" type="date" min={form.startDate || undefined} value={form.endDate ?? ""} onChange={e => set("endDate", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="job-trainer">Trainer Labtech</label><input id="job-trainer" value={form.trainerName ?? ""} onChange={e => set("trainerName", e.target.value)} className={inputCls} /></div>
          <div className="md:col-span-3"><label className={labelCls} htmlFor="job-tech">Teknisi instalasi (pisahkan koma)</label><input id="job-tech" value={form.technicians ?? ""} onChange={e => set("technicians", e.target.value)} className={inputCls} /></div>
          <div className="md:col-span-3"><label className={labelCls} htmlFor="job-topics">Materi training</label><textarea id="job-topics" rows={3} value={form.topics ?? ""} onChange={e => set("topics", e.target.value)} className={inputCls} placeholder="Mis. Pengoperasian trainer refrigerasi, troubleshooting kelistrikan kompresor, penyusunan jobsheet praktikum" /></div>
          <div className="md:col-span-3"><label className={labelCls} htmlFor="job-notes">Catatan</label><textarea id="job-notes" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} className={inputCls} /></div>
        </div>
      </Card>

      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <Link href={jobId ? `/modules/customer-service/jobs/${jobId}` : "/modules/customer-service/jobs"} className={btnSecondary}>Batal</Link>
        <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : jobId ? "Simpan perubahan" : "Buat job"}</button>
      </div>
    </form>
  );
}
