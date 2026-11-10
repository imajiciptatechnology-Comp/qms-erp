"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgePercent, Globe2, HandCoins, Pencil, Plus, Wallet, X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import { markCommissionPaid, saveAgent, type AgentInput } from "../agentActions";
import { COMMISSION_LABEL, COUNTRIES, money, rupiahShort, toIdr, today } from "../lib";
import { Card, ErrorNote, StatCard, StatusBadge, btnPrimary, btnPrimarySm, btnSecondary, inputCls, labelCls, useAction } from "../ui";

type Agent = {
  id: string; agentNo: string; name: string; countries: string; contactName: string | null; email: string | null; phone: string | null;
  commissionPercent: number; status: string; notes: string | null; customers: { id: string; name: string; country: string }[];
};
type Commission = {
  id: string; soNo: string; orderDate: string; status: string; customer: string; country: string; agentId: string; agentName: string;
  currency: string; exchangeRate: number; subtotal: number; commissionPercent: number | null; amount: number; paidAt: string | null; paidRef: string | null; state: string | null;
};

export default function AgentsView({ agents, commissions, canEdit, canPay }: { agents: Agent[]; commissions: Commission[]; canEdit: boolean; canPay: boolean }) {
  const { pending, error, setError, exec } = useAction();
  const [editing, setEditing] = useState<(Partial<Agent> & { id?: string }) | null>(null);
  const [paying, setPaying] = useState<Commission | null>(null);
  const [filter, setFilter] = useState("Belum dibayar");

  const live = commissions.filter(c => c.state && c.state !== "Cancelled");
  const sumIdr = (rows: Commission[]) => rows.reduce((t, c) => t + toIdr(c.amount, c), 0);
  const payable = live.filter(c => c.state === "Payable");
  const accrued = live.filter(c => c.state === "Accrued");
  const shown = commissions.filter(c => filter === "Semua" || (filter === "Belum dibayar" ? c.state === "Payable" || c.state === "Accrued" : c.state === "Paid"));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Agen aktif" value={agents.filter(a => a.status === "Active").length} sub={`${new Set(agents.flatMap(a => a.countries.split(",").map(c => c.trim()))).size} negara`} icon={<Globe2 className="w-6 h-6" />} tone="blue" />
        <StatCard label="Komisi siap dibayar" value={rupiahShort(sumIdr(payable))} sub={`${payable.length} order sudah lunas`} icon={<HandCoins className="w-6 h-6" />} tone={payable.length ? "amber" : "slate"} />
        <StatCard label="Komisi berjalan" value={rupiahShort(sumIdr(accrued))} sub="Terutang setelah order lunas" icon={<Wallet className="w-6 h-6" />} />
      </div>

      <Card title="Agen & kantor perwakilan" actions={canEdit ? <button className={btnPrimarySm} onClick={() => { setError(null); setEditing({ commissionPercent: 5, status: "Active" }); }}><Plus className="w-3.5 h-3.5" aria-hidden /> Agen baru</button> : undefined}>
        {agents.length === 0 ? <p className="text-sm text-slate-500">Belum ada agen. Agen dipasang di data customer; komisinya tercatat otomatis saat PO customer tersebut masuk.</p> : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-slate-500 text-xs uppercase"><tr><th className="px-5 pb-2 font-semibold">Agen</th><th className="px-5 pb-2 font-semibold">Wilayah</th><th className="px-5 pb-2 font-semibold">Customer</th><th className="px-5 pb-2 font-semibold text-right">Komisi</th>{canEdit && <th className="px-5 pb-2"><span className="sr-only">Aksi</span></th>}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {agents.map(a => (
                  <tr key={a.id} className={a.status === "Active" ? "" : "opacity-60"}>
                    <td className="px-5 py-3"><p className="font-semibold text-slate-800">{a.name}</p><p className="text-xs text-slate-500">{a.agentNo}{a.contactName ? ` · ${a.contactName}` : ""}{a.email ? ` · ${a.email}` : ""}{a.status !== "Active" ? " · nonaktif" : ""}</p></td>
                    <td className="px-5 py-3">{a.countries}</td>
                    <td className="px-5 py-3 text-xs">{a.customers.length ? a.customers.map((c, i) => <span key={c.id}>{i ? ", " : ""}<Link href={`/modules/sales/customers/${c.id}`} className="text-blue-700 hover:underline">{c.name}</Link></span>) : <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-800 tabular-nums">{a.commissionPercent}%</td>
                    {canEdit && <td className="px-5 py-3 text-right"><button onClick={() => { setError(null); setEditing(a); }} className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md" aria-label={`Edit ${a.name}`}><Pencil className="w-4 h-4" /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Komisi per Sales Order" actions={
        <select aria-label="Filter komisi" value={filter} onChange={e => setFilter(e.target.value)} className="px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700">
          {["Belum dibayar", "Dibayar", "Semua"].map(f => <option key={f}>{f}</option>)}
        </select>
      }>
        <ErrorNote error={editing || paying ? null : error} />
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-slate-500 text-xs uppercase"><tr><th className="px-5 pb-2 font-semibold">Sales Order</th><th className="px-5 pb-2 font-semibold">Agen</th><th className="px-5 pb-2 font-semibold text-right">DPP order</th><th className="px-5 pb-2 font-semibold text-right">Komisi</th><th className="px-5 pb-2 font-semibold">Status</th>{canPay && <th className="px-5 pb-2"><span className="sr-only">Aksi</span></th>}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length ? shown.map(c => (
                <tr key={c.id}>
                  <td className="px-5 py-3"><Link href={`/modules/sales/orders/${c.id}`} className="font-semibold text-blue-700 hover:underline">{c.soNo}</Link><p className="text-xs text-slate-500">{c.customer} · {c.country} · {c.orderDate}</p></td>
                  <td className="px-5 py-3">{c.agentName}</td>
                  <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap">{money(c.subtotal, c.currency)}</td>
                  <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap font-semibold text-slate-800">{money(c.amount, c.currency)}<span className="block text-xs font-normal text-slate-500">{c.commissionPercent}%</span></td>
                  <td className="px-5 py-3"><StatusBadge status={c.state ?? "-"} /><span className="block text-xs text-slate-500 mt-0.5">{c.state === "Paid" ? `${c.paidAt} · ${c.paidRef}` : COMMISSION_LABEL[c.state ?? ""]}</span></td>
                  {canPay && <td className="px-5 py-3 text-right">{c.state === "Payable" && <button className={btnPrimarySm} onClick={() => { setError(null); setPaying(c); }}><BadgePercent className="w-3.5 h-3.5" aria-hidden /> Bayar</button>}</td>}
                </tr>
              )) : <EmptyTableRow colSpan={canPay ? 6 : 5} icon={<HandCoins className="w-12 h-12 text-slate-200" />} title="Tidak ada komisi" />}
            </tbody>
          </table>
        </div>
      </Card>

      <ModalShell isOpen={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <form onSubmit={e => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
            const data: AgentInput = { name: f.name, countries: f.countries, contactName: f.contactName, email: f.email, phone: f.phone, commissionPercent: Number(f.commissionPercent), status: f.status, notes: f.notes };
            exec(() => saveAgent(editing.id ?? null, data), () => setEditing(null));
          }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 id="modal-title" className="font-bold text-slate-800">{editing.id ? "Edit agen" : "Agen baru"}</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto">
              <div className="sm:col-span-2"><label className={labelCls} htmlFor="a-name">Nama agen / perusahaan</label><input id="a-name" name="name" required defaultValue={editing.name ?? ""} className={inputCls} /></div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="a-ctry">Negara wilayah (pisahkan dengan koma)</label>
                <input id="a-ctry" name="countries" required defaultValue={editing.countries ?? ""} placeholder="Kenya, Tanzania, Uganda" className={inputCls} />
                <p className="text-xs text-slate-500 mt-1">Contoh: {COUNTRIES.slice(1, 6).join(", ")}</p>
              </div>
              <div><label className={labelCls} htmlFor="a-cp">Kontak</label><input id="a-cp" name="contactName" defaultValue={editing.contactName ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="a-ph">Telepon</label><input id="a-ph" name="phone" defaultValue={editing.phone ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="a-em">Email</label><input id="a-em" name="email" type="email" defaultValue={editing.email ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="a-pct">Komisi default (%)</label><input id="a-pct" name="commissionPercent" type="number" min={0} max={30} step={0.5} required defaultValue={editing.commissionPercent ?? 5} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="a-st">Status</label><select id="a-st" name="status" defaultValue={editing.status ?? "Active"} className={inputCls}><option value="Active">Aktif</option><option value="Inactive">Nonaktif</option></select></div>
              <div className="sm:col-span-2"><label className={labelCls} htmlFor="a-notes">Catatan (perjanjian keagenan, eksklusivitas, dll.)</label><textarea id="a-notes" name="notes" rows={2} defaultValue={editing.notes ?? ""} className={inputCls} /></div>
              <div className="sm:col-span-2"><ErrorNote error={error} /></div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setEditing(null)}>Batal</button>
              <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </form>
        )}
      </ModalShell>

      <ModalShell isOpen={!!paying} onClose={() => setPaying(null)}>
        {paying && (
          <form onSubmit={e => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
            exec(() => markCommissionPaid(paying.id, { paidAt: f.paidAt, reference: f.reference }), () => setPaying(null));
          }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 id="modal-title" className="font-bold text-slate-800">Bayar komisi {paying.agentName}</h2>
              <button type="button" onClick={() => setPaying(null)} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">{paying.soNo} · {paying.customer}: komisi <b className="tabular-nums">{money(paying.amount, paying.currency)}</b> ({paying.commissionPercent}% dari DPP).</p>
              <div><label className={labelCls} htmlFor="p-date">Tanggal bayar</label><input id="p-date" name="paidAt" type="date" required defaultValue={today()} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="p-ref">Referensi (no. transfer / voucher)</label><input id="p-ref" name="reference" required className={inputCls} /></div>
              <ErrorNote error={error} />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setPaying(null)}>Batal</button>
              <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Catat pembayaran"}</button>
            </div>
          </form>
        )}
      </ModalShell>
    </div>
  );
}
