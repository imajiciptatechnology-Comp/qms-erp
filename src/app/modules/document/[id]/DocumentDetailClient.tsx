"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, FileText, File, Book, ClipboardList, Download, History,
  CheckCircle, Clock, X, Edit, Trash2, Upload, Loader2, Eye, Calendar, AlertTriangle, Link2, Plus,
  Users, ShieldAlert, CheckCircle2, MessageSquare, ListChecks, Activity
} from "lucide-react";
import { updateDocumentStatus, deleteDocument, createDocumentRevision, editDocument, updateRelatedDocs, updateDistributionList, acknowledgeDocument } from "../actions";
import type { DocumentItem } from "../actions";
import ReviseDocumentModal from "../ReviseDocumentModal";
import AddDocumentModal from "../AddDocumentModal";

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    Published: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Approved: "bg-blue-100 text-blue-700 border-blue-200",
    Draft: "bg-slate-100 text-slate-700 border-slate-200",
    "In Review": "bg-amber-100 text-amber-700 border-amber-200",
    Obsolete: "bg-red-100 text-red-700 border-red-200",
  };
  return `px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.Draft}`;
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case "SOP": return <FileText className="w-5 h-5 text-blue-500" />;
    case "Work Instruction": return <ClipboardList className="w-5 h-5 text-purple-500" />;
    case "Form": return <File className="w-5 h-5 text-emerald-500" />;
    case "Manual": return <Book className="w-5 h-5 text-amber-500" />;
    default: return <FileText className="w-5 h-5 text-slate-500" />;
  }
};

