"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Receipt, ShoppingCart, Target } from "lucide-react";
import { contractState, invoiceState, rupiah, rupiahShort } from "../../lib";
import { Card, History, InfoRow, StatCard, StatusBadge, btnSecondary } from "../../ui";
import CustomerModal, { type CustomerFormValue } from "../CustomerModal";

type C = {
  id: string; customerNo: string; name: string; type: string; npwp: string | null; address: string | null; city: string | null; contactName: string | null; contactTitle: string | null;
  contactEmail: string | null; contactPhone: string | null; paymentTerms: string; notes: string | null; historyJson: string;
  signatoryName: string | null; signatoryTitle: string | null;
  opportunities: { id: string; opportunityNo: string; title: string; stage: string; estimatedValue: number }[];
  quotations: { id: string; quotationNo: string; revision: number; subject: string; date: string; status: string; total: number }[];
  salesOrders: { id: string; soNo: string; customerPoNo: string; orderDate: string; status: string; total: number }[];
  invoices: { id: string; invoiceNo: string; termLabel: string; dueDate: string; status: string; total: number; paidAmount: number }[];
  contracts: { id: string; contractNo: string; title: string; type: string; endDate: string; status: string }[];
};

const n = (v: string | null) => v ?? undefined;

export default function CustomerDetail({ c, canManage }: { c: C; canManage: boolean }) {
  const [editing, setEditing] = useState<CustomerFormValue | null>(null);
  const revenue = c.salesOrders.filter(s => s.status !== "Cancelled").reduce((s, o) => s + o.total, 0);
  const outstanding = c.invoices.filter(i => !["Paid", "Cancelled"].includes(i.status)).reduce((s, i) => s + i.total - i.paidAmount, 0);
  const pipeline = c.opportunities.filter(o => !["Won", "Lost"].includes(o.stage)).reduce((s, o) => s + o.estimatedValue, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/modules/sales/customers" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Customers</Link>
          <h2 className="text-xl font-bold text-slate-800 mt-1">{c.name}</h2>
          <p className="text-sm text-slate-500">{c.customerNo} · {c.type}{c.city ? ` · ${c.city}` : ""}</p>
        </div>
        {canManage && (
          <button className={btnSecondary} onClick={() => setEditing({
            id: c.id, name: c.name, type: c.type, npwp: n(c.npwp), address: n(c.address), city: n(c.city), contactName: n(c.contactName), contactTitle: n(c.contactTitle),
            contactEmail: n(c.contactEmail), contactPhone: n(c.contactPhone), paymentTerms: c.paymentTerms, notes: n(c.notes),
            signatoryName: n(c.signatoryName), signatoryTitle: n(c.signatoryTitle),
          })}><Pencil className="w-4 h-4" /> Edit</button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total order" value={rupiahShort(revenue)} sub={`${c.salesOrders.length} sales order`} icon={<ShoppingCart className="w-6 h-6" />} tone="emerald" />
        <StatCard label="Piutang" value={rupiahShort(outstanding)} icon={<Receipt className="w-6 h-6" />} tone={outstanding ? "amber" : "slate"} />
        <StatCard label="Pipeline terbuka" value={rupiahShort(pipeline)} icon={<Target className="w-6 h-6" />} tone="blue" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title={`Penawaran (${c.quotations.length})`}>
            {c.quotations.length === 0 ? <p className="text-sm text-slate-500">Belum ada.</p> : (
              <ul className="divide-y divide-slate-100">{c.quotations.map(q => (
                <li key={q.id}><Link href={`/modules/sales/quotations/${q.id}`} className="flex justify-between gap-3 py-2 hover:bg-slate-50 -mx-2 px-2 rounded-lg text-sm">
                  <span className="min-w-0"><span className="font-semibold text-slate-800">{q.quotationNo} Rev.{q.revision}</span><span className="block text-xs text-slate-500 truncate">{q.date} · {q.subject}</span></span>
                  <span className="flex items-center gap-2 shrink-0"><span className="tabular-nums">{rupiah(q.total)}</span><StatusBadge status={q.status} /></span>
                </Link></li>))}</ul>
            )}
          </Card>
          <Card title={`Sales order (${c.salesOrders.length})`}>
            {c.salesOrders.length === 0 ? <p className="text-sm text-slate-500">Belum ada.</p> : (
              <ul className="divide-y divide-slate-100">{c.salesOrders.map(s => (
                <li key={s.id}><Link href={`/modules/sales/orders/${s.id}`} className="flex justify-between gap-3 py-2 hover:bg-slate-50 -mx-2 px-2 rounded-lg text-sm">
                  <span><span className="font-semibold text-slate-800">{s.soNo}</span><span className="block text-xs text-slate-500">{s.orderDate} · PO {s.customerPoNo}</span></span>
                  <span className="flex items-center gap-2 shrink-0"><span className="tabular-nums">{rupiah(s.total)}</span><StatusBadge status={s.status} /></span>
                </Link></li>))}</ul>
            )}
          </Card>
          <Card title={`Invoice (${c.invoices.length})`}>
            {c.invoices.length === 0 ? <p className="text-sm text-slate-500">Belum ada.</p> : (
              <ul className="divide-y divide-slate-100">{c.invoices.map(i => (
                <li key={i.id}><Link href={`/modules/sales/invoices/${i.id}`} className="flex justify-between gap-3 py-2 hover:bg-slate-50 -mx-2 px-2 rounded-lg text-sm">
                  <span><span className="font-semibold text-slate-800">{i.invoiceNo}</span><span className="block text-xs text-slate-500">{i.termLabel} · jatuh tempo {i.dueDate}</span></span>
                  <span className="flex items-center gap-2 shrink-0"><span className="tabular-nums">{rupiah(i.total)}</span><StatusBadge status={invoiceState(i)} /></span>
                </Link></li>))}</ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Kontak & administrasi">
            <dl className="space-y-3">
              <InfoRow label="Kontak">{c.contactName ? `${c.contactName}${c.contactTitle ? ` — ${c.contactTitle}` : ""}` : null}</InfoRow>
              <InfoRow label="Telepon / email">{[c.contactPhone, c.contactEmail].filter(Boolean).join("\n")}</InfoRow>
              <InfoRow label="Alamat">{c.address}</InfoRow>
              <InfoRow label="NPWP">{c.npwp}</InfoRow>
              <InfoRow label="Termin bayar">{c.paymentTerms}</InfoRow>
              <InfoRow label="Penandatangan kontrak">{c.signatoryName ? `${c.signatoryName}${c.signatoryTitle ? ` — ${c.signatoryTitle}` : ""}` : null}</InfoRow>
              {c.notes && <InfoRow label="Catatan">{c.notes}</InfoRow>}
            </dl>
          </Card>
          <Card title={`Kontrak (${c.contracts.length})`}>
            {c.contracts.length === 0 ? <p className="text-sm text-slate-500">Belum ada.</p> : (
              <ul className="space-y-2">{c.contracts.map(k => (
                <li key={k.id} className="flex justify-between gap-2 text-sm"><span><span className="font-medium text-slate-800">{k.title}</span><span className="block text-xs text-slate-500">{k.type} · s/d {k.endDate}</span></span><StatusBadge status={contractState(k)} /></li>
              ))}</ul>
            )}
          </Card>
          <Card title={`Opportunity (${c.opportunities.length})`}>
            {c.opportunities.length === 0 ? <p className="text-sm text-slate-500">Belum ada.</p> : (
              <ul className="space-y-2">{c.opportunities.map(o => (
                <li key={o.id} className="flex justify-between gap-2 text-sm"><span><span className="font-medium text-slate-800">{o.title}</span><span className="block text-xs text-slate-500">{o.opportunityNo} · {rupiahShort(o.estimatedValue)}</span></span><StatusBadge status={o.stage} /></li>
              ))}</ul>
            )}
          </Card>
          <Card title="Aktivitas"><History json={c.historyJson} /></Card>
        </div>
      </div>
      <CustomerModal value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
