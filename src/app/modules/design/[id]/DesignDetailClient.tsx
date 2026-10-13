"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle, Clock, ChevronRight, Save, Loader2, AlertTriangle, FileText, CheckSquare, ListChecks, PenTool, LayoutDashboard } from "lucide-react";
import type { DesignProject, DesignChange } from "../actions";
import { updateDesignStage, submitDesignChange, reviewDesignChange } from "../actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STAGES = [
  { id: "planning", label: "Planning", icon: LayoutDashboard, clause: "8.3.2" },
  { id: "inputs", label: "Inputs", icon: FileText, clause: "8.3.3" },
  { id: "controls", label: "Controls", icon: ListChecks, clause: "8.3.4" },
  { id: "outputs", label: "Outputs", icon: CheckSquare, clause: "8.3.5" }
];

export default function DesignDetailClient({ project, user, rolesConfig, documents = [] }: { project: DesignProject, user: any, rolesConfig: any[], documents?: any[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"stages" | "tasks" | "changes">("stages");
  const [activeStage, setActiveStage] = useState<"planning" | "inputs" | "controls" | "outputs">("planning");
  const [isSaving, setIsSaving] = useState(false);
  
  // Local state for forms
  const [stageData, setStageData] = useState(project[activeStage]);
  
  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("design_manage") || user?.department === "Engineering";

  // For Document Action
  const [docAction, setDocAction] = useState<"Create New Document" | "Revise Existing Document" | "No Document Change Needed">("Create New Document");

  // When changing tabs, reset local stage data
  const handleStageChange = (stage: typeof activeStage) => {
    setActiveStage(stage);
    setStageData(project[stage]);
  };

  const handleSaveStage = async (e: React.FormEvent, markCompleted: boolean = false) => {
    e.preventDefault();
    setIsSaving(true);
    await updateDesignStage(project.id, activeStage, stageData, markCompleted);
    setIsSaving(false);
    
    // Refresh local data to reflect newly saved stuff
    router.refresh();
  };

  const handleAddChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    await submitDesignChange(project.id, {
      date: new Date().toISOString().split("T")[0],
      description: formData.get("description") as string,
      impactAnalysis: formData.get("impactAnalysis") as string,
      requester: user?.name || "Unknown",
      documentAction: docAction,
      targetDocumentId: formData.get("targetDocumentId") as string || undefined
    });
    form.reset();
    setDocAction("Create New Document");
    setIsSaving(false);
    router.refresh();
  };

  const currentStageCompleted = project[activeStage].completed;

  // Render correct form fields based on active stage
  const renderStageForm = () => {
    if (activeStage === "planning") {
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Resources Needed</label>
            <textarea
              value={(stageData as any).resourcesNeeded || ""}
              onChange={e => setStageData({...stageData, resourcesNeeded: e.target.value})}
              disabled={currentStageCompleted || !canManage}
              rows={3}
              placeholder="List software, hardware, personnel, or budget required..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Responsibilities & Authorities</label>
            <textarea
              value={(stageData as any).responsibilities || ""}
              onChange={e => setStageData({...stageData, responsibilities: e.target.value})}
              disabled={currentStageCompleted || !canManage}
              rows={3}
              placeholder="Define who is responsible for design, review, verification, etc."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </>
      );
    }
    if (activeStage === "inputs") {
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Functional & Performance Requirements</label>
            <textarea
              value={(stageData as any).functionalReqs || ""}
              onChange={e => setStageData({...stageData, functionalReqs: e.target.value})}
              disabled={currentStageCompleted || !canManage}
              rows={3}
              placeholder="What must the product/service do? What are the performance targets?"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Statutory & Regulatory Requirements</label>
            <textarea
              value={(stageData as any).statutoryReqs || ""}
              onChange={e => setStageData({...stageData, statutoryReqs: e.target.value})}
              disabled={currentStageCompleted || !canManage}
              rows={3}
              placeholder="List any legal or safety standards that apply (e.g., SNI, CE, FDA)..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Other Requirements</label>
            <textarea
              value={(stageData as any).otherReqs || ""}
              onChange={e => setStageData({...stageData, otherReqs: e.target.value})}
              disabled={currentStageCompleted || !canManage}
              rows={2}
              placeholder="Information from previous similar designs, customer specific requests..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </>
      );
    }
    if (activeStage === "controls") {
      return (
        <>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
            <h4 className="font-semibold text-blue-800 text-sm mb-1">ISO 9001 Definitions</h4>
            <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
              <li><strong>Review:</strong> Evaluate ability of results to meet requirements.</li>
              <li><strong>Verification:</strong> Ensure design outputs meet design inputs.</li>
              <li><strong>Validation:</strong> Ensure final product is capable of meeting requirements for specified application/use.</li>
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Review Method</label>
            <textarea
              value={(stageData as any).reviewMethod || ""}
              onChange={e => setStageData({...stageData, reviewMethod: e.target.value})}
              disabled={currentStageCompleted || !canManage}
              rows={2}
              placeholder="e.g., Weekly design meetings, peer review..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Verification Method</label>
            <textarea
              value={(stageData as any).verificationMethod || ""}
              onChange={e => setStageData({...stageData, verificationMethod: e.target.value})}
              disabled={currentStageCompleted || !canManage}
              rows={2}
              placeholder="e.g., Alternative calculations, comparing with proven design..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Validation Method</label>
            <textarea
              value={(stageData as any).validationMethod || ""}
              onChange={e => setStageData({...stageData, validationMethod: e.target.value})}
              disabled={currentStageCompleted || !canManage}
              rows={2}
              placeholder="e.g., Field trials, prototype testing, user testing..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </>
      );
    }
    if (activeStage === "outputs") {
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deliverables</label>
            <textarea
              value={(stageData as any).deliverables || ""}
              onChange={e => setStageData({...stageData, deliverables: e.target.value})}
              disabled={currentStageCompleted || !canManage}
              rows={3}
              placeholder="e.g., CAD Drawings, Bill of Materials (BOM), User Manual..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Acceptance Criteria</label>
            <textarea
              value={(stageData as any).acceptanceCriteria || ""}
              onChange={e => setStageData({...stageData, acceptanceCriteria: e.target.value})}
              disabled={currentStageCompleted || !canManage}
              rows={3}
              placeholder="Criteria for product release. Essential characteristics for proper/safe use..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Breadcrumb & Header */}
      <div>
        <Link href="/modules/design" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Design Projects
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              {project.projectName}
              <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {project.id}
              </span>
            </h1>
            <p className="text-slate-500">{project.description}</p>
          </div>
          <div className="flex flex-col md:items-end text-sm text-slate-600">
            <div>PIC: <span className="font-semibold text-slate-800">{project.picName}</span></div>
            <div>Due: <span className="font-semibold text-slate-800">{project.expectedEndDate}</span></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("stages")}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === "stages" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          <PenTool className="w-4 h-4" /> Design Stages
        </button>
        <button
          onClick={() => setActiveTab("tasks")}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === "tasks" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          <CheckCircle className="w-4 h-4" /> Action Plan & Tasks
          {(project.tasks?.length || 0) > 0 && (
            <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">{project.tasks?.length || 0}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("changes")}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === "changes" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          <AlertTriangle className="w-4 h-4" /> Changes (Cl. 8.3.6)
          {project.changes.length > 0 && (
            <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">{project.changes.length}</span>
          )}
        </button>
      </div>

      {activeTab === "stages" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar Stages Menu */}
          <div className="md:col-span-1 space-y-2">
            {STAGES.map((stage, idx) => {
              const isCompleted = project[stage.id as "planning" | "inputs" | "controls" | "outputs"]?.completed;
              const isActive = activeStage === stage.id;

              // A stage is accessible if it's the first one, or if the previous one is completed
              const isAccessible = idx === 0 || project[STAGES[idx - 1].id as "planning" | "inputs" | "controls" | "outputs"]?.completed;

              return (
                <button
                  key={stage.id}
                  onClick={() => isAccessible && handleStageChange(stage.id as any)}
                  disabled={!isAccessible}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all
                    ${isActive ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-200'}
                    ${!isAccessible ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:border-blue-300 cursor-pointer'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-100 text-blue-600' : isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <stage.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${isActive ? 'text-blue-900' : 'text-slate-700'}`}>{stage.label}</p>
                      <p className="text-xs text-slate-400">Clause {stage.clause}</p>
                    </div>
                  </div>
                  {isCompleted && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                </button>
              );
            })}
          </div>

          {/* Main Stage Content */}
          <div className="md:col-span-3">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 capitalize">{activeStage} Stage</h2>
                {currentStageCompleted && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5" /> Completed on {(project[activeStage] as any).completedAt?.split('T')[0]}
                  </span>
                )}
              </div>
              
              <div className="p-6 flex-1">
                <form id="stage-form" onSubmit={(e) => handleSaveStage(e, false)} className="space-y-6">
                  {renderStageForm()}
                </form>
              </div>

              {canManage && !currentStageCompleted && (
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                  <button
                    type="submit"
                    form="stage-form"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-sm transition-colors"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Draft
                  </button>
                  <button
                    onClick={(e) => {
                      if(confirm(`Mark ${activeStage} as completed? You won't be able to edit it easily.`)) {
                        handleSaveStage(e, true);
                      }
                    }}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Complete Stage
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-800">Action Plan & Task List</h3>
            {canManage && (
              <button 
                onClick={() => {
                  const title = prompt("Task title:");
                  if (!title) return;
                  const assignedTo = prompt("Assign to (Name):");
                  const dueDate = prompt("Due date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
                  if (!assignedTo || !dueDate) return;
                  
                  const newTask = {
                    id: `TSK-${Date.now().toString().slice(-5)}`,
                    title,
                    assignedTo,
                    dueDate,
                    status: "Pending" as const
                  };
                  import("../actions").then(a => {
                    const updatedTasks = [...(project.tasks || []), newTask];
                    a.updateDesignTasks(project.id, updatedTasks).then(() => router.refresh());
                  });
                }}
                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md text-sm font-semibold transition-colors flex items-center gap-2"
              >
                + Add Task
              </button>
            )}
          </div>
          
          {(!project.tasks || project.tasks.length === 0) ? (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
              <p className="text-slate-500 text-sm">No tasks assigned yet. ISO 9001 requires planned arrangements.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Task</th>
                    <th className="px-4 py-3 font-semibold">Assigned To</th>
                    <th className="px-4 py-3 font-semibold">Due Date</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    {canManage && <th className="px-4 py-3 font-semibold text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {project.tasks.map(task => (
                    <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{task.title}</td>
                      <td className="px-4 py-3">{task.assignedTo}</td>
                      <td className="px-4 py-3">{task.dueDate}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          task.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                          task.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-center">
                          <select 
                            value={task.status}
                            onChange={(e) => {
                              import("../actions").then(a => {
                                const updatedTasks = project.tasks!.map(t => t.id === task.id ? { ...t, status: e.target.value as any } : t);
                                a.updateDesignTasks(project.id, updatedTasks).then(() => router.refresh());
                              });
                            }}
                            className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "changes" && (
        <div className="space-y-6">
          {/* Add Change Form */}
          {canManage && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Log Design Change
              </h3>
              <form onSubmit={handleAddChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description of Change</label>
                  <textarea
                    required
                    name="description"
                    rows={2}
                    placeholder="What is changing in the design?"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Impact Analysis</label>
                  <textarea
                    required
                    name="impactAnalysis"
                    rows={2}
                    placeholder="How does this change affect existing components, statutory requirements, or production?"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Required Document Action</label>
                    <select
                      value={docAction}
                      onChange={e => setDocAction(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                    >
                      <option value="Create New Document">Create New Document</option>
                      <option value="Revise Existing Document">Revise Existing Document</option>
                      <option value="No Document Change Needed">No Document Change Needed</option>
                    </select>
                  </div>

                  {docAction === "Revise Existing Document" && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Select Document to Revise <span className="text-red-500">*</span></label>
                      <select
                        required
                        name="targetDocumentId"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                      >
                        <option value="">-- Select Document --</option>
                        {documents.filter(d => d.status === "Published" || d.status === "Approved").map(d => (
                          <option key={d.id} value={d.id}>{d.docNumber} - {d.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Change Request"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Changes List */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800">Change History</h3>
            {project.changes.length === 0 ? (
              <div className="text-center py-8 bg-white border border-slate-200 rounded-xl border-dashed">
                <p className="text-slate-500 text-sm">No design changes logged yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {project.changes.map(change => (
                  <div key={change.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-800">{change.id}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                            change.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            change.status === "Rejected" ? "bg-red-50 text-red-700 border-red-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>{change.status}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Requested on {change.date} by {change.requester}</p>
                      </div>
                      {canManage && change.status === "Pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => reviewDesignChange(project.id, change.id, "Approved", user?.name).then(() => router.refresh())}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-xs font-semibold transition-colors border border-emerald-200"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => reviewDesignChange(project.id, change.id, "Rejected", user?.name).then(() => router.refresh())}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-md text-xs font-semibold transition-colors border border-red-200"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</p>
                        <p className="text-sm text-slate-700">{change.description}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Impact Analysis</p>
                        <p className="text-sm text-slate-700">{change.impactAnalysis}</p>
                      </div>
                      <div className="md:col-span-2 pt-2 border-t border-slate-200">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Required Document Action</p>
                        <p className="text-sm text-slate-700 font-medium">
                          {change.documentAction || "No Document Change Needed"}
                          {change.documentAction === "Revise Existing Document" && change.targetDocumentId && (
                            <span className="text-blue-600 ml-2">
                              (Target: {documents.find(d => d.id === change.targetDocumentId)?.docNumber || change.targetDocumentId})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      {change.reviewer ? (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Reviewed by {change.reviewer}
                        </p>
                      ) : <div />}
                      
                      {change.status === "Approved" && change.documentAction !== "No Document Change Needed" && (
                        <Link
                          href={change.targetDocumentId ? `/modules/document/${change.targetDocumentId}` : "/modules/document"}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                        >
                          <FileText className="w-4 h-4" /> 
                          {change.documentAction === "Revise Existing Document" ? "Go to Target Document" : "Go to Document Control to Add"}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
