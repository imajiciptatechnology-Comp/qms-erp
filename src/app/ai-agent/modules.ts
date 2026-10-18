import { prisma } from "@/lib/prisma";

/**
 * Daftar modul yang bisa dicari/dibuka/di-download/di-export oleh AI Assistant.
 * Setiap modul memetakan tabel Prisma ke bentuk ringkas yang dikirim ke model.
 */

export type AgentFile = { name: string; url: string };

type ModuleDef = {
  label: string;
  /** id izin di rolesConfig (sama dengan id menu di Sidebar). */
  perm: string;
  listPath: string;
  detailPath?: (id: string) => string;
  /** Delegate Prisma, mis. prisma.nCR. */
  table: () => any;
  /** Field nomor/kode yang dikenali user, mis. ncNumber. */
  refField: string;
  searchFields: string[];
  select: Record<string, unknown>;
  orderBy: Record<string, "asc" | "desc">;
  /** Status yang dianggap selesai (filter "open" = selain ini). */
  closedStatuses?: string[];
  /** Field tanggal YYYY-MM-DD untuk filter "overdue". */
  dueField?: string;
  /** Kolom yang dipakai untuk export & ringkasan. */
  columns: string[];
  files?: (row: any) => AgentFile[];
  /** Dokumen terbatas tidak boleh di-download lewat AI. */
  isRestricted?: (row: any) => boolean;
};

const fileNameFromUrl = (url: string) => decodeURIComponent(url.split("?")[0].split("/").pop() || "file");

