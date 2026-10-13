"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AuditItem } from "./actions";

const DEPARTMENTS = [
  "Top Management",
  "Quality Assurance",
  "Production",
  "Engineering",
  "HSE",
  "HR & Admin",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_STYLE: Record<string, string> = {
  Planned: "bg-slate-100 text-slate-700 border-slate-300",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-300",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-300",
  Closed: "bg-purple-100 text-purple-700 border-purple-300",
};

export default function AuditProgramView({ audits }: { audits: AuditItem[] }) {
  const [year, setYear] = useState(new Date().getFullYear());

  // Index: dept → month (0-based) → audits
  const matrix: Record<string, Record<number, AuditItem[]>> = {};
  DEPARTMENTS.forEach(dept => {
    matrix[dept] = {};
    for (let m = 0; m < 12; m++) matrix[dept][m] = [];
  });

  audits
    .filter(a => {
      const d = new Date(a.plannedDate);
      return d.getFullYear() === year;
    })
    .forEach(a => {
      const month = new Date(a.plannedDate).getMonth();
      const dept = a.department;
      if (matrix[dept]) {
        matrix[dept][month].push(a);
      }
    });

  // Count stats
  const totalAudits = audits.filter(a => new Date(a.plannedDate).getFullYear() === year).length;
  const completed = audits.filter(a => new Date(a.plannedDate).getFullYear() === year && (a.status === "Completed" || a.status === "Closed")).length;
  const planned = audits.filter(a => new Date(a.plannedDate).getFullYear() === year && a.status === "Planned").length;

  // Coverage: which departments have at least 1 completed/closed audit this year
  const coveredDepts = new Set(
    audits
      .filter(a => new Date(a.plannedDate).getFullYear() === year && (a.status === "Completed" || a.status === "Closed"))
      .map(a => a.department)
  );
  const uncoveredDepts = DEPARTMENTS.filter(d => !coveredDepts.has(d));
  const coveragePct = Math.round((coveredDepts.size / DEPARTMENTS.length) * 100);

  return (
    <div className="space-y-6">
      {/* Year selector & stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setYear(y => y - 1)}
            className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xl font-bold text-slate-800 min-w-16 text-center">{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-slate-500">Total</p>
            <p className="font-bold text-slate-800 text-lg">{totalAudits}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-emerald-600">Completed</p>
            <p className="font-bold text-emerald-700 text-lg">{completed}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-slate-500">Planned</p>
            <p className="font-bold text-slate-700 text-lg">{planned}</p>
          </div>
        </div>
      </div>

      {/* Coverage Summary */}
      <div className={`flex items-center gap-4 p-4 rounded-xl border ${coveragePct === 100 ? "bg-emerald-50 border-emerald-200" : coveragePct >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
        <div className="relative w-14 h-14 shrink-0">
          <svg role="img" aria-label={`Audit coverage: ${coveragePct}%`} viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <title>{`Audit coverage: ${coveragePct}%`}</title>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none"
              stroke={coveragePct === 100 ? "#10b981" : coveragePct >= 50 ? "#f59e0b" : "#ef4444"}
              strokeWidth="3"
              strokeDasharray={`${coveragePct} ${100 - coveragePct}`}
              strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">{coveragePct}%</span>
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm">
            Audit Coverage {year}: {coveredDepts.size} / {DEPARTMENTS.length} departments
          </p>
          {uncoveredDepts.length > 0 ? (
            <p className="text-xs text-red-700 mt-0.5">
              Not yet audited: <span className="font-semibold">{uncoveredDepts.join(", ")}</span>
            </p>
          ) : (
            <p className="text-xs text-emerald-700 mt-0.5 font-semibold">✓ All departments have been audited this year</p>
          )}
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-40 sticky left-0 bg-slate-50 z-10">
                Department
              </th>
              {MONTHS.map(m => (
                <th key={m} className="px-2 py-3 text-center font-semibold text-slate-600 min-w-20">{m}</th>
              ))}
              <th className="px-3 py-3 text-center font-semibold text-slate-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {DEPARTMENTS.map(dept => {
              const deptTotal = Object.values(matrix[dept]).flat().length;
              const isUncovered = uncoveredDepts.includes(dept);
              return (
                <tr key={dept} className={`transition-colors ${isUncovered ? "bg-red-50/40 hover:bg-red-50" : "hover:bg-slate-50"}`}>
                  <td className={`px-4 py-3 font-medium sticky left-0 z-10 border-r border-slate-100 ${isUncovered ? "bg-red-50/60 text-red-700" : "bg-white text-slate-800"}`}>
                    <div className="flex items-center gap-2">
                      {dept}
                      {isUncovered && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Not Audited</span>}
                    </div>
                  </td>
                  {MONTHS.map((_, mi) => {
                    const cell = matrix[dept][mi];
                    return (
                      <td key={mi} className="px-2 py-3 text-center align-middle">
                        {cell.length > 0 ? (
                          <div className="flex flex-col gap-1 items-center">
                            {cell.map(a => (
                              <span
                                key={a.id}
                                title={`${a.auditNo} — ${a.status}\nLead: ${a.leadAuditor}`}
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border truncate max-w-18 cursor-default ${STATUS_STYLE[a.status] || STATUS_STYLE.Planned}`}
                              >
                                {a.auditNo}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center">
                    {deptTotal > 0 ? (
                      <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{deptTotal}</span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_STYLE).map(([status, cls]) => (
          <span key={status} className={`px-2.5 py-1 rounded border font-semibold ${cls}`}>{status}</span>
        ))}
      </div>
    </div>
  );
}
