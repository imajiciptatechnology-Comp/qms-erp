"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleDollarSign, Pencil, Plus, ShieldAlert, ShieldCheck, Undo2, X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import { saveGuarantee, setGuaranteeStatus } from "../tenderActions";
import { CURRENCIES, GUARANTEE_STATUS_LABEL, GUARANTEE_TYPES, daysBetween, guaranteeState, money, rupiahShort, today } from "../lib";
import { ErrorNote, StatCard, StatusBadge, btnPrimary, btnSecondary, btnSecondarySm, inputCls, labelCls, useAction } from "../ui";

type G = {
  id: string; guaranteeNo: string; type: string; issuer: string; amount: number; currency: string; issueDate: string; expiryDate: string; status: string;
  customerId: string; opportunityId: string | null; salesOrderId: string | null; fileUrl: string | null; notes: string | null;
  customer: { id: string; name: string }; opportunity: { id: string; opportunityNo: string; title: string } | null; salesOrder: { id: string; soNo: string } | null;
};
type Form = Partial<G>;

const STATE_LABEL: Record<string, string> = { ...GUARANTEE_STATUS_LABEL, Expiring: "Segera habis", Expired: "Lewat masa berlaku" };

export default function GuaranteeList({ guarantees, customers, opportunities, orders, canEdit, openNew }: {
  guarantees: G[]; customers: { id: string; name: string; currency: string }[]; opportunities: { id: string; opportunityNo: string; title: string; customerId: string }[];
  orders: { id: string; soNo: string; customerId: string }[]; canEdit: boolean; openNew: { customerId?: string; opportunityId?: string; salesOrderId?: string } | null;
}) {
  const router = useRouter();
  const { pending, error, setError, exec } = useAction();
  const [filter, setFilter] = useState("Aktif");
  const [editing, setEditing] = useState<Form | null>(canEdit && openNew ? { ...openNew, currency: customers.find(c => c.id === openNew.customerId)?.currency ?? "IDR", issueDate: today() } : null);
  const [customerId, setCustomerId] = useState(editing?.customerId ?? "");

  const rows = guarantees.map(g => ({ ...g, state: guaranteeState(g) }));
  const active = rows.filter(r => r.status === "Active");
  const expiring = active.filter(r => r.state === "Expiring" || r.state === "Expired");
  const filtered = rows.filter(r => filter === "Semua" || (filter === "Aktif" ? r.status === "Active" : filter === "Perlu tindakan" ? r.state === "Expiring" || r.state === "Expired" : r.status !== "Active"));

  function open(f: Form) { setError(null); setCustomerId(f.customerId ?? ""); setEditing(f); }
  function close() { setEditing(null); if (openNew) router.replace("/modules/sales/guarantees"); }
  function decide(g: G, status: "Released" | "Claimed") {
    const note = status === "Claimed" ? prompt(`Alasan pencairan ${g.guaranteeNo}:`) ?? "" : undefined;
    if (status === "Claimed" && !note) return;
    if (status === "Released" && !confirm(`Tandai ${g.guaranteeNo} sudah dikembalikan / selesai?`)) return;
    exec(() => setGuaranteeStatus(g.id, status, note));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Jaminan aktif" value={active.length} sub={`${rupiahShort(active.filter(g => g.currency === "IDR").reduce((t, g) => t + g.amount, 0))}${active.some(g => g.currency !== "IDR") ? ` + ${active.filter(g => g.currency !== "IDR").length} jaminan valas` : ""}`} icon={<ShieldCheck className="w-6 h-6" />} tone="blue" />
        <StatCard label="Perlu tindakan" value={expiring.length} sub="Habis ≤ 30 hari / sudah lewat — perpanjang atau minta pengembalian" icon={<ShieldAlert className="w-6 h-6" />} tone={expiring.length ? "amber" : "slate"} />
        <StatCard label="Dicairkan" value={rows.filter(r => r.status === "Claimed").length} icon={<CircleDollarSign className="w-6 h-6" />} tone="red" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <select aria-label="Filter status" value={filter} onChange={e => setFilter(e.target.value)} className={`${inputCls} sm:w-56`}>
          {["Aktif", "Perlu tindakan", "Selesai", "Semua"].map(f => <option key={f}>{f}</option>)}
        </select>
        {canEdit && <button className={`${btnPrimary} sm:ml-auto justify-center`} onClick={() => open({ currency: "IDR", issueDate: today(), type: GUARANTEE_TYPES[0] })}><Plus className="w-4 h-4" /> Catat jaminan</button>}
      </div>
      <ErrorNote error={editing ? null : error} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr><th className="px-6 py-4 font-semibold">Jaminan</th><th className="px-6 py-4 font-semibold">Customer & referensi</th><th className="px-6 py-4 font-semibold text-right">Nilai</th><th className="px-6 py-4 font-semibold">Berlaku s/d</th><th className="px-6 py-4 font-semibold">Status</th>{canEdit && <th className="px-6 py-4"><span className="sr-only">Aksi</span></th>}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length ? filtered.map(g => {
                const d = daysBetween(today(), g.expiryDate);
                return (
                  <tr key={g.id}>
                    <td className="px-6 py-4"><p className="font-semibold text-slate-800">{g.type}</p><p className="text-xs text-slate-500">{g.guaranteeNo} · {g.issuer}{g.fileUrl ? <> · <a href={g.fileUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">file</a></> : null}</p></td>
                    <td className="px-6 py-4">
                      <Link href={`/modules/sales/customers/${g.customer.id}`} className="font-medium text-slate-800 hover:text-blue-700">{g.customer.name}</Link>
                      <p className="text-xs text-slate-500">
                        {g.opportunity && <Link href={`/modules/sales/pipeline/${g.opportunity.id}`} className="hover:underline">{g.opportunity.opportunityNo}</Link>}
                        {g.opportunity && g.salesOrder ? " · " : ""}
                        {g.salesOrder && <Link href={`/modules/sales/orders/${g.salesOrder.id}`} className="hover:underline">{g.salesOrder.soNo}</Link>}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">{money(g.amount, g.currency)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{g.expiryDate}{g.status === "Active" && <span className={`block text-xs ${d < 0 ? "text-red-700" : d <= 30 ? "text-amber-700" : "text-slate-500"}`}>{d < 0 ? `lewat ${-d} hari` : `${d} hari lagi`}</span>}</td>
                    <td className="px-6 py-4"><span title={STATE_LABEL[g.state]}><StatusBadge status={g.state} /></span></td>
                    {canEdit && (
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1.5">
                          {g.status === "Active" && <>
                            <button className={btnSecondarySm} disabled={pending} onClick={() => decide(g, "Released")}><Undo2 className="w-3.5 h-3.5" aria-hidden /> Selesai</button>
                            <button className={btnSecondarySm} disabled={pending} onClick={() => decide(g, "Claimed")}>Dicairkan</button>
                          </>}
                          <button onClick={() => open(g)} className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md" aria-label={`Edit ${g.guaranteeNo}`}><Pencil className="w-4 h-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              }) : <EmptyTableRow colSpan={canEdit ? 6 : 5} icon={<ShieldCheck className="w-12 h-12 text-slate-200" />} title="Tidak ada jaminan" />}
            </tbody>
          </table>
        </div>
      </div>

      <ModalShell isOpen={!!editing} onClose={close} size="max-w-2xl">
        {editing && (
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); exec(() => saveGuarantee(fd), close); }}>
            <input type="hidden" name="id" value={editing.id ?? ""} />
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 id="modal-title" className="font-bold text-slate-800">{editing.id ? "Edit jaminan" : "Catat jaminan"}</h2>
              <button type="button" onClick={close} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto">
              <div><label className={labelCls} htmlFor="g-type">Jenis</label><select id="g-type" name="type" defaultValue={editing.type ?? GUARANTEE_TYPES[0]} className={inputCls}>{GUARANTEE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className={labelCls} htmlFor="g-no">No. jaminan</label><input id="g-no" name="guaranteeNo" required defaultValue={editing.guaranteeNo ?? ""} className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={labelCls} htmlFor="g-issuer">Penerbit (bank / asuransi)</label><input id="g-issuer" name="issuer" required defaultValue={editing.issuer ?? ""} placeholder="mis. Bank Contoh Cabang Batam / PT Asuransi Contoh (surety bond)" className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={labelCls} htmlFor="g-cust">Customer (penerima jaminan)</label>
                <select id="g-cust" name="customerId" required value={customerId} onChange={e => setCustomerId(e.target.value)} className={inputCls}>
                  <option value="" disabled>Pilih customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls} htmlFor="g-opp">Tender / opportunity</label>
                <select id="g-opp" name="opportunityId" defaultValue={editing.opportunityId ?? ""} className={inputCls}>
                  <option value="">—</option>
                  {opportunities.filter(o => o.customerId === customerId).map(o => <option key={o.id} value={o.id}>{o.opportunityNo} · {o.title}</option>)}
                </select>
              </div>
              <div><label className={labelCls} htmlFor="g-so">Sales Order</label>
                <select id="g-so" name="salesOrderId" defaultValue={editing.salesOrderId ?? ""} className={inputCls}>
                  <option value="">—</option>
                  {orders.filter(o => o.customerId === customerId).map(o => <option key={o.id} value={o.id}>{o.soNo}</option>)}
                </select>
              </div>
              <div><label className={labelCls} htmlFor="g-amt">Nilai</label><input id="g-amt" name="amount" type="number" min={0} step="any" required defaultValue={editing.amount ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="g-cur">Mata uang</label><select id="g-cur" name="currency" defaultValue={editing.currency ?? "IDR"} className={inputCls}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className={labelCls} htmlFor="g-issue">Tanggal terbit</label><input id="g-issue" name="issueDate" type="date" required defaultValue={editing.issueDate ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="g-exp">Berlaku sampai</label><input id="g-exp" name="expiryDate" type="date" required defaultValue={editing.expiryDate ?? ""} className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={labelCls} htmlFor="g-file">Scan jaminan (opsional)</label><input id="g-file" name="file" type="file" accept=".pdf,image/*" className={inputCls} /></div>
              <div className="sm:col-span-2"><label className={labelCls} htmlFor="g-notes">Catatan</label><textarea id="g-notes" name="notes" rows={2} defaultValue={editing.notes ?? ""} className={inputCls} /></div>
              <div className="sm:col-span-2"><ErrorNote error={error} /></div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={close}>Batal</button>
              <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </form>
        )}
      </ModalShell>
    </div>
  );
}
