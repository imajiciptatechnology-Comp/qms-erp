"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TICKET_CATEGORIES, TICKET_CHANNELS, TICKET_PRIORITIES, TICKET_SLA_HOURS } from "@/app/modules/sales/lib";
import { Card, ErrorNote, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "@/app/modules/sales/ui";
import { createTicket, type TicketInput } from "../../actions";

type Data = {
  customers: { id: string; name: string; contactName: string | null; contactPhone: string | null }[];
  units: { key: string; customerId: string; product: string; serialNumber: string; warranty: { state: string | null; endDate: string } | null }[];
};

export default function TicketForm({ data, customerId, unitKey }: { data: Data; customerId?: string; unitKey?: string }) {
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const unit0 = data.units.find(u => u.key === unitKey);
  const cust0 = data.customers.find(c => c.id === (unit0?.customerId ?? customerId));
  const [form, setForm] = useState<TicketInput>({
    customerId: cust0?.id ?? "", category: unit0?.warranty && unit0.warranty.state !== "Expired" ? "Klaim Garansi" : "Perbaikan", priority: "Medium", channel: "Telepon",
    subject: "", description: "", productName: unit0?.product ?? "", serialNumber: unit0 && unit0.serialNumber !== "-" ? unit0.serialNumber : "",
    reportedBy: cust0?.contactName ?? "", contactPhone: cust0?.contactPhone ?? "", assignedTo: "",
  });
  const set = <K extends keyof TicketInput>(k: K, v: TicketInput[K]) => setForm(f => ({ ...f, [k]: v }));
  const units = data.units.filter(u => u.customerId === form.customerId);

  return (
    <form className="space-y-6" onSubmit={e => { e.preventDefault(); exec(() => createTicket(form), id => router.push(`/modules/customer-service/tickets/${id}`)); }}>
      <Card title="Pelapor">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls} htmlFor="tk-cust">Customer</label>
            <select id="tk-cust" required value={form.customerId} onChange={e => { const c = data.customers.find(x => x.id === e.target.value); setForm(f => ({ ...f, customerId: e.target.value, reportedBy: c?.contactName ?? "", contactPhone: c?.contactPhone ?? "", productName: "", serialNumber: "" })); }} className={inputCls}>
              <option value="">— pilih —</option>
              {data.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className={labelCls} htmlFor="tk-rep">Nama pelapor</label><input id="tk-rep" value={form.reportedBy ?? ""} onChange={e => set("reportedBy", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="tk-phone">Telepon / WA</label><input id="tk-phone" value={form.contactPhone ?? ""} onChange={e => set("contactPhone", e.target.value)} className={inputCls} /></div>
        </div>
      </Card>

      <Card title="Masalah">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className={labelCls} htmlFor="tk-cat">Kategori</label><select id="tk-cat" value={form.category} onChange={e => set("category", e.target.value)} className={inputCls}>{TICKET_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className={labelCls} htmlFor="tk-pri">Prioritas</label><select id="tk-pri" value={form.priority} onChange={e => set("priority", e.target.value)} className={inputCls}>{TICKET_PRIORITIES.map(p => <option key={p} value={p}>{p} (respon {TICKET_SLA_HOURS[p]} jam)</option>)}</select></div>
          <div><label className={labelCls} htmlFor="tk-ch">Kanal</label><select id="tk-ch" value={form.channel} onChange={e => set("channel", e.target.value)} className={inputCls}>{TICKET_CHANNELS.map(c => <option key={c}>{c}</option>)}</select></div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="tk-unit">Unit terpasang</label>
            <select id="tk-unit" value={units.find(u => u.product === form.productName && (u.serialNumber === form.serialNumber || (u.serialNumber === "-" && !form.serialNumber)))?.key ?? ""} onChange={e => { const u = units.find(x => x.key === e.target.value); setForm(f => ({ ...f, productName: u?.product ?? "", serialNumber: u && u.serialNumber !== "-" ? u.serialNumber : "" })); }} className={inputCls}>
              <option value="">— pilih unit atau isi manual di bawah —</option>
              {units.map(u => <option key={u.key} value={u.key}>{u.product} · S/N {u.serialNumber}{u.warranty ? ` · garansi s/d ${u.warranty.endDate}` : ""}</option>)}
            </select>
          </div>
          <div><label className={labelCls} htmlFor="tk-assign">PIC / teknisi</label><input id="tk-assign" value={form.assignedTo ?? ""} onChange={e => set("assignedTo", e.target.value)} className={inputCls} /></div>
          <div className="md:col-span-2"><label className={labelCls} htmlFor="tk-prod">Produk</label><input id="tk-prod" value={form.productName ?? ""} onChange={e => set("productName", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="tk-sn">No. seri</label><input id="tk-sn" value={form.serialNumber ?? ""} onChange={e => set("serialNumber", e.target.value)} className={inputCls} /></div>
          <div className="md:col-span-3"><label className={labelCls} htmlFor="tk-subj">Judul</label><input id="tk-subj" required value={form.subject} onChange={e => set("subject", e.target.value)} className={inputCls} placeholder="Mis. Kompresor trainer AC tidak menyala" /></div>
          <div className="md:col-span-3"><label className={labelCls} htmlFor="tk-desc">Uraian</label><textarea id="tk-desc" required rows={4} value={form.description} onChange={e => set("description", e.target.value)} className={inputCls} /></div>
        </div>
      </Card>

      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <Link href="/modules/customer-service/tickets" className={btnSecondary}>Batal</Link>
        <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Buat tiket"}</button>
      </div>
    </form>
  );
}
