"use client";

import { useState } from "react";
import { X, Loader2, AlertTriangle, Lightbulb } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { raiseAuditFinding, AuditItem } from "../actions";

export default function AddFindingModal({ isOpen, onClose, audit }: { isOpen: boolean, onClose: () => void, audit: AuditItem }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [findingType, setFindingType] = useState<"NC" | "OFI">("NC");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const res = await raiseAuditFinding(audit.id, formData);

    setIsSubmitting(false);
    if (res.success) onClose();
    else alert(res.message);
  }

  const isNC = findingType === "NC";

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 ${isNC ? "bg-red-50" : "bg-blue-50"}`}>
        <h2 id="modal-title" className={`text-xl font-bold flex items-center gap-2 ${isNC ? "text-red-800" : "text-blue-800"}`}>
          {isNC ? <AlertTriangle className="w-5 h-5" /> : <Lightbulb className="w-5 h-5" />}
          Log Audit Finding
        </h2>
        <button onClick={onClose} aria-label="Close" className={`p-2 rounded-full transition-colors ${isNC ? "hover:bg-red-100 text-red-500" : "hover:bg-blue-100 text-blue-500"}`}>
          <X className="w-5 h-5" />
        </button>
      </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Finding Type Selector */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Finding Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFindingType("NC")}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${isNC ? "border-red-400 bg-red-50" : "border-slate-200 hover:border-slate-300"}`}
              >
                <div className={`p-2 rounded-lg ${isNC ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${isNC ? "text-red-700" : "text-slate-700"}`}>NC</p>
                  <p className="text-xs text-slate-500">Non-Conformance</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFindingType("OFI")}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${!isNC ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}
              >
                <div className={`p-2 rounded-lg ${!isNC ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${!isNC ? "text-blue-700" : "text-slate-700"}`}>OFI</p>
                  <p className="text-xs text-slate-500">Opportunity for Improvement</p>
                </div>
              </button>
            </div>
            <input type="hidden" name="findingType" value={findingType} />
          </div>

          {/* Info Banner */}
          <div className={`p-3 rounded-lg border text-sm ${isNC ? "bg-slate-50 border-slate-100 text-slate-600" : "bg-blue-50 border-blue-100 text-blue-700"}`}>
            {isNC ? (
              <p>Logging an NC will automatically generate a <strong>NCR</strong> in the NC Management module for the <strong>{audit.department}</strong> department.</p>
            ) : (
              <p>OFI is a suggestion for improvement. It will be recorded but <strong>does not generate an NCR</strong>. No corrective action is mandatory.</p>
            )}
          </div>

          {/* Severity — hanya untuk NC */}
          {isNC && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Severity Level <span className="text-red-500">*</span></label>
              <select required={isNC} name="severity" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white">
                <option value="Minor">Minor Non-Conformance</option>
                <option value="Major">Major Non-Conformance</option>
                <option value="Critical">Critical Non-Conformance</option>
              </select>
            </div>
          )}

          {/* ISO Clause Reference */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              ISO 9001:2015 Clause Reference <span className="text-slate-400 font-normal text-xs">(Optional)</span>
            </label>
            <select name="isoClause" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white">
              <option value="">-- Select Clause --</option>
              <optgroup label="Clause 4 — Context of the Organization">
                <option value="4.1">4.1 — Context of the Organization</option>
                <option value="4.2">4.2 — Interested Parties</option>
                <option value="4.4">4.4 — QMS Processes</option>
              </optgroup>
              <optgroup label="Clause 5 — Leadership">
                <option value="5.1">5.1 — Leadership Commitment</option>
                <option value="5.2">5.2 — Quality Policy</option>
                <option value="5.3">5.3 — Roles & Responsibilities</option>
              </optgroup>
              <optgroup label="Clause 6 — Planning">
                <option value="6.1">6.1 — Risks & Opportunities</option>
                <option value="6.2">6.2 — Quality Objectives</option>
              </optgroup>
              <optgroup label="Clause 7 — Support">
                <option value="7.1">7.1 — Resources</option>
                <option value="7.2">7.2 — Competence</option>
                <option value="7.3">7.3 — Awareness</option>
                <option value="7.4">7.4 — Communication</option>
                <option value="7.5">7.5 — Documented Information</option>
              </optgroup>
              <optgroup label="Clause 8 — Operation">
                <option value="8.1">8.1 — Operational Planning</option>
                <option value="8.2">8.2 — Product/Service Requirements</option>
                <option value="8.3">8.3 — Design & Development</option>
                <option value="8.4">8.4 — External Providers</option>
                <option value="8.5">8.5 — Production & Service Provision</option>
                <option value="8.6">8.6 — Release of Products/Services</option>
                <option value="8.7">8.7 — Nonconforming Outputs</option>
              </optgroup>
              <optgroup label="Clause 9 — Performance Evaluation">
                <option value="9.1">9.1 — Monitoring & Measurement</option>
                <option value="9.2">9.2 — Internal Audit</option>
                <option value="9.3">9.3 — Management Review</option>
              </optgroup>
              <optgroup label="Clause 10 — Improvement">
                <option value="10.2">10.2 — Nonconformity & Corrective Action</option>
                <option value="10.3">10.3 — Continual Improvement</option>
              </optgroup>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              {isNC ? "Finding Description" : "Improvement Suggestion"} <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              name="description"
              rows={5}
              placeholder={isNC
                ? "Describe the non-conformance in detail. What was the objective evidence?"
                : "Describe the opportunity for improvement and the suggested action..."}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white resize-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-lg text-white font-medium transition-colors flex items-center gap-2 ${isNC ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                : isNC ? "Log NC & Generate NCR" : "Log OFI"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
