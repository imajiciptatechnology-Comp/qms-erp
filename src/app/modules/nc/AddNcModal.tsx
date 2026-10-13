"use client";

import { useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { addNCR } from "./actions";
import ModalShell from "@/components/ui/ModalShell";
import type { SupplierItem } from "@/app/modules/supplier/actions";

export default function AddNcModal({ isOpen, onClose, suppliers = [] }: {
  isOpen: boolean;
  onClose: () => void;
  suppliers?: SupplierItem[];
}) {
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [source, setSource] = useState(searchParams?.get("source") === "inspection" ? "Process Monitoring" : "Internal Audit");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const supplierId = formData.get("supplierId") as string;
    const supplierName = supplierId
      ? suppliers.find(s => s.id === supplierId)?.name
      : undefined;

    const data = {
      source: formData.get("source") as string,
      department: formData.get("department") as string,
      description: formData.get("description") as string,
      detectedBy: formData.get("detectedBy") as string,
      productBatch: formData.get("productBatch") as string,
      severity: formData.get("severity") as "Minor" | "Major" | "Critical",
      dueDate: formData.get("dueDate") as string,
      isoClause: formData.get("isoClause") as string,
      findingType: "NC" as "NC" | "OFI",
      supplierId: supplierId || undefined,
      supplierName: supplierName || undefined,
    };

    const res = await addNCR(data);
    setIsSubmitting(false);
    if (res.success) onClose();
    else alert(res.message);
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-red-50">
        <h2 id="modal-title" className="text-xl font-bold flex items-center gap-2 text-red-800">
          <AlertTriangle className="w-5 h-5" />
          Raise Non-Conformance (NCR)
        </h2>
        <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-red-100 rounded-full text-red-500 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Source <span className="text-red-500">*</span></label>
              <select required name="source" value={source} onChange={e => setSource(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white">
                <option value="Internal Audit">Internal Audit</option>
                <option value="Customer Complaint">Customer Complaint</option>
                <option value="Process Monitoring">Process Monitoring</option>
                <option value="Supplier Issue">Supplier Issue</option>
                <option value="Management Review">Management Review</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Department <span className="text-red-500">*</span></label>
              <select required name="department" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white">
                <option value="">Select Dept...</option>
                {["Top Management","Quality Assurance","Production","Engineering","HSE","HR & Admin"].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Supplier dropdown — only shown when source = Supplier Issue */}
          {source === "Supplier Issue" && (
            <div className="space-y-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <label className="text-sm font-semibold text-amber-800">Related Supplier</label>
              {suppliers.length > 0 ? (
                <select name="supplierId"
                  className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 bg-white text-sm">
                  <option value="">— Select Supplier (optional) —</option>
                  {suppliers.filter(s => s.status !== "Blacklisted").map(s => (
                    <option key={s.id} value={s.id}>
                      {s.supplierNo} — {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-700 italic">No suppliers registered. Add them in the Supplier Quality module.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Severity <span className="text-red-500">*</span></label>
              <select required name="severity" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white">
                <option value="Minor">Minor</option>
                <option value="Major">Major</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Due Date (Target) <span className="text-red-500">*</span></label>
              <input required type="date" name="dueDate" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Detected By</label>
              <input type="text" name="detectedBy" placeholder="Name / position of person who detected the NC" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Product / Batch No.</label>
              <input type="text" name="productBatch" defaultValue={searchParams?.get("item") || ""} placeholder="e.g., BATCH-2025-001" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">ISO 9001 Clause Reference (Optional)</label>
            <input type="text" name="isoClause" defaultValue={searchParams?.get("source") === "inspection" ? "8.6" : ""} placeholder="e.g., 8.5.1" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">NC Description <span className="text-red-500">*</span></label>
            <textarea required name="description" rows={4}
              defaultValue={searchParams?.get("source") === "inspection" ? `Failed Inspection for item: ${searchParams?.get("item") || ""}\nInspection Ref: ${searchParams?.get("refId") || ""}` : ""}
              placeholder="Describe the non-conformance detailing the problem, where it occurred, and objective evidence..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white resize-none" />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors flex items-center gap-2">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Raise NCR"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
