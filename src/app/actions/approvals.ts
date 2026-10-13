"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";

export async function requestApproval(moduleType: string, recordId: string, approverId: string, initialStatus: string = "Pending") {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "Not logged in" };

  await prisma.approvalRouting.create({
    data: {
      moduleType,
      recordId,
      stage: 1,
      approverId,
      status: initialStatus
    }
  });

  // Revalidate generic paths
  revalidatePath(`/modules/${moduleType.toLowerCase()}`);
  revalidatePath(`/modules/${moduleType.toLowerCase()}/${recordId}`);
  
  return { success: true };
}

export async function processApproval(approvalId: string, status: "Approved" | "Rejected", notes?: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "Not logged in" };

  const approval = await prisma.approvalRouting.findUnique({ where: { id: approvalId } });
  if (!approval) return { success: false, message: "Approval record not found" };

  if (approval.approverId !== user.id && user.role !== "Super Admin") {
    return { success: false, message: "Unauthorized to process this approval" };
  }

  await prisma.approvalRouting.update({
    where: { id: approvalId },
    data: { status, notes }
  });

  // Depending on the module type, you might want to update the actual record's status here
  // For example, if moduleType === 'Document' and status === 'Approved', change Document status to 'Approved'
  if (approval.moduleType === 'Document') {
    if (status === 'Approved') {
      await prisma.document.update({
        where: { id: approval.recordId },
        data: { status: 'Approved', approverName: user.name as string, approvedDate: new Date().toISOString().split('T')[0] }
      });
    } else if (status === 'Rejected') {
      await prisma.document.update({
        where: { id: approval.recordId },
        data: { status: 'Rejected', rejectionReason: notes }
      });
    }
  }

  revalidatePath(`/modules/${approval.moduleType.toLowerCase()}`);
  revalidatePath(`/modules/${approval.moduleType.toLowerCase()}/${approval.recordId}`);

  return { success: true };
}

export async function getApprovalsForRecord(moduleType: string, recordId: string) {
  return await prisma.approvalRouting.findMany({
    where: { moduleType, recordId },
    orderBy: { createdAt: 'asc' }
  });
}

export async function getPendingApprovalsForUser(userId: string) {
  return await prisma.approvalRouting.findMany({
    where: { approverId: userId, status: "Pending" },
    orderBy: { createdAt: 'desc' }
  });
}
