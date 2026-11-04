import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { DOC_STATUS_COLORS, daysLeftText, expiryState, rupiah, type DocTypeSpec } from "../lib";
import { VerifyDocButtons } from "./DocumentForms";

type Doc = {
  id: string; docType: string; docNo: string | null; holderName?: string | null; simClass?: string | null; issuer?: string | null;
  validFrom: string | null; validUntil: string | null; amount?: number | null; paidDate?: string | null; fileUrl: string | null; fileName: string | null;
  source: string; status: string; notes: string | null; createdBy: string; createdAt: string; verifiedBy: string | null;
};

const th = "text-left font-semibold px-4 py-2.5 whitespace-nowrap";
const td = "px-4 py-2.5 align-top";

/** Semua versi dokumen (lama tidak dihapus). Versi Verified dengan masa berlaku terakhir = "Berlaku". */
export function DocTable({ kind, docs, types, canVerify }: { kind: "vehicle" | "driver"; docs: Doc[]; types: Record<string, DocTypeSpec>; canVerify: boolean }) {
  const current = new Map<string, string>();
  for (const d of docs) {
    if (d.status !== "Verified" || !d.validUntil) continue;
    const cur = docs.find(x => x.id === current.get(d.docType));
    if (!cur || d.validUntil > cur.validUntil!) current.set(d.docType, d.id);
  }
  const ordered = Object.keys(types).flatMap(t => docs.filter(d => d.docType === t).sort((a, b) => (b.validUntil ?? "9999").localeCompare(a.validUntil ?? "9999") || b.createdAt.localeCompare(a.createdAt)));
  if (!ordered.length) return <p className="text-sm text-slate-500">Belum ada dokumen.</p>;
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-500 bg-slate-50">
          <tr>{["Dokumen", "Nomor", "Berlaku", "Masa berlaku", "Status", "File", "Dicatat"].map(h => <th key={h} className={th}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ordered.map(d => {
            const spec = types[d.docType];
            const isCurrent = current.get(d.docType) === d.id;
            const st = expiryState(d.validUntil, spec?.remindDays ?? [30]);
            const superseded = d.status === "Verified" && !isCurrent;
            return (
              <tr key={d.id} className={superseded ? "text-slate-400" : ""}>
                <td className={td}>
                  <p className="font-medium whitespace-nowrap">{spec?.label ?? d.docType}{d.simClass ? ` · ${d.simClass}` : ""}</p>
                  {(d.holderName || d.issuer) && <p className="text-xs text-slate-500">{d.holderName || d.issuer}</p>}
                  {d.amount ? <p className="text-xs text-slate-500">{rupiah(d.amount)}{d.paidDate ? ` · dibayar ${d.paidDate}` : ""}</p> : null}
                  {d.notes && <p className="text-xs text-slate-500 max-w-xs">{d.notes}</p>}
                </td>
                <td className={`${td} tabular-nums whitespace-nowrap`}>{d.docNo ?? "—"}</td>
                <td className={`${td} whitespace-nowrap`}>{d.validFrom ?? "…"} s/d <b>{d.validUntil ?? "—"}</b></td>
                <td className={`${td} whitespace-nowrap`}>
                  {superseded ? <span className="text-xs">versi lama</span>
                    : st.level === "none" ? <span className="text-xs text-slate-400">—</span>
                    : <span className={`text-xs px-2 py-0.5 rounded-full border ${st.level === "expired" ? "bg-red-50 text-red-700 border-red-200" : st.level === "remind" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{daysLeftText(st.daysLeft)}</span>}
                </td>
                <td className={td}>
                  <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${DOC_STATUS_COLORS[d.status] ?? ""}`}>{isCurrent ? "Berlaku" : d.status}</span>
                  {d.status === "Draft" && canVerify && <div className="mt-2"><VerifyDocButtons kind={kind} id={d.id} validUntil={d.validUntil} needsSimClass={d.docType === "SIM"} simClass={d.simClass} /></div>}
                </td>
                <td className={td}>
                  {d.fileUrl ? <Link href={d.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"><FileText className="w-3.5 h-3.5" />{d.fileName?.slice(0, 24) ?? "Lihat"}</Link> : <span className="text-xs text-slate-400">—</span>}
                </td>
                <td className={`${td} text-xs text-slate-500 whitespace-nowrap`}>
                  {d.createdBy} · {d.createdAt.slice(0, 10)}
                  <span className="flex items-center gap-1">{d.source === "Scan AI" && <Sparkles className="w-3 h-3 text-blue-600" aria-hidden />}{d.source}{d.verifiedBy && d.status === "Verified" ? ` · cek: ${d.verifiedBy}` : ""}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Tabs({ base, tab, items }: { base: string; tab: string; items: { id: string; label: string; count?: number }[] }) {
  return (
    <div className="flex gap-1 border-b border-slate-200" role="tablist">
      {items.map(i => (
        <Link key={i.id} href={i.id === "overview" ? base : `${base}?tab=${i.id}`} role="tab" aria-selected={tab === i.id}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === i.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          {i.label}{i.count != null ? <span className="ml-1.5 text-xs text-slate-400">{i.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}
