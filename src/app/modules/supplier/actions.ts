"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";

export type SupplierEvaluation = {
  id: string;
  period: string;
  evaluatedBy: string;
  evaluationDate: string;
  qualityScore: number;
  deliveryScore: number;
  serviceScore: number;
  priceScore: number;
  totalScore: number;
  grade: "A" | "B" | "C" | "D";
  notes?: string;
};

export type SupplierItem = {
  id: string;
  supplierNo: string;
  name: string;
  category: string;
  address?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  productsSupplied: string;
  status: "Active" | "Conditional" | "Suspended" | "Blacklisted";
  qualificationStatus: "Approved" | "Conditional Approval" | "Pending" | "Rejected";
  isCritical: boolean;
  certifications?: string;
  evaluations: SupplierEvaluation[];
  ncCount: number;
  approvedDate?: string;
  nextEvaluationDate?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
};

function calcGrade(score: number): SupplierEvaluation["grade"] {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

export async function getSuppliers(): Promise<SupplierItem[]> {
  const suppliers = await prisma.supplier.findMany({
    include: { evaluations: true },
    orderBy: { createdAt: 'desc' }
  });
  
  return suppliers.map(s => ({
    id: s.id,
    supplierNo: s.supplierNo,
    name: s.name,
    category: s.category,
    address: s.address || undefined,
    contactName: s.contactName || undefined,
    contactEmail: s.contactEmail || undefined,
    contactPhone: s.contactPhone || undefined,
    productsSupplied: s.productsSupplied,
    status: s.status as any,
    qualificationStatus: s.qualificationStatus as any,
    isCritical: s.isCritical,
    certifications: s.certifications || undefined,
    ncCount: s.ncCount,
    approvedDate: s.approvedDate || undefined,
    nextEvaluationDate: s.nextEvaluationDate || undefined,
    notes: s.notes || undefined,
    createdAt: s.createdAt,
    createdBy: s.createdBy,
    evaluations: s.evaluations.map(e => ({
      id: e.id,
      period: e.period,
      evaluatedBy: e.evaluatedBy,
      evaluationDate: e.evaluationDate,
      qualityScore: e.qualityScore,
      deliveryScore: e.deliveryScore,
      serviceScore: e.serviceScore,
      priceScore: e.priceScore,
      totalScore: e.totalScore,
      grade: e.grade as any,
      notes: e.notes || undefined
    }))
  }));
}

export async function addSupplier(data: {
  name: string;
  category: string;
  address?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  productsSupplied: string;
  isCritical: boolean;
  certifications?: string;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const id = `SUP-${Date.now().toString().slice(-5)}`;

  await prisma.supplier.create({
    data: {
      id,
      supplierNo: id, // unique
      name: data.name,
      category: data.category,
      address: data.address,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      productsSupplied: data.productsSupplied,
      status: "Active",
      qualificationStatus: "Pending",
      isCritical: data.isCritical,
      certifications: data.certifications,
      ncCount: 0,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      createdBy: user.name
    }
  });

  revalidatePath("/modules/supplier");
  return { success: true };
}

export async function addEvaluation(supplierId: string, eval_data: {
  period: string;
  qualityScore: number;
  deliveryScore: number;
  serviceScore: number;
  priceScore: number;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return { success: false };

  const totalScore = Math.round((eval_data.qualityScore * 0.4 + eval_data.deliveryScore * 0.3 + eval_data.serviceScore * 0.2 + eval_data.priceScore * 0.1));
  const grade = calcGrade(totalScore);

  await prisma.supplierEvaluation.create({
    data: {
      supplierId,
      period: eval_data.period,
      evaluatedBy: user.name,
      evaluationDate: new Date().toISOString().split("T")[0],
      qualityScore: eval_data.qualityScore,
      deliveryScore: eval_data.deliveryScore,
      serviceScore: eval_data.serviceScore,
      priceScore: eval_data.priceScore,
      totalScore,
      grade,
      notes: eval_data.notes
    }
  });

  let qualStatus = supplier.qualificationStatus;
  if (grade === "A" || grade === "B") qualStatus = "Approved";
  else if (grade === "C") qualStatus = "Conditional Approval";
  else qualStatus = "Rejected";

  await prisma.supplier.update({
    where: { id: supplierId },
    data: { qualificationStatus: qualStatus }
  });

  revalidatePath("/modules/supplier");
  return { success: true };
}

export async function updateSupplierStatus(id: string, status: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  await prisma.supplier.update({
    where: { id },
    data: { status }
  });

  revalidatePath("/modules/supplier");
  return { success: true };
}

export async function exportApprovedSupplierList(): Promise<string> {
  const { buildExcel } = await import("@/lib/excel");
  const suppliers = await getSuppliers();
  const approved = suppliers.filter(s => s.qualificationStatus === "Approved" || s.qualificationStatus === "Conditional Approval");

  const rows = approved.map(s => {
    const latestEval = [...s.evaluations].sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate))[0];
    return {
      supplierNo:    s.supplierNo,
      name:          s.name,
      category:      s.category,
      products:      s.productsSupplied,
      qualification: s.qualificationStatus,
      status:        s.status,
      critical:      s.isCritical ? "Yes" : "No",
      certifications: s.certifications || "-",
      contactName:   s.contactName || "-",
      contactEmail:  s.contactEmail || "-",
      latestGrade:   latestEval?.grade || "N/A",
      latestScore:   latestEval?.totalScore ?? "-",
      lastEval:      latestEval?.evaluationDate || "-",
      approvedDate:  s.approvedDate || "-",
    };
  });

  return buildExcel({
    sheetName: "Approved Supplier List",
    title: "APPROVED SUPPLIER LIST (ASL)",
    subtitle: `ISO 9001:2015 Clause 8.4 — Generated: ${new Date().toLocaleDateString()} | Total: ${approved.length} suppliers`,
    columns: [
      { header: "Supplier No.",     key: "supplierNo",    width: 14 },
      { header: "Name",             key: "name",          width: 30 },
      { header: "Category",         key: "category",      width: 18 },
      { header: "Products/Services",key: "products",      width: 35 },
      { header: "Qualification",    key: "qualification", width: 22 },
      { header: "Status",           key: "status",        width: 14 },
      { header: "Critical?",        key: "critical",      width: 10 },
      { header: "Certifications",   key: "certifications",width: 22 },
      { header: "Contact Person",   key: "contactName",   width: 20 },
      { header: "Email",            key: "contactEmail",  width: 28 },
      { header: "Latest Grade",     key: "latestGrade",   width: 14 },
      { header: "Latest Score",     key: "latestScore",   width: 14 },
      { header: "Last Evaluated",   key: "lastEval",      width: 16 },
      { header: "Approved Date",    key: "approvedDate",  width: 16 },
    ],
    rows,
  });
}

export async function deleteSupplier(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  await prisma.supplier.delete({ where: { id } });
  revalidatePath("/modules/supplier");
  return { success: true };
}
