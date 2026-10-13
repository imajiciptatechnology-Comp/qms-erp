"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { addDesignProject } from "./actions";
import ModalShell from "@/components/ui/ModalShell";
import { useRouter } from "next/navigation";

export default function AddDesignModal({ isOpen, onClose, user, allUsers = [] }: { isOpen: boolean, onClose: () => void, user: any, allUsers?: any[] }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const initialDept = user?.department || "Engineering";
  const [selectedDept, setSelectedDept] = useState(initialDept);

  // Extract unique departments from all users, and ensure current user's department is there
  const allDepartments = Array.from(new Set(
    allUsers.map(u => u.department).filter(Boolean)
  ));
  if (!allDepartments.includes(initialDept)) {
    allDepartments.push(initialDept);
  }

  // Filter PICs based on selected department
  const availablePICs = allUsers.filter(u => u.department === selectedDept);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      projectName: formData.get("projectName") as string,
      description: formData.get("description") as string,
      picName: formData.get("picName") as string,
      department: formData.get("department") as string,
      startDate: formData.get("startDate") as string,
      expectedEndDate: formData.get("expectedEndDate") as string,
    };

    const res = await addDesignProject(data);
    
    setIsSubmitting(false);
    if (res.success) {
      router.push(`/modules/design/${res.id}`);
      onClose();
    } else {
      setError(res.message || "Something went wrong");
    }
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="max-w-2xl">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
        <div>
          <h2 id="modal-title" className="font-semibold text-slate-800">New Design Project</h2>
          <p className="text-xs text-slate-500">Create a new product/service design project</p>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Project Name <span className="text-red-500">*</span></label>
              <input
                required
                name="projectName"
                type="text"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="e.g., New Premium Packaging Design"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-red-500">*</span></label>
              <textarea
                required
                name="description"
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                placeholder="Briefly describe the objective and scope of this design project..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department <span className="text-red-500">*</span></label>
                <select
                  required
                  name="department"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                >
                  <option value="">-- Select Department --</option>
                  {allDepartments.map((dept: any) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PIC (Person in Charge) <span className="text-red-500">*</span></label>
                <select
                  required
                  name="picName"
                  defaultValue={user?.name}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                >
                  <option value="">-- Select PIC --</option>
                  {availablePICs.map((pic: any) => (
                    <option key={pic.id} value={pic.name}>{pic.name}</option>
                  ))}
                </select>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Expected End Date <span className="text-red-500">*</span></label>
                <input
                  required
                  name="expectedEndDate"
                  type="date"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
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
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Project"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
