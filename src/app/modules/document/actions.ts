"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { uploadToStorage, deleteFromStorage, copyInStorage } from "@/lib/uploadFile";
import { createNotificationForUser, createNotificationForPermission } from "@/app/actions/notifications";
import { getCurrentUser } from "@/app/actions/auth";


export type DocumentItem = {
  id: string;
  docNumber: string;
  title: string;
  type: string;
  revision: number;
  status: string;
  department: string;
  lastUpdated: string;
  uploaderId?: string;
  fileName?: string;
  fileSize?: number;
  changeLog?: string;
  nextReviewDate?: string;
  parentId?: string;
  effectiveDate?: string;
  approverName?: string;
  approvedDate?: string;
  origin?: "Internal" | "External";
  relatedDocIds?: string[];
  uploaderName?: string;
  retentionPeriod?: number;
  isRestricted?: boolean;
  rejectionReason?: string;
  distributionList?: string[];
  acknowledgments?: { userId: string; userName: string; date: string }[];
  history?: { id: string; date: string; userId: string; userName: string; action: string; note?: string }[];
};

function safeParse(jsonString: string, fallback: any) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

export async function getDocuments(): Promise<DocumentItem[]> {
  const docs = await prisma.document.findMany({
    orderBy: { lastUpdated: 'desc' }
  });

  return docs.map(d => ({
    id: d.id,
    docNumber: d.docNumber,
    title: d.title,
    type: d.type,
    revision: d.revision,
    status: d.status,
    department: d.department,
    lastUpdated: d.lastUpdated,
    uploaderId: d.uploaderId || undefined,
    uploaderName: d.uploaderName || undefined,
    fileName: d.fileName || undefined,
    fileSize: d.fileSize || undefined,
    changeLog: d.changeLog || undefined,
    nextReviewDate: d.nextReviewDate || undefined,
    parentId: d.parentId || undefined,
    effectiveDate: d.effectiveDate || undefined,
    approverName: d.approverName || undefined,
    approvedDate: d.approvedDate || undefined,
    origin: d.origin as any,
    retentionPeriod: d.retentionPeriod || undefined,
    isRestricted: d.isRestricted,
    rejectionReason: d.rejectionReason || undefined,
    relatedDocIds: safeParse(d.relatedDocIdsJson, []),
    distributionList: safeParse(d.distributionListJson, []),
    acknowledgments: safeParse(d.acknowledgmentsJson, []),
    history: safeParse(d.historyJson, []),
  }));
}

