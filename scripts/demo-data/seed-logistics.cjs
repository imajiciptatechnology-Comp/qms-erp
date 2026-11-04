/**
 * Data demo modul Logistik — PT Arunika Trans Nusantara (fiktif, truk charter FTL, armada sendiri).
 * Isi: profil perusahaan (kop), 5 jenis truk, 10 truk, 12 sopir (+ kualifikasi), 6 kenek, 5 klien
 * (+ lokasi), 7 rute, tabel tarif & biaya tambahan, beberapa contoh order, 7 role + akun demo.
 *
 * AMAN: script ini TIDAK MENGHAPUS apa pun. Semua record memakai id berawalan "DEMO-LOG-" dan
 * di-upsert — master data dikembalikan ke nilai demo, order contoh hanya dibuat bila belum ada,
 * akun yang sudah ada tidak diubah. Data Sales/QMS lain tidak disentuh.
 *
 *   node scripts/demo-data/seed-logistics.cjs
 */
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { prisma } = require("./common.cjs");

const P = "DEMO-LOG-";
const day = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};
const nowIso = new Date().toISOString();
const history = (action, by = "Demo Data") => JSON.stringify([{ id: "1", date: nowIso, userName: by, action }]);

// ---------- Role & akun demo (bagian 1.7) ----------
const ROLES = [
  { name: "Admin Order (CS)", permissions: ["logistics", "logistics_order"] },
  { name: "Dispatcher", permissions: ["logistics", "logistics_dispatch"] },
  { name: "Fleet Manager", permissions: ["logistics", "logistics_fleet", "logistics_override_fleet"] },
  { name: "Operations Manager", permissions: ["logistics", "logistics_order", "logistics_dispatch", "logistics_rates", "logistics_override_ops"] },
  { name: "Kasir Finance", permissions: ["logistics", "logistics_finance"] },
  { name: "Direktur Operasional", permissions: ["logistics", "logistics_rates", "logistics_override_fleet", "logistics_override_ops", "logistics_override_director"] },
  { name: "Sopir", permissions: ["logistics_driver"] },
];
const PASSWORD = "arunika123";
const USERS = [
  { email: "cs@demo.log", name: "Nadia Putri", role: "Admin Order (CS)", department: "Customer Service" },
  { email: "dispatcher@demo.log", name: "Bayu Firmansyah", role: "Dispatcher", department: "Operasional" },
  { email: "fleet@demo.log", name: "Agus Saputra", role: "Fleet Manager", department: "Armada" },
  { email: "opsmanager@demo.log", name: "Dewi Anggraini", role: "Operations Manager", department: "Operasional" },
  { email: "kasir@demo.log", name: "Maya Kartika", role: "Kasir Finance", department: "Finance" },
  { email: "direktur@demo.log", name: "Rudi Hartono", role: "Direktur Operasional", department: "Direksi" },
  { email: "sopir1@demo.log", name: "Slamet Riyadi", role: "Sopir", department: "Armada" },
];

async function ensureRolesAndUsers() {
  const row = await prisma.kvStore.findUnique({ where: { key: "roles" } });
  const roles = row ? JSON.parse(row.value) : [];
  for (const r of ROLES) {
    const existing = roles.find(x => x.name === r.name);
    if (!existing) roles.push(r);
    else existing.permissions = [...new Set([...existing.permissions, ...r.permissions])];
  }
  await prisma.kvStore.upsert({ where: { key: "roles" }, update: { value: JSON.stringify(roles) }, create: { key: "roles", value: JSON.stringify(roles) } });
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const u of USERS) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, passwordHash: hash } });
  }
}

// ---------- Profil perusahaan ----------
const COMPANY = {
  id: P + "COMPANY", key: "logistics", name: "PT ARUNIKA TRANS NUSANTARA",
  tagline: "Truck Charter · Jawa–Bali · Armada Sendiri",
  address: "Kawasan Industri Contoh Blok C-7, Cikarang, Bekasi 17530 (alamat contoh)", city: "Cikarang",
  phone: "(021) 8900-0000", email: "order@contoh-arunika.co.id", website: "www.contoh-arunika.co.id",
  npwp: "00.000.000.0-000.001", bank: "Bank Contoh · No. Rek. 111-000-0000 · a.n. PT Arunika Trans Nusantara",
  logoPath: "brand/arunika-logo.png", primaryColor: "#0B2545", accentColor: "#F28C28",
  signersJson: JSON.stringify([
    { key: "director", name: "Rudi Hartono", title: "Direktur Operasional" },
    { key: "fleet", name: "Agus Saputra", title: "Fleet Manager" },
    { key: "finance", name: "Maya Kartika", title: "Kasir / Finance" },
    { key: "cs", name: "Nadia Putri", title: "Admin Order" },
  ]),
  updatedAt: nowIso,
};

