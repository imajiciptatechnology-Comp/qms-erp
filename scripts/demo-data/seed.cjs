/**
 * Isi data demo lintas modul (semua bernomor "DEMO-…") + unggah file contoh ke
 * storage folder "demo/". Aman dijalankan ulang: data demo lama dihapus dulu.
 * Tanggal dihitung relatif terhadap hari ini supaya status overdue tetap masuk akal.
 *
 *   node scripts/demo-data/make-files.cjs   (sekali, membuat file contoh)
 *   node scripts/demo-data/seed.cjs
 *   node scripts/demo-data/clear.cjs        (hapus semua data demo)
 */
const fs = require("fs");
const path = require("path");
const { prisma, supabase, BUCKET, STORAGE_DIR } = require("./common.cjs");
const { clearDemo } = require("./clear.cjs");

const day = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};
const nowIso = new Date().toISOString();
const history = (action, by = "Demo Data") => JSON.stringify([{ id: "1", date: nowIso, userName: by, action }]);

async function upload(file, contentType) {
  const buf = fs.readFileSync(path.join(__dirname, "files", file));
  const target = `${STORAGE_DIR}/${file}`;
  const { error } = await supabase.storage.from(BUCKET).upload(target, buf, { contentType, upsert: true });
  if (error) throw new Error(`Upload ${file} gagal: ${error.message}`);
  return { url: supabase.storage.from(BUCKET).getPublicUrl(target).data.publicUrl, size: buf.length };
}