export async function checkAndNotifyDocumentReviews() {
  try {
    const docs = await prisma.document.findMany({
      where: { status: "Published", nextReviewDate: { not: null } }
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);

    for (const doc of docs) {
      if (!doc.nextReviewDate) continue;
      const reviewDate = new Date(doc.nextReviewDate);
      const diffDays = Math.ceil((reviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays > 30) continue;

      const notifyKey = `${doc.id}-${today.getFullYear()}-${today.getMonth()}`;
      const history = safeParse(doc.historyJson, []);
      const alreadyNotified = history.some((h: any) => h.note === notifyKey);
      if (alreadyNotified) continue;

      const msg = diffDays < 0
        ? `Document review OVERDUE: ${doc.docNumber} — ${doc.title} (was due ${doc.nextReviewDate})`
        : `Document review due in ${diffDays} day(s): ${doc.docNumber} — ${doc.title}`;

      await createNotificationForPermission("document_approve", msg, `/modules/document/${doc.id}`);

      history.push({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        userId: "system",
        userName: "System",
        action: "Review reminder sent",
        note: notifyKey,
      });

      await prisma.document.update({
        where: { id: doc.id },
        data: { historyJson: JSON.stringify(history) }
      });
    }
  } catch (e) {
    console.error("checkAndNotifyDocumentReviews error:", e);
  }
}

export async function addDocument(formData: FormData) {
  try {
    const docNumber = formData.get("docNumber") as string;
    const title = formData.get("title") as string;
    const type = formData.get("type") as string;
    const department = formData.get("department") as string;
    const file = formData.get("file") as File | null;
    const nextReviewDate = formData.get("nextReviewDate") as string;

    const existing = await prisma.document.findFirst({
      where: { docNumber }
    });

    if (existing) {
      return { success: false, message: `Document number ${docNumber} already exists.` };
    }

    let fileName = "";
    let fileSize = 0;

    if (file && file.size > 0) {
      const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
      const safeDocNo = docNumber.replace(/[^a-zA-Z0-9-]/g, "_");
      fileName = `${safeDocNo}_Rev0${ext}`;
      fileSize = file.size;

      fileName = await uploadToStorage("documents", file, fileName);
    }

    const currentUser = await getCurrentUser();
    const effectiveDate = formData.get("effectiveDate") as string;
    const origin = (formData.get("origin") as "Internal" | "External") || "Internal";
    const retentionPeriod = formData.get("retentionPeriod") ? parseInt(formData.get("retentionPeriod") as string) : undefined;
    const isRestricted = formData.get("isRestricted") === "true";

    const id = Date.now().toString();
    const history = [{
      id: Date.now().toString() + "_hist",
      date: new Date().toISOString(),
      userId: currentUser?.id || "system",
      userName: currentUser?.name || "System",
      action: "Document Created",
      note: `Created as ${docNumber} Rev 0`
    }];

    await prisma.document.create({
      data: {
        id,
        docNumber,
        title,
        type,
        revision: 0,
        status: "Draft",
        department,
        lastUpdated: new Date().toISOString().split("T")[0],
        uploaderId: currentUser?.id || null,
        uploaderName: currentUser?.name || "Unknown",
        fileName: fileName || null,
        fileSize: fileSize || null,
        effectiveDate: effectiveDate || null,
        origin,
        retentionPeriod: retentionPeriod || null,
        isRestricted,
        nextReviewDate: nextReviewDate || null,
        historyJson: JSON.stringify(history)
      }
    });

    revalidatePath("/modules/document");
    return { success: true, message: "Document added successfully" };
  } catch (error) {
    console.error("Failed to add document:", error);
    return { success: false, message: "Failed to add document" };
  }
}

export async function deleteDocument(id: string) {
  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return { success: false, message: "Document not found" };

    if (doc.fileName) {
      await deleteFromStorage(doc.fileName);
    }

    await prisma.document.delete({ where: { id } });
    revalidatePath("/modules/document");
    return { success: true, message: "Document deleted successfully" };
  } catch (error) {
    console.error("Delete error:", error);
    return { success: false, message: "Failed to delete document" };
  }
}

export async function updateDocumentStatus(id: string, newStatus: string, rejectionReason?: string) {
  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return { success: false, message: "Document not found" };

    const oldStatus = doc.status;
    const currentUser = await getCurrentUser();
    const history = safeParse(doc.historyJson, []);

    history.push({
      id: Date.now().toString() + "_hist",
      date: new Date().toISOString(),
      userId: currentUser?.id || "system",
      userName: currentUser?.name || "System",
      action: `Status changed to ${newStatus}`,
      note: rejectionReason || `From ${oldStatus}`
    });

    const dataToUpdate: any = {
      status: newStatus,
      lastUpdated: new Date().toISOString().split("T")[0],
      historyJson: JSON.stringify(history)
    };

    if (newStatus === "Approved") {
      dataToUpdate.approverName = currentUser?.name || "Unknown";
      dataToUpdate.approvedDate = new Date().toISOString().split("T")[0];
    }

    if (newStatus === "Draft" && oldStatus !== "Draft") {
      dataToUpdate.approverName = null;
      dataToUpdate.approvedDate = null;
      dataToUpdate.rejectionReason = rejectionReason || null;
    } else {
      dataToUpdate.rejectionReason = null;
    }

    await prisma.document.update({
      where: { id },
      data: dataToUpdate
    });

    if (newStatus === "Published") {
      const familyId = doc.parentId || doc.id;
      await prisma.document.updateMany({
        where: {
          id: { not: doc.id },
          status: "Published",
          OR: [{ parentId: familyId }, { id: familyId }]
        },
        data: { status: "Obsolete" }
      });
    }

    if (newStatus === "In Review") {
      await createNotificationForPermission(
        "document_approve",
        `Document ${doc.docNumber} (${doc.title}) requires approval. Submitted by ${currentUser?.name || 'User'}.`,
        `/modules/document/${doc.id}`
      );
    } else if (newStatus === "Approved" || newStatus === "Published") {
      if (doc.uploaderId) {
        await createNotificationForUser(
          doc.uploaderId,
          `Your document ${doc.docNumber} has been ${newStatus.toLowerCase()}.`,
          `/modules/document/${doc.id}`
        );
      }
    } else if (newStatus === "Draft" && oldStatus !== "Draft") {
      if (doc.uploaderId) {
        await createNotificationForUser(
          doc.uploaderId,
          `Your document ${doc.docNumber} was returned/rejected. Please review and resubmit.`,
          `/modules/document/${doc.id}`
        );
      }
    }

    revalidatePath("/modules/document");
    return { success: true, message: `Status updated to ${newStatus}` };
  } catch (error) {
    console.error("Status update error:", error);
    return { success: false, message: "Failed to update status" };
  }
}

