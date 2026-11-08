/**
 * Data demo 3 modul Labtech (PT Labtech Penta International — produsen trainer pendidikan vokasi, Batam):
 * produk trainer, customer TVET, dan satu skenario per tahap alur
 *   Sales Order → produksi → pelunasan → shipment → instalasi & training → BAST → garansi → tiket CS.
 * Juga role Contract & Shipping Admin / Training Coordinator dan akun demonya.
 *
 * AMAN dijalankan berulang: semua record pakai id "DEMO-LT-…" dan di-upsert; data lain (termasuk data
 * test user) tidak dihapus. Produk demo lama (alat laboratorium, id DEMO-PRD-LPI-…) hanya dinonaktifkan.
 *
 *   node scripts/demo-data/seed-labtech.cjs
 */
const bcrypt = require("bcryptjs");
const { prisma } = require("./common.cjs");

const P = "DEMO-LT-";
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; };
const iso = (n, h = 0) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(d.getHours() + h); return d.toISOString(); };
const hist = (...actions) => JSON.stringify(actions.map(([daysAgo, by, action], i) => ({ id: String(i + 1), date: iso(-daysAgo), userName: by, action })));
const ym = day(0).slice(0, 7).replace("-", "/");
const no = (kind, seq) => `LPI/${kind}/${ym}/${String(seq).padStart(4, "0")}`;
const TAX = 11;

const SALES = "Rina Kartika";
const MGR = "Hendra Wijaya";
const FIN = "Sari Lestari";
const SHIP = "Rudi Hartono";
const TRAIN = "Yusuf Maulana";

// ---------- Role & akun ----------
const ROLES = [
  { name: "Sales Manager", permissions: ["dashboard", "document", "complaint", "sales", "sales_manage", "sales_approve"] },
  { name: "Contract & Shipping Admin", permissions: ["contract_shipping", "document"] },
  { name: "Training Coordinator", permissions: ["customer_service", "complaint", "document"] },
];
const USERS = [
  { email: "shipping@qms.com", password: "shipping123", name: SHIP, role: "Contract & Shipping Admin", department: "Logistics & Export" },
  { email: "training@qms.com", password: "training123", name: TRAIN, role: "Training Coordinator", department: "Training & Customer Service" },
];

// ---------- Produk trainer ----------
const PRODUCTS = [
  { sku: "LT-HVAC-110", name: "Trainer Sistem Refrigerasi Dasar", category: "HVAC & Refrigerasi", model: "RT-110", price: 168000000, leadTimeWeeks: 10, specs: "Kompresor hermetik 1/2 HP R134a; kondensor & evaporator transparan; 12 titik ukur tekanan/suhu; 20 skenario gangguan (fault insertion); modul jobsheet." },
  { sku: "LT-HVAC-220", name: "Trainer AC Split Inverter", category: "HVAC & Refrigerasi", model: "AC-220i", price: 214000000, leadTimeWeeks: 10, specs: "Unit indoor/outdoor inverter 1 PK R32; panel kontrol PCB terbuka; simulasi 16 gangguan; vacuum & recovery station." },
  { sku: "LT-HVAC-350", name: "Trainer Chiller & Cooling Tower", category: "HVAC & Refrigerasi", model: "CH-350", price: 645000000, leadTimeWeeks: 14, warrantyMonths: 24, specs: "Chiller air-cooled 3 TR; cooling tower mini; BMS panel; data logger 16 kanal; software monitoring." },
  { sku: "LT-AUT-410", name: "Trainer Engine Bensin EFI", category: "Otomotif", model: "EG-410", price: 189000000, leadTimeWeeks: 10, specs: "Engine 4 silinder 1.300 cc EFI dengan stand; panel diagnostik OBD-II; 24 simulasi gangguan sensor/aktuator." },
  { sku: "LT-AUT-520", name: "Trainer Sistem Kelistrikan Kendaraan", category: "Otomotif", model: "EL-520", price: 96000000, leadTimeWeeks: 8, specs: "Sistem starter, pengisian, penerangan, wiper; panel ukur; 18 fault switch." },
  { sku: "LT-ELC-610", name: "Trainer Instalasi Listrik Bangunan", category: "Listrik & Tenaga", model: "IL-610", price: 74500000, leadTimeWeeks: 8, specs: "Panel kerja 2 sisi; MCB/RCBO/kontaktor; modul penerangan & tenaga; meter digital." },
  { sku: "LT-ELC-640", name: "Trainer PLC & Otomasi Industri", category: "Mekatronika & PLC", model: "PLC-640", price: 132000000, leadTimeWeeks: 8, specs: "PLC 24 I/O + HMI 7\"; modul konveyor mini, pneumatik, sensor; software pemrograman." },
  { sku: "LT-ELN-710", name: "Trainer Elektronika Dasar & Digital", category: "Elektronika", model: "ED-710", price: 38500000, leadTimeWeeks: 6, specs: "Catu daya variabel; function generator; 32 modul percobaan analog/digital." },
  { sku: "LT-REN-810", name: "Trainer Pembangkit Listrik Tenaga Surya", category: "Energi Terbarukan", model: "PV-810", price: 158000000, leadTimeWeeks: 10, specs: "Panel PV 4×300 Wp; inverter hybrid; baterai LiFePO4; simulator irradiasi; monitoring IoT." },
  { sku: "LT-BIO-910", name: "Trainer Perawatan Peralatan Biomedis", category: "Biomedis", model: "BM-910", price: 276000000, leadTimeWeeks: 12, specs: "Simulator pasien; modul ECG, infus pump, suction, sterilisator; 30 skenario troubleshooting." },
  { sku: "LT-SRV-001", name: "Jasa Instalasi, Commissioning & Training of Trainers", category: "Jasa", model: null, unit: "Paket", price: 18500000, leadTimeWeeks: null, warrantyMonths: 0, specs: "Instalasi & uji fungsi di lokasi; training guru/instruktur 3 hari (maks. 10 peserta); sertifikat peserta." },
  { sku: "LT-SRV-002", name: "Kontrak Service Tahunan Trainer (per unit)", category: "Jasa", model: null, unit: "Unit/Tahun", price: 7500000, leadTimeWeeks: null, warrantyMonths: 0, specs: "2× preventive maintenance per tahun; respon 2×24 jam; diskon 15% suku cadang." },
];
const prod = sku => PRODUCTS.find(p => p.sku === sku);
const prodId = sku => `${P}PRD-${sku}`;