export default function DocumentDetailClient({
  document: doc,
  revisions,
  user,
  rolesConfig,
  allDocs,
  allUsers,
}: {
  document: DocumentItem;
  revisions: DocumentItem[];
  user: any;
  rolesConfig: any[];
  allDocs: DocumentItem[];
  allUsers: any[];
}) {
  const [isReviseOpen, setIsReviseOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentItem | null>(null);
  
  const [isEditingRelated, setIsEditingRelated] = useState(false);
  const [selectedRelated, setSelectedRelated] = useState<string[]>(doc.relatedDocIds || []);
  const [isSavingRelated, setIsSavingRelated] = useState(false);

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  
  const [isEditingDistribution, setIsEditingDistribution] = useState(false);
  const [selectedDistribution, setSelectedDistribution] = useState<string[]>(doc.distributionList || []);
  const [isSavingDistribution, setIsSavingDistribution] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const roleData = rolesConfig?.find((r: any) => r.name === user?.role);
  const canApprove = user?.role === "Super Admin" || roleData?.permissions.includes("document_approve");

  async function handleSaveRelated() {
    setIsSavingRelated(true);
    await updateRelatedDocs(doc.id, selectedRelated);
    setIsSavingRelated(false);
    setIsEditingRelated(false);
  }

  function toggleRelated(id: string) {
    setSelectedRelated(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const relatedDocs = allDocs.filter(d => (doc.relatedDocIds || []).includes(d.id));

  const handleUpdateStatus = async (id: string, status: string, reason?: string) => {
    if (status === "Draft" && !reason) {
      setIsRejectOpen(true);
      return;
    }
    const res = await updateDocumentStatus(id, status, reason);
    if (!res.success) alert(res.message);
    else {
      setIsRejectOpen(false);
      setRejectReason("");
    }
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }
    handleUpdateStatus(doc.id, "Draft", rejectReason);
  };

  async function handleSaveDistribution() {
    setIsSavingDistribution(true);
    await updateDistributionList(doc.id, selectedDistribution);
    setIsSavingDistribution(false);
    setIsEditingDistribution(false);
  }

  function toggleDistribution(id: string) {
    setSelectedDistribution(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleAcknowledge() {
    setIsAcknowledging(true);
    await acknowledgeDocument(doc.id);
    setIsAcknowledging(false);
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this document revision permanently?")) {
      await deleteDocument(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/modules/document" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              {getTypeIcon(doc.type)}
              <h1 className="text-2xl font-bold text-slate-800">{doc.title}</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">{doc.docNumber} · {doc.type} · {doc.department}</p>
          </div>
        </div>
        <span className={getStatusBadge(doc.status)}>{doc.status}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Document Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Document Information</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Document Number</p>
                <p className="font-medium text-slate-800">{doc.docNumber}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Type</p>
                <div className="flex items-center gap-2">
                  {getTypeIcon(doc.type)}
                  <p className="font-medium text-slate-800">{doc.type}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Department</p>
                <p className="font-medium text-slate-800">{doc.department}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Current Revision</p>
                <p className="font-medium text-slate-800">Rev {doc.revision}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Last Updated</p>
                <p className="font-medium text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {doc.lastUpdated}
                </p>
              </div>
              {doc.effectiveDate && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Effective Date</p>
                  <p className="font-medium text-slate-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    {doc.effectiveDate}
                  </p>
                </div>
              )}
              {doc.uploaderName && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Prepared By</p>
                  <p className="font-medium text-slate-800">{doc.uploaderName}</p>
                </div>
              )}
              {doc.retentionPeriod && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Retention Period</p>
                  <p className="font-medium text-slate-800">{doc.retentionPeriod} Years</p>
                </div>
              )}
              {doc.isRestricted && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Access Control</p>
                  <p className="font-medium text-red-600 flex items-center gap-1"><ShieldAlert className="w-4 h-4"/> Restricted (Confidential)</p>
                </div>
              )}
              {doc.approverName && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Approved By</p>
                  <p className="font-medium text-slate-800">{doc.approverName}</p>
                  {doc.approvedDate && (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {doc.approvedDate}
                    </p>
                  )}
                </div>
              )}
              {doc.rejectionReason && doc.status === "Draft" && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-200 mt-2">
                  <p className="text-xs text-red-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3"/> Rejection Reason</p>
                  <p className="text-sm text-red-800">{doc.rejectionReason}</p>
                </div>
              )}
              {doc.nextReviewDate && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Next Review Date</p>
                  {(() => {
                    const today = new Date(); today.setHours(0,0,0,0);
                    const rd = new Date(doc.nextReviewDate!);
                    const diffDays = Math.ceil((rd.getTime() - today.getTime()) / (1000*60*60*24));
                    const isOverdue = diffDays < 0;
                    const isDueSoon = diffDays >= 0 && diffDays <= 30;
                    return (
                      <p className={`font-medium flex items-center gap-2 ${isOverdue ? "text-red-600" : isDueSoon ? "text-amber-600" : "text-slate-800"}`}>
                        <AlertTriangle className="w-4 h-4" />
                        {doc.nextReviewDate}
                        {isOverdue && <span className="text-xs bg-red-100 px-1.5 py-0.5 rounded-full">Overdue</span>}
                        {isDueSoon && !isOverdue && <span className="text-xs bg-amber-100 px-1.5 py-0.5 rounded-full">Due Soon</span>}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Current File */}
          {doc.fileName && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Current File</h3>
              <a
                href={doc.fileName}
                target="_blank"
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded bg-red-100 flex items-center justify-center text-red-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{doc.fileName}</p>
                  <p className="text-xs text-slate-500">Click to view/download</p>
                </div>
                <Download className="w-5 h-5 text-slate-400 shrink-0" />
              </a>
            </div>
          )}

          {/* Origin badge */}
          {doc.origin === "External" && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-xs font-bold px-2 py-1 bg-orange-100 text-orange-700 border border-orange-300 rounded-full">EXTERNAL</span>
              <p className="text-sm text-orange-700">Document originates from outside the organization (Clause 7.5.3.2)</p>
            </div>
          )}

          {/* Related Documents */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-500" /> Related Documents
              </h3>
              {!isEditingRelated ? (
                <button onClick={() => setIsEditingRelated(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                  <Plus className="w-3.5 h-3.5 inline mr-1" />Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setIsEditingRelated(false); setSelectedRelated(doc.relatedDocIds || []); }} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                  <button onClick={handleSaveRelated} disabled={isSavingRelated} className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50">
                    {isSavingRelated ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {isEditingRelated ? (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {allDocs.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Tidak ada dokumen lain.</p>
                ) : allDocs.map(d => (
                  <label key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selectedRelated.includes(d.id)} onChange={() => toggleRelated(d.id)} className="w-4 h-4 accent-blue-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{d.docNumber}</p>
                      <p className="text-xs text-slate-400 truncate">{d.title}</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : relatedDocs.length > 0 ? (
              <div className="space-y-2">
                {relatedDocs.map(d => (
                  <Link key={d.id} href={`/modules/document/${d.id}`} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                    <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-blue-600 truncate">{d.docNumber}</p>
                      <p className="text-xs text-slate-500 truncate">{d.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic text-center py-2">No related documents yet.</p>
            )}
          </div>

          {/* Distribution List */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" /> Distribution List
              </h3>
              {canApprove ? (
                !isEditingDistribution ? (
                  <button onClick={() => setIsEditingDistribution(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                    <Plus className="w-3.5 h-3.5 inline mr-1" />Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => { setIsEditingDistribution(false); setSelectedDistribution(doc.distributionList || []); }} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                    <button onClick={handleSaveDistribution} disabled={isSavingDistribution} className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50">
                      {isSavingDistribution ? "Saving..." : "Save"}
                    </button>
                  </div>
                )
              ) : null}
            </div>

            {isEditingDistribution ? (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {allUsers.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Tidak ada user.</p>
                ) : allUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selectedDistribution.includes(u.id)} onChange={() => toggleDistribution(u.id)} className="w-4 h-4 accent-purple-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{u.name}</p>
                      <p className="text-xs text-slate-400 truncate">{u.department}</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (doc.distributionList && doc.distributionList.length > 0) ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-2">
                  {doc.distributionList.map(userId => {
                    const u = allUsers.find(x => x.id === userId);
                    const isAck = doc.acknowledgments?.some(a => a.userId === userId);
                    return (
                      <div key={userId} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{u?.name || "Unknown User"}</p>
                          <p className="text-xs text-slate-500">{u?.department}</p>
                        </div>
                        {isAck ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3"/> Acknowledged</span>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">Pending</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Acknowledgment Button for the current user if they are in the list and haven't acked */}
                {doc.status === "Published" && doc.distributionList.includes(user.id) && !doc.acknowledgments?.some(a => a.userId === user.id) && (
                  <button onClick={handleAcknowledge} disabled={isAcknowledging} className="w-full mt-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    {isAcknowledging ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Acknowledge Document</>}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic text-center py-2">No distribution records yet.</p>
            )}
          </div>

          {/* Actions Panel */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Actions</h3>
            <div className="space-y-2">
              {((doc.status !== "Published" && doc.uploaderId === user.id) || canApprove) && (
                <button
                  onClick={() => { setEditDoc(doc); setIsEditOpen(true); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                >
                  <Edit className="w-4 h-4" /> Edit Document
                </button>
              )}

              {doc.status === "Draft" && (
                <button onClick={() => handleUpdateStatus(doc.id, "In Review")} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-amber-700 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200">
                  <Clock className="w-4 h-4" /> Submit for Review
                </button>
              )}

              {doc.status === "In Review" && canApprove && (
                <>
                  <button onClick={() => handleUpdateStatus(doc.id, "Approved")} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200">
                    <CheckCircle className="w-4 h-4" /> Approve Document
                  </button>
                  <button onClick={() => handleUpdateStatus(doc.id, "Draft")} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200">
                    <X className="w-4 h-4" /> Reject (Return to Draft)
                  </button>
                </>
              )}

              {doc.status === "Approved" && canApprove && (
                <>
                  <button onClick={() => handleUpdateStatus(doc.id, "Published")} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200">
                    <CheckCircle className="w-4 h-4" /> Publish Document
                  </button>
                  <button onClick={() => handleUpdateStatus(doc.id, "Draft")} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200">
                    <X className="w-4 h-4" /> Reject (Return to Draft)
                  </button>
                </>
              )}

              {doc.status === "Published" && (
                <button onClick={() => setIsReviseOpen(true)} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200">
                  <History className="w-4 h-4" /> Create New Revision
                </button>
              )}

              {doc.status === "Published" && canApprove && (
                <button onClick={() => handleUpdateStatus(doc.id, "Obsolete")} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200">
                  <Trash2 className="w-4 h-4" /> Mark as Obsolete
                </button>
              )}

              {doc.status === "Obsolete" && canApprove && (
                <button onClick={() => handleUpdateStatus(doc.id, "Published")} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-amber-700 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200">
                  <Clock className="w-4 h-4" /> Revert to Published
                </button>
              )}

              {canApprove && (
                <>
                  <div className="h-px bg-slate-100 my-2"></div>
                  <button onClick={() => handleDelete(doc.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200">
                    <Trash2 className="w-4 h-4" /> Delete Document
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Revision History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Change Log (if latest has one) */}
          {doc.changeLog && (
            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
              <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                <History className="w-5 h-5" />
                Latest Change (Rev {doc.revision})
              </h3>
              <p className="text-sm text-blue-700 whitespace-pre-wrap leading-relaxed">{doc.changeLog}</p>
            </div>
          )}

          {/* Revision History Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                Revision History
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-2">{revisions.length} revision(s)</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Rev</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">Change Log</th>
                    <th className="px-6 py-3 font-semibold text-center">File</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {revisions.map((rev) => (
                    <tr key={rev.id} className={`transition-colors ${rev.id === doc.id ? "bg-blue-50/40" : "hover:bg-slate-50"}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">Rev {rev.revision}</span>
                          {rev.id === doc.id && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">CURRENT</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={getStatusBadge(rev.status)}>{rev.status}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{rev.lastUpdated}</td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-sm text-slate-600 truncate" title={rev.changeLog || "Initial document"}>
                          {rev.changeLog || (rev.revision === 0 ? "Initial document creation" : "-")}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {rev.fileName ? (
                          <a
                            href={rev.fileName}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-xs"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity Log */}
          {doc.history && doc.history.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-500" />
                  Activity Log
                </h3>
              </div>
              <div className="p-6 max-h-[400px] overflow-y-auto">
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {[...doc.history].reverse().map((log, idx) => (
                    <div key={log.id || idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-indigo-50 text-indigo-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between space-x-2 mb-1">
                          <div className="font-bold text-slate-800 text-sm">{log.action}</div>
                          <time className="text-xs font-medium text-indigo-500">{new Date(log.date).toLocaleDateString()} {new Date(log.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</time>
                        </div>
                        <div className="text-xs text-slate-500 mb-2">by {log.userName}</div>
                        {log.note && <div className="text-sm text-slate-700 bg-slate-50 p-2 rounded">{log.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {/* Reject Modal */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-red-50">
              <h2 className="text-lg font-bold text-red-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-red-600" /> Reject Document
              </h2>
              <button onClick={() => setIsRejectOpen(false)} className="p-2 hover:bg-red-100 rounded-full text-red-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">Please provide a reason for rejecting this document. This will be visible to the document creator.</p>
              <textarea 
                rows={4} 
                value={rejectReason} 
                onChange={e => setRejectReason(e.target.value)} 
                placeholder="E.g., Formatting is incorrect, missing step 3..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-900 bg-white resize-none"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setIsRejectOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg">Cancel</button>
                <button onClick={handleReject} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2">
                  <X className="w-4 h-4" /> Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReviseDocumentModal
        isOpen={isReviseOpen}
        onClose={() => setIsReviseOpen(false)}
        document={doc}
      />

      <AddDocumentModal
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setEditDoc(null); }}
        editDoc={editDoc}
      />
    </div>
  );
}
