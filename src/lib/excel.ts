"use server";

import ExcelJS from "exceljs";

const HEADER_BG   = "2D5BE3";
const HEADER_FONT = "FFFFFF";
const ROW_ALT_BG  = "EEF3FF";
const BORDER_CLR  = "C5CFEA";

const border: ExcelJS.Border = { style: "thin", color: { argb: BORDER_CLR } };
const allBorders: Partial<ExcelJS.Borders> = { top: border, left: border, bottom: border, right: border };

export type ColDef = {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
};

export type SheetDef = {
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: ColDef[];
  rows: Record<string, string | number | boolean | null | undefined>[];
};

function addSheet(wb: ExcelJS.Workbook, opts: SheetDef) {
  const ws = wb.addWorksheet(opts.sheetName, {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  const colCount = opts.columns.length;

  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell("A1");
  titleCell.value = opts.title;
  titleCell.font = { bold: true, size: 14, color: { argb: HEADER_FONT }, name: "Calibri" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.border = allBorders;
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, colCount);
  const subtitleCell = ws.getCell("A2");
  const generated = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  subtitleCell.value = opts.subtitle || `Generated: ${generated}`;
  subtitleCell.font = { italic: true, size: 10, color: { argb: "555555" }, name: "Calibri" };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D6E4FF" } };
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
  subtitleCell.border = allBorders;
  ws.getRow(2).height = 18;

  ws.columns = opts.columns.map(c => ({ key: c.key, width: c.width ?? 20 }));

  const headerRow = ws.getRow(3);
  opts.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 11, color: { argb: HEADER_FONT }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4A6FD4" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = allBorders;
  });
  headerRow.height = 30;

  opts.rows.forEach((row, rowIdx) => {
    const excelRow = ws.addRow(opts.columns.map(c => row[c.key] ?? ""));
    const isAlt = rowIdx % 2 === 1;
    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const col = opts.columns[colNumber - 1];
      cell.font = { size: 10, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isAlt ? ROW_ALT_BG : "FFFFFF" } };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = allBorders;
      if (col?.numFmt) cell.numFmt = col.numFmt;
    });
    excelRow.height = 22;
  });

  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: colCount },
  };
}

export async function buildExcel(opts: SheetDef & {
  extraSheets?: SheetDef[];
}): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QMS-ERP System";
  wb.created = new Date();

  addSheet(wb, opts);

  if (opts.extraSheets) {
    for (const sheet of opts.extraSheets) {
      addSheet(wb, sheet);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer).toString("base64");
}