// ---------- Jenis truk (1.2) ----------
const TYPES = [
  { code: "CDE", name: "CDE Box", capacityTon: 2.5, volumeM3: 12, kmPerLiter: 8, tollClass: 1, sizeClass: "small", requiresHelper: false, minSim: "B1 Umum" },
  { code: "CDD", name: "CDD Box", capacityTon: 5, volumeM3: 20, kmPerLiter: 6, tollClass: 1, sizeClass: "small", requiresHelper: false, minSim: "B1 Umum" },
  { code: "FUSO", name: "Fuso Wingbox", capacityTon: 8, volumeM3: 32, kmPerLiter: 4.5, tollClass: 2, sizeClass: "large", requiresHelper: false, minSim: "B1 Umum" },
  { code: "TRONTON", name: "Tronton Wingbox", capacityTon: 15, volumeM3: 45, kmPerLiter: 3.5, tollClass: 3, sizeClass: "large", requiresHelper: true, minSim: "B1 Umum" },
  { code: "TRAILER", name: "Trailer 40 ft", capacityTon: 25, volumeM3: 67, kmPerLiter: 2.8, tollClass: 3, sizeClass: "large", requiresHelper: true, minSim: "B2 Umum" },
];
const typeId = code => P + "TT-" + code;

// ---------- Rute (1.5) ----------
const ROUTES = [
  { code: "JKT", destination: "Jabodetabek", distanceKm: 60, durationHours: 3, toll: [40e3, 60e3, 80e3], lat: -6.2088, lng: 106.8456 },
  { code: "BDG", destination: "Bandung", distanceKm: 130, durationHours: 4, toll: [90e3, 135e3, 180e3], lat: -6.9175, lng: 107.6191 },
  { code: "MRK", destination: "Merak", distanceKm: 150, durationHours: 4, toll: [120e3, 180e3, 240e3], lat: -5.9311, lng: 105.9963 },
  { code: "CRB", destination: "Cirebon", distanceKm: 190, durationHours: 4.5, toll: [150e3, 225e3, 300e3], lat: -6.7320, lng: 108.5523 },
  { code: "SMG", destination: "Semarang", distanceKm: 430, durationHours: 8, toll: [380e3, 570e3, 760e3], lat: -6.9667, lng: 110.4167 },
  { code: "YOG", destination: "Yogyakarta", distanceKm: 540, durationHours: 10, toll: [420e3, 630e3, 840e3], lat: -7.7956, lng: 110.3695 },
  { code: "SBY", destination: "Surabaya", distanceKm: 780, durationHours: 13, toll: [650e3, 975e3, 1.3e6], lat: -7.2575, lng: 112.7521 },
];
const routeId = code => P + "RT-" + code;

// ---------- Tarif (1.6): CDE, CDD, FUSO, TRONTON, TRAILER ----------
const RATES = {
  JKT: [1.2e6, 1.8e6, 2.8e6, 3.8e6, 4.5e6],
  BDG: [2.5e6, 3.5e6, 5e6, 7e6, 8.5e6],
  MRK: [2.8e6, 3.8e6, 5.5e6, 7.5e6, 9e6],
  CRB: [3.2e6, 4.5e6, 6.5e6, 8.5e6, 10e6],
  SMG: [5.5e6, 7.5e6, 11e6, 15e6, 18e6],
  YOG: [6.5e6, 8.5e6, 12.5e6, 16.5e6, 20e6],
  SBY: [9e6, 12e6, 17e6, 22e6, 27e6],
};
const SURCHARGES = [
  { code: "EXTRA_DROP", name: "Titik bongkar tambahan (multi-drop)", unit: "per titik", kind: "flat", smallAmount: 300e3, largeAmount: 500e3 },
  { code: "OVERNIGHT", name: "Menginap/menunggu (> 12 jam)", unit: "per hari", kind: "flat", smallAmount: 500e3, largeAmount: 1e6 },
  { code: "TKBM", name: "Jasa bongkar muat (TKBM)", unit: "per trip", kind: "flat", smallAmount: 250e3, largeAmount: 750e3 },
  { code: "ESCORT", name: "Pengawalan", unit: "per trip", kind: "flat", smallAmount: null, largeAmount: 1.5e6 },
  { code: "INSURANCE", name: "Asuransi muatan", unit: "% nilai barang", kind: "percent", percent: 0.1, minAmount: 100e3 },
  { code: "RETURN_LOAD", name: "Diskon muatan balik", unit: "% tarif rute", kind: "discount", percent: 20 },
];

