import { buildExcel, type ColDef } from "@/lib/excel";
import { AGENT_MODULES, type Filter } from "./modules";

/** Label & jenis kolom untuk file Excel hasil export AI Assistant. */
const COLUMN_META: Record<string, { label: string; type?: ColDef["type"] }> = {
  ncNumber: { label: "No. NC" },
  findingType: { label: "Jenis", type: "badge" },
  department: { label: "Departemen" },
  severity: { label: "Severity", type: "badge" },
  status: { label: "Status", type: "badge" },
  source: { label: "Sumber" },
  dateRaised: { label: "Tanggal Temuan", type: "date" },
  dueDate: { label: "Jatuh Tempo", type: "date" },
  productBatch: { label: "Produk / Batch" },
  description: { label: "Deskripsi", type: "longtext" },
  docNumber: { label: "No. Dokumen" },
  title: { label: "Judul", type: "longtext" },
  type: { label: "Tipe" },
  revision: { label: "Rev.", type: "number" },
  lastUpdated: { label: "Update Terakhir", type: "date" },
  nextReviewDate: { label: "Review Berikutnya", type: "date" },
  serialNumber: { label: "No. Alat" },
  equipmentName: { label: "Nama Alat" },
  category: { label: "Kategori" },
  location: { label: "Lokasi" },
  lastCalDate: { label: "Kalibrasi Terakhir", type: "date" },
  nextCalDate: { label: "Kalibrasi Berikutnya", type: "date" },
  auditNo: { label: "No. Audit" },
  auditType: { label: "Jenis Audit" },
  plannedDate: { label: "Tanggal Rencana", type: "date" },
  actualDate: { label: "Tanggal Aktual", type: "date" },
  leadAuditor: { label: "Lead Auditor" },
  findingsCount: { label: "Jumlah Temuan", type: "number" },
  trainingNo: { label: "No. Training" },
  trainer: { label: "Trainer" },
  isMandatory: { label: "Wajib" },
  complaintNo: { label: "No. Complaint" },
  customerName: { label: "Pelanggan" },
  productService: { label: "Produk / Layanan" },
  complaintDate: { label: "Tanggal Complaint", type: "date" },
  targetDate: { label: "Target Selesai", type: "date" },
  riskNo: { label: "No. Risiko" },
  riskLevel: { label: "Level Risiko", type: "badge" },
  riskScore: { label: "Skor", type: "number" },
  treatment: { label: "Penanganan" },
  supplierNo: { label: "No. Supplier" },
  name: { label: "Nama" },
  qualificationStatus: { label: "Kualifikasi", type: "badge" },
  isCritical: { label: "Kritis" },
  ncCount: { label: "Jumlah NC", type: "number" },
  id: { label: "ID" },
  date: { label: "Tanggal", type: "date" },
  dateRequested: { label: "Tanggal Pengajuan", type: "date" },
  productName: { label: "Produk" },
  targetQuantity: { label: "Target Qty", type: "number" },
  actualQuantity: { label: "Aktual Qty", type: "number" },
  startDate: { label: "Mulai", type: "date" },
  endDate: { label: "Selesai", type: "date" },
  assetId: { label: "Aset" },
  performedBy: { label: "Pelaksana" },
  stampNumber: { label: "No. Stamp" },
  processType: { label: "Proses" },
  position: { label: "Posisi" },
  expiryDate: { label: "Berlaku s/d", type: "date" },
};

const FILTER_LABEL: Record<Filter, string> = { open: "Belum Selesai", overdue: "Lewat Jatuh Tempo", all: "Semua Data" };

const slug = (s: string) => s.replace(/\(.*?\)/g, "").trim().replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Bangun file Excel bergaya untuk satu modul; kembalikan nama file & isi base64. */
export async function buildModuleWorkbook(
  moduleId: string,
  rows: Record<string, unknown>[],
  opts: { filter: Filter; query?: string; user: string }
) {
  const mod = AGENT_MODULES[moduleId];
  const columns: ColDef[] = mod.columns.map(key => ({
    key,
    header: COLUMN_META[key]?.label ?? key,
    type: COLUMN_META[key]?.type ?? "text",
  }));

  const now = new Date();
  const stamp = now.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" });
  const parts = [
    "QMS ERP",
    `Filter: ${FILTER_LABEL[opts.filter]}`,
    opts.query?.trim() ? `Kata kunci: "${opts.query.trim()}"` : null,
    `${rows.length} record`,
    `Diekspor ${stamp} WIB oleh ${opts.user}`,
  ].filter(Boolean);

  const base64 = await buildExcel({
    sheetName: mod.label.replace(/[\\/*?:[\]]/g, " "),
    title: `${mod.label} — ${FILTER_LABEL[opts.filter]}`,
    subtitle: parts.join("  ·  "),
    columns,
    rows: rows as Record<string, string | number | boolean | null | undefined>[],
    overdueKey: mod.dueField,
    statusKey: mod.columns.includes("status") ? "status" : undefined,
    closedStatuses: mod.closedStatuses,
  });

  const date = now.toISOString().slice(0, 10);
  const filename = `${slug(mod.label)}_${slug(FILTER_LABEL[opts.filter])}_${date}.xlsx`;
  return { filename, base64 };
}
