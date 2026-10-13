"use client";

import { useState } from "react";
import { X, Loader2, HardHat } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { addPatrol } from "./actions";

export default function AddPatrolModal({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      date: formData.get("date") as string,
      area: formData.get("area") as string,
      findings: formData.get("findings") as string,
      isCompliance: formData.get("isCompliance") === "true",
      inspector: user?.name || "Unknown",
    };

    const res = await addPatrol(data);
    
    setIsSubmitting(false);
    if (res.success) {
      onClose();
    } else {
      setError("Failed to record safety patrol.");
    }
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-emerald-50/50">
        <div>
          <h2 id="modal-title" className="font-bold text-slate-800 flex items-center gap-2">
            <HardHat className="w-5 h-5 text-emerald-600" /> Log Safety Patrol
          </h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Patrol <span className="text-red-500">*</span></label>
                <input required name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Area Inspected <span className="text-red-500">*</span></label>
                <input required name="area" type="text" placeholder="e.g. Welding Zone A" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Overall Compliance Result <span className="text-red-500">*</span></label>
              <select required name="isCompliance" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white">
                <option value="true">Compliant (Safe, No Major Issues)</option>
                <option value="false">Needs Attention (Violations/Hazards Found)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Inspection Findings <span className="text-red-500">*</span></label>
              <textarea required name="findings" rows={4} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none" placeholder="List any safety hazards found, PPE non-compliances, or general safe conditions observed..." />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log Patrol"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
