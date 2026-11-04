"use client";

import { FileDown } from "lucide-react";
import { STATUS_COLORS } from "./lib";
import { btnSecondary } from "../sales/ui";

// Komponen dasar dipakai bersama dengan modul Sales supaya tampilan seragam.
export { Card, ErrorNote, History, InfoRow, StatCard, useAction, btnDanger, btnPrimary, btnSecondary, inputCls, labelCls } from "../sales/ui";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
      {status}
    </span>
  );
}

/** Tautan unduh dokumen ber-kop Arunika (lihat documents/[kind]/[id]/route.ts). */
export function DocLinks({ kind, id, label }: { kind: string; id: string; label?: string }) {
  return (
    <>
      {(["pdf", "docx"] as const).map(f => (
        <a key={f} href={`/modules/logistics/documents/${kind}/${id}?format=${f}`} {...(f === "pdf" ? { target: "_blank", rel: "noreferrer" } : {})} className={btnSecondary}>
          <FileDown className="w-4 h-4" aria-hidden /> {label ? `${label} ` : ""}{f === "pdf" ? "PDF" : "Word"}
        </a>
      ))}
    </>
  );
}
