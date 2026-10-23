"use server";

import ExcelJS from "exceljs";

// Palet mengikuti UI ERP: netral slate + biru-600 sebagai warna utama.
const C = {
  ink: "0F172A",        // slate-900
  text: "1E293B",       // slate-800
  muted: "64748B",      // slate-500
  line: "E2E8F0",       // slate-200
  zebra: "F8FAFC",      // slate-50
  header: "2563EB",     // blue-600
  headerText: "FFFFFF",
  accentSoft: "EFF6FF", // blue-50
  overdue: "B91C1C",    // red-700
};

// Badge untuk kolom status/level: warna lembut + teks gelap (terbaca saat dicetak hitam-putih).
const BADGE: { match: RegExp; fill: string; font: string }[] = [
  { match: /^(critical|major|overdue|rejected|fail|blacklisted|expired|accident|ng)$/i, fill: "FEE2E2", font: "991B1B" },
  { match: /^(high|open|suspended|investigating|under investigation|near miss|on hold|revoked)$/i, fill: "FFEDD5", font: "9A3412" },
  { match: /^(medium|minor|warning|conditional|conditional approval|draft|pending|requested|planned|scheduled|adjusted|root cause analysis|action plan|in treatment)$/i, fill: "FEF9C3", font: "854D0E" },
  { match: /^(in progress|verification|assessed|under review|monitored|action taken|ofi|info)$/i, fill: "DBEAFE", font: "1E40AF" },
  { match: /^(closed|completed|pass|approved|published|active|implemented|low|effective|conform|delivered|resolved|accepted|true)$/i, fill: "DCFCE7", font: "166534" },
];

const thin = (argb: string): ExcelJS.Border => ({ style: "thin", color: { argb } });
const gridBorder: Partial<ExcelJS.Borders> = { top: thin(C.line), left: thin(C.line), bottom: thin(C.line), right: thin(C.line) };

export type ColDef = {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  /** Nilai "YYYY-MM-DD" diubah jadi tanggal Excel asli (bisa di-sort/filter). */
  type?: "text" | "date" | "number" | "badge" | "longtext";
};

type CellValue = string | number | boolean | null | undefined;

