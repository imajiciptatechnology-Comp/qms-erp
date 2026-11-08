/**
 * Data demo modul Sales & Marketing (PT Labtech Penta International — distributor
 * alat laboratorium, B2B): produk, customer, pipeline, penawaran (dengan revisi),
 * sales order dari PO customer, invoice per termin + pembayaran, dan kontrak.
 * Juga menambah role Sales / Sales Manager / Finance dan akun demonya.
 *
 * Semua id record berawalan "DEMO-"; nomor dokumen memakai format asli
 * (LPI/QUO/2026/11/0001) supaya tampil wajar di PDF.
 *
 *   node scripts/demo-data/seed-sales.cjs    (hapus data sales demo lama, lalu isi ulang)
 *   Juga dipanggil otomatis oleh seed.cjs; dihapus oleh clear.cjs.
 */
const bcrypt = require("bcryptjs");
const { prisma, PREFIX } = require("./common.cjs");

const day = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};
const nowIso = new Date().toISOString();
const history = (action, by = "Demo Data") => JSON.stringify([{ id: "1", date: nowIso, userName: by, action }]);
const docNo = (kind, date, seq) => `LPI/${kind}/${date.slice(0, 4)}/${date.slice(5, 7)}/${String(seq).padStart(4, "0")}`;
const round = n => Math.round(n);

const SALES_A = "Rina Kartika";
const SALES_B = "Dimas Prasetyo";
const SALES_MGR = "Hendra Wijaya";
const FINANCE = "Sari Lestari";
const TAX = 11;

// ---------- Role & akun demo ----------
const ROLES = [
  { name: "Sales", permissions: ["dashboard", "document", "sales", "sales_manage"] },
  { name: "Sales Manager", permissions: ["dashboard", "document", "complaint", "sales", "sales_manage", "sales_approve"] },
  { name: "Finance", permissions: ["dashboard", "sales", "finance"] },
];
const USERS = [
  { email: "sales@qms.com", password: "sales123", name: SALES_A, role: "Sales", department: "Sales & Marketing" },
  { email: "salesmanager@qms.com", password: "salesmgr123", name: SALES_MGR, role: "Sales Manager", department: "Sales & Marketing" },
  { email: "finance@qms.com", password: "finance123", name: FINANCE, role: "Finance", department: "Finance" },
];

async function ensureRolesAndUsers() {
  const row = await prisma.kvStore.findUnique({ where: { key: "roles" } });
  const roles = row ? JSON.parse(row.value) : [];
  // Role baru ditambahkan; role yang sudah ada hanya ditambah permission Sales yang belum dimiliki.
  for (const r of ROLES) {
    const existing = roles.find(x => x.name === r.name);
    if (!existing) roles.push(r);
    else existing.permissions = [...new Set([...existing.permissions, ...r.permissions])];
  }
  await prisma.kvStore.upsert({ where: { key: "roles" }, update: { value: JSON.stringify(roles) }, create: { key: "roles", value: JSON.stringify(roles) } });

  // Akun yang sudah ada tidak diubah (password mungkin sudah diganti pemiliknya).
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, role: u.role, department: u.department, passwordHash: await bcrypt.hash(u.password, 10) },
    });
  }
}