// ---------- Klien (1.4) ----------
const CLIENTS = [
  { code: "SPL", name: "PT Sinar Pangan Lestari", industry: "FMCG makanan", city: "Cikarang", address: "Jl. Industri Contoh No. 12, Cikarang Barat (alamat contoh)", contactName: "Ibu Lina Marlina", contactPhone: "0812-0000-1101", contactEmail: "logistik@contoh-sinarpangan.co.id", paymentTerms: "30 hari", contractDiscountPercent: 5, insuranceRequired: false, tollPassThrough: false, orderPattern: "Rutin Cikarang → Semarang/Surabaya, multi-drop distributor", aliases: "Sinar Pangan, SPL, Sinar" },
  { code: "BKU", name: "PT Baja Konstruksi Utama", industry: "Baja/konstruksi", city: "Cikarang", address: "Jl. Baja Raya Contoh No. 5, Cikarang Utara (alamat contoh)", contactName: "Bapak Hendro", contactPhone: "0812-0000-1102", contactEmail: "ppic@contoh-bajakonstruksi.co.id", paymentTerms: "45 hari", contractDiscountPercent: 0, insuranceRequired: false, tollPassThrough: true, orderPattern: "Tronton/trailer, muatan berat", aliases: "Baja Konstruksi, BKU, Baja" },
  { code: "KPI", name: "PT Kemas Plastindo", industry: "Kemasan plastik", city: "Bekasi", address: "Jl. Plastik Contoh No. 8, Bekasi (alamat contoh)", contactName: "Ibu Siska", contactPhone: "0812-0000-1103", contactEmail: "warehouse@contoh-kemasplastindo.co.id", paymentTerms: "30 hari", contractDiscountPercent: 0, insuranceRequired: false, tollPassThrough: false, orderPattern: "CDD/Fuso, Jabodetabek & Bandung", aliases: "Kemas Plastindo, Kemas, Plastindo" },
  { code: "ATM", name: "CV Agro Tani Makmur", industry: "Pupuk/agri", city: "Karawang", address: "Jl. Tani Contoh No. 3, Karawang (alamat contoh)", contactName: "Bapak Wahyu", contactPhone: "0812-0000-1104", contactEmail: "order@contoh-agrotani.co.id", paymentTerms: "14 hari", contractDiscountPercent: 0, insuranceRequired: false, tollPassThrough: false, orderPattern: "Musiman, Cirebon & Yogyakarta", aliases: "Agro Tani, Agro, ATM" },
  { code: "EPI", name: "PT Elektronika Prima Indonesia", industry: "Elektronik", city: "Cikarang", address: "Jl. Elektronik Contoh No. 21, Cikarang Selatan (alamat contoh)", contactName: "Bapak Kevin", contactPhone: "0812-0000-1105", contactEmail: "scm@contoh-elektronikaprima.co.id", paymentTerms: "30 hari", contractDiscountPercent: 7, insuranceRequired: true, tollPassThrough: false, orderPattern: "Barang bernilai tinggi, wajib asuransi muatan", aliases: "Elektronika Prima, EPI, Elektronika" },
];
const clientId = code => P + "CL-" + code;

const LOCATIONS = [
  { id: "LOC-POOL", clientId: null, name: "Pool Arunika Cikarang", kind: "Pool", city: "Cikarang", address: "Kawasan Industri Contoh Blok C-7", lat: -6.3008, lng: 107.1530 },
  { id: "LOC-SPL-WH", client: "SPL", name: "Gudang Sinar Pangan Cikarang", kind: "Muat", city: "Cikarang", lat: -6.2950, lng: 107.1380 },
  { id: "LOC-SPL-SMG", client: "SPL", name: "Distributor SPL Semarang", kind: "Bongkar", city: "Semarang", lat: -6.9932, lng: 110.4203 },
  { id: "LOC-SPL-KDL", client: "SPL", name: "Distributor SPL Kendal", kind: "Bongkar", city: "Kendal", lat: -6.9223, lng: 110.2045 },
  { id: "LOC-SPL-UNG", client: "SPL", name: "Distributor SPL Ungaran", kind: "Bongkar", city: "Ungaran", lat: -7.1390, lng: 110.4050 },
  { id: "LOC-SPL-SBY", client: "SPL", name: "DC SPL Surabaya", kind: "Bongkar", city: "Surabaya", lat: -7.2756, lng: 112.6426 },
  { id: "LOC-BKU-PLANT", client: "BKU", name: "Plant Baja Konstruksi Cikarang", kind: "Muat", city: "Cikarang", lat: -6.2820, lng: 107.1710 },
  { id: "LOC-BKU-MRK", client: "BKU", name: "Proyek Dermaga Merak", kind: "Bongkar", city: "Merak", lat: -5.9311, lng: 105.9963 },
  { id: "LOC-KPI-WH", client: "KPI", name: "Gudang Kemas Plastindo Bekasi", kind: "Muat", city: "Bekasi", lat: -6.2383, lng: 106.9756 },
  { id: "LOC-KPI-BDG", client: "KPI", name: "Customer Kemas Bandung", kind: "Bongkar", city: "Bandung", lat: -6.9175, lng: 107.6191 },
  { id: "LOC-ATM-WH", client: "ATM", name: "Gudang Agro Tani Karawang", kind: "Muat", city: "Karawang", lat: -6.3227, lng: 107.3376 },
  { id: "LOC-ATM-CRB", client: "ATM", name: "Kios Pupuk Cirebon", kind: "Bongkar", city: "Cirebon", lat: -6.7320, lng: 108.5523 },
  { id: "LOC-EPI-WH", client: "EPI", name: "Pabrik Elektronika Prima Cikarang", kind: "Muat", city: "Cikarang", lat: -6.3330, lng: 107.1410 },
  { id: "LOC-EPI-SBY", client: "EPI", name: "Gudang EPI Surabaya", kind: "Bongkar", city: "Surabaya", lat: -7.3305, lng: 112.7270 },
];

