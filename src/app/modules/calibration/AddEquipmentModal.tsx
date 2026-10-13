"use client";

import { useState } from "react";
import { X, Save, Scale } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { addEquipment, EquipmentItem } from "./actions";

export default function AddEquipmentModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    equipmentNo: "",
    name: "",
    category: "Measuring" as EquipmentItem["category"],
    location: "",
    range: "",
    tolerance: "",
    resolution: "",
    frequencyMonths: 12,
    status: "Active" as EquipmentItem["status"],
    picName: "",
    pmFrequencyDays: 30,
    pmChecklistStr: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    
    const submitData: any = { ...form };
    delete submitData.pmChecklistStr;
    if (form.category === "Production") {
      submitData.pmChecklist = form.pmChecklistStr ? form.pmChecklistStr.split(",").map(s => s.trim()).filter(Boolean) : [];
    } else {
      submitData.pmFrequencyDays = undefined;
    }

    await addEquipment(submitData);
    onClose();
  }

  return (
    <ModalShell isOpen={true} onClose={onClose} size="max-w-2xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-teal-50">
        <h2 id="modal-title" className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Scale className="w-5 h-5 text-teal-600" /> Register Measuring Equipment
        </h2>
        <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-teal-100 rounded-full text-teal-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Equipment No / ID *</label>
              <input required value={form.equipmentNo} onChange={e => setForm({...form, equipmentNo: e.target.value})}
                placeholder="e.g., EQ-MS-001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Equipment Name *</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="e.g., Digital Caliper"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Category *</label>
              <select required value={form.category} onChange={e => setForm({...form, category: e.target.value as EquipmentItem["category"]})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900">
                <option value="Measuring">Measuring Equipment</option>
                <option value="Testing">Testing Equipment</option>
                <option value="Production">Production Machinery</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Location / Department *</label>
              <input required value={form.location} onChange={e => setForm({...form, location: e.target.value})}
                placeholder="e.g., QC Lab"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Measurement Range</label>
              <input value={form.range} onChange={e => setForm({...form, range: e.target.value})}
                placeholder="e.g., 0-150mm"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Tolerance / Accuracy</label>
              <input value={form.tolerance} onChange={e => setForm({...form, tolerance: e.target.value})}
                placeholder="e.g., ±0.02mm"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Resolution</label>
              <input value={form.resolution} onChange={e => setForm({...form, resolution: e.target.value})}
                placeholder="e.g., 0.01mm"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Calibration Frequency (Months) *</label>
              <input required type="number" min={1} value={form.frequencyMonths} onChange={e => setForm({...form, frequencyMonths: parseInt(e.target.value) || 12})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value as EquipmentItem["status"]})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900">
                <option value="Active">Active</option>
                <option value="Out of Service">Out of Service</option>
                <option value="Lost">Lost</option>
                <option value="Damaged">Damaged</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">PIC (Person In Charge)</label>
              <input value={form.picName} onChange={e => setForm({...form, picName: e.target.value})}
                placeholder="Name of person responsible"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
            </div>
            {form.category === "Production" && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">PM Frequency (Days) *</label>
                  <input required type="number" min={1} value={form.pmFrequencyDays} onChange={e => setForm({...form, pmFrequencyDays: parseInt(e.target.value) || 30})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">PM Checklist Items (comma separated)</label>
                  <input value={form.pmChecklistStr} onChange={e => setForm({...form, pmChecklistStr: e.target.value})}
                    placeholder="e.g., Check oil level, Clean filter, Test E-Stop"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-slate-900" />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Register Equipment"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
