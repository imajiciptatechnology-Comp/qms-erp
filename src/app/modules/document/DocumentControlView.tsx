"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Search, Filter, MoreVertical, FileText, File, Book, ClipboardList, Trash2, Edit, CheckCircle, Clock, X, History, ChevronRight, AlertTriangle, Download, Loader2, ShieldAlert, MessageSquare } from "lucide-react";
import AddDocumentModal from "./AddDocumentModal";
import { deleteDocument, updateDocumentStatus, getDocumentMasterListExcel } from "./actions";
import type { DocumentItem } from "./actions";
import Link from "next/link";

// Helper for Status Badge
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

// Helper for Doc Type Icon
const getTypeIcon = (type: string) => {
  switch (type) {
    case "SOP": return <FileText className="w-4 h-4 text-blue-500" />;
    case "Work Instruction": return <ClipboardList className="w-4 h-4 text-purple-500" />;
    case "Form": return <File className="w-4 h-4 text-emerald-500" />;
    case "Manual": return <Book className="w-4 h-4 text-amber-500" />;
    default: return <FileText className="w-4 h-4 text-slate-500" />;
  }
};

// Helper: cek status review date
function getReviewStatus(nextReviewDate?: string): "overdue" | "due-soon" | "ok" | null {
  if (!nextReviewDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reviewDate = new Date(nextReviewDate);
  const diffDays = Math.ceil((reviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 30) return "due-soon";
  return "ok";
}

// Group documents by family and return only the latest revision per family
function getGroupedDocuments(docs: DocumentItem[]) {
  const familyMap = new Map<string, DocumentItem[]>();

  for (const doc of docs) {
    const familyId = doc.parentId || doc.id;
    if (!familyMap.has(familyId)) {
      familyMap.set(familyId, []);
    }
    familyMap.get(familyId)!.push(doc);
  }

  // For each family, pick the latest revision (highest revision number)
  const latest: DocumentItem[] = [];
  for (const [, family] of familyMap) {
    family.sort((a, b) => b.revision - a.revision);
    latest.push(family[0]); // the latest revision
  }

  return latest;
}

export default function DocumentControlView({ initialDocuments, user, rolesConfig }: { initialDocuments: DocumentItem[], user: any, rolesConfig: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filters
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  
  const [editDoc, setEditDoc] = useState<DocumentItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExportCSV() {
    setIsExporting(true);
    const base64 = await getDocumentMasterListExcel();
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `master-list-dokumen-${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  }

  // Action Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [documentToReject, setDocumentToReject] = useState<string | null>(null);

  // Handle clicking outside action menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canApprove = user?.role === "Super Admin" || roleData?.permissions.includes("document_approve");

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this document? This cannot be undone.")) {
      const res = await deleteDocument(id);
      if (!res.success) alert(res.message);
      setActiveMenuId(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: string, reason?: string) => {
    if (status === "Draft" && !reason) {
      setDocumentToReject(id);
      setIsRejectOpen(true);
      setActiveMenuId(null);
      return;
    }
    const res = await updateDocumentStatus(id, status, reason);
    if (!res.success) alert(res.message);
    else {
      setIsRejectOpen(false);
      setRejectReason("");
      setDocumentToReject(null);
      setActiveMenuId(null);
    }
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }
    if (documentToReject) {
      handleUpdateStatus(documentToReject, "Draft", rejectReason);
    }
  };

  // Group documents: show only the latest revision per document family
  const groupedDocs = getGroupedDocuments(initialDocuments);

  const filteredDocs = groupedDocs.filter(doc => {
    const matchesSearch = doc.docNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          doc.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "All" || doc.status === filterStatus;
    const matchesType = filterType === "All" || doc.type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Document Control</h1>
          <p className="text-slate-500 text-sm">Master List of all QMS documented information.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Excel
          </button>
          <button onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Document
          </button>
        </div>
      </div>

      {/* Toolbar / Filter Section */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Document No or Title..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white text-sm outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
            >
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in slide-in-from-top-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="In Review">In Review</option>
                <option value="Approved">Approved</option>
                <option value="Published">Published</option>
                <option value="Obsolete">Obsolete</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Document Type</label>
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All Types</option>
                <option value="SOP">SOP</option>
                <option value="Work Instruction">Work Instruction</option>
                <option value="Form">Form</option>
                <option value="Manual">Manual</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Master List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
        <div className="overflow-x-auto min-h-[400px] overflow-visible">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Document No</th>
                <th className="px-6 py-4 font-semibold">Title</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold text-center">Rev</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Last Updated</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length > 0 ? filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-slate-800 whitespace-nowrap">
                    <Link href={`/modules/document/${doc.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                      {doc.docNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="flex items-center gap-2">
                      <Link href={`/modules/document/${doc.id}`} className="text-slate-800 hover:text-blue-700 transition-colors truncate block">
                        {doc.title}
                      </Link>
                      {doc.isRestricted && <span title="Restricted Document"><ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" /></span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getTypeIcon(doc.type)}
                      <span>{doc.type}</span>
                      {doc.origin === "External" && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-full">EXT</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                    {doc.revision}
                  </td>
                  <td className="px-6 py-4">
                    <span className={getStatusBadge(doc.status)}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {doc.department}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <div className="flex flex-col gap-1">
                      <span>{doc.lastUpdated}</span>
                      {(() => {
                        const rs = getReviewStatus(doc.nextReviewDate);
                        if (rs === "overdue") return (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Review Overdue
                          </span>
                        );
                        if (rs === "due-soon") return (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Review Due Soon
                          </span>
                        );
                        return null;
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center relative">
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/modules/document/${doc.id}`} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="View Details">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === doc.id ? null : doc.id);
                        }} 
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Action Dropdown */}
                    {activeMenuId === doc.id && (
                      <div ref={menuRef} className="absolute right-6 top-10 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <div className="p-1">
                          
                          {/* EDIT PERMISSION */}
                          {((doc.status !== "Published" && doc.uploaderId === user.id) || canApprove) && (
                            <button 
                              onClick={() => {
                                setEditDoc(doc);
                                setIsModalOpen(true);
                                setActiveMenuId(null);
                              }} 
                              className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md transition-colors text-left"
                            >
                              <Edit className="w-4 h-4" /> Edit Document
                            </button>
                          )}

                          {doc.status === "Draft" && (
                            <button onClick={() => handleUpdateStatus(doc.id, "In Review")} className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-md transition-colors text-left">
                              <Clock className="w-4 h-4" /> Submit for Review
                            </button>
                          )}
                          
                          {doc.status === "In Review" && canApprove && (
                            <>
                              <button onClick={() => handleUpdateStatus(doc.id, "Approved")} className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors text-left">
                                <CheckCircle className="w-4 h-4" /> Approve Document
                              </button>
                              <button onClick={() => handleUpdateStatus(doc.id, "Draft")} className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors text-left">
                                <X className="w-4 h-4" /> Reject Document
                              </button>
                            </>
                          )}

                          {doc.status === "Approved" && canApprove && (
                            <>
                              <button onClick={() => handleUpdateStatus(doc.id, "Published")} className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors text-left">
                                <CheckCircle className="w-4 h-4" /> Publish Document
                              </button>
                              <button onClick={() => handleUpdateStatus(doc.id, "Draft")} className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors text-left">
                                <X className="w-4 h-4" /> Reject Document
                              </button>
                            </>
                          )}

                          {doc.status === "Published" && canApprove && (
                            <button onClick={() => handleUpdateStatus(doc.id, "Obsolete")} className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors text-left">
                              <Trash2 className="w-4 h-4" /> Mark as Obsolete
                            </button>
                          )}

                          {doc.status === "Obsolete" && canApprove && (
                            <button onClick={() => handleUpdateStatus(doc.id, "Published")} className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-md transition-colors text-left">
                              <Clock className="w-4 h-4" /> Revert to Published
                            </button>
                          )}
                          
                          <div className="h-px bg-slate-100 my-1"></div>
                          
                          {/* DELETE PERMISSION */}
                          {canApprove && (
                            <button onClick={() => handleDelete(doc.id)} className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors text-left">
                              <Trash2 className="w-4 h-4" /> Delete Completely
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <FileText className="w-12 h-12 text-slate-300" />
                      <p className="text-base font-medium text-slate-600">No documents found</p>
                      <p className="text-sm">Adjust your filters or add a new document.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{filteredDocs.length}</span> document(s)
          </div>
        </div>
      </div>

      <AddDocumentModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditDoc(null);
        }} 
        editDoc={editDoc}
      />

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
    </div>
  );
}
