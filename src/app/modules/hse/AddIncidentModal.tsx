"use client";

import { useState } from "react";
import { X, Loader2, Siren } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { addIncident } from "./actions";

export default function AddIncidentModal({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) {
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
      type: formData.get("type") as any,
      location: formData.get("location") as string,
      description: formData.get("description") as string,
      reporterName: user?.name || "Unknown",
    };

    const res = await addIncident(data);
    
    setIsSubmitting(false);
    if (res.success) {
      onClose();
    } else {
      setError("Failed to report incident.");
    }
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-red-50/50">
        <div>
          <h2 id="modal-title" className="font-bold text-slate-800 flex items-center gap-2">
            <Siren className="w-5 h-5 text-red-600" /> Report HSE Incident
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Incident <span className="text-red-500">*</span></label>
                <input required name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Incident Type <span className="text-red-500">*</span></label>
                <select required name="type" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white">
                  <option value="Near Miss">Near Miss</option>
                  <option value="Accident">Accident / Injury</option>
                  <option value="Environmental">Environmental Spill</option>
                  <option value="Property Damage">Property Damage</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location <span className="text-red-500">*</span></label>
              <input required name="location" type="text" placeholder="e.g. Production Line 1, Warehouse" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Detailed Description <span className="text-red-500">*</span></label>
              <textarea required name="description" rows={4} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm resize-none" placeholder="Describe what happened, who was involved, and immediate actions taken..." />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Report"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
