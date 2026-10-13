"use client";

import { useState } from "react";
import { X, Loader2, FileText } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { addWPS } from "./actions";

export default function AddWpsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      id: formData.get("id") as string,
      baseMetal: formData.get("baseMetal") as string,
      fillerMetal: formData.get("fillerMetal") as string,
      processType: formData.get("processType") as string,
      issueDate: formData.get("issueDate") as string,
    };

    const res = await addWPS(data);
    
    setIsSubmitting(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.message || "Failed to add WPS.");
    }
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-blue-50/50">
        <div>
          <h2 id="modal-title" className="font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> New WPS Document
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">WPS Number <span className="text-red-500">*</span></label>
              <input required name="id" type="text" placeholder="e.g. WPS-SMAW-CS-001" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Process Type <span className="text-red-500">*</span></label>
                <select required name="processType" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                  <option value="SMAW">SMAW</option>
                  <option value="GTAW">GTAW</option>
                  <option value="GMAW">GMAW</option>
                  <option value="FCAW">FCAW</option>
                  <option value="SAW">SAW</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Issue Date <span className="text-red-500">*</span></label>
                <input required name="issueDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Base Metal <span className="text-red-500">*</span></label>
                <input required name="baseMetal" type="text" placeholder="e.g. Carbon Steel (P1)" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Filler Metal <span className="text-red-500">*</span></label>
                <input required name="fillerMetal" type="text" placeholder="e.g. E7018" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save WPS"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