// ---------- Customer ----------
const CUSTOMERS = [
  { key: "PTN", name: "Politeknik Teknologi Nusantara", type: "Politeknik", city: "Bandung", address: "Jl. Ciwaruga No. 18, Bandung Barat 40559", contactName: "Ir. Dedi Kurniadi, M.T.", contactTitle: "Ketua Jurusan Teknik Refrigerasi & Tata Udara", contactPhone: "0812-2001-5512", contactEmail: "dedi.k@ptn.ac.id", paymentTerms: "Sesuai kontrak (termin)" },
  { key: "SMK", name: "SMK Negeri 3 Kota Mandala", type: "SMK", city: "Semarang", address: "Jl. Sugiyopranoto No. 7, Semarang 50131", contactName: "Drs. Bambang Wiratno", contactTitle: "Kepala Sekolah", contactPhone: "0813-2554-8801", contactEmail: "smkn3@mandala.sch.id", paymentTerms: "Sesuai kontrak (termin)" },
  { key: "BLK", name: "Balai Latihan Kerja Industri Banten Raya", type: "Balai Latihan Kerja", city: "Serang", address: "Jl. Raya Cilegon Km 8, Serang, Banten 42183", contactName: "Agus Salim, S.T.", contactTitle: "Kepala Seksi Pelatihan", contactPhone: "0821-1120-7733", contactEmail: "pelatihan@blkibantenraya.go.id", paymentTerms: "30 hari" },
  { key: "ANC", name: "Al-Noor Technical College", type: "Lembaga Internasional", city: "Amman, Jordan", address: "Al-Madina Al-Munawara St. 214, Amman, Jordan", contactName: "Eng. Khaled Haddad", contactTitle: "Head of Workshops", contactPhone: "+962-6-555-0142", contactEmail: "k.haddad@alnoor-tc.edu.jo", paymentTerms: "L/C at sight" },
  { key: "UTM", name: "Fakultas Teknik Universitas Teknologi Maritim", type: "Universitas", city: "Surabaya", address: "Jl. Arief Rahman Hakim No. 100, Surabaya 60111", contactName: "Dr. Ir. Ratna Puspita", contactTitle: "Kepala Laboratorium Konversi Energi", contactPhone: "0811-3300-4021", contactEmail: "ratna.p@utm.ac.id", paymentTerms: "30 hari" },
];
const custId = k => `${P}CUS-${k}`;
const custByKey = k => CUSTOMERS.find(c => c.key === k);

