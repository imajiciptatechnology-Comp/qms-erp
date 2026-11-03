"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, Search } from "lucide-react";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import TableFooter from "@/components/ui/TableFooter";
import { daysBetween, invoiceState, rupiah, rupiahShort, today } from "../lib";
import { StatusBadge, inputCls } from "../ui";

type Row = { id: string; invoiceNo: string; termLabel: string; invoiceDate: string; dueDate: string; total: number; paidAmount: number; status: string; customer: { name: string }; salesOrder: { soNo: string } | null };

/** Umur piutang dihitung dari jatuh tempo. */
const BUCKETS = [
  { label: "Belum jatuh tempo", test: (d: number) => d <= 0 },
  { label: "1–30 hari", test: (d: number) => d >= 1 && d <= 30 },
  { label: "31–60 hari", test: (d: number) => d >= 31 && d <= 60 },
  { label: "> 60 hari", test: (d: number) => d > 60 },
];

export default function InvoiceList({ invoices }: { invoices: Row[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("Open");
  const rows = useMemo(() => invoices.map(i => ({ ...i, state: invoiceState(i), outstanding: i.status === "Cancelled" ? 0 : i.total - i.paidAmount })), [invoices]);
  const openRows = rows.filter(r => r.outstanding > 0);
  const aging = BUCKETS.map(b => {
    const list = openRows.filter(r => b.test(daysBetween(r.dueDate, today())));
    return { ...b, count: list.length, amount: list.reduce((s, r) => s + r.outstanding, 0) };
  });

  const filtered = rows.filter(r => {
    const ok = filter === "All" || (filter === "Open" ? r.outstanding > 0 : r.state === filter);
    return ok && `${r.invoiceNo} ${r.customer.name} ${r.salesOrder?.soNo ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <section aria-label="Umur piutang" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {aging.map((a, i) => (
          <div key={a.label} className={`bg-white border rounded-xl p-4 shadow-sm ${i > 0 && a.count ? "border-red-200" : "border-slate-200"}`}>
            <p className="text-xs font-semibold text-slate-500 uppercase">{a.label}</p>
            <p className={`text-xl font-bold mt-1 tabular-nums ${i > 0 && a.count ? "text-red-700" : "text-slate-800"}`}>{rupiahShort(a.amount)}</p>
            <p className="text-xs text-slate-500">{a.count} invoice</p>
          </div>
        ))}
      </section>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input aria-label="Cari invoice" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nomor invoice, customer, SO…" className={`${inputCls} pl-9`} />
        </div>
        <select aria-label="Filter status" value={filter} onChange={e => setFilter(e.target.value)} className={`${inputCls} sm:w-52`}>
          <option value="Open">Belum lunas</option><option value="Overdue">Lewat jatuh tempo</option><option value="Paid">Lunas</option><option value="Cancelled">Dibatalkan</option><option value="All">Semua</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">No. Invoice</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Jatuh tempo</th>
                <th className="px-6 py-4 font-semibold text-right">Total</th>
                <th className="px-6 py-4 font-semibold text-right">Sisa</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length ? filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4"><Link href={`/modules/sales/invoices/${r.id}`} className="font-bold text-slate-700 hover:text-blue-700 whitespace-nowrap">{r.invoiceNo}</Link><p className="text-xs text-slate-500">{r.termLabel}</p></td>
                  <td className="px-6 py-4"><p className="font-semibold text-slate-800">{r.customer.name}</p><p className="text-xs text-slate-500">{r.salesOrder?.soNo ?? "Tanpa SO"}</p></td>
                  <td className="px-6 py-4 whitespace-nowrap">{r.dueDate}{r.state === "Overdue" && <p className="text-xs text-red-700">{daysBetween(r.dueDate, today())} hari lewat</p>}</td>
                  <td className="px-6 py-4 text-right tabular-nums whitespace-nowrap">{rupiah(r.total)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">{rupiah(r.outstanding)}</td>
                  <td className="px-6 py-4"><StatusBadge status={r.state} /></td>
                </tr>
              )) : <EmptyTableRow colSpan={6} icon={<Receipt className="w-12 h-12 text-slate-200" />} title="Tidak ada invoice" subtitle="Invoice diterbitkan dari halaman Sales Order per termin." />}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={invoices.length} label="invoice" />
      </div>
    </div>
  );
}
