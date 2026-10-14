import { prisma } from "@/lib/prisma";

const MAX_ROWS = 40;
const cut = (s: string | null | undefined, n = 120) => (s && s.length > n ? s.slice(0, n) + "…" : s || undefined);

/**
 * Snapshot data ERP yang dikirim ke AI Assistant sebagai konteks.
 * Hanya kolom ringkas (tanpa kontak pribadi, file, atau riwayat JSON),
 * maksimal MAX_ROWS baris per modul, terbaru dulu.
 */
export async function getAssistantContext() {
  const take = MAX_ROWS;
  const [ncrs, complaints, equipments, risks, trainings, audits, documents, suppliers, incidents, mocs, workOrders, maintenance, welders] =
    await Promise.all([
      prisma.nCR.findMany({
        take, orderBy: { dateRaised: "desc" },
        select: { ncNumber: true, findingType: true, department: true, severity: true, status: true, dateRaised: true, dueDate: true, description: true, supplierName: true },
      }),
      prisma.complaint.findMany({
        take, orderBy: { complaintDate: "desc" },
        select: { complaintNo: true, customerName: true, productService: true, category: true, severity: true, status: true, complaintDate: true, targetDate: true, description: true },
      }),
      prisma.equipment.findMany({
        take, orderBy: { nextCalDate: "asc" },
        select: { serialNumber: true, equipmentName: true, location: true, status: true, lastCalDate: true, nextCalDate: true },
      }),
      prisma.risk.findMany({
        take, orderBy: { riskScore: "desc" },
        select: { riskNo: true, title: true, department: true, riskLevel: true, riskScore: true, status: true, treatment: true, targetDate: true },
      }),
      prisma.training.findMany({
        take, orderBy: { plannedDate: "desc" },
        select: { trainingNo: true, title: true, department: true, plannedDate: true, status: true, isMandatory: true },
      }),
      prisma.audit.findMany({
        take, orderBy: { plannedDate: "desc" },
        select: { auditNo: true, department: true, plannedDate: true, actualDate: true, status: true, leadAuditor: true, findingsCount: true },
      }),
      prisma.document.findMany({
        take, orderBy: { lastUpdated: "desc" },
        select: { docNumber: true, title: true, type: true, status: true, revision: true, department: true, nextReviewDate: true },
      }),
      prisma.supplier.findMany({
        take, orderBy: { createdAt: "desc" },
        select: { supplierNo: true, name: true, category: true, status: true, qualificationStatus: true, isCritical: true, ncCount: true },
      }),
      prisma.incident.findMany({
        take, orderBy: { date: "desc" },
        select: { id: true, date: true, type: true, severity: true, status: true, location: true, description: true },
      }),
      prisma.moc.findMany({
        take, orderBy: { dateRequested: "desc" },
        select: { id: true, title: true, category: true, department: true, status: true, riskLevel: true, dateRequested: true },
      }),
      prisma.workOrder.findMany({
        take, orderBy: { startDate: "desc" },
        select: { id: true, productName: true, targetQuantity: true, actualQuantity: true, status: true, startDate: true, endDate: true },
      }),
      prisma.maintenanceRecord.findMany({
        take, orderBy: { date: "desc" },
        select: { assetId: true, type: true, date: true, status: true, description: true },
      }),
      prisma.welder.findMany({
        take, orderBy: { expiryDate: "asc" },
        select: { stampNumber: true, name: true, processType: true, expiryDate: true, status: true },
      }),
    ]);

  return {
    today: new Date().toISOString().split("T")[0],
    nonConformances: ncrs.map(n => ({ ...n, description: cut(n.description) })),
    complaints: complaints.map(c => ({ ...c, description: cut(c.description) })),
    calibrationEquipment: equipments,
    risks,
    trainings,
    audits,
    documents,
    suppliers,
    hseIncidents: incidents.map(i => ({ ...i, description: cut(i.description) })),
    mocs,
    workOrders,
    maintenance: maintenance.map(m => ({ ...m, description: cut(m.description) })),
    welders,
  };
}