// ---------- Armada 10 truk (+ skenario kelayakan) ----------
const VEHICLES = [
  { id: "VH-01", pkb: 140, plateNo: "B 9101 FXA", type: "CDE", brand: "Mitsubishi Colt Diesel", year: 2021, odometerKm: 182000, stnk: 220, kir: 95, svcDate: 40, svcKm: 190000, tollMethod: "A", tollCardNo: "E-TOLL 6032-0001" },
  { id: "VH-02", pkb: 75, plateNo: "B 9102 FXA", type: "CDE", brand: "Isuzu Elf", year: 2022, odometerKm: 131000, stnk: 300, kir: 120, svcDate: 25, svcKm: 140000, tollMethod: "B", notes: "Skenario demo: P2H gagal pada rem (kritis) — tidak boleh jalan." },
  { id: "VH-03", pkb: 200, plateNo: "B 9203 FXB", type: "CDD", brand: "Mitsubishi Colt Diesel", year: 2020, odometerKm: 244000, stnk: -12, kir: 60, svcDate: 30, svcKm: 250000, tollMethod: "A", tollCardNo: "E-TOLL 6032-0003", notes: "Skenario demo: STNK sudah habis, sedang proses perpanjangan." },
  { id: "VH-04", pkb: -5, plateNo: "B 9204 FXB", type: "CDD", brand: "Isuzu Elf NMR", year: 2023, odometerKm: 88000, stnk: 400, kir: 150, svcDate: 50, svcKm: 95000, tollMethod: "A", tollCardNo: "E-TOLL 6032-0004", notes: "Skenario demo: pajak tahunan (PKB) telat 5 hari — STNK tidak sah sampai dibayar." },
  { id: "VH-05", pkb: 110, plateNo: "B 9205 FXB", type: "CDD", brand: "Hino Dutro", year: 2022, odometerKm: 120500, stnk: 260, kir: 75, svcDate: -9, svcKm: 120000, tollMethod: "C", notes: "Skenario demo: servis berkala overdue (9 hari / 500 km)." },
  { id: "VH-06", pkb: 26, plateNo: "B 9306 FXC", type: "FUSO", brand: "Mitsubishi Fuso Fighter", year: 2021, odometerKm: 205000, stnk: 180, kir: 40, svcDate: 20, svcKm: 210000, tollMethod: "A", tollCardNo: "E-TOLL 6032-0006" },
  { id: "VH-07", pkb: 160, plateNo: "B 9307 FXC", type: "FUSO", brand: "Hino Ranger", year: 2019, odometerKm: 310000, stnk: 90, kir: 70, svcDate: 15, svcKm: 315000, tollMethod: "A", tollCardNo: "E-TOLL 6032-0007", status: "In Repair", notes: "Skenario demo: sedang perbaikan (ganti kampas kopling)." },
  { id: "VH-08", pkb: 230, plateNo: "B 9408 FXD", type: "TRONTON", brand: "Hino Ranger FL", year: 2022, odometerKm: 156000, stnk: 330, kir: 110, svcDate: 35, svcKm: 165000, tollMethod: "A", tollCardNo: "E-TOLL 6032-0008" },
  { id: "VH-09", pkb: 95, plateNo: "B 9409 FXD", type: "TRONTON", brand: "Isuzu Giga", year: 2023, odometerKm: 74000, stnk: 500, kir: 160, svcDate: 60, svcKm: 85000, tollMethod: "B" },
  { id: "VH-10", pkb: 180, plateNo: "B 9510 FXE", type: "TRAILER", brand: "Hino 700 + Trailer 40 ft", year: 2021, odometerKm: 268000, stnk: 210, kir: 85, svcDate: 28, svcKm: 280000, tollMethod: "A", tollCardNo: "E-TOLL 6032-0010" },
];

// ---------- Sopir 12 orang ----------
// Golongan: 3 sopir CDE/CDD, 4 sopir s.d. Fuso, 3 sopir s.d. Tronton, 2 sopir semua jenis (Trailer).
const DRIVERS = [
  { id: "DRV-01", name: "Slamet Riyadi", email: "sopir1@demo.log", sim: "B2 Umum", simExp: 640, exp: 12, training: true, trailer: true, phone: "0813-0000-2001" },
  { id: "DRV-02", name: "Joko Susilo", sim: "B2 Umum", simExp: 410, exp: 9, training: true, trailer: true, phone: "0813-0000-2002" },
  { id: "DRV-03", name: "Bambang Wijaya", sim: "B1 Umum", simExp: 300, exp: 7, training: true, phone: "0813-0000-2003" },
  { id: "DRV-04", name: "Hadi Purnomo", sim: "B1 Umum", simExp: 12, exp: 6, training: true, phone: "0813-0000-2004", notes: "Skenario demo: SIM habis bulan ini." },
  { id: "DRV-05", name: "Eko Prasetyo", sim: "B1 Umum", simExp: 520, exp: 4, training: true, phone: "0813-0000-2005", notes: "Skenario demo: sudah 7 hari berturut-turut jalan (peringatan jam kerja)." },
  { id: "DRV-06", name: "Teguh Santoso", sim: "B1 Umum", simExp: 380, exp: 3, training: false, phone: "0813-0000-2006", notes: "Skenario demo: belum training defensive driving — tidak boleh membawa Tronton." },
  { id: "DRV-07", name: "Rahmat Hidayat", sim: "B1 Umum", simExp: 270, exp: 2, training: false, phone: "0813-0000-2007", notes: "Skenario demo: masih punya saldo uang jalan belum di-settle." },
  { id: "DRV-08", name: "Supriyadi", sim: "B1 Umum", simExp: 450, exp: 1.5, training: false, phone: "0813-0000-2008" },
  { id: "DRV-09", name: "Andi Kurniawan", sim: "B1 Umum", simExp: 600, exp: 1, training: false, phone: "0813-0000-2009" },
  { id: "DRV-10", name: "Dedi Setiawan", sim: "B1 Umum", simExp: 330, exp: 0.5, training: false, phone: "0813-0000-2010" },
  { id: "DRV-11", name: "Yusuf Ramadhan", sim: "B1 Umum", simExp: 700, exp: 0.8, training: false, phone: "0813-0000-2011" },
  { id: "DRV-12", name: "Ilham Saputra", sim: "B1 Umum", simExp: 250, exp: 0.3, training: false, phone: "0813-0000-2012" },
];
/** Aturan kualifikasi 1.3 (disederhanakan) — sama dengan qualifiesFor() di src/app/modules/logistics/lib.ts. */
function qualifies(d, code) {
  const b2 = d.sim === "B2 Umum";
  switch (code) {
    case "CDE": case "CDD": return true;
    case "FUSO": return d.exp >= 1;
    case "TRONTON": return d.training && d.exp >= 2;
    case "TRAILER": return b2 && d.training && d.trailer;
  }
  return false;
}

