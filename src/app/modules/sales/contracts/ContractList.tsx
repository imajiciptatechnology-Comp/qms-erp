"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Plus } from "lucide-react";
import { contractState, daysBetween, rupiah, today, type SalesAccess } from "../lib";
import { StatusBadge, btnPrimary, inputCls } from "../ui";

type Contract = {
  id: string; contractNo: string; type: string; title: string; startDate: string; endDate: string; value: number; visitsPerYear: number | null;
  coveredItemsJson: string; status: string; approvalDueDate: string | null; notes: string | null; customer: { name: string };
};

const FILTERS = ["Perlu perhatian", "Draft & approval", "Active", "Expiring", "Expired", "Renewed", "Terminated", "Semua"];

export default function ContractList({ contracts, access }: { contracts: Contract[]; access: SalesAccess }) {
  const [filter, setFilter] = useState("Semua");
  const rows = contracts.map(c => ({ ...c, state: contractState(c) }));
  const filtered = rows.filter(r =>
    filter === "Semua" ? true
    : filter === "Perlu perhatian" ? ["Expiring", "Expired", "Waiting Approval"].includes(r.state)
    : filter === "Draft & approval" ? ["Draft", "Waiting Approval", "Approved", "Sent"].includes(r.state)
    : r.state === filter);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 sm:items-center">
        <select aria-label="Filter kontrak" value={filter} onChange={e => setFilter(e.target.value)} className={`${inputCls} sm:w-56`}>{FILTERS.map(f => <option key={f}>{f}</option>)}</select>
        <p className="text-sm text-slate-500">“Expiring” = berakhir dalam 60 hari. Garansi dibuat otomatis saat BAST; AMC/Kalibrasi/Service butuh approval (maks. 7 hari kerja).</p>
        {access.canManage && <Link href="/modules/sales/contracts/new" className={`${btnPrimary} sm:ml-auto justify-center shrink-0`}><Plus className="w-4 h-4" /> New Contract</Link>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.length === 0 && <p className="text-sm text-slate-500 col-span-full bg-white border border-slate-200 rounded-xl p-8 text-center">Tidak ada kontrak untuk filter ini.</p>}
        {filtered.map(c => {
          const items = JSON.parse(c.coveredItemsJson) as unknown[];
          const left = daysBetween(today(), c.endDate);
          const lateApproval = c.state === "Waiting Approval" && c.approvalDueDate && today() > c.approvalDueDate;
          return (
            <Link key={c.id} href={`/modules/sales/contracts/${c.id}`} className={`block bg-white rounded-xl border shadow-sm p-5 hover:border-blue-300 transition-colors ${c.state === "Expiring" || lateApproval ? "border-amber-300" : c.state === "Expired" ? "border-red-200" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-400">{c.contractNo} · {c.type}</p>
                  <h3 className="font-semibold text-slate-800 mt-0.5">{c.title}</h3>
                  <p className="text-sm text-slate-600">{c.customer.name}</p>
                </div>
                <StatusBadge status={c.state} />
              </div>
              <dl className="grid grid-cols-3 gap-3 mt-4 text-sm">
                <div><dt className="text-xs text-slate-500">Periode</dt><dd className="text-slate-800">{c.startDate} – {c.endDate}</dd></div>
                <div><dt className="text-xs text-slate-500">Sisa</dt><dd className={left < 0 ? "text-red-700" : left <= 60 ? "text-amber-700" : "text-slate-800"}>{left < 0 ? `lewat ${-left} hari` : `${left} hari`}</dd></div>
                <div><dt className="text-xs text-slate-500">Nilai · alat</dt><dd className="text-slate-800 tabular-nums">{c.value ? rupiah(c.value) : "—"} · {items.length}</dd></div>
              </dl>
              {c.state === "Waiting Approval" && c.approvalDueDate && (
                <p className={`text-xs mt-3 flex items-center gap-1.5 ${lateApproval ? "text-red-700 font-semibold" : "text-amber-800"}`}>
                  <Clock className="w-3.5 h-3.5" aria-hidden /> Batas approval {c.approvalDueDate}{lateApproval ? " — terlambat" : ""}
                </p>
              )}
              {c.notes && <p className="text-xs text-slate-600 mt-2 line-clamp-2">{c.notes}</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
