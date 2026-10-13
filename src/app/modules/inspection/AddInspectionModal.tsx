"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { addInspection } from "./actions";
import ModalShell from "@/components/ui/ModalShell";
import { useRouter, useSearchParams } from "next/navigation";

export default function AddInspectionModal({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      type: formData.get("type") as "Incoming" | "In-Process" | "Final",
      itemName: formData.get("itemName") as string,
      lotNumber: formData.get("lotNumber") as string,
      sampleSize: parseInt(formData.get("sampleSize") as string, 10),
      inspector: user?.name || "Unknown",
      date: formData.get("date") as string,
      remarks: formData.get("remarks") as string,
    };

    const res = await addInspection(data);
    
    setIsSubmitting(false);
    if (res.success) {
      router.push(`/modules/inspection/${res.id}`);
      onClose();
    } else {
      setError("Something went wrong");
    }
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="max-w-2xl">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
        <div>
          <h2 id="modal-title" className="font-semibold text-slate-800">New Inspection Record</h2>
          <p className="text-xs text-slate-500">Record a new quality check for a product or material</p>
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Inspection Type <span className="text-red-500">*</span></label>
                <select
                  required
                  name="type"
                  defaultValue={searchParams?.get("source") === "production" ? "In-Process" : "Incoming"}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                >
                  <option value="Incoming">Incoming (IQC)</option>
                  <option value="In-Process">In-Process (IPQC)</option>
                  <option value="Final">Final (FQC)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input
                  required
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Item / Product Name <span className="text-red-500">*</span></label>
              <input
                required
                name="itemName"
                type="text"
                defaultValue={searchParams?.get("item") || ""}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="e.g., Raw Material Steel A36"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lot / Batch Number <span className="text-red-500">*</span></label>
                <input
                  required
                  name="lotNumber"
                  type="text"
                  defaultValue={searchParams?.get("lot") || ""}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="e.g., LOT-2026-10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sample Size (Qty) <span className="text-red-500">*</span></label>
                <input
                  required
                  name="sampleSize"
                  type="number"
                  min="1"
                  defaultValue={searchParams?.get("qty") || ""}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="e.g., 5"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">General Remarks</label>
              <textarea
                name="remarks"
                rows={3}
                defaultValue={searchParams?.get("source") === "production" ? `QC Request for Work Order: ${searchParams.get("refId")}` : ""}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                placeholder="Any general notes or observations..."
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Inspection"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