export async function editDocument(id: string, formData: FormData) {
  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return { success: false, message: "Document not found" };

    const currentUser = await getCurrentUser();
    const history = safeParse(doc.historyJson, []);
    history.push({
      id: Date.now().toString() + "_hist",
      date: new Date().toISOString(),
      userId: currentUser?.id || "system",
      userName: currentUser?.name || "System",
      action: "Document Edited",
      note: "Updated document metadata/file"
    });

    const file = formData.get("file") as File | null;
    let fileName = doc.fileName;
    let fileSize = doc.fileSize;

    if (file && file.size > 0) {
      const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
      const safeDocNo = (formData.get("docNumber") as string).replace(/[^a-zA-Z0-9-]/g, "_");
      const newName = `${safeDocNo}_Rev${doc.revision}${ext}`;
      fileSize = file.size;

      fileName = await uploadToStorage("documents", file, newName);

      if (doc.fileName && doc.fileName !== fileName) {
        await deleteFromStorage(doc.fileName);
      }
    }

    const effectiveDateEdit = formData.get("effectiveDate") as string;
    const originEdit = formData.get("origin") as string;
    const retentionPeriodEdit = formData.get("retentionPeriod");

    await prisma.document.update({
      where: { id },
      data: {
        docNumber: formData.get("docNumber") as string,
        title: formData.get("title") as string,
        type: formData.get("type") as string,
        department: formData.get("department") as string,
        lastUpdated: new Date().toISOString().split("T")[0],
        effectiveDate: effectiveDateEdit || doc.effectiveDate,
        origin: originEdit || doc.origin,
        retentionPeriod: retentionPeriodEdit ? parseInt(retentionPeriodEdit as string) : doc.retentionPeriod,
        isRestricted: formData.get("isRestricted") === "true",
        fileName: fileName || null,
        fileSize: fileSize || null,
        historyJson: JSON.stringify(history)
      }
    });

    revalidatePath("/modules/document");
    return { success: true, message: "Document updated successfully" };
  } catch (error) {
    console.error("Edit error:", error);
    return { success: false, message: "Failed to update document" };
  }
}

export async function createDocumentRevision(oldDocId: string, formData: FormData) {
  try {
    const oldDoc = await prisma.document.findUnique({ where: { id: oldDocId } });
    if (!oldDoc) return { success: false, message: "Original document not found" };

    const currentUser = await getCurrentUser();
    const newRevisionNum = oldDoc.revision + 1;
    const changeLog = formData.get("changeLog") as string;
    const nextReviewDate = formData.get("nextReviewDate") as string;
    const file = formData.get("file") as File | null;

    let fileName = oldDoc.fileName;
    let fileSize = oldDoc.fileSize;

    if (file && file.size > 0) {
      const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
      const safeDocNo = oldDoc.docNumber.replace(/[^a-zA-Z0-9-]/g, "_");
      const newName = `${safeDocNo}_Rev${newRevisionNum}${ext}`;
      fileSize = file.size;

      fileName = await uploadToStorage("documents", file, newName);
      if (oldDoc.fileName && oldDoc.fileName !== fileName) {
        await deleteFromStorage(oldDoc.fileName);
      }
    } else if (oldDoc.fileName) {
      const ext = oldDoc.fileName.includes(".") ? "." + oldDoc.fileName.split(".").pop() : "";
      const safeDocNo = oldDoc.docNumber.replace(/[^a-zA-Z0-9-]/g, "_");
      const newName = `${safeDocNo}_Rev${newRevisionNum}${ext}`;
      try {
        fileName = await copyInStorage(oldDoc.fileName, "documents", newName);
      } catch {
        fileName = oldDoc.fileName; // fallback: pakai file revisi sebelumnya
      }
    }

    const history = [{
      id: Date.now().toString() + "_hist",
      date: new Date().toISOString(),
      userId: currentUser?.id || "system",
      userName: currentUser?.name || "System",
      action: "Revision Created",
      note: `Rev ${newRevisionNum} created: ${changeLog}`
    }];

    await prisma.document.create({
      data: {
        id: Date.now().toString(),
        docNumber: oldDoc.docNumber,
        title: oldDoc.title,
        type: oldDoc.type,
        department: oldDoc.department,
        revision: newRevisionNum,
        status: "Draft",
        lastUpdated: new Date().toISOString().split("T")[0],
        uploaderId: currentUser?.id || oldDoc.uploaderId,
        uploaderName: currentUser?.name || oldDoc.uploaderName,
        fileName: fileName || null,
        fileSize: fileSize || null,
        effectiveDate: oldDoc.effectiveDate,
        origin: oldDoc.origin,
        retentionPeriod: oldDoc.retentionPeriod,
        isRestricted: oldDoc.isRestricted,
        changeLog,
        nextReviewDate: nextReviewDate || null,
        parentId: oldDoc.parentId || oldDoc.id,
        relatedDocIdsJson: oldDoc.relatedDocIdsJson,
        distributionListJson: oldDoc.distributionListJson,
        historyJson: JSON.stringify(history),
        acknowledgmentsJson: "[]", // Reset for new rev
      }
    });

    revalidatePath("/modules/document");
    return { success: true, message: `Revision ${newRevisionNum} created as Draft.` };
  } catch (error) {
    console.error("Create revision error:", error);
    return { success: false, message: "Failed to create revision" };
  }
}