function items(lines, key = "X") {
  return lines.map(([sku, qty], i) => {
    const p = prod(sku);
    return { id: `${P}SOI-${key}-${sku}-${i}`, productId: prodId(sku), description: p.model ? `${p.name} — Labtech ${p.model}` : `${p.name} — Labtech`, qty, unit: p.unit || "Unit", unitPrice: p.price, lineTotal: Math.round(p.price * qty), sortOrder: i + 1 };
  });
}
const totals = its => { const subtotal = its.reduce((s, i) => s + i.lineTotal, 0); const taxAmount = Math.round(subtotal * TAX / 100); return { subtotal, taxAmount, total: subtotal + taxAmount }; };

const SCHED_LC = [{ label: "Pembayaran 100% (L/C)", percent: 100, trigger: "L/C cair sebelum barang dikirim" }];
const SCHED_30 = [{ label: "DP 30%", percent: 30, trigger: "Setelah PO diterima" }, { label: "Pelunasan 70%", percent: 70, trigger: "Sebelum barang dikirim" }];
const REVIEW = ["Spesifikasi & jumlah pada PO sesuai penawaran", "Harga, diskon, dan termin pembayaran disetujui", "Jadwal produksi & pengiriman dapat dipenuhi", "Kebutuhan instalasi, utilitas, dan training guru/instruktur sudah jelas", "Persyaratan khusus (regulasi, kalibrasi, dokumen) teridentifikasi"]
  .map(item => ({ item, ok: true, reviewedBy: MGR, date: day(-40) }));

// Skenario per tahap (key, customer, item, termin, status SO, produksi, invoice terbayar per termin [fraksi])
const ORDERS = [
  { key: "A", cust: "UTM", seq: 901, lines: [["LT-REN-810", 2], ["LT-ELC-640", 2], ["LT-SRV-001", 1]], sched: SCHED_30, status: "Confirmed", prod: "In Production", prodStart: day(-12), prodTarget: day(30), paid: [1, null], orderDate: day(-20) },
  { key: "B", cust: "SMK", seq: 902, lines: [["LT-AUT-410", 2], ["LT-AUT-520", 3], ["LT-SRV-001", 1]], sched: SCHED_30, status: "Confirmed", prod: "Ready to Ship", prodStart: day(-60), prodTarget: day(-3), paid: [1, 0], orderDate: day(-75) },
  { key: "C", cust: "BLK", seq: 903, lines: [["LT-ELC-610", 4], ["LT-ELN-710", 6], ["LT-SRV-001", 1]], sched: SCHED_30, status: "In Delivery", prod: "Ready to Ship", prodStart: day(-70), prodTarget: day(-10), paid: [1, 1], orderDate: day(-85) },
  { key: "D", cust: "ANC", seq: 904, lines: [["LT-HVAC-110", 4], ["LT-HVAC-220", 2], ["LT-SRV-001", 1]], sched: SCHED_LC, status: "In Delivery", prod: "Ready to Ship", prodStart: day(-95), prodTarget: day(-35), paid: [1], orderDate: day(-110) },
  { key: "E", cust: "PTN", seq: 905, lines: [["LT-HVAC-110", 2], ["LT-HVAC-350", 1], ["LT-SRV-001", 1]], sched: SCHED_30, status: "Installed", prod: "Ready to Ship", prodStart: day(-200), prodTarget: day(-140), paid: [1, 1], orderDate: day(-220), bastNo: "BAST/PTN/2026/014", bastDate: day(-95), serials: { "LT-HVAC-110": "RT110-2603-0041, RT110-2603-0042", "LT-HVAC-350": "CH350-2602-0007" } },
];
const soId = k => `${P}SO-${k}`;

async function ensureRolesAndUsers() {
  const row = await prisma.kvStore.findUnique({ where: { key: "roles" } });
  const roles = row ? JSON.parse(row.value) : [];
  for (const r of ROLES) {
    const existing = roles.find(x => x.name === r.name);
    if (!existing) roles.push(r);
    else existing.permissions = [...new Set([...existing.permissions, ...r.permissions])];
  }
  await prisma.kvStore.upsert({ where: { key: "roles" }, update: { value: JSON.stringify(roles) }, create: { key: "roles", value: JSON.stringify(roles) } });
  for (const u of USERS) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { email: u.email, name: u.name, role: u.role, department: u.department, passwordHash: await bcrypt.hash(u.password, 10) } });
  }
}

