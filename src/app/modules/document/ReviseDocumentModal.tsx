"use client";

import { useState } from "react";
import { X, FileUp, Loader2, History } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { createDocumentRevision, DocumentItem } from "./actions";

export default function ReviseDocumentModal({ isOpen, onClose, document }: { isOpen: boolean, onClose: () => void, document: DocumentItem | null }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !document) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const res = await createDocumentRevision(document!.id, formData);
    
    setIsSubmitting(false);
    if (res.success) onClose();
    else alert(res.message);
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
        <h2 id="modal-title" className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          Create Revision for {document.docNumber}
        </h2>
        <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
          <X className="w-5 h-5" />
        </button>
      </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
            <History className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Creating Revision {document.revision + 1}</p>
              <p>This will create a new Draft. The current <strong>Published (Rev {document.revision})</strong> version will remain active until the new revision is Approved and Published.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Change Log (What changed?) <span className="text-red-500">*</span></label>
            <textarea required name="changeLog" rows={3} placeholder="Describe the changes made in this revision..." className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white resize-none"></textarea>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Next Review Date (Optional)</label>
            <input type="date" name="nextReviewDate" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">New Document File (Optional)</label>
            <p className="text-xs text-slate-500 mb-2">If you do not upload a new file, the current file will be copied to the new revision.</p>
            <input type="file" name="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><FileUp className="w-4 h-4" /> Create Draft</>}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