// ---------- Master produk ----------
const PRODUCTS = [
  { sku: "LPI-SPC-001", name: "Spektrofotometer UV-Vis Double Beam", category: "Spektroskopi", brand: "SpectraLine", model: "UV-2800", price: 185000000, availability: "Indent", leadTimeWeeks: 8, requiresCalibration: true, calibrationIntervalMonths: 12, specs: "Rentang 190–1100 nm; bandwidth 1,8 nm; akurasi panjang gelombang ±0,3 nm; software PC termasuk." },
  { sku: "LPI-SPC-002", name: "Spektrofotometer Visible", category: "Spektroskopi", brand: "SpectraLine", model: "VIS-720", price: 48500000, availability: "Ready", requiresCalibration: true, calibrationIntervalMonths: 12, specs: "Rentang 320–1100 nm; bandwidth 4 nm; layar LCD; output USB." },
  { sku: "LPI-CHR-001", name: "HPLC System Quaternary dengan Detektor PDA", category: "Kromatografi", brand: "ChromaTech", model: "LC-9000Q", price: 1250000000, availability: "Indent", leadTimeWeeks: 12, warrantyMonths: 24, requiresCalibration: true, calibrationIntervalMonths: 12, specs: "Pompa quaternary 0,001–10 mL/min; autosampler 120 vial; column oven 5–85 °C; detektor PDA 190–800 nm; software CDS 21 CFR Part 11." },
  { sku: "LPI-CEN-001", name: "Centrifuge Refrigerated Benchtop", category: "Centrifuge", brand: "CentriMax", model: "CR-16R", price: 142000000, availability: "Ready", requiresCalibration: true, calibrationIntervalMonths: 12, specs: "Maks 16.000 rpm (24.000 ×g); suhu -20 s/d 40 °C; rotor angle 24 × 1,5/2,0 mL." },
  { sku: "LPI-CEN-002", name: "Micro Centrifuge", category: "Centrifuge", brand: "CentriMax", model: "MC-15", price: 28500000, availability: "Ready", specs: "Maks 15.000 rpm; rotor 24 × 1,5/2,0 mL; timer 30 detik–99 menit." },
  { sku: "LPI-BAL-001", name: "Neraca Analitik 0,1 mg", category: "Neraca", brand: "PrecisaLab", model: "AB-220i", price: 38500000, availability: "Ready", requiresCalibration: true, calibrationIntervalMonths: 12, specs: "Kapasitas 220 g; keterbacaan 0,1 mg; kalibrasi internal otomatis; draft shield kaca." },
  { sku: "LPI-BAL-002", name: "Moisture Analyzer Halogen", category: "Neraca", brand: "PrecisaLab", model: "MA-110H", price: 64000000, availability: "Ready", requiresCalibration: true, calibrationIntervalMonths: 12, specs: "Kapasitas 110 g; keterbacaan 1 mg / 0,01 %; pemanas halogen 40–230 °C." },
  { sku: "LPI-PHM-001", name: "pH/Conductivity Meter Benchtop", category: "Elektrokimia", brand: "AquaSense", model: "PC-950", price: 21500000, availability: "Ready", requiresCalibration: true, calibrationIntervalMonths: 6, specs: "pH -2,000–20,000; konduktivitas 0–2000 mS/cm; kompensasi suhu otomatis; elektroda termasuk." },
  { sku: "LPI-PHM-002", name: "pH Meter Portable", category: "Elektrokimia", brand: "AquaSense", model: "P-30", price: 7800000, availability: "Ready", requiresCalibration: true, calibrationIntervalMonths: 6, specs: "pH 0–14; akurasi ±0,01 pH; tahan air IP67." },
  { sku: "LPI-BSC-001", name: "Biosafety Cabinet Class II A2", category: "Laminar & BSC", brand: "SafeAir", model: "BSC-1200A2", price: 168000000, availability: "Indent", leadTimeWeeks: 6, requiresCalibration: true, calibrationIntervalMonths: 12, specs: "Lebar kerja 1,2 m; filter HEPA/ULPA; inflow ≥0,5 m/s; lampu UV; sertifikasi EN 12469." },
  { sku: "LPI-FMH-001", name: "Fume Hood Ducted 1,5 m", category: "Laminar & BSC", brand: "SafeAir", model: "FH-1500D", price: 96000000, availability: "Indent", leadTimeWeeks: 8, specs: "Lebar 1,5 m; meja epoxy resin; airflow monitor digital; blower tahan bahan kimia (instalasi ducting terpisah)." },
  { sku: "LPI-AUT-001", name: "Autoklaf Vertikal 75 L", category: "Sterilisasi", brand: "SteriPro", model: "AV-75", price: 87500000, availability: "Ready", requiresCalibration: true, calibrationIntervalMonths: 12, specs: "Kapasitas 75 L; 121–134 °C; pengering vakum; printer data siklus." },
  { sku: "LPI-INC-001", name: "Inkubator Mikrobiologi 150 L", category: "Inkubator & Oven", brand: "ThermoLab", model: "IN-150", price: 46000000, availability: "Ready", requiresCalibration: true, calibrationIntervalMonths: 12, specs: "Kapasitas 150 L; suhu ambient +5 s/d 70 °C; keseragaman ±0,5 °C; pintu kaca dalam." },
  { sku: "LPI-OVN-001", name: "Oven Pengering Forced Air 100 L", category: "Inkubator & Oven", brand: "ThermoLab", model: "DO-100F", price: 39500000, availability: "Ready", requiresCalibration: true, calibrationIntervalMonths: 12, specs: "Kapasitas 100 L; suhu sampai 250 °C; sirkulasi udara paksa; timer digital." },
  { sku: "LPI-REF-001", name: "Lab Refrigerator 2–8 °C 400 L", category: "Penyimpanan Dingin", brand: "ColdChain", model: "LR-400", price: 58000000, availability: "Ready", requiresCalibration: true, calibrationIntervalMonths: 12, specs: "Kapasitas 400 L; 2–8 °C; alarm suhu & pintu; data logger USB." },
  { sku: "LPI-WTR-001", name: "Water Purification System Type I", category: "Pemurnian Air", brand: "PureFlow", model: "UP-20", price: 112000000, availability: "Indent", leadTimeWeeks: 6, specs: "Air Type I 18,2 MΩ·cm; TOC <5 ppb; 20 L/jam; tangki 30 L." },
  { sku: "LPI-MIC-001", name: "Mikroskop Binokuler LED", category: "Mikroskopi", brand: "OptiView", model: "BX-200", price: 18500000, availability: "Ready", specs: "Objektif 4×/10×/40×/100× (oil); iluminasi LED; stage mekanik." },
  { sku: "LPI-SRV-001", name: "Jasa Kalibrasi Alat Laboratorium (per alat)", category: "Jasa", brand: "Labtech Service", unit: "Alat", price: 2750000, availability: "Ready", warrantyMonths: 0, specs: "Kalibrasi on-site oleh teknisi bersertifikat; sertifikat tertelusur SI." },
  { sku: "LPI-SRV-002", name: "Kontrak Perawatan Tahunan (AMC) per Alat", category: "Jasa", brand: "Labtech Service", unit: "Alat/Tahun", price: 9500000, availability: "Ready", warrantyMonths: 0, specs: "2× preventive maintenance per tahun; prioritas respon 2×24 jam; diskon 15% suku cadang." },
  { sku: "LPI-SRV-003", name: "Instalasi, Commissioning & Training Operator", category: "Jasa", brand: "Labtech Service", unit: "Paket", price: 6500000, availability: "Ready", warrantyMonths: 0, specs: "Instalasi, IQ/OQ, dan training operator maks. 5 peserta di lokasi customer." },
];
const product = sku => PRODUCTS.find(p => p.sku === sku);