const HELPERS = [
  { id: "HLP-01", name: "Ujang Supardi", phone: "0857-0000-3001", pref: "DRV-01" },
  { id: "HLP-02", name: "Asep Sunandar", phone: "0857-0000-3002", pref: "DRV-02" },
  { id: "HLP-03", name: "Wawan Hermawan", phone: "0857-0000-3003", pref: "DRV-03" },
  { id: "HLP-04", name: "Dodi Kusnadi", phone: "0857-0000-3004" },
  { id: "HLP-05", name: "Rizki Maulana", phone: "0857-0000-3005" },
  { id: "HLP-06", name: "Fajar Nugroho", phone: "0857-0000-3006" },
];

// ---------- Order contoh (hanya dibuat bila belum ada) ----------
const ORDERS = [
  { id: "ORD-001", no: 1, client: "SPL", route: "SMG", type: "TRONTON", load: 1, time: "06:00", origin: "LOC-SPL-WH", cargo: "Mi instan & minuman kemasan (1.200 karton)", ton: 14, value: 450e6,
    stops: ["LOC-SPL-SMG", "LOC-SPL-KDL", "LOC-SPL-UNG"], tkbm: true, status: "Confirmed", source: "Teks", ref: "PO-SPL-2611-018" },
  { id: "ORD-002", no: 2, client: "EPI", route: "SBY", type: "FUSO", load: 2, time: "08:00", origin: "LOC-EPI-WH", cargo: "Televisi LED 43\" (320 unit)", ton: 6.5, value: 1.6e9,
    stops: ["LOC-EPI-SBY"], insurance: true, escort: true, status: "Draft", source: "Manual", ref: "DO-EPI-7731" },
  { id: "ORD-003", no: 3, client: "KPI", route: "BDG", type: "CDD", load: 0, time: "13:00", origin: "LOC-KPI-WH", cargo: "Botol PET & preform (180 bal)", ton: 3.8, value: 85e6,
    stops: ["LOC-KPI-BDG"], status: "Confirmed", source: "Suara" },
];

function price(o, rates, surcharges, client, type) {
  const size = type.sizeClass;
  const s = code => surcharges.find(x => x.code === code);
  const amt = code => (size === "small" ? s(code).smallAmount : s(code).largeAmount);
  const base = RATES[o.route][TYPES.findIndex(t => t.code === o.type)];
  const lines = [{ code: "BASE", label: `Tarif charter ${type.name}`, detail: `Cikarang → ${ROUTES.find(r => r.code === o.route).destination} (${o.route})`, amount: base }];
  const extra = o.stops.length - 1;
  if (extra > 0) lines.push({ code: "EXTRA_DROP", label: s("EXTRA_DROP").name, detail: `${extra} titik`, amount: extra * amt("EXTRA_DROP") });
  if (o.tkbm) lines.push({ code: "TKBM", label: s("TKBM").name, detail: "per trip", amount: amt("TKBM") });
  if (o.escort) lines.push({ code: "ESCORT", label: s("ESCORT").name, detail: "per trip", amount: amt("ESCORT") });
  if (o.insurance) lines.push({ code: "INSURANCE", label: s("INSURANCE").name, detail: "0,1% × nilai barang", amount: Math.max(Math.round(o.value * 0.001), 100e3) });
  const gross = lines.reduce((a, l) => a + l.amount, 0);
  const discountPercent = client.contractDiscountPercent;
  const discountAmount = Math.round(gross * discountPercent / 100);
  const subtotal = gross - discountAmount;
  const taxAmount = Math.round(subtotal * 0.11);
  return { baseRate: base, surchargeTotal: gross - base, discountPercent, discountAmount, subtotal, taxPercent: 11, taxAmount, total: subtotal + taxAmount, breakdownJson: JSON.stringify(lines) };
}

