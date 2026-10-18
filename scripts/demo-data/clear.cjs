/**
 * Hapus SEMUA data demo: record bernomor/ber-id "DEMO-…" di setiap modul dan
 * file di storage folder "demo/". Data lain tidak disentuh.
 * Jalankan: node scripts/demo-data/clear.cjs
 */
const { prisma, supabase, BUCKET, PREFIX, STORAGE_DIR } = require("./common.cjs");

async function clearDemo({ quiet = false } = {}) {
  const starts = { startsWith: PREFIX };
  // Urutan: tabel anak dulu (relasi cascade tetap aman).
  const results = {
    ncr: await prisma.nCR.deleteMany({ where: { ncNumber: starts } }),
    complaint: await prisma.complaint.deleteMany({ where: { complaintNo: starts } }),
    equipment: await prisma.equipment.deleteMany({ where: { serialNumber: starts } }), // + CalibrationRecord (cascade)
    risk: await prisma.risk.deleteMany({ where: { riskNo: starts } }),
    training: await prisma.training.deleteMany({ where: { trainingNo: starts } }),
    audit: await prisma.audit.deleteMany({ where: { auditNo: starts } }), // + AuditFinding (cascade)
    document: await prisma.document.deleteMany({ where: { docNumber: starts } }),
    supplier: await prisma.supplier.deleteMany({ where: { supplierNo: starts } }),
    incident: await prisma.incident.deleteMany({ where: { id: starts } }),
    moc: await prisma.moc.deleteMany({ where: { id: starts } }),
    workOrder: await prisma.workOrder.deleteMany({ where: { id: starts } }),
    asset: await prisma.asset.deleteMany({ where: { serialNumber: starts } }), // + MaintenanceRecord (cascade)
    welder: await prisma.welder.deleteMany({ where: { stampNumber: starts } }),
  };

  const { data: files } = await supabase.storage.from(BUCKET).list(STORAGE_DIR, { limit: 1000 });
  const paths = (files || []).map(f => `${STORAGE_DIR}/${f.name}`);
  if (paths.length) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw new Error(`Gagal hapus file demo: ${error.message}`);
  }

  if (!quiet) {
    const summary = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.count]));
    console.log("Data demo dihapus:", JSON.stringify(summary), `| file: ${paths.length}`);
  }
}

module.exports = { clearDemo };

if (require.main === module) {
  clearDemo()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