export const AGENT_MODULES: Record<string, ModuleDef> = {
  nc: {
    label: "Non-Conformance (NC/NCR)",
    perm: "nc",
    listPath: "/modules/nc",
    detailPath: id => `/modules/nc/${id}`,
    table: () => prisma.nCR,
    refField: "ncNumber",
    searchFields: ["ncNumber", "description", "department", "productBatch", "supplierName"],
    select: { id: true, ncNumber: true, findingType: true, department: true, severity: true, status: true, source: true, dateRaised: true, dueDate: true, productBatch: true, description: true, actionPlanJson: true },
    orderBy: { dateRaised: "desc" },
    closedStatuses: ["Closed"],
    dueField: "dueDate",
    columns: ["ncNumber", "findingType", "department", "severity", "status", "source", "dateRaised", "dueDate", "productBatch", "description"],
    files: r => {
      try {
        const urls: string[] = JSON.parse(r.actionPlanJson || "{}")?.evidenceFiles || [];
        return urls.filter(u => typeof u === "string" && u.startsWith("http")).map(u => ({ name: fileNameFromUrl(u), url: u }));
      } catch {
        return [];
      }
    },
  },
  document: {
    label: "Document Control",
    perm: "document",
    listPath: "/modules/document",
    detailPath: id => `/modules/document/${id}`,
    table: () => prisma.document,
    refField: "docNumber",
    searchFields: ["docNumber", "title", "type", "department"],
    select: { id: true, docNumber: true, title: true, type: true, status: true, revision: true, department: true, lastUpdated: true, nextReviewDate: true, fileName: true, isRestricted: true },
    orderBy: { lastUpdated: "desc" },
    closedStatuses: ["Obsolete", "Archived"],
    dueField: "nextReviewDate",
    columns: ["docNumber", "title", "type", "status", "revision", "department", "lastUpdated", "nextReviewDate"],
    files: r => (typeof r.fileName === "string" && r.fileName.startsWith("http") ? [{ name: fileNameFromUrl(r.fileName), url: r.fileName }] : []),
    isRestricted: r => Boolean(r.isRestricted),
  },
  calibration: {
    label: "Calibration (alat ukur)",
    perm: "calibration",
    listPath: "/modules/calibration",
    detailPath: id => `/modules/calibration/${id}`,
    table: () => prisma.equipment,
    refField: "serialNumber",
    searchFields: ["serialNumber", "equipmentName", "location", "category"],
    select: {
      id: true, serialNumber: true, equipmentName: true, category: true, location: true, status: true, lastCalDate: true, nextCalDate: true,
      records: { select: { date: true, certificateNo: true, result: true, attachmentUrl: true }, orderBy: { date: "desc" } },
    },
    orderBy: { nextCalDate: "asc" },
    dueField: "nextCalDate",
    columns: ["serialNumber", "equipmentName", "category", "location", "status", "lastCalDate", "nextCalDate"],
    // Sertifikat terbaru lebih dulu.
    files: r =>
      (r.records || [])
        .filter((rec: any) => rec.attachmentUrl)
        .map((rec: any) => ({ name: `Sertifikat ${rec.certificateNo} (${rec.date})`, url: rec.attachmentUrl })),
  },
  audit: {
    label: "Audit",
    perm: "audit",
    listPath: "/modules/audit",
    detailPath: id => `/modules/audit/${id}`,
    table: () => prisma.audit,
    refField: "auditNo",
    searchFields: ["auditNo", "department", "leadAuditor", "auditType"],
    select: { id: true, auditNo: true, department: true, auditType: true, plannedDate: true, actualDate: true, status: true, leadAuditor: true, findingsCount: true },
    orderBy: { plannedDate: "desc" },
    closedStatuses: ["Completed", "Closed", "Cancelled"],
    dueField: "plannedDate",
    columns: ["auditNo", "department", "auditType", "plannedDate", "actualDate", "status", "leadAuditor", "findingsCount"],
  },
  training: {
    label: "Training",
    perm: "training",
    listPath: "/modules/training",
    detailPath: id => `/modules/training/${id}`,
    table: () => prisma.training,
    refField: "trainingNo",
    searchFields: ["trainingNo", "title", "department", "trainer", "category"],
    select: { id: true, trainingNo: true, title: true, category: true, department: true, trainer: true, plannedDate: true, status: true, isMandatory: true },
    orderBy: { plannedDate: "desc" },
    closedStatuses: ["Completed", "Cancelled"],
    dueField: "plannedDate",
    columns: ["trainingNo", "title", "category", "department", "trainer", "plannedDate", "status", "isMandatory"],
  },
  complaint: {
    label: "Customer Complaint",
    perm: "complaint",
    listPath: "/modules/complaint",
    table: () => prisma.complaint,
    refField: "complaintNo",
    searchFields: ["complaintNo", "customerName", "productService", "category", "description"],
    select: { id: true, complaintNo: true, customerName: true, productService: true, category: true, severity: true, status: true, complaintDate: true, targetDate: true },
    orderBy: { complaintDate: "desc" },
    closedStatuses: ["Closed", "Rejected"],
    dueField: "targetDate",
    columns: ["complaintNo", "customerName", "productService", "category", "severity", "status", "complaintDate", "targetDate"],
  },
  risk: {
    label: "Risk Register",
    perm: "risk",
    listPath: "/modules/risk",
    table: () => prisma.risk,
    refField: "riskNo",
    searchFields: ["riskNo", "title", "department", "category", "riskLevel"],
    select: { id: true, riskNo: true, title: true, category: true, department: true, riskLevel: true, riskScore: true, status: true, treatment: true, targetDate: true },
    orderBy: { riskScore: "desc" },
    closedStatuses: ["Closed"],
    dueField: "targetDate",
    columns: ["riskNo", "title", "category", "department", "riskLevel", "riskScore", "status", "treatment", "targetDate"],
  },
  supplier: {
    label: "Supplier",
    perm: "supplier",
    listPath: "/modules/supplier",
    table: () => prisma.supplier,
    refField: "supplierNo",
    searchFields: ["supplierNo", "name", "category", "productsSupplied"],
    select: { id: true, supplierNo: true, name: true, category: true, status: true, qualificationStatus: true, isCritical: true, ncCount: true },
    orderBy: { createdAt: "desc" },
    columns: ["supplierNo", "name", "category", "status", "qualificationStatus", "isCritical", "ncCount"],
  },
  hse: {
    label: "HSE Incident",
    perm: "hse",
    listPath: "/modules/hse",
    detailPath: id => `/modules/hse/incident/${id}`,
    table: () => prisma.incident,
    refField: "id",
    searchFields: ["id", "type", "location", "description"],
    select: { id: true, date: true, type: true, severity: true, status: true, location: true, description: true },
    orderBy: { date: "desc" },
    closedStatuses: ["Closed"],
    columns: ["id", "date", "type", "severity", "status", "location", "description"],
  },
  moc: {
    label: "Management of Change (MOC)",
    perm: "moc",
    listPath: "/modules/moc",
    detailPath: id => `/modules/moc/${id}`,
    table: () => prisma.moc,
    refField: "id",
    searchFields: ["id", "title", "category", "department"],
    select: { id: true, title: true, category: true, department: true, status: true, riskLevel: true, dateRequested: true },
    orderBy: { dateRequested: "desc" },
    closedStatuses: ["Closed", "Rejected"],
    columns: ["id", "title", "category", "department", "status", "riskLevel", "dateRequested"],
  },
  ppc: {
    label: "Production Work Order",
    perm: "ppc",
    listPath: "/modules/ppc",
    detailPath: id => `/modules/ppc/${id}`,
    table: () => prisma.workOrder,
    refField: "id",
    searchFields: ["id", "productName", "operator", "machineId"],
    select: { id: true, productName: true, targetQuantity: true, actualQuantity: true, status: true, startDate: true, endDate: true },
    orderBy: { startDate: "desc" },
    closedStatuses: ["Completed", "Cancelled"],
    dueField: "endDate",
    columns: ["id", "productName", "targetQuantity", "actualQuantity", "status", "startDate", "endDate"],
  },
  maintenance: {
    label: "Maintenance",
    perm: "maintenance",
    listPath: "/modules/maintenance",
    detailPath: id => `/modules/maintenance/${id}`,
    table: () => prisma.maintenanceRecord,
    refField: "id",
    searchFields: ["id", "assetId", "type", "description", "performedBy"],
    select: { id: true, assetId: true, type: true, date: true, status: true, description: true, performedBy: true },
    orderBy: { date: "desc" },
    closedStatuses: ["Completed"],
    dueField: "date",
    columns: ["id", "assetId", "type", "date", "status", "performedBy", "description"],
  },
  welding: {
    label: "Welder Qualification",
    perm: "welding",
    listPath: "/modules/welding",
    table: () => prisma.welder,
    refField: "stampNumber",
    searchFields: ["stampNumber", "name", "processType"],
    select: { id: true, stampNumber: true, name: true, processType: true, position: true, expiryDate: true, status: true },
    orderBy: { expiryDate: "asc" },
    dueField: "expiryDate",
    columns: ["stampNumber", "name", "processType", "position", "expiryDate", "status"],
  },
};

