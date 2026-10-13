"use client";

import { useState } from "react";
import { X, Loader2, ShieldCheck } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { addWelder } from "./actions";

export default function AddWelderModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      stampNumber: formData.get("stampNumber") as string,
      name: formData.get("name") as string,
      processType: formData.get("processType") as string,
      position: formData.get("position") as string,
      expiryDate: formData.get("expiryDate") as string,
      notes: formData.get("notes") as string,
    };

    const res = await addWelder(data);
    
    setIsSubmitting(false);
    if (res.success) {
      onClose();
    } else {
      setError("Failed to register welder.");
    }
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-orange-50/50">
        <div>
          <h2 id="modal-title" className="font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-600" /> Register Welder Qualification (WPQ)
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Welder Stamp No. <span className="text-red-500">*</span></label>
                <input required name="stampNumber" type="text" placeholder="e.g. W-001" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input required name="name" type="text" placeholder="e.g. John Doe" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Welding Process <span className="text-red-500">*</span></label>
                <select required name="processType" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-white">
                  <option value="SMAW">SMAW</option>
                  <option value="GTAW">GTAW</option>
                  <option value="GMAW">GMAW</option>
                  <option value="FCAW">FCAW</option>
                  <option value="SAW">SAW</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Position Qualified <span className="text-red-500">*</span></label>
                <select required name="position" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-white">
                  <option value="1G">1G</option>
                  <option value="2G">2G</option>
                  <option value="3G">3G</option>
                  <option value="4G">4G</option>
                  <option value="6G">6G</option>
                  <option value="All">All Positions</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date <span className="text-red-500">*</span></label>
              <input required name="expiryDate" type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm" />
              <p className="text-xs text-slate-500 mt-1">The system will automatically mark this as "Expired" past this date.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea name="notes" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm resize-none" placeholder="Any restrictions or extra qualifications..." />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register Welder"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