async function seedLabtech() {
  await ensureRolesAndUsers();

  // Produk lama (alat laboratorium) dinonaktifkan, tidak dihapus.
  const off = await prisma.product.updateMany({ where: { id: { startsWith: "DEMO-PRD-LPI-" } }, data: { isActive: false } });
  for (const p of PRODUCTS) {
    const data = { sku: p.sku, name: p.name, category: p.category, brand: "Labtech", model: p.model, unit: p.unit || "Unit", price: p.price, availability: p.category === "Jasa" ? "Ready" : "Indent", leadTimeWeeks: p.leadTimeWeeks ?? null, warrantyMonths: p.warrantyMonths ?? 12, requiresCalibration: false, specs: p.specs, isActive: true };
    await prisma.product.upsert({ where: { id: prodId(p.sku) }, update: data, create: { id: prodId(p.sku), ...data, createdAt: day(-400) } });
  }

  for (const [i, c] of CUSTOMERS.entries()) {
    const { key, ...data } = c;
    await prisma.customer.upsert({ where: { id: custId(key) }, update: data, create: { id: custId(key), customerNo: `CUS-LT-${String(i + 1).padStart(3, "0")}`, ...data, createdAt: day(-300), historyJson: hist([300, SALES, "Customer didaftarkan"]) } });
  }

  // Opportunity tender + penawaran menunggu persetujuan diskon
  const opps = [
    { id: `${P}OPP-1`, opportunityNo: "OPP-LT-001", title: "Pengadaan trainer HVAC & otomotif — revitalisasi SMK", customerId: custId("SMK"), stage: "Qualified", source: "Tender LPSE", estimatedValue: 1850000000, probability: 25, expectedCloseDate: day(45), tenderNo: "LPSE-MDL-2026-0142", tenderDeadline: day(12) },
    { id: `${P}OPP-2`, opportunityNo: "OPP-LT-002", title: "Laboratorium energi terbarukan — tahap 2", customerId: custId("UTM"), stage: "Negotiation", source: "Repeat Order", estimatedValue: 720000000, probability: 60, expectedCloseDate: day(20), tenderNo: null, tenderDeadline: null },
    { id: `${P}OPP-3`, opportunityNo: "OPP-LT-003", title: "Biomedical technician training lab", customerId: custId("ANC"), stage: "Quotation", source: "Tender UN / Donor", estimatedValue: 1100000000, probability: 40, expectedCloseDate: day(60), tenderNo: "UNGM-RFP-26-8812", tenderDeadline: day(25) },
  ];
  for (const o of opps) {
    const data = { ...o, salesName: SALES, notes: null, lostReason: null };
    await prisma.opportunity.upsert({ where: { id: o.id }, update: data, create: { ...data, createdAt: day(-30), historyJson: hist([30, SALES, "Opportunity dibuat"]) } });
  }
  const qItems = items([["LT-BIO-910", 3], ["LT-SRV-001", 1]], "Q").map(it => ({ ...it, id: it.id.replace("SOI", "QI"), discountPercent: 0, specs: prod(it.productId.replace(`${P}PRD-`, "")).specs }));
  const qSub = qItems.reduce((s, i) => s + i.lineTotal, 0);
  const qDisc = 12;
  const qDiscAmt = Math.round(qSub * qDisc / 100);
  const qTax = Math.round((qSub - qDiscAmt) * TAX / 100);
  const qData = {
    quotationNo: no("QUO", 901), revision: 0, customerId: custId("ANC"), opportunityId: `${P}OPP-3`, date: day(-2), validUntil: day(28), status: "Waiting Approval",
    subject: "Penawaran Biomedical Technology Training Lab", attention: "Eng. Khaled Haddad", subtotal: qSub, discountPercent: qDisc, discountAmount: qDiscAmt, taxPercent: TAX, taxAmount: qTax, total: qSub - qDiscAmt + qTax,
    paymentTerms: "100% L/C at sight, dibayar sebelum pengiriman.", deliveryTerms: "CIF Aqaba Port. Produksi 12 minggu setelah L/C terbit.", warrantyTerms: "Garansi 12 bulan sejak BAST instalasi & training.",
    salesName: SALES, createdBy: SALES, createdAt: day(-2),
  };
  await prisma.quotation.upsert({ where: { id: `${P}QUO-1` }, update: qData, create: { id: `${P}QUO-1`, ...qData, historyJson: hist([2, SALES, "Penawaran dibuat"], [1, SALES, "Diajukan untuk persetujuan diskon"]) } });
  await prisma.quotationItem.deleteMany({ where: { quotationId: `${P}QUO-1` } });
  await prisma.quotationItem.createMany({ data: qItems.map(({ id, ...it }) => ({ id, quotationId: `${P}QUO-1`, ...it })) });

  // Sales order + invoice + pembayaran
  for (const o of ORDERS) {
    const its = items(o.lines, o.key);
    const t = totals(its);
    const c = custByKey(o.cust);
    const data = {
      soNo: no("SO", o.seq), customerId: custId(o.cust), customerPoNo: `PO/${o.cust}/2026/${o.seq}`, customerPoDate: o.orderDate, orderDate: o.orderDate, status: o.status,
      contractReviewJson: JSON.stringify(REVIEW), deliveryAddress: c.address, expectedDelivery: o.prodTarget, ...t, paymentScheduleJson: JSON.stringify(o.sched), salesName: SALES,
      productionStatus: o.prod, productionStart: o.prodStart, productionTarget: o.prodTarget, productionNotes: o.prod === "In Production" ? "Perakitan panel PV & HMI berjalan; QC dijadwalkan minggu depan." : null,
      bastNo: o.bastNo ?? null, bastDate: o.bastDate ?? null, installationDate: o.bastDate ?? null,
    };
    await prisma.salesOrder.upsert({ where: { id: soId(o.key) }, update: data, create: { id: soId(o.key), ...data, createdAt: o.orderDate, historyJson: hist([40, SALES, `Dibuat dari PO ${data.customerPoNo}`], [38, MGR, "Status: Contract Review → Confirmed"]) } });
    await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: soId(o.key) } });
    await prisma.salesOrderItem.createMany({ data: its.map(it => ({ ...it, salesOrderId: soId(o.key), serialNumbers: o.serials?.[it.productId.replace(`${P}PRD-`, "")] ?? null })) });

    for (const [ti, term] of o.sched.entries()) {
      const frac = o.paid[ti];
      if (frac === null || frac === undefined) continue;
      const invId = `${P}INV-${o.key}-${ti}`;
      const subtotal = Math.round(t.subtotal * term.percent / 100);
      const taxAmount = Math.round(subtotal * TAX / 100);
      const total = subtotal + taxAmount;
      const paidAmount = Math.round(total * frac);
      const invDate = ti === 0 ? day(-35) : day(-8);
      const inv = { invoiceNo: no("INV", o.seq * 10 + ti - 8000), customerId: custId(o.cust), salesOrderId: soId(o.key), termLabel: term.label, termPercent: term.percent, invoiceDate: invDate, dueDate: ti === 0 ? day(-5) : day(22), subtotal, taxAmount, total, paidAmount, status: frac >= 1 ? "Paid" : frac > 0 ? "Partial" : "Unpaid" };
      await prisma.invoice.upsert({ where: { id: invId }, update: inv, create: { id: invId, ...inv, createdAt: invDate, historyJson: hist([35, FIN, `Invoice ${term.label}`]) } });
      await prisma.payment.deleteMany({ where: { invoiceId: invId } });
      if (paidAmount > 0) {
        await prisma.payment.create({ data: { id: `${P}PAY-${o.key}-${ti}`, invoiceId: invId, paymentDate: day(ti === 0 ? -30 : -4), amount: paidAmount, method: o.sched === SCHED_LC ? "L/C" : "Transfer", reference: o.sched === SCHED_LC ? "L/C No. ARB-LC-26-00419 (Arab Bank)" : `TRF-${o.cust}-${ti + 1}`, receivedBy: FIN, createdAt: day(-4), receiptNo: no("KWT", o.seq * 10 + ti - 8000) } });
      }
    }
  }

  // Shipment
  const crates = (rows) => JSON.stringify(rows.map(([crateNo, contents, dims, grossKg, netKg]) => ({ crateNo, contents, dims, grossKg, netKg })));
  const docs = (names, doneCount) => JSON.stringify(names.map((name, i) => ({ name, done: i < doneCount })));
  const DOM = ["Packing List", "Surat Jalan / Delivery Order", "Foto peti & label kiriman"];
  const EXP = [...DOM, "Commercial Invoice", "Certificate of Origin (COO)", "PEB (Pemberitahuan Ekspor Barang)", "Bill of Lading / Air Waybill", "Polis asuransi kargo"];
  const SHIPMENTS = [
    { id: `${P}SHP-B`, shipmentNo: no("SHP", 901), so: "B", cust: "SMK", scope: "Domestik", incoterm: "Franco", mode: "Laut", forwarder: "PT Samudera Logistik Nusantara", destination: custByKey("SMK").address, etd: day(5), eta: day(9), status: "Draft",
      packagesJson: crates([["C-01", "2 Unit Trainer Engine Bensin EFI", "180×120×150", 640, 560], ["C-02", "3 Unit Trainer Kelistrikan Kendaraan", "150×100×120", 390, 330]]), docsJson: docs(DOM, 1),
      exceptionStatus: "Waiting Approval", exceptionReason: "Sekolah negeri: pelunasan 70% cair dari APBD setelah barang diterima (sesuai SPK). Surat jaminan Kepala Dinas sudah ada.", exceptionRequestedBy: SHIP,
      history: [[3, SHIP, "Shipment dibuat"], [1, SHIP, "Minta izin kirim sebelum lunas"]] },
    { id: `${P}SHP-C`, shipmentNo: no("SHP", 902), so: "C", cust: "BLK", scope: "Domestik", incoterm: "Franco", mode: "Laut", forwarder: "PT Samudera Logistik Nusantara", destination: custByKey("BLK").address, etd: day(-3), eta: day(2), awbNo: "SLN-BTM-CLG-26-1187", vessel: "KM Kendhaga Nusantara 7", status: "Shipped", shippedAt: day(-3),
      packagesJson: crates([["C-01", "4 Unit Trainer Instalasi Listrik Bangunan", "200×120×110", 520, 440], ["C-02", "6 Unit Trainer Elektronika Dasar & Digital", "120×80×90", 210, 170]]), docsJson: docs(DOM, 3),
      history: [[10, SHIP, "Shipment dibuat"], [5, SHIP, "Dirilis untuk dikirim (order lunas)"], [3, SHIP, "Dikirim"]] },
    { id: `${P}SHP-D`, shipmentNo: no("SHP", 903), so: "D", cust: "ANC", scope: "Ekspor", incoterm: "CIF", mode: "Laut", forwarder: "Batam Global Freight", origin: "Batam (Batu Ampar)", destination: "Aqaba Port, Jordan → Amman", etd: day(-32), eta: day(-6), awbNo: "BGF-BTH-AQJ-0326-551", vessel: "MSC Leandra / via Port Klang", containerNo: "MSCU 724119-3 (20' GP)", status: "Arrived", shippedAt: day(-32), arrivedAt: day(-4), receivedBy: "Eng. Khaled Haddad",
      packagesJson: crates([["C-01", "2 Unit Trainer Sistem Refrigerasi Dasar", "160×90×170", 420, 360], ["C-02", "2 Unit Trainer Sistem Refrigerasi Dasar", "160×90×170", 420, 360], ["C-03", "2 Unit Trainer AC Split Inverter", "180×100×170", 510, 440]]), docsJson: docs(EXP, 8),
      history: [[40, SHIP, "Shipment dibuat"], [33, SHIP, "Dirilis untuk dikirim (order lunas)"], [32, SHIP, "Dikirim"], [4, SHIP, "Tiba di client, diterima Eng. Khaled Haddad"]] },
    { id: `${P}SHP-E`, shipmentNo: no("SHP", 904), so: "E", cust: "PTN", scope: "Domestik", incoterm: "Franco", mode: "Darat", forwarder: "PT Trans Jawa Cargo", destination: custByKey("PTN").address, etd: day(-120), eta: day(-112), awbNo: "TJC-26-04419", status: "Arrived", shippedAt: day(-120), arrivedAt: day(-111), receivedBy: "Ir. Dedi Kurniadi, M.T.",
      packagesJson: crates([["C-01", "2 Unit Trainer Sistem Refrigerasi Dasar", "160×90×170", 420, 360], ["C-02", "1 Unit Trainer Chiller & Cooling Tower", "240×160×190", 1150, 980]]), docsJson: docs(DOM, 3),
      history: [[125, SHIP, "Shipment dibuat"], [120, SHIP, "Dikirim"], [111, SHIP, "Tiba di client"]] },
  ];
  for (const s of SHIPMENTS) {
    const { id, so, cust, history, ...rest } = s;
    const data = { ...rest, salesOrderId: soId(so), customerId: custId(cust), origin: rest.origin ?? "Batam", createdBy: SHIP };
    await prisma.salesShipment.upsert({ where: { id }, update: data, create: { id, ...data, createdAt: day(-history[0][0]), historyJson: hist(...history) } });
  }

  // Instalasi & training
  const PEOPLE_E = [
    { name: "Ir. Dedi Kurniadi, M.T.", title: "Ketua Jurusan", attended: true, pre: 62, post: 88 },
    { name: "Wahyu Prasetya, S.T., M.Eng.", title: "Dosen", attended: true, pre: 55, post: 85 },
    { name: "Nia Rahmawati, S.Tr.T.", title: "Teknisi Laboratorium", attended: true, pre: 48, post: 82 },
    { name: "Fajar Nugraha, A.Md.", title: "Teknisi Laboratorium", attended: true, pre: 51, post: 79 },
    { name: "Hendri Saputra, S.T.", title: "Dosen", attended: false, pre: null, post: null },
  ];
  const checklistFor = (k, done) => items(ORDERS.find(o => o.key === k).lines, k).filter(it => !/^Jasa/.test(it.description)).flatMap(it => {
    const serials = (ORDERS.find(o => o.key === k).serials?.[it.productId.replace(`${P}PRD-`, "")] ?? "").split(",").map(x => x.trim());
    return Array.from({ length: it.qty }, (_, i) => ({ itemId: it.id, item: it.description, serial: done ? serials[i] ?? "" : "", installed: done, tested: done }));
  });
  const JOBS = [
    { id: `${P}SVC-D`, jobNo: no("SVC", 901), so: "D", cust: "ANC", shipmentId: `${P}SHP-D`, type: "Instalasi & Training", mode: "Onsite", location: "Al-Noor Technical College — HVAC Workshop, Amman", startDate: day(9), endDate: day(13), technicians: "Joko Santoso, Rizal Effendi", trainerName: TRAIN, topics: "Refrigeration cycle & fault diagnosis; inverter AC PCB troubleshooting; lesson plan & jobsheet development (ToT)", status: "Waiting Approval", checklistJson: JSON.stringify(checklistFor("D", false)), participantsJson: "[]",
      history: [[4, SHIP, "Dibuat otomatis: barang tiba di client"], [1, TRAIN, "Jadwal diajukan untuk persetujuan"]] },
    { id: `${P}SVC-E`, jobNo: no("SVC", 902), so: "E", cust: "PTN", shipmentId: `${P}SHP-E`, type: "Instalasi & Training", mode: "Onsite", location: custByKey("PTN").address, startDate: day(-99), endDate: day(-95), technicians: "Joko Santoso", trainerName: TRAIN, topics: "Pengoperasian trainer refrigerasi & chiller; troubleshooting kelistrikan kompresor; penyusunan jobsheet praktikum", status: "Completed", checklistJson: JSON.stringify(checklistFor("E", true)), participantsJson: JSON.stringify(PEOPLE_E),
      feedbackScore: 5, feedbackNote: "Materi aplikatif, langsung bisa dipakai untuk praktikum semester ini.", bastNo: "BAST/PTN/2026/014", bastDate: day(-95), approvedBy: MGR, approvedAt: day(-105),
      history: [[111, SHIP, "Dibuat otomatis: barang tiba di client"], [106, TRAIN, "Jadwal diajukan"], [105, MGR, "Jadwal disetujui"], [99, TRAIN, "Pekerjaan di lokasi dimulai"], [95, TRAIN, "Selesai — BAST BAST/PTN/2026/014"]] },
    { id: `${P}SVC-T`, jobNo: no("SVC", 903), so: null, cust: "BLK", shipmentId: null, type: "Training", mode: "Di Labtech Batam", location: "Labtech Training Center, Batam", startDate: day(18), endDate: day(19), technicians: null, trainerName: "Andi Firmansyah", topics: "Training lanjutan PLC untuk instruktur BLK (sebelum barang tiba)", status: "Draft", checklistJson: "[]", participantsJson: JSON.stringify([{ name: "Agus Salim, S.T.", title: "Kepala Seksi Pelatihan", attended: true, pre: null, post: null }]),
      history: [[2, TRAIN, "Job dibuat"]] },
  ];
  for (const j of JOBS) {
    const { id, so, cust, history, ...rest } = j;
    const data = { ...rest, salesOrderId: so ? soId(so) : null, customerId: custId(cust), createdBy: TRAIN };
    await prisma.serviceJob.upsert({ where: { id }, update: data, create: { id, ...data, createdAt: day(-history[0][0]), historyJson: hist(...history) } });
  }

  // Kontrak garansi dari BAST order E
  const eItems = items(ORDERS.find(o => o.key === "E").lines, "E").filter(it => !/^Jasa/.test(it.description));
  const covered = eItems.map(it => ({ product: it.description, serialNumber: ORDERS.find(o => o.key === "E").serials[it.productId.replace(`${P}PRD-`, "")] }));
  const wEnd = (() => { const d = new Date(day(-95)); d.setMonth(d.getMonth() + 24); return d.toISOString().split("T")[0]; })();
  const wData = { contractNo: no("CTR", 901), customerId: custId("PTN"), salesOrderId: soId("E"), type: "Garansi", title: `Garansi ${no("SO", 905)}`, startDate: day(-95), endDate: wEnd, value: 0, status: "Active", coveredItemsJson: JSON.stringify(covered) };
  await prisma.contract.upsert({ where: { id: `${P}CTR-E` }, update: wData, create: { id: `${P}CTR-E`, ...wData, createdAt: day(-95), historyJson: hist([95, TRAIN, "Dibuat otomatis dari BAST BAST/PTN/2026/014"]) } });

  // Tiket CS
  const TICKETS = [
    { id: `${P}TKT-1`, ticketNo: no("TKT", 901), cust: "PTN", category: "Klaim Garansi", priority: "High", channel: "WhatsApp", subject: "Kompresor trainer refrigerasi unit 2 tidak start", description: "Saat praktikum, kompresor unit RT-110 nomor 2 berdengung lalu overload trip. Sudah dicoba reset 2 kali. Praktikum minggu depan terganggu.", productName: eItems[0].description, serialNumber: "RT110-2603-0042", underWarranty: true, status: "Open", assignedTo: null, reportedBy: "Nia Rahmawati, S.Tr.T.", contactPhone: "0857-2210-3344", responseDueAt: iso(0, -6), createdAt: iso(-1, -6), history: [[1, TRAIN, "Tiket dibuat via WhatsApp"]] },
    { id: `${P}TKT-2`, ticketNo: no("TKT", 902), cust: "PTN", category: "Pertanyaan Teknis", priority: "Low", channel: "Email", subject: "Permintaan file jobsheet versi Word", description: "Mohon dikirimkan file jobsheet praktikum chiller dalam format Word agar bisa disesuaikan dengan RPS.", productName: eItems[1].description, serialNumber: "CH350-2602-0007", underWarranty: true, status: "Resolved", assignedTo: TRAIN, reportedBy: "Wahyu Prasetya, S.T., M.Eng.", contactPhone: null, responseDueAt: iso(-20), firstResponseAt: iso(-22), resolvedAt: iso(-21), resolution: "File jobsheet (Word) dan video panduan dikirim via email.", createdAt: iso(-23), history: [[23, TRAIN, "Tiket dibuat via Email"], [22, TRAIN, "Status: Open → In Progress"], [21, TRAIN, "Status: In Progress → Resolved · Penyelesaian: File jobsheet dikirim"]] },
  ];
  for (const t of TICKETS) {
    const { id, cust, history, ...rest } = t;
    const data = { ...rest, customerId: custId(cust), createdBy: TRAIN };
    await prisma.serviceTicket.upsert({ where: { id }, update: data, create: { id, ...data, historyJson: hist(...history) } });
  }

  console.log(`Data demo Labtech siap: ${PRODUCTS.length} produk, ${CUSTOMERS.length} customer, ${ORDERS.length} sales order, ${SHIPMENTS.length} shipment, ${JOBS.length} job, ${TICKETS.length} tiket. Produk lama dinonaktifkan: ${off.count}.`);
}

async function clearLabtech() {
  const starts = { id: { startsWith: P } };
  await prisma.serviceTicket.deleteMany({ where: starts });
  await prisma.serviceJob.deleteMany({ where: starts });
  await prisma.salesShipment.deleteMany({ where: starts });
}

module.exports = { seedLabtech, clearLabtech };

if (require.main === module) {
  seedLabtech()
    .catch(e => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