// ---------- Dokumen armada & sopir (rancangan 10.1) ----------
// Gambar contoh dibuat dinamis oleh route /modules/logistics/fleet/sample/<kind>/<id> (berwatermark "CONTOH").
const PKB_AMOUNT = { CDE: 1.85e6, CDD: 2.4e6, FUSO: 3.6e6, TRONTON: 5.2e6, TRAILER: 7.8e6 };
/** Polis asuransi tahunan: jatuh tempo dalam 1 tahun ke depan (VH-03 → 18 hari, muncul sebagai peringatan). */
const insOffset = v => ((v.stnk + 30) % 365 + 365) % 365 || 365;
const SAMPLE = (kind, id) => `/modules/logistics/fleet/sample/${kind}/${id}`;

async function upsert(model, id, data) {
  await prisma[model].upsert({ where: { id }, update: data, create: { id, ...data } });
}

async function seedFleetDocuments() {
  const base = { source: "Demo Data", status: "Verified", createdBy: "Demo Data", verifiedBy: "Agus Saputra" };
  for (const v of VEHICLES) {
    const vid = P + v.id;
    const plateDigits = v.plateNo.replace(/\D/g, "");
    const at = n => day(n) + "T08:00:00.000Z";
    const vdoc = async (suffix, data) => {
      const id = `${P}VDOC-${v.id}-${suffix}`;
      await upsert("vehicleDocument", id, { vehicleId: vid, ...base, verifiedAt: data.createdAt, fileUrl: SAMPLE("vehicle", id), notes: null, ...data });
    };
    await vdoc("STNK-1", { docType: "STNK", docNo: `STNK-${plateDigits}-${v.year}`, holderName: "PT Arunika Trans Nusantara", validFrom: day(v.stnk - 1825), validUntil: day(v.stnk), fileName: "contoh-stnk.svg", createdAt: at(v.stnk - 1825) });
    if (v.stnk < 0) {
      // Bukti proses perpanjangan (bahan override #5 di Tahap 2): draft tanpa masa berlaku baru.
      await vdoc("STNK-2", { docType: "STNK", docNo: null, holderName: "PT Arunika Trans Nusantara", validFrom: null, validUntil: null, status: "Draft", verifiedBy: null, verifiedAt: null, fileUrl: null, fileName: null,
        notes: "Proses perpanjangan STNK 5 tahunan di Samsat — tanda terima sudah ada, STNK baru belum terbit.", createdAt: at(-3) });
    }
    await vdoc("PKB-1", { docType: "PKB", docNo: `SKPD-${plateDigits}-${day(v.pkb - 365).slice(0, 4)}`, holderName: "PT Arunika Trans Nusantara", validFrom: day(v.pkb - 730), validUntil: day(v.pkb - 365), amount: PKB_AMOUNT[v.type], paidDate: day(v.pkb - 733), fileName: "contoh-pkb.svg", createdAt: at(v.pkb - 733) });
    await vdoc("PKB-2", { docType: "PKB", docNo: `SKPD-${plateDigits}-${day(v.pkb).slice(0, 4)}`, holderName: "PT Arunika Trans Nusantara", validFrom: day(v.pkb - 365), validUntil: day(v.pkb), amount: PKB_AMOUNT[v.type], paidDate: day(v.pkb - 368), fileName: "contoh-pkb.svg", createdAt: at(v.pkb - 368) });
    await vdoc("KIR-1", { docType: "KIR", docNo: `KIR-BKS-${plateDigits}-A`, validFrom: day(v.kir - 364), validUntil: day(v.kir - 182), fileName: "contoh-kir.svg", createdAt: at(v.kir - 364) });
    await vdoc("KIR-2", { docType: "KIR", docNo: `KIR-BKS-${plateDigits}-B`, validFrom: day(v.kir - 182), validUntil: day(v.kir), fileName: "contoh-kir.svg", createdAt: at(v.kir - 182) });
    await vdoc("INS-1", { docType: "INSURANCE", docNo: `POL-AK-${plateDigits}`, holderName: "Asuransi Contoh Sejahtera (fiktif)", validFrom: day(insOffset(v) - 365), validUntil: day(insOffset(v)), amount: Math.round(PKB_AMOUNT[v.type] * 2.2), fileName: "contoh-polis.svg", createdAt: at(insOffset(v) - 365) });

    // Riwayat servis: dua servis berkala; yang terakhir menentukan jadwal berikutnya (svcDate / svcKm).
    const lastKm = Math.min(v.svcKm - 10000, v.odometerKm - 500);
    const small = v.type === "CDE" || v.type === "CDD";
    const svc = async (suffix, data) => {
      const id = `${P}SVC-${v.id}-${suffix}`;
      await upsert("vehicleServiceRecord", id, { vehicleId: vid, createdBy: "Demo Data", createdAt: data.serviceDate + "T09:00:00.000Z", fileUrl: SAMPLE("service", id), fileName: "contoh-nota-servis.svg", notes: null, ...data });
    };
    await svc("1", { serviceDate: day(v.svcDate - 180), odometerKm: lastKm - 10000, workshop: "Bengkel Contoh Diesel Cikarang", kind: "Berkala", items: "Ganti oli mesin & filter oli, cek rem & kopling", cost: small ? 1.1e6 : 2.4e6, nextServiceDate: day(v.svcDate - 90), nextServiceKm: lastKm });
    await svc("2", { serviceDate: day(v.svcDate - 90), odometerKm: lastKm, workshop: "Bengkel Contoh Diesel Cikarang", kind: "Berkala", items: "Ganti oli mesin, filter oli & solar, grease, setel rem", cost: small ? 1.35e6 : 2.9e6, nextServiceDate: day(v.svcDate), nextServiceKm: v.svcKm });
    if (v.id === "VH-07") {
      await svc("3", { serviceDate: day(-2), odometerKm: v.odometerKm, workshop: "Bengkel Contoh Truk Bekasi", kind: "Perbaikan", items: "Ganti kampas kopling & bearing (dalam pengerjaan)", cost: 4.75e6, nextServiceDate: null, nextServiceKm: null, notes: "Estimasi selesai 3 hari." });
    }
  }

  for (const d of DRIVERS) {
    const did = P + d.id;
    const simNo = `SIM-${d.id.slice(-2)}00${d.id.slice(-2)}`;
    const at = n => day(n) + "T08:00:00.000Z";
    const ddoc = async (suffix, data) => {
      const id = `${P}DDOC-${d.id}-${suffix}`;
      await upsert("driverDocument", id, { driverId: did, ...base, holderName: d.name, verifiedAt: data.createdAt, fileUrl: SAMPLE("driver", id), notes: null, ...data });
    };
    // SIM periode lalu (sopir B2 dulu masih B1) + SIM yang berlaku sekarang.
    await ddoc("SIM-1", { docType: "SIM", docNo: simNo.replace("SIM-", "SIM-L"), simClass: "B1 Umum", issuer: "Satpas Contoh Bekasi", validFrom: day(d.simExp - 3650), validUntil: day(d.simExp - 1825), fileName: "contoh-sim.svg", createdAt: at(d.simExp - 3650) });
    await ddoc("SIM-2", { docType: "SIM", docNo: simNo, simClass: d.sim, issuer: "Satpas Contoh Bekasi", validFrom: day(d.simExp - 1825), validUntil: day(d.simExp), fileName: "contoh-sim.svg", createdAt: at(d.simExp - 1825) });
    if (d.training) {
      const until = d.id === "DRV-03" ? 20 : 430; // DRV-03: sertifikat training hampir habis (muncul di Expiring documents)
      await ddoc("TRN-1", { docType: "TRAINING_DEFENSIVE", docNo: `DDT-${d.id.slice(-2)}-2025`, issuer: "Lembaga Pelatihan Keselamatan Contoh", validFrom: day(until - 730), validUntil: day(until), fileName: "contoh-sertifikat.svg", createdAt: at(until - 730) });
    }
    if (d.trailer) {
      await ddoc("TRL-1", { docType: "TRAINING_TRAILER", docNo: `TRL-${d.id.slice(-2)}-2025`, issuer: "Lembaga Pelatihan Keselamatan Contoh", validFrom: day(-200), validUntil: day(530), fileName: "contoh-sertifikat.svg", createdAt: at(-200) });
    }
  }
}