async function main() {
  await clearDemo({ quiet: true });

  // ---------- File contoh ----------
  const sopQa = await upload("DEMO-SOP-QA-001.pdf", "application/pdf");
  const wiPrd = await upload("DEMO-WI-PRD-002.pdf", "application/pdf");
  const sopHr = await upload("DEMO-SOP-HR-003.pdf", "application/pdf");
  const certMic = await upload("DEMO-CERT-MIC-2026.png", "image/png");
  const certTt = await upload("DEMO-CERT-TT-2026.png", "image/png");
  const ncEvidence = await upload("DEMO-NC-002-bukti-rework.png", "image/png");

  // ---------- NC / NCR ----------
  const nc = (o) => ({ source: "Process Monitoring", findingType: "NC", historyJson: history("NCR raised"), ...o });
  await prisma.nCR.createMany({ data: [
    nc({ ncNumber: "DEMO-NC-001", department: "Production", process: "Welding", severity: "Major", status: "Open", dateRaised: day(-20), dueDate: day(-5),
      detectedBy: "Rina Wulandari – QC Inspector", productBatch: "Flange SS304 DN50 – Lot 2610-01", isoClause: "8.7",
      description: "Porositas pada sambungan las 9 dari 80 pcs flange, terdeteksi saat dye penetrant test di line welding 2. Produk diberi label HOLD." }),
    nc({ ncNumber: "DEMO-NC-002", department: "Production", process: "Welding", severity: "Major", status: "Action Plan", dateRaised: day(-14), dueDate: day(6),
      detectedBy: "QC Final", productBatch: "Flange SS304 DN50 – Lot 2610-03", isoClause: "8.7",
      description: "Porositas berulang pada lot berikutnya; gas argon terindikasi bocor pada selang torch.",
      rcaJson: JSON.stringify({ why1: "Porositas pada las", why2: "Gas pelindung tidak stabil", why3: "Selang argon bocor", rootCauseStatement: "Tidak ada pengecekan kebocoran selang sebelum shift." }),
      actionPlanJson: JSON.stringify({ description: "Ganti selang argon & rework 18 pcs", preventiveAction: "Tambah cek kebocoran di checklist harian (DEMO-WI-PRD-002)", picName: "Agus Pratama", targetDate: day(6), evidenceFiles: [ncEvidence.url] }) }),
    nc({ ncNumber: "DEMO-NC-003", department: "Quality Assurance", process: "Calibration", severity: "Minor", status: "Root Cause Analysis", source: "Internal Audit", dateRaised: day(-30), dueDate: day(-2),
      detectedBy: "Lead Auditor – Hendra S.", isoClause: "7.1.5",
      description: "Pressure gauge DEMO-CAL-003 dipakai di produksi padahal jadwal kalibrasi sudah lewat." }),
    nc({ ncNumber: "DEMO-NC-004", department: "Engineering", process: "Design Control", severity: "Minor", status: "Open", source: "Internal Audit", dateRaised: day(-6), dueDate: day(10),
      detectedBy: "Internal Auditor", isoClause: "7.5.3",
      description: "Gambar kerja rev. C belum didistribusikan ke workshop; operator masih memakai rev. B." }),
    nc({ ncNumber: "DEMO-NC-005", department: "Production", process: "Machining", severity: "Critical", status: "Verification", source: "Customer Complaint", dateRaised: day(-25), dueDate: day(3),
      detectedBy: "Customer – via DEMO-CC-001", productBatch: "Shaft S45C Ø25 – Lot 2609-14", isoClause: "8.5.1",
      description: "Diameter shaft 25.12 mm di luar toleransi 25.00 ±0.05 mm pada 40 dari 200 pcs yang dikirim ke pelanggan." }),
    nc({ ncNumber: "DEMO-NC-006", department: "HSE", process: "Housekeeping", severity: "Minor", status: "Closed", dateRaised: day(-60), dueDate: day(-40),
      detectedBy: "HSE Officer", description: "Jalur evakuasi area gudang terhalang palet." }),
    nc({ ncNumber: "DEMO-OFI-001", department: "Engineering", process: "Design Control", severity: "Minor", status: "Open", findingType: "OFI", ofiStatus: "Under Review", source: "Internal Audit", dateRaised: day(-6), dueDate: day(30),
      description: "Peluang perbaikan: gunakan template checklist review desain digital agar riwayat review tercatat." }),
  ] });

  // ---------- Customer Complaint ----------
  const cc = (o) => ({ source: "Email", slaTargetDays: 7, createdAt: nowIso, historyJson: history("Complaint received"), ...o });
  await prisma.complaint.createMany({ data: [
    cc({ complaintNo: "DEMO-CC-001", customerName: "PT Sinar Jaya Konstruksi", productService: "Shaft S45C Ø25", complaintDate: day(-26), category: "Product Quality", severity: "High", status: "Under Investigation",
      description: "40 pcs shaft tidak bisa masuk ke bearing housing; diameter terlalu besar.", targetDate: day(-19), ncReferenceNo: "DEMO-NC-005", picName: "QA Manager" }),
    cc({ complaintNo: "DEMO-CC-002", customerName: "CV Mitra Teknik Abadi", productService: "Flange SS304 DN50", complaintDate: day(-5), category: "Product Quality", severity: "Medium", status: "Open",
      description: "Ditemukan bercak karat ringan pada 6 pcs flange saat diterima.", targetDate: day(2) }),
    cc({ complaintNo: "DEMO-CC-003", customerName: "PT Nusantara Energi Mandiri", productService: "Pengiriman", complaintDate: day(-12), category: "Delivery", severity: "Low", status: "Action Taken",
      description: "Barang datang terlambat 2 hari dari jadwal.", targetDate: day(-5), correctiveAction: "Jadwal pickup ekspedisi dimajukan 1 hari." }),
    cc({ complaintNo: "DEMO-CC-004", customerName: "PT Sinar Jaya Konstruksi", productService: "Dokumen MTC", complaintDate: day(-40), category: "Documentation", severity: "Medium", status: "Closed",
      description: "Sertifikat material (MTC) tidak dilampirkan pada pengiriman.", targetDate: day(-33), actualCloseDate: day(-35), customerSatisfied: true, satisfactionScore: 4 }),
  ] });

  // ---------- Calibration ----------
  const eq = (o) => ({ category: "Measuring", location: "QC Lab", frequencyMonths: 12, status: "Active", picName: "Dewi Lestari", ...o });
  await prisma.equipment.create({ data: eq({ id: "DEMO-EQ-001", serialNumber: "DEMO-CAL-001", equipmentName: "Vernier Caliper 0–200 mm", range: "0–200 mm", tolerance: "±0.03 mm", resolution: "0.02 mm",
    lastCalDate: day(-345), nextCalDate: day(20) }) });
  await prisma.equipment.create({ data: eq({ id: "DEMO-EQ-002", serialNumber: "DEMO-CAL-002", equipmentName: "Outside Micrometer 0–25 mm", range: "0–25 mm", tolerance: "±0.004 mm", resolution: "0.001 mm",
    lastCalDate: "2026-04-12", nextCalDate: "2027-04-12",
    records: { create: [{ date: "2026-04-12", certificateNo: "DEMO-SK/2026/04/0118", performedBy: "PT Lab Kalibrasi Nusantara", result: "Pass", remarks: "Semua titik dalam toleransi.", attachmentUrl: certMic.url }] } }) });
  await prisma.equipment.create({ data: eq({ id: "DEMO-EQ-003", serialNumber: "DEMO-CAL-003", equipmentName: "Pressure Gauge 0–10 bar", category: "Testing", location: "Hydrotest Area", range: "0–10 bar", tolerance: "±1% FS",
    frequencyMonths: 6, lastCalDate: day(-190), nextCalDate: day(-10) }) });
  await prisma.equipment.create({ data: eq({ id: "DEMO-EQ-004", serialNumber: "DEMO-CAL-004", equipmentName: "Torque Wrench 20–100 Nm", category: "Testing", location: "Assembly Line", range: "20–100 Nm", tolerance: "±4%",
    frequencyMonths: 6, lastCalDate: "2026-09-03", nextCalDate: "2027-03-03",
    records: { create: [{ date: "2026-09-03", certificateNo: "DEMO-SK/2026/09/0377", performedBy: "PT Lab Kalibrasi Nusantara", result: "Adjusted", remarks: "Deviasi awal 6% pada 100 Nm, lulus setelah penyetelan.", attachmentUrl: certTt.url }] } }) });

  // ---------- Risk ----------
  const rk = (o) => ({ process: "Production", historyJson: history("Risk identified"), dateIdentified: day(-50), ...o });
  await prisma.risk.createMany({ data: [
    rk({ riskNo: "DEMO-RISK-001", title: "Porositas las berulang pada flange", category: "Quality", department: "Production", description: "Kebocoran gas pelindung dan kebersihan material.", potentialImpact: "Reject pelanggan & biaya rework", likelihood: 4, severity: 4, riskScore: 16, riskLevel: "High", treatment: "Mitigate", mitigationAction: "Checklist kebocoran gas harian", status: "Open", isoClause: "6.1", targetDate: day(25) }),
    rk({ riskNo: "DEMO-RISK-002", title: "Keterlambatan kalibrasi alat ukur", category: "Compliance", department: "Quality Assurance", description: "Jadwal kalibrasi tidak dipantau.", potentialImpact: "Hasil ukur tidak valid", likelihood: 3, severity: 3, riskScore: 9, riskLevel: "Medium", treatment: "Mitigate", mitigationAction: "Notifikasi otomatis 30 hari sebelum jatuh tempo", status: "In Treatment", isoClause: "7.1.5", targetDate: day(14) }),
    rk({ riskNo: "DEMO-RISK-003", title: "Ketergantungan pada satu supplier plat SS304", category: "Supply Chain", department: "Top Management", description: "Hanya satu supplier terkualifikasi.", potentialImpact: "Produksi berhenti bila pasokan terganggu", likelihood: 4, severity: 5, riskScore: 20, riskLevel: "Critical", treatment: "Mitigate", mitigationAction: "Kualifikasi supplier kedua (DEMO-SUP-003)", status: "Open", isoClause: "8.4", targetDate: day(45) }),
    rk({ riskNo: "DEMO-RISK-004", title: "Dokumen kerja usang di workshop", category: "Documentation", department: "Engineering", description: "Distribusi revisi dokumen manual.", potentialImpact: "Produk dibuat dengan gambar lama", likelihood: 2, severity: 2, riskScore: 4, riskLevel: "Low", treatment: "Accept", status: "Monitored", isoClause: "7.5.3" }),
  ] });

  // ---------- Training ----------
  const tr = (o) => ({ creatorId: "demo", lastUpdated: nowIso, ...o });
  await prisma.training.createMany({ data: [
    tr({ trainingNo: "DEMO-TRN-001", title: "Refresher Pengelasan TIG Stainless Steel", type: "Internal", category: "Technical", department: "Production", trainer: "Welding Engineer", plannedDate: day(-40), actualDate: day(-40), durationHours: 8, status: "Completed", isMandatory: true, isoClause: "7.2",
      participantsJson: JSON.stringify([
        { name: "Joko Santoso", department: "Production", result: "Pass", score: 85, certificateNo: "DEMO-CRT-0091", certificateExpiry: day(20) },
        { name: "Bayu Saputra", department: "Production", result: "Pass", score: 78, certificateNo: "DEMO-CRT-0092", certificateExpiry: day(325) },
      ]) }),
    tr({ trainingNo: "DEMO-TRN-002", title: "Internal Auditor ISO 9001:2015", type: "External", category: "Quality", department: "Quality Assurance", trainer: "Lembaga Pelatihan Mutu (contoh)", plannedDate: day(15), durationHours: 16, status: "Planned", isMandatory: false, isoClause: "9.2" }),
    tr({ trainingNo: "DEMO-TRN-003", title: "K3 Dasar & Penggunaan APD", type: "Internal", category: "Safety", department: "All Departments", trainer: "HSE Officer", plannedDate: day(-3), durationHours: 4, status: "Planned", isMandatory: true, isoClause: "7.2" }),
  ] });

  // ---------- Audit ----------
  await prisma.audit.create({ data: { auditNo: "DEMO-AUD-001", department: "Production", plannedDate: day(-35), actualDate: day(-33), leadAuditor: "Hendra Saputra", leadAuditorId: "demo", status: "Completed", auditType: "Internal", findingsCount: 2, ofiCount: 0,
    findings: { create: [
      { description: "Pressure gauge lewat jadwal kalibrasi masih dipakai.", requirement: "ISO 9001 7.1.5", type: "NC", status: "Open", correctiveAction: "Lihat DEMO-NC-003" },
      { description: "Label HOLD tidak dipasang pada 2 pallet produk reject.", requirement: "ISO 9001 8.7", type: "NC", status: "Closed" },
    ] } } });
  await prisma.audit.create({ data: { auditNo: "DEMO-AUD-002", department: "Quality Assurance", plannedDate: day(12), leadAuditor: "Rina Wulandari", leadAuditorId: "demo", status: "Planned", auditType: "Internal" } });
  await prisma.audit.create({ data: { auditNo: "DEMO-AUD-003", department: "Engineering", plannedDate: day(-2), actualDate: day(-2), leadAuditor: "Hendra Saputra", leadAuditorId: "demo", status: "In Progress", auditType: "Internal", findingsCount: 1, ofiCount: 1 } });

  // ---------- Document Control ----------
  const doc = (o) => ({ revision: 1, uploaderName: "Demo Data", origin: "Internal", lastUpdated: day(-30), historyJson: history("Document published"), ...o });
  await prisma.document.createMany({ data: [
    doc({ docNumber: "DEMO-SOP-QA-001", title: "Pengendalian Produk Tidak Sesuai", type: "SOP", status: "Published", department: "Quality Assurance", effectiveDate: "2026-07-01", nextReviewDate: day(260), fileName: sopQa.url, fileSize: sopQa.size, approverName: "QA Manager", approvedDate: "2026-06-28" }),
    doc({ docNumber: "DEMO-WI-PRD-002", title: "Instruksi Kerja Pengelasan TIG Flange SS304", type: "Work Instruction", status: "Published", department: "Production", effectiveDate: "2026-08-15", nextReviewDate: day(300), fileName: wiPrd.url, fileSize: wiPrd.size, approverName: "Production Manager", approvedDate: "2026-08-12" }),
    doc({ docNumber: "DEMO-SOP-HR-003", title: "Penilaian Kompetensi Karyawan", type: "SOP", status: "Published", department: "HR & Admin", effectiveDate: "2026-03-01", nextReviewDate: day(-15), fileName: sopHr.url, fileSize: sopHr.size, isRestricted: true, approverName: "HR Manager", approvedDate: "2026-02-25" }),
    doc({ docNumber: "DEMO-FRM-QA-004", title: "Checklist Inspeksi Final Flange", type: "Form", revision: 0, status: "Draft", department: "Quality Assurance", lastUpdated: day(-3), historyJson: history("Draft created") }),
  ] });

  // ---------- Supplier ----------
  const sp = (o) => ({ createdAt: nowIso, createdBy: "Demo Data", ...o });
  await prisma.supplier.createMany({ data: [
    sp({ supplierNo: "DEMO-SUP-001", name: "CV Baja Prima Mandiri", category: "Raw Material", productsSupplied: "Plat & pipa SS304", status: "Active", qualificationStatus: "Approved", isCritical: true, ncCount: 1, approvedDate: day(-400), nextEvaluationDate: day(40) }),
    sp({ supplierNo: "DEMO-SUP-002", name: "PT Gas Industri Sejahtera", category: "Consumable", productsSupplied: "Gas argon & CO2", status: "Conditional", qualificationStatus: "Conditional Approval", isCritical: false, ncCount: 2, nextEvaluationDate: day(10), notes: "Dua kali keterlambatan pengiriman tabung." }),
    sp({ supplierNo: "DEMO-SUP-003", name: "PT Logam Utama Nusantara", category: "Raw Material", productsSupplied: "Plat SS304 (kandidat supplier kedua)", status: "Active", qualificationStatus: "Pending", isCritical: false }),
  ] });

  // ---------- HSE ----------
  await prisma.incident.createMany({ data: [
    { id: "DEMO-INC-001", date: day(-4), time: "10:20", location: "Line Welding 2", type: "Near Miss", description: "Tabung argon hampir terjatuh karena rantai pengaman tidak terpasang.", severity: "Minor", status: "Open", actionsJson: "[]" },
    { id: "DEMO-INC-002", date: day(-9), time: "14:05", location: "Gudang Bahan Baku", type: "Accident", description: "Operator forklift terluka ringan di tangan saat memindahkan palet.", severity: "Major", status: "Investigating", actionsJson: JSON.stringify([{ description: "Investigasi & refresh training forklift" }]) },
  ] });

  // ---------- MOC ----------
  await prisma.moc.createMany({ data: [
    { id: "DEMO-MOC-001", title: "Ganti supplier gas argon", description: "Evaluasi pemindahan ke supplier gas kedua karena keterlambatan berulang.", category: "Material", requester: "Purchasing", department: "Production", dateRequested: day(-7), status: "Requested", riskLevel: "Medium" },
    { id: "DEMO-MOC-002", title: "Tambah cek kebocoran gas di checklist harian", description: "Revisi DEMO-WI-PRD-002 untuk mencegah porositas las.", category: "Process", requester: "QA Manager", department: "Production", dateRequested: day(-12), status: "Approved", riskLevel: "Low", assessment: "Risiko rendah, menambah 5 menit per shift." },
  ] });

  // ---------- Production (PPC) ----------
  await prisma.workOrder.createMany({ data: [
    { id: "DEMO-WO-001", productName: "Flange SS304 DN50", targetQuantity: 300, actualQuantity: 180, startDate: day(-5), endDate: day(3), status: "In Progress", operator: "Joko Santoso", machineId: "WLD-02", notes: "Termasuk rework lot 2610-03.", qcRequested: true },
    { id: "DEMO-WO-002", productName: "Shaft S45C Ø25", targetQuantity: 200, startDate: day(4), endDate: day(9), status: "Scheduled", operator: "Bayu Saputra", machineId: "CNC-01", notes: "Pengganti lot yang dikomplain (DEMO-CC-001)." },
    { id: "DEMO-WO-003", productName: "Bracket Mounting MS", targetQuantity: 500, actualQuantity: 120, startDate: day(-10), endDate: day(-1), status: "On Hold", operator: "Andi Wijaya", machineId: "PRS-03", notes: "Menunggu material dari DEMO-SUP-001." },
  ] });

  // ---------- Maintenance ----------
  await prisma.asset.create({ data: { id: "DEMO-AST-001", assetName: "CNC Lathe Line 2", serialNumber: "DEMO-AST-001", category: "Machine", location: "Machining Area", status: "Active",
    records: { create: [
      { id: "DEMO-MT-001", type: "Preventive", date: day(-4), description: "Ganti oli spindle & cek backlash sumbu X.", performedBy: "Maintenance Team", status: "Scheduled" },
      { id: "DEMO-MT-002", type: "Corrective", date: day(-18), description: "Perbaikan encoder sumbu Z (penyebab diameter shaft melenceng).", performedBy: "Vendor Service", status: "Completed", downtimeHours: 6, cost: 4500000 },
    ] } } });

  // ---------- Welding ----------
  await prisma.welder.createMany({ data: [
    { stampNumber: "DEMO-W-001", name: "Joko Santoso", processType: "GTAW", position: "6G", expiryDate: day(200), status: "Active" },
    { stampNumber: "DEMO-W-002", name: "Bayu Saputra", processType: "GTAW", position: "3G", expiryDate: day(25), status: "Active", notes: "Sertifikat akan habis, jadwalkan uji ulang." },
  ] });

  console.log("Data demo berhasil dibuat (awalan DEMO-, file di storage folder demo/).");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
