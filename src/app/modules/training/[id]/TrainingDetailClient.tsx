"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Calendar, Users, CheckCircle, Upload, Download,
  Loader2, Plus, Trash2, FileText, AlertTriangle, Save, Edit, ClipboardCheck, Printer
} from "lucide-react";
import type { TrainingRecord, TrainingParticipant, EffectivenessEvaluation } from "../actions";
import {
  updateTrainingStatus, addParticipant, addParticipantsBulk, updateParticipantResult,
  removeParticipant, uploadTrainingEvidence, updateEffectivenessEval
} from "../actions";
import AddTrainingModal from "../AddTrainingModal";

const STATUS_BADGE: Record<string, string> = {
  Planned: "bg-slate-100 text-slate-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-red-100 text-red-700",
};

const RESULT_BADGE: Record<string, string> = {
  Pass: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Fail: "bg-red-100 text-red-700 border-red-200",
  Attended: "bg-blue-100 text-blue-700 border-blue-200",
};

const EFFECTIVENESS_BADGE: Record<string, string> = {
  Effective: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Partially Effective": "bg-amber-100 text-amber-700 border-amber-200",
  "Not Effective": "bg-red-100 text-red-700 border-red-200",
};

const DEPTS = ["Quality Assurance", "Production", "Engineering", "HSE", "HR & Admin", "Top Management"];

