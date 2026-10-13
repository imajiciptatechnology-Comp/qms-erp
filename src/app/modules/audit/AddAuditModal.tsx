"use client";

import { useState } from "react";
import { X, Calendar, Loader2, ClipboardCheck, Users } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { addAudit } from "./actions";

export default function AddAuditModal({ isOpen, onClose, users }: { isOpen: boolean, onClose: () => void, users: any[] }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCoAuditors, setSelectedCoAuditors] = useState<string[]>([]);
  const [leadAuditorVal, setLeadAuditorVal] = useState("");

  if (!isOpen) return null;

  const leadAuditorId = leadAuditorVal.split("|")[0];
  const eligibleCoAuditors = users.filter(u => `${u.id}|${u.name}` !== leadAuditorVal);

  function toggleCoAuditor(name: string) {
    setSelectedCoAuditors(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const department = formData.get("department") as string;

    // Check Lead Auditor Independence
    const leadAuditorObj = users.find(u => u.id === leadAuditorId);
    if (leadAuditorObj && leadAuditorObj.department === department) {
      alert(`Auditor Independence Error: Lead Auditor (${leadAuditorObj.name}) belongs to the audited department (${department}).`);
      setIsSubmitting(false);
      return;
    }

    // Check Co-Auditor Independence
    const invalidCoAuditor = users.find(u => selectedCoAuditors.includes(u.name) && u.department === department);
    if (invalidCoAuditor) {
      alert(`Auditor Independence Error: Co-Auditor (${invalidCoAuditor.name}) belongs to the audited department (${department}).`);
      setIsSubmitting(false);
      return;
    }

    formData.set("coAuditors", JSON.stringify(selectedCoAuditors));
    const res = await addAudit(formData);

    setIsSubmitting(false);
    if (res.success) {
      setSelectedCoAuditors([]);
      setLeadAuditorVal("");
      onClose();
    } else alert("Failed to schedule audit.");
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
        <h2 id="modal-title" className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-purple-600" />
          Schedule Internal Audit
        </h2>
        <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
          <X className="w-5 h-5" />
        </button>
      </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto custom-scrollbar flex-1 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Audit Number <span className="text-red-500">*</span></label>
              <input required name="auditNo" type="text" placeholder="IA-2026-01" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Audit Type <span className="text-red-500">*</span></label>
              <select required name="auditType" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white">
                <option value="Internal">Internal Audit</option>
                <option value="External">External Audit (Certification)</option>
                <option value="Supplier">Supplier Audit</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Planned Date <span className="text-red-500">*</span></label>
              <input required name="plannedDate" type="date" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Department to Audit <span className="text-red-500">*</span></label>
              <select required name="department" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white">
                <option value="">Select Department...</option>
                <option value="Top Management">Top Management</option>
                <option value="Quality Assurance">Quality Assurance</option>
                <option value="Production">Production</option>
                <option value="Engineering">Engineering</option>
                <option value="HSE">HSE</option>
                <option value="HR & Admin">HR & Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Auditee (PIC Dept.) <span className="text-slate-400 font-normal text-xs">(Optional)</span></label>
              <input type="text" name="auditeeName" placeholder="Name of PIC being audited"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Lead Auditor <span className="text-red-500">*</span></label>
            <select
              required
              name="leadAuditor"
              value={leadAuditorVal}
              onChange={e => {
                setLeadAuditorVal(e.target.value);
                // Hapus lead auditor dari co-auditors jika ada
                const name = e.target.value.split("|")[1];
                // Remove lead auditor from co-auditors if present
                setSelectedCoAuditors(prev => prev.filter(n => n !== name));
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white"
            >
              <option value="">Select Auditor...</option>
              {users.map((u) => (
                <option key={u.id} value={`${u.id}|${u.name}`}>
                  {u.name} ({u.department})
                </option>
              ))}
            </select>
          </div>

          {/* Co-Auditors */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              Co-Auditors <span className="text-slate-400 font-normal text-xs">(Optional — multiple allowed)</span>
            </label>
            {eligibleCoAuditors.length > 0 ? (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-36 overflow-y-auto">
                {eligibleCoAuditors.map(u => (
                  <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCoAuditors.includes(u.name)}
                      onChange={() => toggleCoAuditor(u.name)}
                      className="w-4 h-4 accent-purple-600"
                    />
                    <span className="text-sm text-slate-700">{u.name}</span>
                    <span className="text-xs text-slate-400 ml-auto">{u.department}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Select a Lead Auditor first.</p>
            )}
            {selectedCoAuditors.length > 0 && (
              <p className="text-xs text-purple-600 font-medium">
                Selected: {selectedCoAuditors.join(", ")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Audit Scope / Objective</label>
            <textarea name="scope" rows={2} placeholder="Focus areas for this audit..." className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white resize-none"></textarea>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Audit Criteria <span className="text-slate-400 font-normal text-xs">(ISO Clause / standard being audited)</span></label>
            <input type="text" name="criteria" placeholder="e.g., ISO 9001:2015 Clause 7.5, 8.4, 9.2"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white" />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors flex items-center gap-2">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Scheduling...</> : <><Calendar className="w-4 h-4" /> Schedule Audit</>}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
