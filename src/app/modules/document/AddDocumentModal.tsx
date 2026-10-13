"use client";

import { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, Loader2 } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { addDocument, editDocument, DocumentItem } from "./actions";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  editDoc?: DocumentItem | null;
};

export default function AddDocumentModal({ isOpen, onClose, editDoc }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes or editDoc changes
  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
    }
  }, [isOpen, editDoc]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    
    let res;
    if (editDoc) {
      res = await editDocument(editDoc.id, formData);
    } else {
      res = await addDocument(formData);
    }
    
    setIsSubmitting(false);
    if (res.success) {
      onClose();
      setSelectedFile(null);
    } else {
      alert("Failed to save document. Check console.");
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="max-w-2xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
        <h2 id="modal-title" className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          {editDoc ? "Edit Document" : "Add New Document"}
        </h2>
        <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto custom-scrollbar flex-1 p-6 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Document Number <span className="text-red-500">*</span></label>
              <input required defaultValue={editDoc?.docNumber || ""} name="docNumber" type="text" placeholder="e.g., SOP-QMS-01" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 bg-white" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Document Type <span className="text-red-500">*</span></label>
              <select required defaultValue={editDoc?.type || ""} name="type" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white">
                <option value="">Select Type...</option>
                <optgroup label="Internal Documents">
                  <option value="SOP">Standard Operating Procedure (SOP)</option>
                  <option value="Work Instruction">Work Instruction (WI)</option>
                  <option value="Form">Form / Checklist</option>
                  <option value="Manual">Manual</option>
                  <option value="Policy">Policy</option>
                  <option value="Procedure">Procedure</option>
                  <option value="Specification">Specification</option>
                  <option value="Record">Record</option>
                </optgroup>
                <optgroup label="External Documents (Clause 7.5.3.2)">
                  <option value="Standard">Standard (ISO / SNI / ASTM)</option>
                  <option value="Regulation">Regulation</option>
                  <option value="Customer Specification">Customer Specification</option>
                </optgroup>
              </select>
            </div>
          </div>

          {/* Origin */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Document Origin</label>
            <div className="flex gap-4">
              {(["Internal", "External"] as const).map(o => (
                <label key={o} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                  <input
                    type="radio"
                    name="origin"
                    value={o}
                    defaultChecked={(editDoc?.origin || "Internal") === o}
                    className="accent-blue-600"
                  />
                  {o === "Internal" ? "Internal (created in-house)" : "External (from outside the organization)"}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Document Title <span className="text-red-500">*</span></label>
            <input required defaultValue={editDoc?.title || ""} name="title" type="text" placeholder="e.g., Procedure for Internal Audit" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Department / Process Owner <span className="text-red-500">*</span></label>
            <select required defaultValue={editDoc?.department || ""} name="department" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white">
              <option value="">Select Department...</option>
              <option value="Top Management">Top Management</option>
              <option value="Quality Assurance">Quality Assurance</option>
              <option value="Production">Production</option>
              <option value="Engineering">Engineering</option>
              <option value="HSE">HSE</option>
              <option value="HR & Admin">HR & Admin</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Effective Date</label>
            <input type="date" name="effectiveDate" defaultValue={editDoc?.effectiveDate || ""} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white" />
          </div>

          {!editDoc && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Next Review Date</label>
              <input type="date" name="nextReviewDate" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white" />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Retention Period <span className="text-slate-400 font-normal text-xs">(years)</span></label>
              <input type="number" min="1" max="99" name="retentionPeriod" defaultValue={editDoc?.retentionPeriod || ""} placeholder="e.g., 5" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Access Control</label>
              <div className="flex items-center h-10">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="isRestricted"
                    value="true"
                    defaultChecked={editDoc?.isRestricted || false}
                    className="w-4 h-4 accent-red-600"
                  />
                  <span className="font-semibold text-red-600">Restricted (Confidential)</span>
                </label>
              </div>
            </div>
          </div>

          {/* File Upload Area */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              Upload Document File (PDF, DOCX) {!editDoc && <span className="text-red-500">*</span>}
            </label>
            
            <input 
              required={!editDoc}
              type="file" 
              name="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".pdf,.doc,.docx" 
              className="hidden" 
            />
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                ${selectedFile ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'}`}
            >
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-slate-800">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : editDoc && editDoc.fileName ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-slate-700">Current File: {editDoc.fileName}</p>
                  <p className="text-xs text-slate-500">Click to upload a new file to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-slate-700">Click to upload document</p>
                  <p className="text-xs text-slate-500">PDF, Word Document up to 10MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer actions inside form so they trigger submit */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-blue-400"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                <><Upload className="w-4 h-4" /> {editDoc ? "Save Changes" : "Save Document"}</>
              )}
            </button>
          </div>
        </form>

    </ModalShell>
  );
}
