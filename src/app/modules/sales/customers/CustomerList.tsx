"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Plus, Search } from "lucide-react";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import TableFooter from "@/components/ui/TableFooter";
import { CUSTOMER_TYPES } from "../lib";
import { btnPrimary, inputCls } from "../ui";
import CustomerModal, { type CustomerFormValue } from "./CustomerModal";

type Row = { id: string; customerNo: string; name: string; type: string; city: string | null; country: string; currency: string; contactName: string | null; contactPhone: string | null; _count: { quotations: number; salesOrders: number; contracts: number } };

export default function CustomerList({ customers, canManage }: { customers: Row[]; canManage: boolean }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [editing, setEditing] = useState<CustomerFormValue | null>(null);
  const filtered = customers.filter(c => (type === "All" || c.type === type) && `${c.name} ${c.city ?? ""} ${c.country} ${c.contactName ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input aria-label="Cari customer" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama, kota, kontak…" className={`${inputCls} pl-9`} />
        </div>
        <select aria-label="Filter jenis" value={type} onChange={e => setType(e.target.value)} className={`${inputCls} sm:w-48`}><option value="All">Semua jenis</option>{CUSTOMER_TYPES.map(t => <option key={t}>{t}</option>)}</select>
        {canManage && <button className={`${btnPrimary} sm:ml-auto justify-center`} onClick={() => setEditing({ name: "", type: CUSTOMER_TYPES[0], paymentTerms: "30 hari" })}><Plus className="w-4 h-4" /> New Customer</button>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr><th className="px-6 py-4 font-semibold">Customer</th><th className="px-6 py-4 font-semibold">Jenis</th><th className="px-6 py-4 font-semibold">Kontak</th><th className="px-6 py-4 font-semibold text-right">Penawaran / SO / Kontrak</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length ? filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4"><Link href={`/modules/sales/customers/${c.id}`} className="font-semibold text-slate-800 hover:text-blue-700">{c.name}</Link><p className="text-xs text-slate-500">{c.customerNo}{c.city ? ` · ${c.city}` : ""}{c.country !== "Indonesia" ? ` · ${c.country} (${c.currency})` : ""}</p></td>
                  <td className="px-6 py-4">{c.type}</td>
                  <td className="px-6 py-4"><p className="text-slate-800">{c.contactName ?? "—"}</p><p className="text-xs text-slate-500">{c.contactPhone}</p></td>
                  <td className="px-6 py-4 text-right tabular-nums">{c._count.quotations} / {c._count.salesOrders} / {c._count.contracts}</td>
                </tr>
              )) : <EmptyTableRow colSpan={4} icon={<Building2 className="w-12 h-12 text-slate-200" />} title="Tidak ada customer" />}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={customers.length} label="customer" />
      </div>
      <CustomerModal value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
