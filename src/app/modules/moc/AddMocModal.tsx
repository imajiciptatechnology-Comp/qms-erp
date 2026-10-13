"use client";

import { useState } from "react";
import { X, Loader2, RefreshCw } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { addMoc } from "./actions";

export default function AddMocModal({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      category: formData.get("category") as any,
      description: formData.get("description") as string,
      proposer: user?.name || "Unknown",
      requestDate: new Date().toISOString().split("T")[0],
    };

    const res = await addMoc(data);
    
    setIsSubmitting(false);
    if (res.success) {
      onClose();
    } else {
      setError("Failed to create MOC ticket.");
    }
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-blue-50/50">
        <div>
          <h2 id="modal-title" className="font-bold text-slate-800 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" /> Propose a Change (MOC)
          </h2>
          <p className="text-xs text-slate-500">Initiate a formal Management of Change request</p>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">MOC Title <span className="text-red-500">*</span></label>
              <input required name="title" type="text" placeholder="e.g. Change of Raw Material Supplier" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category of Change <span className="text-red-500">*</span></label>
              <select required name="category" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                <option value="Process">Process</option>
                <option value="Equipment">Equipment / Machinery</option>
                <option value="Material">Raw Material</option>
                <option value="Document">Document / Specification</option>
                <option value="Organization">Organization / Personnel</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description & Reason for Change <span className="text-red-500">*</span></label>
              <textarea required name="description" rows={5} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" placeholder="Describe what is changing, why it is necessary, and any expected benefits..." />
            </div>
            
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">
              <strong>Note:</strong> After submission, this request will be reviewed by the QA / Management team for Risk Assessment before approval.
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Proposal"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