// ---------- Customer ----------
const CUSTOMERS = [
  { key: "UNR", name: "Fakultas Farmasi Universitas Nusantara Raya", type: "Universitas", city: "Yogyakarta", address: "Jl. Kaliurang Km 6,5, Sleman, DI Yogyakarta 55281", contactName: "Dr. apt. Laras Wulandari, M.Sc.", contactTitle: "Kepala Laboratorium Kimia Farmasi", contactPhone: "0812-2711-4405", contactEmail: "laras.w@unr.ac.id", npwp: "00.123.456.7-541.000", paymentTerms: "30 hari" },
  { key: "RSH", name: "RSUP Harapan Sehat", type: "Rumah Sakit", city: "Jakarta Timur", address: "Jl. Pemuda No. 88, Rawamangun, Jakarta Timur 13220", contactName: "dr. Bagus Hartono, Sp.PK", contactTitle: "Kepala Instalasi Laboratorium", contactPhone: "0813-1980-2216", contactEmail: "lab@rsupharapansehat.go.id", npwp: "00.234.567.8-002.000", paymentTerms: "45 hari" },
  { key: "FMI", name: "PT Farma Medika Indonesia", type: "Farmasi", city: "Bekasi", address: "Kawasan Industri Jababeka II Blok C-12, Cikarang, Bekasi 17530", contactName: "Yohana Siregar", contactTitle: "QC Manager", contactPhone: "0811-1903-5521", contactEmail: "yohana.siregar@farmamedika.co.id", npwp: "01.345.678.9-413.000", paymentTerms: "30 hari" },
  { key: "PSL", name: "PT Pangan Sejahtera Laboratorium", type: "Lab Pangan", city: "Surabaya", address: "Jl. Rungkut Industri III No. 21, Surabaya 60293", contactName: "Andreas Kurniawan", contactTitle: "Lab Supervisor", contactPhone: "0817-0321-7780", contactEmail: "andreas@panganlab.co.id", npwp: "02.456.789.0-615.000", paymentTerms: "30 hari" },
  { key: "BBP", name: "Balai Besar Pengujian Mutu Produk Industri", type: "Pemerintah", city: "Bandung", address: "Jl. Soekarno-Hatta No. 412, Bandung 40266", contactName: "Ir. Wahyu Setiadi, M.T.", contactTitle: "Pejabat Pembuat Komitmen", contactPhone: "0822-1450-3398", contactEmail: "ppk@bbpmutu.go.id", npwp: "00.567.890.1-441.000", paymentTerms: "Sesuai kontrak (termin)" },
  { key: "KPI", name: "PT Kimia Prima Industri", type: "Industri", city: "Cilegon", address: "Jl. Raya Anyer Km 121, Cilegon, Banten 42445", contactName: "Fajar Ramadhan", contactTitle: "Head of Laboratory", contactPhone: "0819-0612-4473", contactEmail: "fajar.r@kimiaprima.co.id", npwp: "01.678.901.2-417.000", paymentTerms: "30 hari" },
  { key: "LKD", name: "UPT Laboratorium Kesehatan Daerah Kota Mandala", type: "Pemerintah", city: "Semarang", address: "Jl. Pandanaran No. 79, Semarang 50241", contactName: "Siti Aminah, S.Si.", contactTitle: "Kepala UPT", contactPhone: "0856-4120-8834", contactEmail: "labkesda@mandalakota.go.id", npwp: "00.789.012.3-511.000", paymentTerms: "Sesuai kontrak (termin)" },
  { key: "UTB", name: "Program Studi Kimia Universitas Teknologi Bahari", type: "Universitas", city: "Makassar", address: "Jl. Perintis Kemerdekaan Km 10, Makassar 90245", contactName: "Prof. Arif Rahman, Ph.D.", contactTitle: "Ketua Program Studi", contactPhone: "0821-8833-1290", contactEmail: "kimia@utb.ac.id", npwp: "00.890.123.4-801.000", paymentTerms: "30 hari" },
];

// Gaya bahasa penawaran yang konsisten — nanti jadi contoh untuk AI.
const INTRO = (topic) => `Dengan hormat,\n\nBersama surat ini, PT Labtech Penta International sebagai distributor resmi peralatan laboratorium dengan pengalaman lebih dari 15 tahun, dengan senang hati mengajukan penawaran harga untuk ${topic} sesuai kebutuhan Bapak/Ibu. Rincian spesifikasi dan harga kami sampaikan sebagai berikut.`;
const CLOSING = "Harga sudah termasuk pengiriman sampai lokasi, instalasi, dan training operator, namun belum termasuk PPN. Kami siap melakukan presentasi teknis atau demo alat sesuai jadwal Bapak/Ibu.\n\nDemikian penawaran ini kami sampaikan. Atas perhatian dan kerja sama yang baik, kami ucapkan terima kasih.";
const TERMS = {
  payment: "DP 30% setelah PO diterima; 70% setelah BAST instalasi. Pembayaran 30 hari setelah invoice diterima.",
  paymentGov: "Sesuai kontrak: 100% setelah barang diterima dan BAST ditandatangani.",
  delivery: "Franco lokasi customer. Barang ready: 2–3 minggu; barang indent: 8–12 minggu setelah PO.",
  warranty: "Garansi 12 bulan suku cadang dan jasa sejak BAST, termasuk 1× kalibrasi gratis pada bulan ke-11.",
};

