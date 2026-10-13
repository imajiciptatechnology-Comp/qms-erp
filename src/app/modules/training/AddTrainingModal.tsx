"use client";

import { useState, useEffect } from "react";
import { X, Loader2, GraduationCap, ShieldAlert } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { addTraining, editTraining, type TrainingRecord } from "./actions";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  editData?: TrainingRecord | null;
  ncReferenceId?: string;
  ncReferenceNo?: string;
  presetDepartment?: string;
  presetCategory?: string;
};

const DEPT_OPTIONS = ["All Departments", "Top Management", "Quality Assurance", "Production", "Engineering", "HSE", "HR & Admin"];
const TYPE_OPTIONS = ["Internal", "External", "On-the-Job", "E-Learning", "Certification"] as const;
const CATEGORY_OPTIONS = ["Quality / ISO", "Safety / K3", "Technical", "Soft Skills", "Regulatory", "Welding / Fabrication", "Environmental", "Other"];
const ISO_OPTIONS = [
  { value: "6.2", label: "6.2 — Competence & Awareness" },
  { value: "7.2", label: "7.2 — Competence" },
  { value: "7.3", label: "7.3 — Awareness" },
  { value: "8.5", label: "8.5 — Production & Service Provision" },
  { value: "9.2", label: "9.2 — Internal Audit" },
];

export default function AddTrainingModal({ isOpen, onClose, editData, ncReferenceId, ncReferenceNo, presetDepartment, presetCategory }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMandatory, setIsMandatory] = useState(editData?.isMandatory ?? false);
  const isEdit = !!editData;

  useEffect(() => { setIsMandatory(editData?.isMandatory ?? false); }, [editData]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const res = isEdit
      ? await editTraining(editData!.id, formData)
      : await addTraining(formData);
    setIsSubmitting(false);
    if (res.success) onClose();
    else alert(res.message);
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-indigo-50">
        <h2 id="modal-title" className="text-xl font-bold text-indigo-800 flex items-center gap-2">
          <GraduationCap className="w-5 h-5" />
          {isEdit ? "Edit Training" : "Schedule Training"}
        </h2>
        <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-indigo-100 rounded-full text-indigo-500 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto custom-scrollbar flex-1 p-6 space-y-5">

          {(presetDepartment || presetCategory) && !isEdit && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-sm text-indigo-800 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Training scheduled to close competency gap in <strong>{presetCategory}</strong> for <strong>{presetDepartment}</strong> department.</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Training Title <span className="text-red-500">*</span></label>
            <input required name="title" type="text" defaultValue={editData?.title || ""}
              placeholder="e.g., Internal Audit Awareness Training"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Type <span className="text-red-500">*</span></label>
              <select required name="type" defaultValue={editData?.type || "Internal"}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white">
                {TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Category <span className="text-red-500">*</span></label>
              <select required name="category" defaultValue={editData?.category || presetCategory || "Quality / ISO"}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white">
                {CATEGORY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Target Department <span className="text-red-500">*</span></label>
              <select required name="department" defaultValue={editData?.department || presetDepartment || "All Departments"}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white">
                {DEPT_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Duration (hours)</label>
              <input type="number" name="durationHours" min="0.5" step="0.5"
                defaultValue={editData?.durationHours || ""}
                placeholder="e.g., 8"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Planned Date <span className="text-red-500">*</span></label>
              <input required type="date" name="plannedDate" defaultValue={editData?.plannedDate || ""}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Trainer / Institution</label>
              <input type="text" name="trainer" defaultValue={editData?.trainer || ""}
                placeholder="e.g., John Smith / BSI Group"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">ISO 9001 Clause Reference <span className="text-slate-400 font-normal text-xs">(Optional)</span></label>
            <select name="isoClause" defaultValue={editData?.isoClause || ""}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white">
              <option value="">-- Select Clause --</option>
              {ISO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Passing Score <span className="text-slate-400 font-normal text-xs">(Optional, 0–100)</span>
              </label>
              <input type="number" name="passingScore" min="0" max="100"
                defaultValue={editData?.passingScore ?? ""}
                placeholder="e.g., 70"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white" />
              <p className="text-xs text-slate-400">If set, participants with score ≥ this value are automatically marked Pass</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Link to NCR <span className="text-slate-400 font-normal text-xs">(CAPA-driven training)</span>
              </label>
              <input type="text" name="ncReferenceNo"
                defaultValue={editData?.ncReferenceNo || ncReferenceNo || ""}
                placeholder="e.g., NCR-2026-001"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white" />
              <input type="hidden" name="ncReferenceId"
                defaultValue={editData?.ncReferenceId || ncReferenceId || ""} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Training Objectives <span className="text-slate-400 font-normal text-xs">(Optional)</span></label>
            <textarea name="objectives" rows={2} defaultValue={editData?.objectives || ""}
              placeholder="What should participants be able to do after this training?"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white resize-none" />
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <input
              type="checkbox"
              id="isMandatory"
              checked={isMandatory}
              onChange={e => setIsMandatory(e.target.checked)}
              className="w-4 h-4 accent-amber-600 mt-0.5 cursor-pointer"
            />
            <input type="hidden" name="isMandatory" value={isMandatory ? "true" : "false"} />
            <label htmlFor="isMandatory" className="cursor-pointer">
              <p className="text-sm font-semibold text-amber-800">Mandatory Training</p>
              <p className="text-xs text-amber-600 mt-0.5">Mark if all employees in the target department are required to complete this training. Will be tracked in compliance reports.</p>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:bg-indigo-400">
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                : isEdit ? "Save Changes" : "Schedule Training"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