export type SheetDef = {
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: ColDef[];
  rows: Record<string, CellValue>[];
  /** Kunci kolom tanggal jatuh tempo: diberi warna merah bila lewat & record belum selesai. */
  overdueKey?: string;
  /** Status yang dianggap selesai (tidak ditandai overdue). */
  closedStatuses?: string[];
  statusKey?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function toCellValue(col: ColDef, v: CellValue): ExcelJS.CellValue {
  if (v === null || v === undefined || v === "") return "";
  if (col.type === "date" && typeof v === "string" && DATE_RE.test(v)) {
    const [y, m, d] = v.slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  return v;
}

/** Lebar kolom dari isi terpanjang (dibatasi supaya tabel tetap rapi). */
function fitWidth(col: ColDef, rows: Record<string, CellValue>[]) {
  if (col.width) return col.width;
  // Header butuh ruang ekstra untuk tombol filter (autofilter) di kanan sel.
  const headerWidth = col.header.length + 6;
  if (col.type === "date") return Math.max(14, headerWidth);
  const content = Math.max(0, ...rows.map(r => String(r[col.key] ?? "").length)) + 3;
  const cap = col.type === "longtext" ? 60 : 36;
  return Math.min(Math.max(headerWidth, content, 10), cap);
}

function addSheet(wb: ExcelJS.Workbook, opts: SheetDef) {
  const colCount = opts.columns.length;
  const HEADER_ROW = 4;
  const ws = wb.addWorksheet(opts.sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: HEADER_ROW, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
    pageSetup: {
      orientation: colCount > 6 ? "landscape" : "portrait",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
      printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`,
    },
    headerFooter: {
      oddFooter: `&L&8${opts.title}&R&8Halaman &P dari &N`,
    },
  });

  ws.columns = opts.columns.map(c => ({ key: c.key, width: fitWidth(c, opts.rows) }));

  // Baris 1: judul
  ws.mergeCells(1, 1, 1, colCount);
  const title = ws.getCell(1, 1);
  title.value = opts.title;
  title.font = { name: "Calibri", size: 16, bold: true, color: { argb: C.ink } };
  title.alignment = { vertical: "middle" };
  ws.getRow(1).height = 30;

  // Baris 2: keterangan ekspor
  ws.mergeCells(2, 1, 2, colCount);
  const generated = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" });
  const sub = ws.getCell(2, 1);
  sub.value = opts.subtitle || `QMS ERP · Diekspor ${generated} WIB · ${opts.rows.length} record`;
  sub.font = { name: "Calibri", size: 10, color: { argb: C.muted } };
  sub.alignment = { vertical: "middle" };
  ws.getRow(2).height = 18;

  // Baris 3: garis aksen tipis di bawah judul
  ws.getRow(3).height = 6;
  for (let i = 1; i <= colCount; i++) {
    ws.getCell(3, i).border = { top: { style: "medium", color: { argb: C.header } } };
  }

  // Baris 4: header kolom
  const headerRow = ws.getRow(HEADER_ROW);
  opts.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.header } };
    cell.alignment = { horizontal: col.type === "number" ? "right" : "left", vertical: "middle", wrapText: true, indent: 1 };
    cell.border = { ...gridBorder, top: thin(C.header), bottom: thin(C.header) };
  });
  headerRow.height = 26;

  const today = new Date().toISOString().slice(0, 10);
  const closed = new Set((opts.closedStatuses ?? []).map(s => s.toLowerCase()));

  opts.rows.forEach((row, idx) => {
    const r = ws.addRow(opts.columns.map(c => toCellValue(c, row[c.key])));
    const zebra = idx % 2 === 1;
    const status = opts.statusKey ? String(row[opts.statusKey] ?? "").toLowerCase() : "";
    const isOverdue = Boolean(
      opts.overdueKey && typeof row[opts.overdueKey] === "string" && DATE_RE.test(String(row[opts.overdueKey])) &&
      String(row[opts.overdueKey]).slice(0, 10) < today && !closed.has(status)
    );
    let tall = false;

    opts.columns.forEach((col, i) => {
      const cell = r.getCell(i + 1);
      const raw = row[col.key];
      cell.font = { name: "Calibri", size: 10, color: { argb: C.text } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra ? C.zebra : "FFFFFF" } };
      cell.border = gridBorder;
      cell.alignment = { vertical: "top", wrapText: col.type === "longtext", indent: 1, horizontal: col.type === "number" ? "right" : "left" };
      if (col.numFmt) cell.numFmt = col.numFmt;
      if (col.type === "date") cell.numFmt = "dd mmm yyyy";
      if (col.type === "longtext" && String(raw ?? "").length > 60) tall = true;

      if (col.type === "badge" && raw !== null && raw !== undefined && raw !== "") {
        const badge = BADGE.find(b => b.match.test(String(raw).trim()));
        if (badge) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: badge.fill } };
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: badge.font } };
        }
      }
      if (isOverdue && col.key === opts.overdueKey) {
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.overdue } };
        cell.note = "Lewat jatuh tempo";
      }
    });
    r.height = tall ? 32 : 20;
  });

  // Ringkasan di bawah tabel
  if (opts.rows.length) {
    const sumRow = ws.addRow([]);
    sumRow.height = 8;
    const total = ws.addRow([`Total: ${opts.rows.length} record`]);
    total.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: C.text } };
    if (opts.overdueKey) {
      const overdueCount = opts.rows.filter(row => {
        const v = String(row[opts.overdueKey!] ?? "");
        const st = opts.statusKey ? String(row[opts.statusKey] ?? "").toLowerCase() : "";
        return DATE_RE.test(v) && v.slice(0, 10) < today && !closed.has(st);
      }).length;
      if (overdueCount) {
        const c = ws.addRow([`Lewat jatuh tempo: ${overdueCount} record (tanggal bertanda merah)`]).getCell(1);
        c.font = { name: "Calibri", size: 10, color: { argb: C.overdue } };
      }
    }
  } else {
    const empty = ws.addRow(["Tidak ada data."]);
    empty.getCell(1).font = { name: "Calibri", size: 10, italic: true, color: { argb: C.muted } };
  }

  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: colCount } };
}

export async function buildExcel(opts: SheetDef & {
  extraSheets?: SheetDef[];
}): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QMS ERP";
  wb.created = new Date();
  wb.title = opts.title;

  addSheet(wb, opts);
  for (const sheet of opts.extraSheets ?? []) addSheet(wb, sheet);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer).toString("base64");
}
