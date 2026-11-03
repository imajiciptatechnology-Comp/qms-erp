"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { STATUS_COLORS } from "./lib";

export const inputCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50";
export const labelCls = "text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block";
export const btnPrimary = "bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm";
export const btnSecondary = "bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors";
export const btnDanger = "bg-white hover:bg-red-50 disabled:opacity-60 text-red-600 border border-red-200 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
      {status}
    </span>
  );
}

export function StatCard({ label, value, sub, icon, tone = "slate" }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; tone?: "slate" | "blue" | "emerald" | "amber" | "red" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-100 text-slate-600",
    blue: "border-blue-200 bg-blue-100 text-blue-600",
    emerald: "border-emerald-200 bg-emerald-100 text-emerald-600",
    amber: "border-amber-200 bg-amber-100 text-amber-700",
    red: "border-red-200 bg-red-100 text-red-600",
  }[tone];
  const [border, bg, text] = tones.split(" ");
  return (
    <div className={`bg-white border ${border} rounded-xl p-5 flex items-center gap-4 shadow-sm`}>
      <div className={`w-12 h-12 ${bg} ${text} rounded-xl flex items-center justify-center shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500 font-semibold uppercase">{label}</p>
        <p className="text-2xl font-bold text-slate-800 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {title && (
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</dt>
      <dd className="text-sm text-slate-800 mt-0.5 whitespace-pre-line">{children || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

export function History({ json }: { json: string }) {
  const items = (JSON.parse(json || "[]") as { id: string; date: string; userName: string; action: string }[]).slice().reverse();
  return (
    <ol className="space-y-3">
      {items.map(h => (
        <li key={h.id + h.date} className="text-sm">
          <p className="text-slate-800">{h.action}</p>
          <p className="text-xs text-slate-500">{h.userName} · {new Date(h.date).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
        </li>
      ))}
    </ol>
  );
}

type ActionResult = { success: true; id?: string } | { success: false; message: string };

/** Jalankan server action: tampilkan error, refresh data, opsional pindah halaman. */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function exec(fn: () => Promise<ActionResult>, onSuccess?: (id?: string) => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.success) {
        setError(res.message);
        return;
      }
      onSuccess?.(res.id);
      router.refresh();
    });
  }
  return { pending, error, setError, exec };
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>;
}
