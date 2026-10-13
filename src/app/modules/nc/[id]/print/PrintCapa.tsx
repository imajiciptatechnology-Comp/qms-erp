"use client";

import { useEffect } from "react";
import type { NCRItem } from "../../actions";

const STATUS_STAGES = ["Open", "Root Cause Analysis", "Action Plan", "Verification", "Closed"];

export default function PrintCapa({ ncr }: { ncr: NCRItem }) {
  useEffect(() => {
    window.print();
  }, []);

  const currentStageIdx = STATUS_STAGES.indexOf(ncr.status);

  return (
    <div className="print-page bg-white p-8 max-w-4xl mx-auto font-sans text-sm text-slate-800">
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          .print-page { padding: 12mm; max-width: 100%; }
        }
        body { font-family: system-ui, -apple-system, sans-serif; }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CORRECTIVE ACTION REPORT</h1>
          <p className="text-slate-500 text-xs mt-1">ISO 9001:2015 Clause 10.2 — Non-Conformance & Corrective Action</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-slate-800">{ncr.ncNumber}</p>
          <p className="text-xs text-slate-500">Date: {ncr.dateRaised}</p>
          <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded border ${
            ncr.severity === "Critical" ? "bg-red-100 text-red-800 border-red-300" :
            ncr.severity === "Major" ? "bg-orange-100 text-orange-800 border-orange-300" :
            "bg-amber-100 text-amber-800 border-amber-300"
          }`}>{ncr.severity}</span>
        </div>
      </div>

      {/* Section 1: NC Details */}
      <section className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-3 py-1.5 rounded mb-3">1. Non-Conformance Details</h2>
        <table className="w-full border border-slate-300 text-xs">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="px-3 py-2 font-semibold bg-slate-50 w-40">Source</td>
              <td className="px-3 py-2">{ncr.source}</td>
              <td className="px-3 py-2 font-semibold bg-slate-50 w-40">Department</td>
              <td className="px-3 py-2">{ncr.department}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="px-3 py-2 font-semibold bg-slate-50">Date Raised</td>
              <td className="px-3 py-2">{ncr.dateRaised}</td>
              <td className="px-3 py-2 font-semibold bg-slate-50">Due Date</td>
              <td className="px-3 py-2">{ncr.dueDate}</td>
            </tr>
            {(ncr.detectedBy || ncr.productBatch) && (
              <tr className="border-b border-slate-200">
                <td className="px-3 py-2 font-semibold bg-slate-50">Detected By</td>
                <td className="px-3 py-2">{ncr.detectedBy || "-"}</td>
                <td className="px-3 py-2 font-semibold bg-slate-50">Product / Batch</td>
                <td className="px-3 py-2">{ncr.productBatch || "-"}</td>
              </tr>
            )}
            {ncr.isoClause && (
              <tr className="border-b border-slate-200">
                <td className="px-3 py-2 font-semibold bg-slate-50">ISO Clause</td>
                <td className="px-3 py-2 col-span-3">{ncr.isoClause}</td>
                <td className="px-3 py-2 font-semibold bg-slate-50">Status</td>
                <td className="px-3 py-2">{ncr.status}</td>
              </tr>
            )}
            <tr>
              <td className="px-3 py-2 font-semibold bg-slate-50 align-top">Problem Description</td>
              <td className="px-3 py-2" colSpan={3}>{ncr.description}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Section 2: Workflow Status */}
      <section className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-3 py-1.5 rounded mb-3">2. CAPA Workflow Status</h2>
        <div className="flex items-center gap-0">
          {STATUS_STAGES.map((stage, idx) => {
            const isActive = idx === currentStageIdx;
            const isCompleted = idx < currentStageIdx;
            return (
              <div key={stage} className="flex items-center flex-1">
                <div className={`flex flex-col items-center flex-1`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    isActive ? "bg-red-600 border-red-600 text-white" :
                    isCompleted ? "bg-slate-700 border-slate-700 text-white" :
                    "bg-white border-slate-300 text-slate-400"
                  }`}>{isCompleted ? "✓" : idx + 1}</div>
                  <span className={`text-[9px] font-semibold mt-1 text-center ${isActive ? "text-red-700" : isCompleted ? "text-slate-700" : "text-slate-400"}`}>{stage}</span>
                </div>
                {idx < STATUS_STAGES.length - 1 && (
                  <div className={`h-0.5 flex-1 -mt-4 ${isCompleted ? "bg-slate-700" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 3: Immediate Containment */}
      <section className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-3 py-1.5 rounded mb-3">3. Immediate Containment Action (Correction)</h2>
        <div className="border border-slate-300 rounded p-3 min-h-16 text-xs">
          {ncr.containmentAction || <span className="text-slate-400 italic">Not recorded.</span>}
        </div>
      </section>

      {/* Section 4: Root Cause Analysis */}
      {ncr.rca && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-3 py-1.5 rounded mb-3">4. Root Cause Analysis (5-Why)</h2>
          <table className="w-full border border-slate-300 text-xs">
            <tbody>
              {[1,2,3,4,5].map(n => {
                const key = `why${n}` as keyof typeof ncr.rca;
                const val = ncr.rca![key];
                return val ? (
                  <tr key={n} className="border-b border-slate-200">
                    <td className="px-3 py-2 font-bold bg-slate-50 w-20">Why {n}</td>
                    <td className="px-3 py-2">{val as string}</td>
                  </tr>
                ) : null;
              })}
              {ncr.rca.rootCauseStatement && (
                <tr>
                  <td className="px-3 py-2 font-bold bg-amber-50 text-amber-800">Root Cause</td>
                  <td className="px-3 py-2 font-medium">{ncr.rca.rootCauseStatement}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Section 5: Corrective Action Plan */}
      {ncr.actionPlan && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-3 py-1.5 rounded mb-3">5. Corrective Action Plan</h2>
          <table className="w-full border border-slate-300 text-xs">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="px-3 py-2 font-semibold bg-slate-50 w-40 align-top">Action Description</td>
                <td className="px-3 py-2" colSpan={3}>{ncr.actionPlan.description || "-"}</td>
              </tr>
              {ncr.actionPlan.preventiveAction && (
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-2 font-semibold bg-slate-50 align-top">Preventive Action</td>
                  <td className="px-3 py-2" colSpan={3}>{ncr.actionPlan.preventiveAction}</td>
                </tr>
              )}
              <tr className="border-b border-slate-200">
                <td className="px-3 py-2 font-semibold bg-slate-50">PIC</td>
                <td className="px-3 py-2">{ncr.actionPlan.picName || "-"}</td>
                <td className="px-3 py-2 font-semibold bg-slate-50">Target Date</td>
                <td className="px-3 py-2">{ncr.actionPlan.targetDate || "-"}</td>
              </tr>
              {ncr.actionPlan.actualCompletionDate && (
                <tr>
                  <td className="px-3 py-2 font-semibold bg-slate-50">Actual Completion</td>
                  <td className="px-3 py-2">{ncr.actionPlan.actualCompletionDate}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Section 6: Verification */}
      {ncr.verification && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-3 py-1.5 rounded mb-3">6. Verification of Effectiveness</h2>
          <table className="w-full border border-slate-300 text-xs">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="px-3 py-2 font-semibold bg-slate-50 w-40">Verified By</td>
                <td className="px-3 py-2">{ncr.verification.verifierName || "-"}</td>
                <td className="px-3 py-2 font-semibold bg-slate-50 w-40">Verification Date</td>
                <td className="px-3 py-2">{ncr.verification.verificationDate || "-"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="px-3 py-2 font-semibold bg-slate-50">Effective?</td>
                <td className="px-3 py-2" colSpan={3}>
                  <span className={`font-bold ${ncr.verification.isEffective ? "text-emerald-700" : "text-red-700"}`}>
                    {ncr.verification.isEffective ? "✓ YES — Corrective action is effective" : "✗ NO — Requires new corrective action"}
                  </span>
                </td>
              </tr>
              {ncr.verification.notes && (
                <tr>
                  <td className="px-3 py-2 font-semibold bg-slate-50 align-top">Notes / Evidence</td>
                  <td className="px-3 py-2" colSpan={3}>{ncr.verification.notes}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Signatures */}
      <section className="mt-8 pt-6 border-t border-slate-300">
        <div className="grid grid-cols-3 gap-8 text-xs">
          {[
            { label: "Prepared By", hint: "(NC Raiser)" },
            { label: "Reviewed By", hint: "(QA/Auditor)" },
            { label: "Approved By", hint: "(Manager)" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="h-14 border-b border-slate-400 mb-2"></div>
              <p className="font-semibold text-slate-700">{s.label}</p>
              <p className="text-slate-400">{s.hint}</p>
              <p className="text-slate-400 mt-1">Date: ________________</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div className="mt-6 pt-3 border-t border-slate-200 flex justify-between text-[10px] text-slate-400">
        <span>Document No: {ncr.ncNumber} · Generated: {new Date().toLocaleDateString()}</span>
        <span>ISO 9001:2015 Cl. 10.2 — Nonconformity and Corrective Action</span>
      </div>

      {/* Print Button (hidden when printing) */}
      <div className="no-print fixed bottom-6 right-6">
        <button onClick={() => window.print()}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center gap-2">
          🖨️ Print / Save PDF
        </button>
        <button onClick={() => window.history.back()}
          className="ml-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg shadow-lg font-medium text-sm">
          ← Back
        </button>
      </div>
    </div>
  );
}
