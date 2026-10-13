"use client";

import type { TrainingRecord } from "../../actions";

export default function PrintAttendance({ training }: { training: TrainingRecord }) {
  return (
    <>
      {/* Print button — hidden when printing */}
      <div className="no-print fixed top-4 right-4 flex gap-3 z-50">
        <button
          onClick={() => window.print()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-lg transition-colors"
        >
          🖨 Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-white hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-lg font-medium text-sm shadow-lg border border-slate-200 transition-colors"
        >
          ✕ Close
        </button>
      </div>

      {/* Print area */}
      <div className="max-w-4xl mx-auto p-8 bg-white font-sans text-sm text-slate-800" style={{ fontFamily: "Arial, sans-serif" }}>

        {/* Header */}
        <div className="border-2 border-slate-800 p-5 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-wide">Training Attendance Sheet</h1>
              <p className="text-slate-500 text-xs mt-1">Attendance Sheet — ISO 9001:2015 Clause 7.2</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">{training.trainingNo}</p>
              <p className="text-xs text-slate-500">No. Training</p>
            </div>
          </div>
        </div>

        {/* Training Info Grid */}
        <table className="w-full border-collapse border border-slate-400 mb-6 text-sm">
          <tbody>
            <tr>
              <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-semibold w-36">Training Title</td>
              <td className="border border-slate-300 px-3 py-2 font-medium" colSpan={3}>{training.title}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-semibold">Type / Category</td>
              <td className="border border-slate-300 px-3 py-2">{training.type} / {training.category}</td>
              <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-semibold w-28">Department</td>
              <td className="border border-slate-300 px-3 py-2">{training.department}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-semibold">Trainer / Institution</td>
              <td className="border border-slate-300 px-3 py-2">{training.trainer || "-"}</td>
              <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-semibold">Duration</td>
              <td className="border border-slate-300 px-3 py-2">{training.durationHours ? `${training.durationHours} hrs` : "-"}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-semibold">Planned Date</td>
              <td className="border border-slate-300 px-3 py-2">{training.plannedDate}</td>
              <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-semibold">Actual Date</td>
              <td className="border border-slate-300 px-3 py-2">{training.actualDate || "___________"}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-semibold">Location / Method</td>
              <td className="border border-slate-300 px-3 py-2">___________________________</td>
              <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-semibold">ISO Clause</td>
              <td className="border border-slate-300 px-3 py-2">{training.isoClause || "-"}</td>
            </tr>
            {training.objectives && (
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-semibold">Objective</td>
                <td className="border border-slate-300 px-3 py-2" colSpan={3}>{training.objectives}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Participant Table */}
        <h2 className="font-bold text-base mb-2 uppercase tracking-wide border-b-2 border-slate-800 pb-1">
          Participant List
        </h2>
        <table className="w-full border-collapse border border-slate-400 text-sm mb-6">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-400 px-3 py-2 text-center w-8">No</th>
              <th className="border border-slate-400 px-3 py-2 text-left">Participant Name</th>
              <th className="border border-slate-400 px-3 py-2 text-left w-36">Department / Position</th>
              {training.passingScore !== undefined && (
                <th className="border border-slate-400 px-3 py-2 text-center w-16">Score</th>
              )}
              <th className="border border-slate-400 px-3 py-2 text-center w-20">Result</th>
              <th className="border border-slate-400 px-3 py-2 text-center w-36">Signature</th>
            </tr>
          </thead>
          <tbody>
            {training.participants.length > 0 ? (
              training.participants.map((p, i) => (
                <tr key={p.name} className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-3 py-3 text-center">{i + 1}</td>
                  <td className="border border-slate-300 px-3 py-3 font-medium">{p.name}</td>
                  <td className="border border-slate-300 px-3 py-3 text-slate-600">{p.department}</td>
                  {training.passingScore !== undefined && (
                    <td className="border border-slate-300 px-3 py-3 text-center">
                      {p.score !== undefined ? p.score : ""}
                    </td>
                  )}
                  <td className="border border-slate-300 px-3 py-3 text-center">
                    {p.result === "Pass" ? (
                      <span className="font-bold text-green-700">PASS</span>
                    ) : p.result === "Fail" ? (
                      <span className="font-bold text-red-700">FAIL</span>
                    ) : p.result === "Attended" ? (
                      <span className="text-slate-600">Attended</span>
                    ) : ""}
                  </td>
                  <td className="border border-slate-300 px-3 py-3">&nbsp;</td>
                </tr>
              ))
            ) : (
              // Empty rows for manual fill
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  <td className="border border-slate-300 px-3 py-4 text-center text-slate-400">{i + 1}</td>
                  <td className="border border-slate-300 px-3 py-4">&nbsp;</td>
                  <td className="border border-slate-300 px-3 py-4">&nbsp;</td>
                  {training.passingScore !== undefined && <td className="border border-slate-300 px-3 py-4">&nbsp;</td>}
                  <td className="border border-slate-300 px-3 py-4">&nbsp;</td>
                  <td className="border border-slate-300 px-3 py-4">&nbsp;</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Signing Section */}
        <table className="w-full border-collapse border border-slate-400 text-sm mb-6">
          <tbody>
            <tr>
              <td className="border border-slate-300 px-4 py-2 bg-slate-50 font-semibold text-center w-1/3">Prepared By</td>
              <td className="border border-slate-300 px-4 py-2 bg-slate-50 font-semibold text-center w-1/3">Trainer / Facilitator</td>
              <td className="border border-slate-300 px-4 py-2 bg-slate-50 font-semibold text-center w-1/3">Acknowledged By (QA)</td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-4 pt-2 pb-10 text-center align-bottom text-xs text-slate-500">
                (___________________)<br />Name & Position
              </td>
              <td className="border border-slate-300 px-4 pt-2 pb-10 text-center align-bottom text-xs text-slate-500">
                ({training.trainer || "___________________"})<br />Trainer
              </td>
              <td className="border border-slate-300 px-4 pt-2 pb-10 text-center align-bottom text-xs text-slate-500">
                (___________________)<br />QA Manager
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex justify-between text-xs text-slate-400 border-t border-slate-200 pt-3">
          <span>This document was generated by QMS-ERP System</span>
          <span>Print date: {new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}</span>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 15mm; size: A4; }
        }
      `}</style>
    </>
  );
}