export type AgentModuleId = keyof typeof AGENT_MODULES;
export const AGENT_MODULE_IDS = Object.keys(AGENT_MODULES);

/** Halaman yang boleh dibuka lewat AI (selain halaman detail record). */
export const AGENT_PAGES: Record<string, { label: string; path: string; perm?: string }> = {
  dashboard: { label: "Dashboard", path: "/" },
  context: { label: "Context & Interested Parties", path: "/modules/context", perm: "context" },
  objectives: { label: "Quality Objectives", path: "/modules/objectives", perm: "objectives" },
  "management-review": { label: "Management Review", path: "/modules/management-review", perm: "management-review" },
  design: { label: "Design", path: "/modules/design", perm: "design" },
  inspection: { label: "Inspection", path: "/modules/inspection", perm: "inspection" },
  shipping: { label: "Shipping", path: "/modules/shipping", perm: "shipping" },
  profile: { label: "Profil saya", path: "/settings/profile" },
  ...Object.fromEntries(Object.entries(AGENT_MODULES).map(([id, m]) => [id, { label: m.label, path: m.listPath, perm: m.perm }])),
};

export type Filter = "open" | "overdue" | "all";

const today = () => new Date().toISOString().split("T")[0];

function buildWhere(mod: ModuleDef, query: string | undefined, filter: Filter) {
  const and: Record<string, unknown>[] = [];
  const q = query?.trim();
  if (q) {
    and.push({ OR: mod.searchFields.map(f => ({ [f]: { contains: q, mode: "insensitive" } })) });
  }
  if ((filter === "open" || filter === "overdue") && mod.closedStatuses) {
    and.push({ status: { notIn: mod.closedStatuses } });
  }
  if (filter === "overdue" && mod.dueField) {
    and.push({ [mod.dueField]: { lt: today(), not: "" } });
  }
  return and.length ? { AND: and } : {};
}

/** Bentuk ringkas satu record untuk model: kolom + link + daftar file. */
export function toSummary(moduleId: string, row: any) {
  const mod = AGENT_MODULES[moduleId];
  const out: Record<string, unknown> = { ref: row[mod.refField] };
  for (const c of mod.columns) {
    const v = row[c];
    if (v === null || v === undefined || v === "") continue;
    out[c] = typeof v === "string" && v.length > 160 ? v.slice(0, 160) + "…" : v;
  }
  if (mod.detailPath) out.page = mod.detailPath(row.id);
  const files = mod.files?.(row) ?? [];
  if (files.length) out.files = files.map(f => f.name);
  if (mod.isRestricted?.(row)) out.restricted = true;
  return out;
}

export async function searchModule(moduleId: string, opts: { query?: string; filter?: Filter; limit?: number }) {
  const mod = AGENT_MODULES[moduleId];
  const where = buildWhere(mod, opts.query, opts.filter ?? "all");
  const [total, rows] = await Promise.all([
    mod.table().count({ where }),
    mod.table().findMany({ where, select: mod.select, orderBy: mod.orderBy, take: Math.min(Math.max(opts.limit ?? 10, 1), 20) }),
  ]);
  return { total, rows: rows as any[] };
}

/** Cari satu record dari nomor/kode, id, atau kata kunci yang hanya cocok ke satu record. */
export async function findRecord(moduleId: string, ref: string) {
  const mod = AGENT_MODULES[moduleId];
  const value = ref.trim();
  if (!value) return { row: null, candidates: [] as any[] };
  const exact = await mod.table().findFirst({
    where: { OR: [{ [mod.refField]: { equals: value, mode: "insensitive" } }, { id: value }] },
    select: mod.select,
  });
  if (exact) return { row: exact, candidates: [] as any[] };
  const { rows } = await searchModule(moduleId, { query: value, limit: 5 });
  return rows.length === 1 ? { row: rows[0], candidates: [] as any[] } : { row: null, candidates: rows };
}

export async function exportModule(moduleId: string, opts: { query?: string; filter?: Filter }) {
  const mod = AGENT_MODULES[moduleId];
  const rows = await mod.table().findMany({
    where: buildWhere(mod, opts.query, opts.filter ?? "all"),
    select: mod.select,
    orderBy: mod.orderBy,
    take: 1000,
  });
  return (rows as any[]).map(r => Object.fromEntries(mod.columns.map(c => [c, r[c] ?? ""])));
}