export default function TrainingDetailClient({
  training, user, rolesConfig, allUsers
}: { training: TrainingRecord, user: any, rolesConfig: any[], allUsers: any[] }) {

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [actualDate, setActualDate] = useState(training.actualDate || "");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isReTrainOpen, setIsReTrainOpen] = useState(false);

  // Add participant
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [addMode, setAddMode] = useState<"system" | "manual" | "bulk">("system");
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newParticipantDept, setNewParticipantDept] = useState("Quality Assurance");
  const [bulkDept, setBulkDept] = useState("Quality Assurance");

  // Edit participant result
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null);
  const [editResult, setEditResult] = useState<TrainingParticipant>({} as TrainingParticipant);

  // Effectiveness evaluation
  const [evalData, setEvalData] = useState<EffectivenessEvaluation>(
    training.effectiveness || { method: "Observation", result: "Effective" }
  );
  const [isSavingEval, setIsSavingEval] = useState(false);
  const [evalSaved, setEvalSaved] = useState(!!training.effectiveness?.result);

  const roleData = rolesConfig?.find((r: any) => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("training");
  const isCompleted = training.status === "Completed";
  const isPlanned = training.status === "Planned";

  async function handleMarkCompleted() {
    if (!actualDate) { alert("Isi Actual Date terlebih dahulu."); return; }
    setIsSubmitting(true);
    await updateTrainingStatus(training.id, "Completed", actualDate);
    setIsSubmitting(false);
  }

  async function handleMarkCancelled() {
    if (!confirm("Cancel this training?")) return;
    setIsSubmitting(true);
    await updateTrainingStatus(training.id, "Cancelled");
    setIsSubmitting(false);
  }

  async function handleAddParticipant() {
    if (!newParticipantName.trim()) { alert("Name cannot be empty."); return; }
    setIsSubmitting(true);
    const res = await addParticipant(training.id, { name: newParticipantName.trim(), department: newParticipantDept });
    if (!res.success) alert(res.message);
    setNewParticipantName("");
    setShowAddParticipant(false);
    setAddMode("system");
    setIsSubmitting(false);
  }

  async function handleBulkAdd() {
    const toAdd = allUsers
      .filter(u => u.department === bulkDept)
      .map(u => ({ name: u.name, department: u.department, userId: u.id }));
    if (toAdd.length === 0) { alert(`Tidak ada user dengan department ${bulkDept}.`); return; }
    setIsSubmitting(true);
    const res = await addParticipantsBulk(training.id, toAdd);
    setIsSubmitting(false);
    if (res.success) {
      alert(`${res.added} participant(s) added${res.skipped ? `, ${res.skipped} already exist` : ""}.`);
      setShowAddParticipant(false);
    } else alert(res.message);
  }

  async function handleSaveResult(name: string) {
    setIsSubmitting(true);
    await updateParticipantResult(training.id, name, {
      result: editResult.result,
      score: editResult.score,
      certificateNo: editResult.certificateNo,
      certificateExpiry: editResult.certificateExpiry,
    });
    setEditingParticipant(null);
    setIsSubmitting(false);
  }

  async function handleSaveEval() {
    if (!evalData.result) { alert("Please select an evaluation result."); return; }
    setIsSavingEval(true);
    const res = await updateEffectivenessEval(training.id, {
      ...evalData,
      evaluatorName: user.name,
      evaluationDate: new Date().toISOString().split("T")[0],
    });
    setIsSavingEval(false);
    if (res.success) setEvalSaved(true);
    else alert(res.message);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadTrainingEvidence(training.id, fd);
    setIsUploading(false);
    if (!res.success) alert(res.message);
  }

  const passCount = training.participants.filter(p => p.result === "Pass").length;
  const failCount = training.participants.filter(p => p.result === "Fail").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/modules/training" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800 truncate">{training.title}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${STATUS_BADGE[training.status]}`}>{training.status}</span>
            {training.ncReferenceNo && (
              <Link href={`/modules/nc`} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 shrink-0 hover:bg-red-100 transition-colors">
                CAPA: {training.ncReferenceNo}
              </Link>
            )}
            {training.effectiveness?.result && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${EFFECTIVENESS_BADGE[training.effectiveness.result]}`}>
                Eval: {training.effectiveness.result}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-0.5">{training.trainingNo} · {training.type} · {training.category}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href={`/modules/training/${training.id}/print`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Printer className="w-4 h-4" /> Attendance
          </a>
          {canManage && (
            <button onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              <Edit className="w-4 h-4" /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Info + Actions */}
        <div className="space-y-6">

          {/* Info Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Training Information</h3>
            <div className="space-y-3 text-sm">
              {[
                { label: "Department", value: training.department },
                { label: "Trainer / Lembaga", value: training.trainer || "-" },
                { label: "Duration", value: training.durationHours ? `${training.durationHours} hrs` : "-" },
                { label: "ISO Clause", value: training.isoClause || "-" },
              { label: "Passing Score", value: training.passingScore !== undefined ? `≥ ${training.passingScore} (auto Pass/Fail)` : "Manual" },
              ].map(row => (
                <div key={row.label}>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">{row.label}</p>
                  <p className="font-medium text-slate-800">{row.value}</p>
                </div>
              ))}
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Planned Date</p>
                <p className="font-medium text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />{training.plannedDate}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Actual Date</p>
                {isCompleted ? (
                  <p className="font-medium text-emerald-700 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{training.actualDate}</p>
                ) : isPlanned && canManage ? (
                  <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white" />
                ) : (
                  <p className="text-slate-400 italic text-sm">Not filled yet</p>
                )}
              </div>
            </div>
            {training.objectives && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Objectives</p>
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{training.objectives}</p>
              </div>
            )}
          </div>

          {/* Evidence */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" /> Evidence / Documents
            </h3>
            {training.evidenceFileName ? (
              <a href={`/uploads/training/${training.evidenceFileName}`} target="_blank"
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors mb-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{training.evidenceFileName}</p>
                  <p className="text-xs text-slate-500">Click to view/download</p>
                </div>
                <Download className="w-4 h-4 text-slate-400 shrink-0" />
              </a>
            ) : (
              <p className="text-sm text-slate-400 italic mb-3">No documents uploaded yet (attendance sheet, certificate, etc.)</p>
            )}
            {canManage && (
              <label className={`cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors w-full justify-center ${isUploading ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}>
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {isUploading ? "Uploading..." : training.evidenceFileName ? "Replace File" : "Upload Evidence"}
                <input type="file" className="hidden" disabled={isUploading} onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.jpg,.png,.xls,.xlsx" />
              </label>
            )}
          </div>

          {/* Workflow */}
          {canManage && isPlanned && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Workflow</h3>
              <div className="space-y-3">
                <button onClick={handleMarkCompleted} disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-bold transition-colors disabled:bg-slate-300">
                  <CheckCircle className="w-4 h-4" /> Mark as Completed
                </button>
                <button onClick={handleMarkCancelled} disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition-colors">
                  Cancel Training
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Participants + Effectiveness */}
        <div className="lg:col-span-2 space-y-6">

          {/* Stats */}
          {isCompleted && training.participants.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-slate-800">{training.participants.length}</p>
                <p className="text-xs text-slate-500 font-semibold uppercase mt-1">Total Participants</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-emerald-700">{passCount}</p>
                <p className="text-xs text-emerald-600 font-semibold uppercase mt-1">Pass</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-700">{failCount}</p>
                <p className="text-xs text-red-600 font-semibold uppercase mt-1">Fail</p>
              </div>
            </div>
          )}

          {/* Participants Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Training Participants
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold ml-1">
                  {training.participants.length}
                </span>
              </h3>
              {canManage && training.status !== "Cancelled" && (
                <button onClick={() => { setShowAddParticipant(!showAddParticipant); setAddMode("system"); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Add Participant
                </button>
              )}
            </div>

            {/* Add participant form */}
            {showAddParticipant && (
              <div className="px-6 py-4 bg-indigo-50/70 border-b border-indigo-100 space-y-3">
                {/* Mode toggle */}
                <div className="flex gap-2 flex-wrap">
                  {(["system", "manual", "bulk"] as const).map(m => (
                    <button key={m} type="button"
                      onClick={() => { setAddMode(m); setNewParticipantName(""); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${addMode === m ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                      {m === "system" ? "From System User" : m === "manual" ? "Manual Input" : "Bulk by Department"}
                    </button>
                  ))}
                </div>

                {/* Bulk mode UI */}
                {addMode === "bulk" && (
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="flex-1 min-w-45">
                      <label className="text-xs font-semibold text-slate-600 block mb-1">
                        Add all employees from department
                      </label>
                      <select value={bulkDept} onChange={e => setBulkDept(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white">
                        {DEPTS.map(d => <option key={d}>{d}</option>)}
                      </select>
                      <p className="text-xs text-slate-400 mt-1">
                        {allUsers.filter(u => u.department === bulkDept).length} users registered in this department
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={handleBulkAdd} disabled={isSubmitting}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-300 transition-colors">
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add All"}
                      </button>
                      <button onClick={() => setShowAddParticipant(false)}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* System/Manual mode UI */}
                {addMode !== "bulk" && <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex-1 min-w-45">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      {addMode === "system" ? "Select Employee" : "Participant Name"}
                    </label>
                    {addMode === "system" ? (
                      <select value={newParticipantName} onChange={e => {
                        setNewParticipantName(e.target.value);
                        const u = allUsers.find(u => u.name === e.target.value);
                        if (u) setNewParticipantDept(u.department || "Quality Assurance");
                      }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white">
                        <option value="">-- Select Employee --</option>
                        {allUsers.map(u => (
                          <option key={u.id} value={u.name}>{u.name} ({u.department})</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" value={newParticipantName} onChange={e => setNewParticipantName(e.target.value)}
                        placeholder="Full name of participant"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-37.5">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Department</label>
                    <select value={newParticipantDept} onChange={e => setNewParticipantDept(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white">
                      {DEPTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={handleAddParticipant} disabled={isSubmitting || !newParticipantName}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-300 transition-colors">
                      Add
                    </button>
                    <button onClick={() => { setShowAddParticipant(false); setNewParticipantName(""); }}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>}
              </div>
            )}

            {training.participants.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-medium">No participants yet</p>
                <p className="text-sm">Add training participants above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Name</th>
                      <th className="px-6 py-3 font-semibold">Department</th>
                      <th className="px-6 py-3 font-semibold text-center">Result</th>
                      <th className="px-6 py-3 font-semibold text-center">
                        Score
                        {training.passingScore !== undefined && (
                          <span className="text-[10px] font-normal text-slate-400 block">≥{training.passingScore} = Pass</span>
                        )}
                      </th>
                      <th className="px-6 py-3 font-semibold">Certificate</th>
                      {canManage && <th className="px-6 py-3 font-semibold text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {training.participants.map(p => (
                      <tr key={p.name} className="hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-800">{p.name}</td>
                        <td className="px-6 py-3 text-slate-500">{p.department}</td>
                        <td className="px-6 py-3 text-center">
                          {editingParticipant === p.name ? (
                            <select value={editResult.result || "Attended"}
                              onChange={e => setEditResult({ ...editResult, result: e.target.value as any })}
                              className="px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                              <option value="Attended">Attended</option>
                              <option value="Pass">Pass</option>
                              <option value="Fail">Fail</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${RESULT_BADGE[p.result || "Attended"]}`}>
                              {p.result || "Attended"}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {editingParticipant === p.name ? (
                            <input type="number" min="0" max="100"
                              value={editResult.score ?? ""}
                              onChange={e => setEditResult({ ...editResult, score: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="0-100"
                              className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs text-center focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
                          ) : (
                            <span className="text-slate-700">{p.score !== undefined ? p.score : "-"}</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {editingParticipant === p.name ? (
                            <div className="flex flex-col gap-1">
                              <input type="text" value={editResult.certificateNo || ""}
                                onChange={e => setEditResult({ ...editResult, certificateNo: e.target.value })}
                                placeholder="Certificate No."
                                className="px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white w-full" />
                              <input type="date" value={editResult.certificateExpiry || ""}
                                onChange={e => setEditResult({ ...editResult, certificateExpiry: e.target.value })}
                                className="px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white w-full" />
                            </div>
                          ) : (
                            <div>
                              {p.certificateNo
                                ? <p className="text-xs font-medium text-slate-700">{p.certificateNo}</p>
                                : <p className="text-xs text-slate-400">-</p>}
                              {p.certificateExpiry && (() => {
                                const today = new Date(); today.setHours(0,0,0,0);
                                const exp = new Date(p.certificateExpiry);
                                const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000*60*60*24));
                                return (
                                  <p className={`text-xs flex items-center gap-0.5 ${daysLeft < 0 ? "text-red-600 font-semibold" : daysLeft <= 30 ? "text-amber-600 font-semibold" : "text-slate-400"}`}>
                                    {daysLeft <= 30 && <AlertTriangle className="w-3 h-3" />}
                                    Exp: {p.certificateExpiry}
                                  </p>
                                );
                              })()}
                            </div>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-6 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {editingParticipant === p.name ? (
                                <>
                                  <button onClick={() => handleSaveResult(p.name)} disabled={isSubmitting}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors">
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setEditingParticipant(null)}
                                    className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors text-xs">✕</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => { setEditingParticipant(p.name); setEditResult({ ...p }); }}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors text-xs font-medium">Edit</button>
                                  <button onClick={() => removeParticipant(training.id, p.name)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ===== EFFECTIVENESS EVALUATION (ISO 7.2) ===== */}
          {isCompleted && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-purple-500" />
                  Training Effectiveness Evaluation
                  <span className="text-xs text-slate-500 font-normal">(ISO 9001:2015 Clause 7.2)</span>
                </h3>
                {training.effectiveness?.result && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${EFFECTIVENESS_BADGE[training.effectiveness.result]}`}>
                    {training.effectiveness.result}
                  </span>
                )}
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-sm text-purple-800">
                  This evaluation is conducted 1–3 months after training to verify whether participants are genuinely applying the competencies acquired.
                  {training.effectiveness?.evaluatorName && (
                    <span className="block mt-1 text-xs text-purple-600">
                      Last evaluated by <strong>{training.effectiveness.evaluatorName}</strong> on {training.effectiveness.evaluationDate}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1.5">Evaluation Method</label>
                    <select value={evalData.method || "Observation"}
                      onChange={e => setEvalData({ ...evalData, method: e.target.value as any })}
                      disabled={!canManage}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white disabled:bg-slate-50">
                      <option value="Observation">Observation (direct observation)</option>
                      <option value="Test/Exam">Test / Exam</option>
                      <option value="Interview">Interview</option>
                      <option value="Work Result Review">Work Result Review</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1.5">Evaluation Result <span className="text-red-500">*</span></label>
                    <select value={evalData.result || ""}
                      onChange={e => setEvalData({ ...evalData, result: e.target.value as any })}
                      disabled={!canManage}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white disabled:bg-slate-50">
                      <option value="">-- Select --</option>
                      <option value="Effective">Effective — Competency applied well</option>
                      <option value="Partially Effective">Partially Effective — Partially applied</option>
                      <option value="Not Effective">Not Effective — Follow-up required</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">Notes / Evaluation Evidence</label>
                  <textarea value={evalData.notes || ""}
                    onChange={e => setEvalData({ ...evalData, notes: e.target.value })}
                    disabled={!canManage}
                    rows={3}
                    placeholder="Describe the objective evidence used to evaluate training effectiveness..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 bg-white resize-none disabled:bg-slate-50" />
                </div>

                {evalData.result === "Not Effective" && (
                  <div>
                    <label className="text-sm font-semibold text-red-700 flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle className="w-4 h-4" /> Required Follow-up Action
                    </label>
                    <textarea value={evalData.nextAction || ""}
                      onChange={e => setEvalData({ ...evalData, nextAction: e.target.value })}
                      disabled={!canManage}
                      rows={2}
                      placeholder="e.g., Re-training rescheduled, individual coaching, etc."
                      className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-red-50/30 resize-none disabled:bg-slate-50" />
                  </div>
                )}

                {canManage && (
                  <div className="flex justify-end">
                    <button onClick={handleSaveEval} disabled={isSavingEval}
                      className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-purple-400">
                      {isSavingEval ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Evaluation</>}
                    </button>
                  </div>
                )}

                {evalSaved && !isSavingEval && (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg">
                    <CheckCircle className="w-4 h-4 shrink-0" /> Effectiveness evaluation saved.
                  </div>
                )}

                {/* Re-training trigger */}
                {training.effectiveness?.result === "Not Effective" && canManage && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-bold text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Training Not Effective — Re-Training Required
                    </p>
                    <p className="text-xs text-red-600">
                      Per ISO 9001:2015 Clause 7.2, ineffective training must be followed up.
                      Reschedule training for participants who have not yet demonstrated competency.
                    </p>
                    <button
                      onClick={() => setIsReTrainOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Schedule Re-Training
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Edit Modal */}
      <AddTrainingModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        editData={training}
      />

      {/* Re-Training Modal — buka form baru dengan preset dept & category */}
      <AddTrainingModal
        isOpen={isReTrainOpen}
        onClose={() => setIsReTrainOpen(false)}
        presetDepartment={training.department}
        presetCategory={training.category}
      />
    </div>
  );
}
