"use client";

import { useState } from "react";
import { X, Loader2, Factory } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { addWorkOrder } from "./actions";
import { useRouter } from "next/navigation";

export default function AddWoModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      productName: formData.get("productName") as string,
      targetQuantity: parseInt(formData.get("targetQuantity") as string, 10),
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      operator: formData.get("operator") as string,
      machineId: formData.get("machineId") as string,
      notes: formData.get("notes") as string,
    };

    if (new Date(data.endDate) < new Date(data.startDate)) {
      setError("End date cannot be earlier than start date.");
      setIsSubmitting(false);
      return;
    }

    const res = await addWorkOrder(data);
    
    setIsSubmitting(false);
    if (res.success) {
      router.push(`/modules/ppc/${res.id}`);
      onClose();
    } else {
      setError("Something went wrong");
    }
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="max-w-2xl">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-blue-50/50">
        <div>
          <h2 id="modal-title" className="font-bold text-slate-800 flex items-center gap-2">
            <Factory className="w-5 h-5 text-blue-600" /> New Work Order
          </h2>
          <p className="text-xs text-slate-500">Create a new production schedule and assignment</p>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name <span className="text-red-500">*</span></label>
                <input
                  required
                  name="productName"
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="e.g., Shaft Bearing Type B"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Quantity (Units) <span className="text-red-500">*</span></label>
                <input
                  required
                  name="targetQuantity"
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="e.g., 1000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date <span className="text-red-500">*</span></label>
                <input
                  required
                  name="startDate"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target End Date <span className="text-red-500">*</span></label>
                <input
                  required
                  name="endDate"
                  type="date"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Machine / Area ID <span className="text-red-500">*</span></label>
                <input
                  required
                  name="machineId"
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="e.g., CNC-Milling-02"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Operator PIC <span className="text-red-500">*</span></label>
                <input
                  required
                  name="operator"
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="e.g., Budi Santoso"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Production Notes</label>
              <textarea
                name="notes"
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                placeholder="Special instructions, material batch reference, etc."
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
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Work Order"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