/** Hitung item & total dokumen dari daftar [sku, qty, diskon%]. */
function buildItems(lines) {
  return lines.map(([sku, qty, disc = 0], i) => {
    const p = product(sku);
    const lineTotal = round(qty * p.price * (1 - disc / 100));
    return { productId: `${PREFIX}PRD-${sku}`, description: p.model ? `${p.name} — ${p.brand} ${p.model}` : `${p.name} — ${p.brand}`, specs: p.specs, qty, unit: p.unit || "Unit", unitPrice: p.price, discountPercent: disc, lineTotal, sortOrder: i + 1 };
  });
}
function totals(items, discountPercent = 0) {
  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
  const discountAmount = round(subtotal * discountPercent / 100);
  const taxAmount = round((subtotal - discountAmount) * TAX / 100);
  return { subtotal, discountPercent, discountAmount, taxPercent: TAX, taxAmount, total: subtotal - discountAmount + taxAmount };
}

async function clearSales({ quiet = false } = {}) {
  const starts = { id: { startsWith: PREFIX } };
  // Anak dulu; item & pembayaran ikut terhapus lewat cascade.
  const results = {
    // Modul Labtech (Contract & Shipping, Training & CS) merujuk SO/customer — hapus lebih dulu.
    serviceTicket: await prisma.serviceTicket.deleteMany({ where: starts }),
    serviceJob: await prisma.serviceJob.deleteMany({ where: starts }),
    salesShipment: await prisma.salesShipment.deleteMany({ where: starts }),
    contract: await prisma.contract.deleteMany({ where: starts }),
    invoice: await prisma.invoice.deleteMany({ where: starts }),
    salesOrder: await prisma.salesOrder.deleteMany({ where: starts }),
    quotation: await prisma.quotation.deleteMany({ where: starts }),
    opportunity: await prisma.opportunity.deleteMany({ where: starts }),
    customer: await prisma.customer.deleteMany({ where: starts }),
    product: await prisma.product.deleteMany({ where: starts }),
  };
  if (!quiet) console.log("Data sales demo dihapus:", JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.count]))));
}