async function main() {
  await ensureRolesAndUsers();
  await prisma.companyProfile.upsert({ where: { key: COMPANY.key }, update: { ...COMPANY, id: undefined }, create: COMPANY });

  for (const [i, t] of TYPES.entries()) {
    const data = { ...t, sortOrder: i + 1 };
    await prisma.truckType.upsert({ where: { id: typeId(t.code) }, update: data, create: { id: typeId(t.code), ...data } });
  }
  for (const [i, r] of ROUTES.entries()) {
    const data = { code: r.code, origin: "Cikarang", destination: r.destination, distanceKm: r.distanceKm, durationHours: r.durationHours, toll1: r.toll[0], toll2: r.toll[1], toll3: r.toll[2], destLat: r.lat, destLng: r.lng, isActive: true, sortOrder: i + 1 };
    await prisma.logisticsRoute.upsert({ where: { id: routeId(r.code) }, update: data, create: { id: routeId(r.code), ...data } });
    for (const [j, t] of TYPES.entries()) {
      const id = `${P}RATE-${r.code}-${t.code}`;
      const rate = { routeId: routeId(r.code), truckTypeId: typeId(t.code), price: RATES[r.code][j], updatedBy: "Demo Data", updatedAt: nowIso };
      await prisma.charterRate.upsert({ where: { id }, update: rate, create: { id, ...rate } });
    }
  }
  for (const [i, s] of SURCHARGES.entries()) {
    const data = { smallAmount: null, largeAmount: null, percent: null, minAmount: null, ...s, sortOrder: i + 1 };
    await prisma.rateSurcharge.upsert({ where: { id: P + "SC-" + s.code }, update: data, create: { id: P + "SC-" + s.code, ...data } });
  }
  for (const c of CLIENTS) {
    await prisma.logisticsClient.upsert({ where: { id: clientId(c.code) }, update: c, create: { id: clientId(c.code), ...c, createdAt: day(-120) } });
  }
  for (const l of LOCATIONS) {
    const data = { clientId: l.client ? clientId(l.client) : null, name: l.name, kind: l.kind, city: l.city, address: l.address ?? null, lat: l.lat, lng: l.lng };
    await prisma.logisticsLocation.upsert({ where: { id: P + l.id }, update: data, create: { id: P + l.id, ...data } });
  }
  for (const v of VEHICLES) {
    const data = {
      plateNo: v.plateNo, truckTypeId: typeId(v.type), brand: v.brand, year: v.year, status: v.status ?? "Ready", odometerKm: v.odometerKm,
      stnkExpiry: day(v.stnk), kirExpiry: day(v.kir), insuranceExpiry: day(insOffset(v)), pkbExpiry: day(v.pkb), nextServiceDate: day(v.svcDate), nextServiceKm: v.svcKm,
      tollMethod: v.tollMethod, tollCardNo: v.tollCardNo ?? null, notes: v.notes ?? null,
    };
    await prisma.vehicle.upsert({ where: { id: P + v.id }, update: data, create: { id: P + v.id, ...data } });
  }
  for (const d of DRIVERS) {
    const data = {
      code: d.id.replace("DRV-", "SPR-"), name: d.name, phone: d.phone, userEmail: d.email ?? null, simClass: d.sim, simNo: `SIM-${d.id.slice(-2)}00${d.id.slice(-2)}`,
      simExpiry: day(d.simExp), experienceYears: d.exp, defensiveTraining: !!d.training, trailerCertified: !!d.trailer, status: "Active", notes: d.notes ?? null,
    };
    await prisma.driver.upsert({ where: { id: P + d.id }, update: data, create: { id: P + d.id, ...data } });
    for (const t of TYPES) {
      const id = `${P}QL-${d.id}-${t.code}`;
      if (qualifies(d, t.code)) {
        await prisma.driverQualification.upsert({ where: { id }, update: { basis: "auto" }, create: { id, driverId: P + d.id, truckTypeId: typeId(t.code), basis: "auto" } });
      }
    }
  }
  for (const h of HELPERS) {
    const data = { code: h.id.replace("HLP-", "KNK-"), name: h.name, phone: h.phone, idCardNo: `3216${h.id.slice(-2)}0000000000`.slice(0, 16), preferredDriverId: h.pref ? P + h.pref : null, status: "Active" };
    await prisma.helper.upsert({ where: { id: P + h.id }, update: data, create: { id: P + h.id, ...data } });
  }

  await seedFleetDocuments();

  const surcharges = await prisma.rateSurcharge.findMany();
  const ym = day(0).slice(0, 7).replace("-", "/");
  for (const o of ORDERS) {
    const id = P + o.id;
    if (await prisma.charterOrder.findUnique({ where: { id } })) continue;
    const orderNo = `ATN/ORD/${ym}/${String(o.no).padStart(4, "0")}`;
    if (await prisma.charterOrder.findUnique({ where: { orderNo } })) continue; // nomor sudah dipakai order user
    const client = CLIENTS.find(c => c.code === o.client);
    const type = TYPES.find(t => t.code === o.type);
    const origin = LOCATIONS.find(l => l.id === o.origin);
    const pr = price(o, RATES, surcharges, client, type);
    await prisma.charterOrder.create({ data: {
      id, orderNo, clientId: clientId(o.client), routeId: routeId(o.route), truckTypeId: typeId(o.type),
      clientRef: o.ref ?? null, loadDate: day(o.load), loadTime: o.time, originName: origin.name, originAddress: origin.city,
      cargoDesc: o.cargo, cargoWeightTon: o.ton, cargoValue: o.value, tkbm: !!o.tkbm, escort: !!o.escort, insurance: !!o.insurance,
      ...pr, status: o.status, source: o.source, trackingToken: crypto.randomBytes(12).toString("hex"),
      createdBy: "Nadia Putri", createdAt: nowIso, historyJson: history(`Order dibuat (${o.source})`, "Nadia Putri"),
      stops: { create: o.stops.map((sid, i) => { const l = LOCATIONS.find(x => x.id === sid); return { id: `${id}-S${i + 1}`, seq: i + 1, name: l.name, city: l.city }; }) },
    } });
  }

  const docCounts = await Promise.all([prisma.vehicleDocument.count({ where: { id: { startsWith: P } } }), prisma.driverDocument.count({ where: { id: { startsWith: P } } }), prisma.vehicleServiceRecord.count({ where: { id: { startsWith: P } } })]);
  console.log(`Dokumen demo — truk ${docCounts[0]}, sopir ${docCounts[1]}, riwayat servis ${docCounts[2]}.`);
  const counts = await Promise.all([prisma.vehicle.count({ where: { id: { startsWith: P } } }), prisma.driver.count({ where: { id: { startsWith: P } } }), prisma.helper.count({ where: { id: { startsWith: P } } }), prisma.logisticsClient.count({ where: { id: { startsWith: P } } }), prisma.logisticsRoute.count({ where: { id: { startsWith: P } } }), prisma.charterRate.count({ where: { id: { startsWith: P } } }), prisma.charterOrder.count({ where: { id: { startsWith: P } } })]);
  console.log(`Logistik demo OK — truk ${counts[0]}, sopir ${counts[1]}, kenek ${counts[2]}, klien ${counts[3]}, rute ${counts[4]}, tarif ${counts[5]}, order contoh ${counts[6]}.`);
  console.log(`Akun demo (password ${PASSWORD}): ${USERS.map(u => u.email).join(", ")}`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
