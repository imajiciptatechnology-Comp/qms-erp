"use client";

import { useState } from "react";
import { X, Loader2, Wrench } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { addMaintenanceRecord } from "./actions";
import { useRouter, useSearchParams } from "next/navigation";

export default function AddMaintenanceModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
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
      machineId: formData.get("machineId") as string,
      type: formData.get("type") as "Preventive" | "Corrective",
      scheduledDate: formData.get("scheduledDate") as string,
      technician: formData.get("technician") as string,
      description: formData.get("description") as string,
      relatedWorkOrder: searchParams?.get("woId") || undefined,
    };

    const res = await addMaintenanceRecord(data);
    
    setIsSubmitting(false);
    if (res.success) {
      router.push(`/modules/maintenance/${res.id}`);
      onClose();
    } else {
      setError("Failed to create maintenance ticket.");
    }
  }

  // Pre-fill from query params if coming from PPC breakdown report
  const defaultMachine = searchParams?.get("machine") || "";
  const defaultType = searchParams?.get("machine") ? "Corrective" : "Preventive";
  const defaultDesc = searchParams?.get("woId") ? `Machine breakdown reported during WO: ${searchParams.get("woId")}` : "";

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-blue-50/50">
        <div>
          <h2 id="modal-title" className="font-bold text-slate-800 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" /> New Maintenance Ticket
          </h2>
          <p className="text-xs text-slate-500">Schedule machine servicing or repairs</p>
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

          {searchParams?.get("woId") && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 font-medium">
              Creating Corrective Maintenance for Work Order: {searchParams.get("woId")}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Machine / Equipment <span className="text-red-500">*</span></label>
                <input
                  required
                  name="machineId"
                  type="text"
                  defaultValue={defaultMachine}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="e.g., CNC-Milling-02"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Maintenance Type <span className="text-red-500">*</span></label>
                <select
                  required
                  name="type"
                  defaultValue={defaultType}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                >
                  <option value="Preventive">Preventive (Routine)</option>
                  <option value="Corrective">Corrective (Breakdown)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled Date <span className="text-red-500">*</span></label>
                <input
                  required
                  name="scheduledDate"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Technician / Vendor <span className="text-red-500">*</span></label>
                <input
                  required
                  name="technician"
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="e.g., Internal Team / PT Service"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description of Issue / Task <span className="text-red-500">*</span></label>
              <textarea
                required
                name="description"
                rows={3}
                defaultValue={defaultDesc}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                placeholder="Details of the maintenance required..."
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
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Ticket"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
