/**
 * Membuat file contoh (PDF SOP, sertifikat kalibrasi, bukti NC) untuk data demo.
 * Butuh Google Chrome terpasang. Jalankan: node scripts/demo-data/make-files.cjs
 * Hasil: scripts/demo-data/files/*  (diunggah oleh seed.cjs)
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const OUT = path.join(ROOT, "files");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
fs.mkdirSync(OUT, { recursive: true });

const fill = (tpl, vars) => Object.entries(vars).reduce((s, [k, v]) => s.split(`{{${k}}}`).join(v), tpl);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qms-demo-"));

function render(html, outFile, { pdf = false, width = 820, height = 1060 } = {}) {
  const src = path.join(tmp, path.basename(outFile) + ".html");
  fs.writeFileSync(src, html);
  const url = "file:///" + src.replace(/\\/g, "/");
  const args = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=4000"];
  if (pdf) args.push("--no-pdf-header-footer", `--print-to-pdf=${outFile}`);
  else args.push(`--window-size=${width},${height}`, `--screenshot=${outFile}`);
  execFileSync(CHROME, [...args, url], { stdio: "ignore" });
  console.log("dibuat", path.basename(outFile), Math.round(fs.statSync(outFile).size / 1024) + " KB");
}

// --- Dokumen SOP / WI (PDF) ---
const sop = fs.readFileSync(path.join(ROOT, "templates", "sop.html"), "utf8");
const docs = [
  {
    file: "DEMO-SOP-QA-001.pdf", DOCNO: "DEMO-SOP-QA-001", TITLE: "Pengendalian Produk Tidak Sesuai", DATE: "01-07-2026",
    PURPOSE: "Memastikan produk yang tidak sesuai persyaratan diidentifikasi dan dikendalikan agar tidak digunakan atau dikirim tanpa sengaja (ISO 9001 klausul 8.7).",
    SCOPE: "Bahan baku, produk dalam proses, dan produk jadi di seluruh area produksi dan gudang.",
    STEPS: ["Pisahkan produk dan pasang label HOLD merah.", "Catat temuan di modul NC Management (Raise NCR).", "QA menentukan disposisi: rework, repair, use-as-is, atau scrap.", "Lakukan analisis akar masalah (5 Why) untuk temuan Major/Critical.", "Verifikasi efektivitas tindakan sebelum NCR ditutup."],
    RECORDS: [["Laporan NCR", "QA Engineer", "3 tahun"], ["Label HOLD & disposisi", "QC Inspector", "1 tahun"]],
  },
  {
    file: "DEMO-WI-PRD-002.pdf", DOCNO: "DEMO-WI-PRD-002", TITLE: "Instruksi Kerja Pengelasan TIG Flange SS304", DATE: "15-08-2026",
    PURPOSE: "Memberikan langkah standar pengelasan TIG flange stainless steel agar bebas porositas dan sesuai WPS.",
    SCOPE: "Line welding 1 dan 2, flange SS304 DN25–DN100.",
    STEPS: ["Pastikan welder memiliki sertifikat aktif (modul Welding).", "Bersihkan area las dengan aseton, pastikan kering.", "Set gas argon 8–12 L/menit, cek kebocoran selang.", "Las sesuai parameter WPS-SS-04.", "Lakukan inspeksi visual dan dye penetrant 10% sampel per lot."],
    RECORDS: [["Checklist parameter las", "Operator", "1 tahun"], ["Laporan dye penetrant", "QC Inspector", "3 tahun"]],
  },
  {
    file: "DEMO-SOP-HR-003.pdf", DOCNO: "DEMO-SOP-HR-003", TITLE: "Penilaian Kompetensi Karyawan (Terbatas)", DATE: "01-03-2026",
    PURPOSE: "Menetapkan cara menilai kompetensi personel yang pekerjaannya memengaruhi mutu (ISO 9001 klausul 7.2).",
    SCOPE: "Seluruh karyawan tetap dan kontrak di bagian produksi dan QA.",
    STEPS: ["HR menyiapkan matriks kompetensi per jabatan.", "Atasan langsung menilai setiap semester.", "Gap kompetensi ditindaklanjuti dengan rencana training.", "Hasil penilaian disimpan rahasia oleh HR."],
    RECORDS: [["Matriks kompetensi", "HR & Admin", "5 tahun"]],
  },
];
for (const d of docs) {
  render(fill(sop, {
    ...d,
    STEPS: d.STEPS.map(s => `<li>${s}</li>`).join(""),
    RECORDS: d.RECORDS.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join(""),
  }), path.join(OUT, d.file), { pdf: true });
}

// --- Sertifikat kalibrasi (PNG) ---
const cert = fs.readFileSync(path.join(ROOT, "templates", "cert.html"), "utf8");
const rows = (unit, points, tol) =>
  `<tr><th>Nominal (${unit})</th><th>Pembacaan</th><th>Toleransi</th><th>Status</th></tr>` +
  points.map(([n, r]) => `<tr><td>${n}</td><td>${r}</td><td>± ${tol}</td><td>OK</td></tr>`).join("");
const certs = [
  { file: "DEMO-CERT-MIC-2026.png", CERTNO: "DEMO-SK/2026/04/0118", NAME: "Outside Micrometer 0–25 mm", SERIAL: "DEMO-CAL-002", DATE: "12-04-2026", NEXT: "12-04-2027", STANDARD: "Gauge Block Set Grade 0 (GB-01)", ROWS: rows("mm", [["5.000", "5.001"], ["10.000", "10.001"], ["25.000", "25.002"]], "0.004"), CONCLUSION: "Alat memenuhi spesifikasi (PASS)." },
  { file: "DEMO-CERT-TT-2026.png", CERTNO: "DEMO-SK/2026/09/0377", NAME: "Torque Wrench 20–100 Nm", SERIAL: "DEMO-CAL-004", DATE: "03-09-2026", NEXT: "03-03-2027", STANDARD: "Torque Transducer TT-200 (tertelusur ke SI)", ROWS: rows("Nm", [["20", "20.9"], ["60", "61.8"], ["100", "103.9"]], "4%"), CONCLUSION: "Lulus setelah penyetelan (ADJUSTED): deviasi awal 6% pada 100 Nm." },
];
for (const c of certs) render(fill(cert, c), path.join(OUT, c.file));

// --- Bukti tindakan NC (PNG) ---
render(`<!doctype html><html><body style="margin:0;width:820px;height:600px;font-family:Arial;background:#f8fafc;display:flex;align-items:center;justify-content:center">
<div style="width:740px;padding:28px;background:#fff;border:2px solid #334155;border-radius:10px">
<div style="font-size:12px;color:#64748b">BUKTI TINDAKAN — CONTOH / DEMO · perusahaan fiktif</div>
<h2 style="margin:6px 0 14px">DEMO-NC-002 · Rework las flange Lot 2610-03</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><td style="border:1px solid #94a3b8;padding:8px;width:40%">Jumlah di-rework</td><td style="border:1px solid #94a3b8;padding:8px">18 pcs</td></tr>
<tr><td style="border:1px solid #94a3b8;padding:8px">Hasil dye penetrant ulang</td><td style="border:1px solid #94a3b8;padding:8px">18/18 lulus, tidak ada indikasi porositas</td></tr>
<tr><td style="border:1px solid #94a3b8;padding:8px">Diperiksa oleh</td><td style="border:1px solid #94a3b8;padding:8px">QC Final</td></tr>
<tr><td style="border:1px solid #94a3b8;padding:8px">Tanggal</td><td style="border:1px solid #94a3b8;padding:8px">20-10-2026 (rencana)</td></tr>
</table></div></body></html>`, path.join(OUT, "DEMO-NC-002-bukti-rework.png"), { width: 820, height: 600 });

fs.rmSync(tmp, { recursive: true, force: true });
