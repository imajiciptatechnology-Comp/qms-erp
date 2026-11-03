"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search } from "lucide-react";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import TableFooter from "@/components/ui/TableFooter";
import { rupiah } from "../lib";
import { StatusBadge, btnPrimary, inputCls } from "../ui";

type Row = { id: string; quotationNo: string; revision: number; date: string; validUntil: string; status: string; subject: string; total: number; salesName: string; customer: { name: string } };

const STATUSES = ["Draft", "Waiting Approval", "Approved", "Sent", "Accepted", "Rejected", "Superseded"];

export default function QuotationList({ quotations, canManage }: { quotations: Row[]; canManage: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("Active");

  const filtered = useMemo(() => quotations.filter(r => {
    const text = `${r.quotationNo} ${r.subject} ${r.customer.name} ${r.salesName}`.toLowerCase();
    const okStatus = status === "All" || (status === "Active" ? r.status !== "Superseded" : r.status === status);
    return okStatus && text.includes(q.toLowerCase());
  }), [quotations, q, status]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input aria-label="Cari penawaran" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nomor, perihal, customer, sales…" className={`${inputCls} pl-9`} />
        </div>
        <select aria-label="Filter status" value={status} onChange={e => setStatus(e.target.value)} className={`${inputCls} sm:w-56`}>
          <option value="Active">Semua (tanpa Superseded)</option>
          <option value="All">Semua revisi</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        {canManage && <Link href="/modules/sales/quotations/new" className={`${btnPrimary} sm:ml-auto justify-center`}><Plus className="w-4 h-4" /> New Quotation</Link>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">No. Penawaran</th>
                <th className="px-6 py-4 font-semibold">Customer & Perihal</th>
                <th className="px-6 py-4 font-semibold">Tanggal</th>
                <th className="px-6 py-4 font-semibold text-right">Total (incl. PPN)</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length ? filtered.map(r => (
                <tr key={r.id} onClick={() => router.push(`/modules/sales/quotations/${r.id}`)} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-6 py-4">
                    <Link href={`/modules/sales/quotations/${r.id}`} onClick={e => e.stopPropagation()} className="font-bold text-slate-700 hover:text-blue-700 whitespace-nowrap">{r.quotationNo}</Link>
                    <span className="ml-1.5 text-xs text-slate-500">Rev.{r.revision}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-800">{r.customer.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{r.subject} · {r.salesName}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-slate-700">{r.date}</p>
                    <p className="text-xs text-slate-500">berlaku s/d {r.validUntil}</p>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">{rupiah(r.total)}</td>
                  <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                </tr>
              )) : <EmptyTableRow colSpan={5} icon={<FileText className="w-12 h-12 text-slate-200" />} title="Tidak ada penawaran" subtitle="Ubah filter atau buat penawaran baru." />}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={quotations.length} label="penawaran" />
      </div>
    </div>
  );
}
