"use client";

import { useState, useTransition } from "react";
import { Sparkles, RefreshCw, AlertTriangle, AlertOctagon, Info } from "lucide-react";
import { generateInsights, type AiInsightsResult } from "@/app/actions/ai-insights";

const SEVERITY_STYLE = {
  critical: { box: "border-red-200 bg-red-50/40", badge: "bg-red-100 text-red-700", Icon: AlertOctagon, icon: "text-red-500" },
  warning: { box: "border-amber-200 bg-amber-50/40", badge: "bg-amber-100 text-amber-700", Icon: AlertTriangle, icon: "text-amber-500" },
  info: { box: "border-slate-200 bg-white", badge: "bg-blue-100 text-blue-700", Icon: Info, icon: "text-blue-500" },
} as const;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
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

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-900/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" /> AI Insights
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data
              ? `Last analysis ${formatTime(data.generatedAt)} by ${data.generatedBy} · ${data.model}`
              : "AI analysis across all QMS modules"}
          </p>
        </div>
        <button
          onClick={run}
          disabled={isPending || !configured}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
          {isPending ? "Analysing…" : data ? "Re-analyse" : "Generate Analysis"}
        </button>
      </div>

      <div className="p-6 space-y-4">
        {!configured && (
          <p className="text-sm text-slate-500">AI is not configured yet. Set <code>AI_API_KEY</code> in the environment to enable it.</p>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

        {isPending && !data && (
          <div className="space-y-3 animate-pulse">
            {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-lg bg-slate-100" />)}
          </div>
        )}

        {!data && !isPending && configured && !error && (
          <p className="text-sm text-slate-500">No analysis yet. Click <b>Generate Analysis</b> to let AI review every module.</p>
        )}

        {data && (
          <>
            {data.summary && <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {data.insights.map((ins, idx) => {
                const s = SEVERITY_STYLE[ins.severity] ?? SEVERITY_STYLE.info;
                return (
                  <div key={idx} className={`rounded-lg border p-4 ${s.box}`}>
                    <div className="flex items-start gap-3">
                      <s.Icon className={`w-5 h-5 shrink-0 mt-0.5 ${s.icon}`} />
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{ins.module}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.badge}`}>{ins.severity}</span>
                        </div>
                        <p className="font-semibold text-sm text-slate-800">{ins.title}</p>
                        <p className="text-xs text-slate-600">{ins.finding}</p>
                        <p className="text-xs text-slate-800"><span className="font-semibold">Recommendation: </span>{ins.recommendation}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