export async function updateRelatedDocs(id: string, relatedDocIds: string[]) {
  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return { success: false, message: "Document not found" };
    
    const currentUser = await getCurrentUser();
    const history = safeParse(doc.historyJson, []);
    history.push({
      id: Date.now().toString() + "_hist",
      date: new Date().toISOString(),
      userId: currentUser?.id || "system",
      userName: currentUser?.name || "System",
      action: "Related Documents Updated"
    });
    
    await prisma.document.update({
      where: { id },
      data: {
        relatedDocIdsJson: JSON.stringify(relatedDocIds),
        historyJson: JSON.stringify(history)
      }
    });
    
    revalidatePath(`/modules/document/${id}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: "Failed to update related documents" };
  }
}

export async function updateDistributionList(id: string, userIds: string[]) {
  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return { success: false, message: "Document not found" };
    
    const currentUser = await getCurrentUser();
    const history = safeParse(doc.historyJson, []);
    history.push({
      id: Date.now().toString() + "_hist",
      date: new Date().toISOString(),
      userId: currentUser?.id || "system",
      userName: currentUser?.name || "System",
      action: "Distribution List Updated",
      note: `Added ${userIds.length} users`
    });

    await prisma.document.update({
      where: { id },
      data: {
        distributionListJson: JSON.stringify(userIds),
        historyJson: JSON.stringify(history)
      }
    });
    
    revalidatePath(`/modules/document/${id}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: "Failed to update distribution list" };
  }
}

export async function acknowledgeDocument(id: string) {
  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return { success: false, message: "Document not found" };
    
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, message: "Not logged in" };

    const acks = safeParse(doc.acknowledgmentsJson, []);
    if (!acks.some((a: any) => a.userId === currentUser.id)) {
      acks.push({
        userId: currentUser.id,
        userName: currentUser.name,
        date: new Date().toISOString()
      });
      
      const history = safeParse(doc.historyJson, []);
      history.push({
        id: Date.now().toString() + "_hist",
        date: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name,
        action: "Document Acknowledged"
      });

      await prisma.document.update({
        where: { id },
        data: {
          acknowledgmentsJson: JSON.stringify(acks),
          historyJson: JSON.stringify(history)
        }
      });
      revalidatePath(`/modules/document/${id}`);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, message: "Failed to acknowledge document" };
  }
}

export async function getDocumentMasterListExcel(): Promise<string> {
  const { buildExcel } = await import("@/lib/excel");
  const docs = await getDocuments();

  const latest = new Map<string, typeof docs[0]>();
  for (const d of docs) {
    const fid = d.parentId || d.id;
    const existing = latest.get(fid);
    if (!existing || d.revision > existing.revision) latest.set(fid, d);
  }

  const rows = Array.from(latest.values()).map(d => ({
    docNumber:      d.docNumber,
    title:          d.title,
    type:           d.type,
    origin:         d.origin || "Internal",
    department:     d.department,
    revision:       `Rev ${d.revision}`,
    status:         d.status,
    effectiveDate:  d.effectiveDate || "-",
    nextReviewDate: d.nextReviewDate || "-",
    approverName:   d.approverName || "-",
    approvedDate:   d.approvedDate || "-",
    changeLog:      d.changeLog || "-",
  }));

  return buildExcel({
    sheetName: "Master List",
    title: "MASTER LIST DOKUMEN QMS",
    subtitle: `ISO 9001:2015 Clause 7.5 — Generated: ${new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}`,
    columns: [
      { header: "Document No.",    key: "docNumber",      width: 18 },
      { header: "Document Title",  key: "title",          width: 40 },
      { header: "Type",            key: "type",           width: 16 },
      { header: "Origin",          key: "origin",         width: 12 },
      { header: "Department",      key: "department",     width: 20 },
      { header: "Revision",        key: "revision",       width: 10 },
      { header: "Status",          key: "status",         width: 14 },
      { header: "Effective Date",  key: "effectiveDate",  width: 14 },
      { header: "Next Review Date", key: "nextReviewDate", width: 18 },
      { header: "Approved By",     key: "approverName",   width: 20 },
      { header: "Approved Date",   key: "approvedDate",   width: 14 },
      { header: "Change Log",      key: "changeLog",      width: 35 },
    ],
    rows,
  });
}
