"use client";

import { useState, useTransition } from "react";
import { FileSearch, RefreshCw, AlertTriangle, AlertOctagon, Info, Loader2 } from "lucide-react";
import { generateInsights, type AiInsightsResult } from "@/app/actions/ai-insights";

// Warna semantik yang sama dengan badge status di modul lain (merah/kuning/biru),
// selalu dipasangkan dengan ikon + teks agar tidak bergantung pada warna saja.
const SEVERITY = {
  critical: { label: "Critical", Icon: AlertOctagon, pill: "bg-red-50 text-red-700 ring-red-200" },
  warning: { label: "Warning", Icon: AlertTriangle, pill: "bg-amber-50 text-amber-800 ring-amber-200" },
  info: { label: "Info", Icon: Info, pill: "bg-blue-50 text-blue-700 ring-blue-200" },
} as const;

function formatTime(iso: string) {
  // Zona waktu dikunci supaya hasil render server (UTC) sama dengan browser.
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }) + " WIB";
}

export default function AiInsightsPanel({ initial, configured }: { initial: AiInsightsResult | null; configured: boolean }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      const res = await generateInsights();
      if (res.ok) setData(res.result);
      else setError(res.error);
    });
  };

  const counts = data
    ? (["critical", "warning", "info"] as const).map(k => ({ k, n: data.insights.filter(i => i.severity === k).length })).filter(c => c.n > 0)
    : [];

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-900/5 overflow-hidden" aria-labelledby="qms-analysis-title">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h3 id="qms-analysis-title" className="font-bold text-slate-800 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-blue-600" /> QMS Analysis
          </h3>
          <p className="text-xs text-slate-500 mt-0.5" suppressHydrationWarning>
            {data
              ? `AI review of all modules · ${formatTime(data.generatedAt)} · by ${data.generatedBy}`
              : "AI review of all modules: findings and recommended actions"}
          </p>
        </div>
        <button
          onClick={run}
          disabled={isPending || !configured}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {isPending ? "Analysing…" : data ? "Refresh analysis" : "Run analysis"}
        </button>
      </div>

      {!configured && (
        <p className="px-6 py-5 text-sm text-slate-600">AI is not configured yet. Set <code>AI_API_KEY</code> in the environment to enable it.</p>
      )}
      {error && (
        <p role="alert" className="mx-6 mt-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {isPending && !data && (
        <div className="divide-y divide-slate-100" aria-busy="true" aria-label="Running analysis">
          {[0, 1, 2].map(i => (
            <div key={i} className="px-6 py-4 flex gap-4 animate-pulse">
              <div className="h-5 w-20 rounded bg-slate-100" />
              <div className="flex-1 space-y-2"><div className="h-4 w-1/2 rounded bg-slate-100" /><div className="h-3 w-5/6 rounded bg-slate-100" /></div>
            </div>
          ))}
        </div>
      )}

      {!data && !isPending && configured && !error && (
        <p className="px-6 py-5 text-sm text-slate-600">
          No analysis yet. <b>Run analysis</b> reviews every module (NC, audit, calibration, risk, training, HSE and more) and lists what needs attention first.
        </p>
      )}

      {data && (
        <>
          {(data.summary || counts.length > 0) && (
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 space-y-2">
              {counts.length > 0 && (
                <p className="flex flex-wrap gap-2 text-xs">
                  {counts.map(({ k, n }) => {
                    const s = SEVERITY[k];
                    return (
                      <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ring-1 ring-inset ${s.pill}`}>
                        <s.Icon className="w-3.5 h-3.5" aria-hidden="true" /> {n} {s.label}
                      </span>
                    );
                  })}
                </p>
              )}
              {data.summary && <p className="text-sm text-slate-700 leading-relaxed max-w-[80ch]">{data.summary}</p>}
            </div>
          )}

          <ol className="divide-y divide-slate-100">
            {data.insights.map((ins, idx) => {
              const s = SEVERITY[ins.severity] ?? SEVERITY.info;
              return (
                <li key={idx} className="px-6 py-4 grid gap-x-5 gap-y-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                  <div className="flex sm:flex-col items-start gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${s.pill}`}>
                      <s.Icon className="w-3.5 h-3.5" aria-hidden="true" /> {s.label}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{ins.module}</span>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-sm text-slate-800">{ins.title}</p>
                    <p className="text-sm text-slate-600">{ins.finding}</p>
                    <p className="text-sm text-slate-800"><span className="font-semibold text-slate-900">Action: </span>{ins.recommendation}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="px-6 py-2.5 border-t border-slate-100 text-[11px] text-slate-500">
            Generated by AI ({data.model}) from module data. Verify before acting.
          </p>
        </>
      )}
    </section>
  );
}
