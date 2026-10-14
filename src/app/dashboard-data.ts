import { prisma } from "@/lib/prisma";

export type ChartDatum = { name: string; value: number };

/** Hitung jumlah per kunci (mis. status) → data siap pakai untuk chart. */
function countBy<T>(rows: T[], key: (row: T) => string): ChartDatum[] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const k = key(row);
    counts[k] = (counts[k] || 0) + 1;
  }
  return Object.keys(counts).map(name => ({ name, value: counts[name] }));
}

/**
 * Data Global Dashboard.
 * Hanya mengambil kolom yang benar-benar ditampilkan (tanpa kolom JSON besar
 * & tanpa relasi), lalu mengirim angka/agregat ke client, bukan seluruh tabel.
 */
export async function getDashboardData() {
  const [ncrs, audits, documents, risks, equipments, workOrders, maintenance, welders, incidents, mocRecords] =
    await Promise.all([
      prisma.nCR.findMany({
        select: { id: true, ncNumber: true, status: true, findingType: true, department: true, description: true, dateRaised: true, dueDate: true },
      }),
      prisma.audit.findMany({ select: { status: true, plannedDate: true } }),
      prisma.document.findMany({ select: { status: true } }),
      prisma.risk.findMany({ select: { status: true, riskLevel: true } }),
      prisma.equipment.findMany({ select: { status: true } }),
      prisma.workOrder.findMany({ select: { status: true } }),
      prisma.maintenanceRecord.findMany({ select: { status: true, date: true } }),
      prisma.welder.findMany({ select: { status: true, expiryDate: true } }),
      prisma.incident.findMany({ select: { id: true, type: true, status: true, date: true } }),
      prisma.moc.findMany({ select: { id: true, title: true, status: true }, orderBy: { dateRequested: "desc" } }),
    ]);

  const today = new Date();
  const currentMonth = today.getMonth();
  today.setHours(0, 0, 0, 0);

  const isActiveMoc = (m: { status: string }) => m.status !== "Closed" && m.status !== "Rejected";
  const nonOfiNcs = ncrs.filter(n => n.findingType !== "OFI");

  return {
    kpi: {
      openNCs: nonOfiNcs.filter(n => n.status !== "Closed").length,
      overdueNCs: nonOfiNcs.filter(n => n.status !== "Closed" && new Date(n.dueDate) < today).length,
      auditsThisMonth: audits.filter(a => new Date(a.plannedDate).getMonth() === currentMonth).length,
      activeMocs: mocRecords.filter(isActiveMoc).length,
      activeRisks: risks.filter(r => r.status !== "Closed").length,
      openIncidents: incidents.filter(i => i.status === "Open").length,
      welderCount: welders.length,
      expiredWelders: welders.filter(w => new Date(w.expiryDate) < today || w.status === "Expired").length,
      maintenanceCount: maintenance.length,
      overdueMaintenance: maintenance.filter(m => m.status !== "Completed" && new Date(m.date) < today).length,
      activeWOs: workOrders.filter(w => w.status === "Scheduled" || w.status === "In Progress").length,
    },
    charts: {
      ncrByDept: countBy(ncrs, n => n.department),
      riskByLevel: countBy(risks, r => r.riskLevel),
      documentByStatus: countBy(documents, d => d.status),
      auditByStatus: countBy(audits, a => a.status),
      equipmentByStatus: countBy(equipments, e => e.status),
    },
    recentNCs: nonOfiNcs
      .sort((a, b) => b.dateRaised.localeCompare(a.dateRaised))
      .slice(0, 5)
      .map(({ id, ncNumber, status, department, description }) => ({ id, ncNumber, status, department, description })),
    recentIncidents: incidents
      .filter(i => i.status === "Open")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3),
    activeMocList: mocRecords.filter(isActiveMoc).slice(0, 3),
  };
}