async function seedSales() {
  await clearSales({ quiet: true });
  await ensureRolesAndUsers();

  await prisma.product.createMany({ data: PRODUCTS.map(p => ({ id: `${PREFIX}PRD-${p.sku}`, unit: "Unit", warrantyMonths: 12, ...p, createdAt: day(-400) })) });

  const cust = {};
  for (const [i, c] of CUSTOMERS.entries()) {
    const { key, ...data } = c;
    cust[key] = `${PREFIX}CUS-${key}`;
    await prisma.customer.create({ data: { id: cust[key], customerNo: `CUS-${String(i + 1).padStart(4, "0")}`, ...data, createdAt: day(-420 + i * 30), historyJson: history("Customer didaftarkan") } });
  }

  // ---------- Pipeline ----------
  const opp = (n, data) => ({ id: `${PREFIX}OPP-${n}`, opportunityNo: `OPP-2026-${String(n).padStart(3, "0")}`, historyJson: history("Opportunity dibuat"), ...data });
  await prisma.opportunity.createMany({ data: [
    opp(1, { title: "Spektrofotometer UV-Vis untuk Lab Kimia Farmasi", customerId: cust.UNR, stage: "Won", source: "Referensi", estimatedValue: 400000000, probability: 100, expectedCloseDate: day(-100), salesName: SALES_A, createdAt: day(-150) }),
    opp(2, { title: "BSC & Centrifuge Instalasi Laboratorium Mikrobiologi", customerId: cust.RSH, stage: "Won", source: "Repeat Order", estimatedValue: 330000000, probability: 100, expectedCloseDate: day(-35), salesName: SALES_B, createdAt: day(-75) }),
    opp(3, { title: "HPLC untuk QC Release Produk", customerId: cust.FMI, stage: "Negotiation", source: "Pameran", estimatedValue: 1300000000, probability: 60, expectedCloseDate: day(20), salesName: SALES_A, createdAt: day(-45), notes: "Customer membandingkan dengan 2 vendor lain; minta diskon tambahan." }),
    opp(4, { title: "Moisture Analyzer & Neraca Analitik Lab Pangan", customerId: cust.PSL, stage: "Won", source: "Website", estimatedValue: 180000000, probability: 100, expectedCloseDate: day(-60), salesName: SALES_B, createdAt: day(-90) }),
    opp(5, { title: "Pengadaan Fume Hood (Tender e-Katalog)", customerId: cust.BBP, stage: "Quotation", source: "Tender", estimatedValue: 215000000, probability: 40, expectedCloseDate: day(30), salesName: SALES_A, createdAt: day(-20) }),
    opp(6, { title: "Autoklaf untuk Lab QC Bahan Kimia", customerId: cust.KPI, stage: "Lead", source: "Website", estimatedValue: 90000000, probability: 10, expectedCloseDate: day(60), salesName: SALES_B, createdAt: day(-4), notes: "Masuk lewat form website, belum ada kunjungan." }),
    opp(7, { title: "Inkubator & Lab Refrigerator Labkesda", customerId: cust.LKD, stage: "Qualified", source: "Referensi", estimatedValue: 210000000, probability: 25, expectedCloseDate: day(45), salesName: SALES_A, createdAt: day(-12), notes: "Anggaran APBD perubahan; menunggu RAB final." }),
    opp(8, { title: "pH Meter untuk Praktikum Mahasiswa", customerId: cust.UTB, stage: "Lost", source: "Website", estimatedValue: 95000000, probability: 0, expectedCloseDate: day(-25), salesName: SALES_B, createdAt: day(-70), lostReason: "Harga — customer memilih produk lokal yang lebih murah." }),
    opp(9, { title: "Repeat Order Neraca Analitik & pH Meter QC", customerId: cust.FMI, stage: "Won", source: "Repeat Order", estimatedValue: 140000000, probability: 100, expectedCloseDate: day(-3), salesName: SALES_A, createdAt: day(-18) }),
    opp(10, { title: "Perpanjangan Kontrak AMC Peralatan Lab", customerId: cust.RSH, stage: "Negotiation", source: "Repeat Order", estimatedValue: 60000000, probability: 70, expectedCloseDate: day(10), salesName: SALES_B, createdAt: day(-25), notes: "Kontrak AMC lama sudah habis; customer minta tambahan 2 alat." }),
  ] });

  // ---------- Penawaran ----------
  let qSeq = 0;
  const quotes = {};
  async function quote(key, { customer, opp: oppN, date, revision = 0, sameNoAs, lines, discountPercent = 0, status, subject, topic, attention, paymentTerms = TERMS.payment, sales, approved, notes }) {
    const items = buildItems(lines);
    const quotationNo = sameNoAs ? quotes[sameNoAs].quotationNo : docNo("QUO", date, ++qSeq);
    const id = `${PREFIX}QUO-${key}`;
    await prisma.quotation.create({ data: {
      id, quotationNo, revision, customerId: cust[customer], opportunityId: oppN ? `${PREFIX}OPP-${oppN}` : null,
      date, validUntil: day(Math.round((new Date(date) - new Date(day(0))) / 864e5) + 30), status, subject, attention,
      introText: INTRO(topic), closingText: CLOSING, ...totals(items, discountPercent),
      paymentTerms, deliveryTerms: TERMS.delivery, warrantyTerms: TERMS.warranty, notes, salesName: sales, createdBy: sales, createdAt: date,
      approvedBy: approved ? SALES_MGR : null, approvedAt: approved ? date : null,
      historyJson: history(revision ? `Revisi ${revision} dibuat` : "Penawaran dibuat", sales),
      items: { create: items },
    } });
    quotes[key] = { id, quotationNo, items, ...totals(items, discountPercent) };
  }
  const att = key => CUSTOMERS.find(c => c.key === key).contactName;

  await quote("UNR-R0", { customer: "UNR", opp: 1, date: day(-130), lines: [["LPI-SPC-001", 2], ["LPI-SRV-003", 2]], status: "Superseded", subject: "Penawaran Harga Spektrofotometer UV-Vis", topic: "Spektrofotometer UV-Vis Double Beam", attention: att("UNR"), sales: SALES_A });
  await quote("UNR-R1", { customer: "UNR", opp: 1, date: day(-112), revision: 1, sameNoAs: "UNR-R0", lines: [["LPI-SPC-001", 2, 5], ["LPI-SRV-003", 2]], status: "Accepted", subject: "Penawaran Harga Spektrofotometer UV-Vis (Revisi 1)", topic: "Spektrofotometer UV-Vis Double Beam", attention: att("UNR"), sales: SALES_A, notes: "Revisi: diskon 5% untuk unit alat sesuai negosiasi tanggal kunjungan." });
  await quote("PSL", { customer: "PSL", opp: 4, date: day(-80), lines: [["LPI-BAL-002", 1], ["LPI-BAL-001", 3]], status: "Accepted", subject: "Penawaran Moisture Analyzer & Neraca Analitik", topic: "Moisture Analyzer Halogen dan Neraca Analitik 0,1 mg", attention: att("PSL"), paymentTerms: "100% setelah BAST. Pembayaran 30 hari setelah invoice diterima.", sales: SALES_B });
  await quote("UTB", { customer: "UTB", opp: 8, date: day(-55), lines: [["LPI-PHM-002", 12]], status: "Rejected", subject: "Penawaran pH Meter Portable untuk Praktikum", topic: "pH Meter Portable (12 unit)", attention: att("UTB"), sales: SALES_B });
  await quote("RSH", { customer: "RSH", opp: 2, date: day(-50), lines: [["LPI-BSC-001", 1], ["LPI-CEN-001", 1], ["LPI-SRV-003", 2]], status: "Accepted", subject: "Penawaran Biosafety Cabinet & Refrigerated Centrifuge", topic: "Biosafety Cabinet Class II A2 dan Refrigerated Centrifuge", attention: att("RSH"), paymentTerms: "DP 30% setelah PO; 70% setelah BAST. Pembayaran 45 hari setelah invoice diterima.", sales: SALES_B });
  await quote("FMI-HPLC-R0", { customer: "FMI", opp: 3, date: day(-30), lines: [["LPI-CHR-001", 1], ["LPI-SRV-003", 1]], status: "Sent", subject: "Penawaran HPLC System Quaternary dengan Detektor PDA", topic: "HPLC System Quaternary dengan detektor PDA", attention: att("FMI"), sales: SALES_A });
  await quote("BBP", { customer: "BBP", opp: 5, date: day(-15), lines: [["LPI-FMH-001", 2], ["LPI-SRV-003", 2]], discountPercent: 8, status: "Sent", subject: "Penawaran Fume Hood Ducted 1,5 m", topic: "Fume Hood Ducted 1,5 m (2 unit)", attention: att("BBP"), paymentTerms: TERMS.paymentGov, sales: SALES_A, approved: true });
  await quote("FMI-RO", { customer: "FMI", opp: 9, date: day(-14), lines: [["LPI-BAL-001", 2], ["LPI-PHM-001", 2], ["LPI-SRV-001", 4]], status: "Accepted", subject: "Penawaran Repeat Order Neraca Analitik & pH Meter", topic: "Neraca Analitik dan pH/Conductivity Meter (repeat order)", attention: att("FMI"), sales: SALES_A });
  await quote("FMI-HPLC-R1", { customer: "FMI", opp: 3, date: day(-2), revision: 1, sameNoAs: "FMI-HPLC-R0", lines: [["LPI-CHR-001", 1], ["LPI-SRV-003", 1]], discountPercent: 12, status: "Waiting Approval", subject: "Penawaran HPLC System Quaternary dengan Detektor PDA (Revisi 1)", topic: "HPLC System Quaternary dengan detektor PDA", attention: att("FMI"), sales: SALES_A, notes: "Diskon 12% di atas batas 10% — menunggu persetujuan Sales Manager." });
  await quote("RSH-AMC", { customer: "RSH", opp: 10, date: day(-1), lines: [["LPI-SRV-002", 6]], status: "Draft", subject: "Penawaran Perpanjangan Kontrak Perawatan Tahunan (AMC)", topic: "perpanjangan Kontrak Perawatan Tahunan (AMC) untuk 6 alat laboratorium", attention: att("RSH"), paymentTerms: "100% di awal periode kontrak. Pembayaran 45 hari setelah invoice diterima.", sales: SALES_B });

  // ---------- Sales Order (dari PO customer) ----------
  const review = (date, by) => JSON.stringify([
    "Spesifikasi & jumlah pada PO sesuai penawaran",
    "Harga, diskon, dan termin pembayaran disetujui",
    "Jadwal pengiriman dapat dipenuhi (stok/indent dicek)",
    "Kebutuhan instalasi, utilitas, dan training sudah jelas",
    "Persyaratan khusus (regulasi, kalibrasi, dokumen) teridentifikasi",
  ].map(item => ({ item, ok: true, reviewedBy: by, date })));
  const schedule = (...terms) => JSON.stringify(terms.map(([label, percent, trigger]) => ({ label, percent, trigger })));
  const STD_SCHEDULE = schedule(["DP 30%", 30, "Setelah PO diterima"], ["Pelunasan 70%", 70, "Setelah BAST instalasi"]);

  let soSeq = 0;
  async function so(key, { customer, fromQuote, items: rawItems, orderDate, poNo, status, sales, schedule: sched = STD_SCHEDULE, reviewed = true, ...rest }) {
    const q = fromQuote ? quotes[fromQuote] : null;
    const items = q ? q.items : buildItems(rawItems);
    const t = q || totals(items);
    await prisma.salesOrder.create({ data: {
      id: `${PREFIX}SO-${key}`, soNo: docNo("SO", orderDate, ++soSeq), customerId: cust[customer], quotationId: q ? q.id : null,
      customerPoNo: poNo, customerPoDate: orderDate, orderDate, status, salesName: sales,
      contractReviewJson: reviewed ? review(orderDate, SALES_MGR) : "[]", paymentScheduleJson: sched,
      deliveryAddress: CUSTOMERS.find(c => c.key === customer).address,
      subtotal: t.subtotal - (t.discountAmount || 0), taxAmount: t.taxAmount, total: t.total, createdAt: orderDate,
      historyJson: history("Sales Order dibuat dari PO customer", sales),
      items: { create: items.map(({ productId, description, qty, unit, unitPrice, lineTotal, sortOrder }) => ({ productId, description, qty, unit, unitPrice, lineTotal, sortOrder })) },
      ...rest,
    } });
    return t;
  }

  const soOld = await so("RSH-2025", { customer: "RSH", items: [["LPI-REF-001", 2], ["LPI-INC-001", 2], ["LPI-AUT-001", 1], ["LPI-SRV-003", 1]], orderDate: day(-385), poNo: "PO/RSUPHS/LAB/2025/0147", status: "Completed", sales: SALES_B, schedule: schedule(["Pembayaran 100%", 100, "Setelah BAST"]), installationDate: day(-345), bastNo: "BAST/LPI/2025/0091", bastDate: day(-345), expectedDelivery: day(-350), notes: "Pengadaan awal laboratorium (sebelum modul Sales dipakai)." });
  const soUnr = await so("UNR", { customer: "UNR", fromQuote: "UNR-R1", orderDate: day(-105), poNo: "SPK/UNR-FF/2026/033", status: "Completed", sales: SALES_A, expectedDelivery: day(-48), installationDate: day(-45), bastNo: "BAST/LPI/2026/0118", bastDate: day(-45) });
  const soPsl = await so("PSL", { customer: "PSL", fromQuote: "PSL", orderDate: day(-62), poNo: "PO-PSL-2026-0412", status: "Installed", sales: SALES_B, schedule: schedule(["Pembayaran 100%", 100, "Setelah BAST"]), expectedDelivery: day(-45), installationDate: day(-41), bastNo: "BAST/LPI/2026/0131", bastDate: day(-41) });
  const soRsh = await so("RSH", { customer: "RSH", fromQuote: "RSH", orderDate: day(-36), poNo: "PO/RSUPHS/LAB/2026/0388", status: "In Delivery", sales: SALES_B, expectedDelivery: day(5), notes: "BSC indent 6 minggu; centrifuge sudah dikirim terpisah." });
  await so("FMI-RO", { customer: "FMI", fromQuote: "FMI-RO", orderDate: day(-3), poNo: "4500021876", status: "Contract Review", sales: SALES_A, reviewed: false, expectedDelivery: day(18) });

  // ---------- Invoice & pembayaran ----------
  let invSeq = 0;
  async function invoice(key, { customer, so: soKey, base, percent, termLabel, invoiceDate, termDays = 30, payments = [], status, fakturPajakNo }) {
    const subtotal = round(base.subtotal * percent / 100);
    const taxAmount = round(subtotal * TAX / 100);
    const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
    await prisma.invoice.create({ data: {
      id: `${PREFIX}INV-${key}`, invoiceNo: docNo("INV", invoiceDate, ++invSeq), customerId: cust[customer], salesOrderId: soKey ? `${PREFIX}SO-${soKey}` : null,
      termLabel, termPercent: percent, invoiceDate, dueDate: day(Math.round((new Date(invoiceDate) - new Date(day(0))) / 864e5) + termDays),
      subtotal, taxAmount, total: subtotal + taxAmount, paidAmount, status, fakturPajakNo, createdAt: invoiceDate,
      historyJson: history("Invoice diterbitkan", FINANCE),
      payments: { create: payments.map((p, i) => ({ id: `${PREFIX}PAY-${key}-${i + 1}`, method: "Transfer", receivedBy: FINANCE, createdAt: p.paymentDate, ...p })) },
    } });
    return subtotal + taxAmount;
  }
  const net = t => ({ subtotal: t.subtotal - (t.discountAmount || 0) });
  const full = (base, pct) => round(base.subtotal * pct / 100 * (1 + TAX / 100));

  await invoice("RSH-2025", { customer: "RSH", so: "RSH-2025", base: net(soOld), percent: 100, termLabel: "Pembayaran 100%", invoiceDate: day(-344), termDays: 45, status: "Paid", fakturPajakNo: "010.000-25.00041122",
    payments: [{ paymentDate: day(-305), amount: full(net(soOld), 100), reference: "TRF BNI 2025-12-04" }] });
  await invoice("UNR-DP", { customer: "UNR", so: "UNR", base: net(soUnr), percent: 30, termLabel: "DP 30%", invoiceDate: day(-104), status: "Paid", fakturPajakNo: "010.000-26.00012875",
    payments: [{ paymentDate: day(-80), amount: full(net(soUnr), 30), reference: "TRF BRI 0331" }] });
  await invoice("UNR-70", { customer: "UNR", so: "UNR", base: net(soUnr), percent: 70, termLabel: "Pelunasan 70%", invoiceDate: day(-44), status: "Paid", fakturPajakNo: "010.000-26.00019340",
    payments: [{ paymentDate: day(-16), amount: full(net(soUnr), 70), reference: "TRF BRI 0912" }] });
  const pslTotal = full(net(soPsl), 100);
  await invoice("PSL", { customer: "PSL", so: "PSL", base: net(soPsl), percent: 100, termLabel: "Pembayaran 100%", invoiceDate: day(-40), status: "Partial", fakturPajakNo: "010.000-26.00019877",
    payments: [{ paymentDate: day(-6), amount: round(pslTotal / 2), reference: "TRF Mandiri 1028" }] });
  await invoice("RSH-DP", { customer: "RSH", so: "RSH", base: net(soRsh), percent: 30, termLabel: "DP 30%", invoiceDate: day(-35), termDays: 45, status: "Paid", fakturPajakNo: "010.000-26.00020114",
    payments: [{ paymentDate: day(-9), amount: full(net(soRsh), 30), reference: "TRF BNI 1025" }] });
  const calib = totals(buildItems([["LPI-SRV-001", 2]]));
  await invoice("UNR-CAL", { customer: "UNR", base: calib, percent: 100, termLabel: "Jasa Kalibrasi Tahunan", invoiceDate: day(-5), status: "Unpaid" });

  // ---------- Kontrak ----------
  const covered = (...rows) => JSON.stringify(rows.map(([product, serialNumber]) => ({ product, serialNumber })));
  await prisma.contract.createMany({ data: [
    { id: `${PREFIX}CTR-1`, contractNo: docNo("CTR", day(-45), 3), customerId: cust.UNR, salesOrderId: `${PREFIX}SO-UNR`, type: "Garansi", title: "Garansi Spektrofotometer UV-Vis (2 unit)", startDate: day(-45), endDate: day(320), value: 0, status: "Active", picName: "Teknisi: Yusuf Maulana",
      coveredItemsJson: covered(["SpectraLine UV-2800", "UV28-2604-0117"], ["SpectraLine UV-2800", "UV28-2604-0118"]), createdAt: day(-45), historyJson: history("Kontrak garansi dibuat otomatis dari BAST") },
    { id: `${PREFIX}CTR-2`, contractNo: docNo("CTR", day(-5), 4), customerId: cust.UNR, type: "Kalibrasi", title: "Kalibrasi Tahunan Spektrofotometer", startDate: day(-5), endDate: day(360), value: calib.subtotal, visitsPerYear: 1, status: "Active", picName: "Teknisi: Yusuf Maulana",
      coveredItemsJson: covered(["SpectraLine UV-2800", "UV28-2604-0117"], ["SpectraLine UV-2800", "UV28-2604-0118"]), createdAt: day(-5), historyJson: history("Kontrak kalibrasi dibuat") },
    { id: `${PREFIX}CTR-3`, contractNo: docNo("CTR", day(-345), 2), customerId: cust.RSH, salesOrderId: `${PREFIX}SO-RSH-2025`, type: "Garansi", title: "Garansi Peralatan Lab Mikrobiologi (5 unit)", startDate: day(-345), endDate: day(20), value: 0, status: "Active", picName: "Teknisi: Rudi Hartanto",
      coveredItemsJson: covered(["ColdChain LR-400", "LR4-2511-0031"], ["ColdChain LR-400", "LR4-2511-0032"], ["ThermoLab IN-150", "IN15-2510-0207"], ["ThermoLab IN-150", "IN15-2510-0208"], ["SteriPro AV-75", "AV75-2509-0044"]),
      notes: "Garansi habis dalam 3 minggu — tawarkan kontrak AMC.", createdAt: day(-345), historyJson: history("Kontrak garansi dibuat otomatis dari BAST") },
    { id: `${PREFIX}CTR-4`, contractNo: docNo("CTR", day(-395), 1), customerId: cust.RSH, type: "AMC", title: "Kontrak Perawatan Tahunan Lab Patologi Klinik (4 alat)", startDate: day(-395), endDate: day(-30), value: 38000000, visitsPerYear: 2, status: "Expired", picName: "Teknisi: Rudi Hartanto",
      coveredItemsJson: covered(["CentriMax CR-16R", "CR16-2402-0089"], ["OptiView BX-200", "BX2-2401-0310"], ["OptiView BX-200", "BX2-2401-0311"], ["PureFlow UP-20", "UP20-2403-0015"]),
      notes: "Perpanjangan sedang dinegosiasikan (OPP-2026-010).", createdAt: day(-395), historyJson: history("Kontrak AMC dibuat") },
  ] });

  // ---------- Pelengkap dokumen: nomor seri, kwitansi, penandatangan, kontrak menunggu approval ----------
  const serials = {
    "SO-UNR": { "LPI-SPC-001": "UV28-2604-0117, UV28-2604-0118" },
    "SO-PSL": { "LPI-BAL-002": "MA11-2608-0021", "LPI-BAL-001": "AB22-2608-0101, AB22-2608-0102, AB22-2608-0103" },
    "SO-RSH-2025": { "LPI-REF-001": "LR4-2511-0031, LR4-2511-0032", "LPI-INC-001": "IN15-2510-0207, IN15-2510-0208", "LPI-AUT-001": "AV75-2509-0044" },
  };
  for (const [so, map] of Object.entries(serials)) {
    for (const [sku, sn] of Object.entries(map)) {
      await prisma.salesOrderItem.updateMany({ where: { salesOrderId: `${PREFIX}${so}`, productId: `${PREFIX}PRD-${sku}` }, data: { serialNumbers: sn } });
    }
  }
  const pays = await prisma.payment.findMany({ where: { id: { startsWith: PREFIX } }, orderBy: { paymentDate: "asc" } });
  const kwtSeq = {};
  for (const p of pays) {
    const y = p.paymentDate.slice(0, 4);
    kwtSeq[y] = (kwtSeq[y] || 0) + 1;
    await prisma.payment.update({ where: { id: p.id }, data: { receiptNo: docNo("KWT", p.paymentDate, kwtSeq[y]) } });
  }
  const signatories = {
    UNR: ["Prof. Dr. apt. Hendra Gunawan, M.Si.", "Dekan Fakultas Farmasi"],
    RSH: ["dr. Ratna Dewi, MARS", "Direktur Utama"],
    FMI: ["Ir. Benny Santoso", "Plant Director"],
    PSL: ["Lukas Hartanto", "Direktur"],
    BBP: ["Ir. Wahyu Setiadi, M.T.", "Pejabat Pembuat Komitmen"],
  };
  for (const [key, [name, title]] of Object.entries(signatories)) {
    await prisma.customer.update({ where: { id: cust[key] }, data: { signatoryName: name, signatoryTitle: title } });
  }
  // Invoice kalibrasi UNR adalah tagihan periode kontrak CTR-2 (mencegah tagih ganda dari menu Invoice baru).
  const ctr2 = await prisma.contract.findUniqueOrThrow({ where: { id: `${PREFIX}CTR-2` } });
  await prisma.invoice.update({ where: { id: `${PREFIX}INV-UNR-CAL` }, data: { contractId: ctr2.id, periodLabel: `Periode ${ctr2.startDate} s/d ${ctr2.endDate}` } });
  // Kontrak kalibrasi PSL: diajukan 9 hari kerja lalu, batas approval (7 hari kerja) sudah lewat.
  await prisma.contract.create({ data: {
    id: `${PREFIX}CTR-5`, contractNo: docNo("CTR", day(-12), 5), customerId: cust.PSL, salesOrderId: `${PREFIX}SO-PSL`, type: "Kalibrasi",
    title: "Kalibrasi Berkala Neraca & Moisture Analyzer", startDate: day(5), endDate: day(369), value: 2750000 * 4 * 2, visitsPerYear: 2,
    coveredItemsJson: covered(["PrecisaLab MA-110H", "MA11-2608-0021"], ["PrecisaLab AB-220i", "AB22-2608-0101"], ["PrecisaLab AB-220i", "AB22-2608-0102"], ["PrecisaLab AB-220i", "AB22-2608-0103"]),
    status: "Waiting Approval", approvalDueDate: day(-2), responseTime: "2x24 jam hari kerja", billingSchedule: "Quarterly",
    signatoryName: "Lukas Hartanto", signatoryTitle: "Direktur", picName: "Teknisi: Yusuf Maulana", createdAt: day(-12),
    notes: "Customer minta sertifikat kalibrasi terakreditasi.", historyJson: history("Diajukan untuk persetujuan", SALES_B),
  } });

  console.log("Data sales demo dibuat: 20 produk, 8 customer, 10 opportunity, 10 penawaran, 5 SO, 6 invoice, 5 kontrak.");
}

module.exports = { seedSales, clearSales };

if (require.main === module) {
  seedSales()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
