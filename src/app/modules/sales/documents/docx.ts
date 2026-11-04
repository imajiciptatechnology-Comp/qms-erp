import fs from "fs";
import path from "path";
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, VerticalAlignTable, WidthType, type IBorderOptions, type ParagraphChild, type TableVerticalAlign,
} from "docx";
import { DEFAULT_BRAND } from "./letterhead";
import type { Block, Cell, DocBrand, DocModel, Signature } from "./model";

const FONT = "Arial";
const PAGE_W = 9638; // A4 dikurangi margin 2 cm kiri-kanan, dalam twip
type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

/** Semua helper dibuat per kop (warna, logo, nama perusahaan). */
function createDocxKit(L: DocBrand) {
const C = Object.fromEntries(Object.entries(L.colors).map(([k, v]) => [k, v.replace("#", "")])) as Record<keyof DocBrand["colors"], string>;

const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
const thin = (color = C.line): IBorderOptions => ({ style: BorderStyle.SINGLE, size: 4, color });

const run = (text: string, o: { bold?: boolean; italics?: boolean; size?: number; color?: string; underline?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 18, bold: o.bold, italics: o.italics, color: o.color ?? C.text, underline: o.underline ? {} : undefined });
const para = (children: ParagraphChild[] | string, o: { align?: Align; after?: number; before?: number } = {}) =>
  new Paragraph({ children: typeof children === "string" ? [run(children)] : children, alignment: o.align, spacing: { after: o.after ?? 60, before: o.before ?? 0, line: 276 } });
/** Teks multi-paragraf (dipisah baris kosong) dari database. */
const paragraphs = (text: string, align: Align = AlignmentType.JUSTIFIED) =>
  text.split(/\n\s*\n/).map(p => para(p.split("\n").flatMap((line, i) => (i ? [new TextRun({ break: 1 }), run(line)] : [run(line)])), { align, after: 100 }));

function cell(children: Paragraph[], o: { width: number; fill?: string; borders?: object; vAlign?: TableVerticalAlign }) {
  return new TableCell({
    children, width: { size: o.width, type: WidthType.DXA }, verticalAlign: o.vAlign,
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 40, bottom: 40, left: 100, right: 100 }, borders: o.borders,
  });
}
const alignOf = (a?: string): Align => (a === "right" ? AlignmentType.RIGHT : a === "center" ? AlignmentType.CENTER : AlignmentType.LEFT);

function letterhead() {
  const logo = fs.readFileSync(path.join(process.cwd(), "assets", L.logoFile));
  return new Header({
    children: [
      new Table({
        width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: [1000, PAGE_W - 1000],
        borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 12, color: C.primary } },
        rows: [new TableRow({ children: [
          cell([new Paragraph({ children: [new ImageRun({ type: "png", data: logo, transformation: { width: 52, height: 52 } })] })], { width: 1000, vAlign: VerticalAlignTable.CENTER }),
          cell([
            para([run(L.company, { bold: true, size: 28, color: C.primary })], { after: 0 }),
            para([run(L.tagline, { bold: true, size: 15, color: C.accent })], { after: 20 }),
            para([run(L.address, { size: 14, color: C.muted })], { after: 0 }),
            para([run(`Telp. ${L.phone} · ${L.email} · ${L.website}`, { size: 14, color: C.muted })], { after: 60 }),
          ], { width: PAGE_W - 1000, vAlign: VerticalAlignTable.CENTER }),
        ] })],
      }),
    ],
  });
}

function footer(number: string) {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 4 } },
        tabStops: [{ type: "right", position: PAGE_W }],
        children: [
          run(L.company, { bold: true, size: 14, color: C.primary }),
          run(`\t${number}  ·  Hal. `, { size: 14, color: C.muted }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: C.muted }),
          run("/", { size: 14, color: C.muted }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14, color: C.muted }),
        ],
      }),
      para([run(`${L.address} · NPWP ${L.npwp}`, { size: 14, color: C.muted })], { after: 0 }),
    ],
  });
}

function cellParas(c: Cell, a?: string): Paragraph[] {
  const v = typeof c === "string" ? { text: c } : c;
  return [
    para([run(v.text, { bold: v.bold })], { align: alignOf(a), after: 0 }),
    ...(v.sub ? [para([run(v.sub, { size: 15, color: C.muted })], { align: alignOf(a), after: 0 })] : []),
    ...(v.note ? [para([run(v.note, { size: 14, color: "B45309" })], { align: alignOf(a), after: 0 })] : []),
  ];
}

function blockToDocx(b: Block): (Paragraph | Table)[] {
  switch (b.type) {
    case "para":
      return paragraphs(b.text, b.align === "center" ? AlignmentType.CENTER : b.align === "left" ? AlignmentType.LEFT : AlignmentType.JUSTIFIED);
    case "heading":
      return [para([run(b.text, { bold: true, color: C.primary, size: 19 })], { before: 160, after: 40 })];
    case "table": {
      const sum = b.columns.reduce((a, c) => a + c.width, 0);
      const W = b.columns.map(c => Math.round((c.width / sum) * PAGE_W));
      return [new Table({
        width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: W,
        borders: { top: thin(), bottom: thin(), left: thin(), right: thin(), insideHorizontal: thin(), insideVertical: none },
        rows: [
          new TableRow({ tableHeader: true, children: b.columns.map((col, i) => cell([para([run(col.label, { bold: true, size: 16, color: "FFFFFF" })], { align: alignOf(col.align), after: 0 })], { width: W[i], fill: C.primary })) }),
          ...b.rows.map(row => new TableRow({ cantSplit: true, children: row.map((c, i) => cell(cellParas(c, b.columns[i].align), { width: W[i] })) })),
        ],
      }), para("", { after: 60 })];
    }
    case "totals": {
      const W = [PAGE_W - 4400, 2300, 2100];
      const row = (k: string, v: string, grand = false) => new TableRow({ children: [
        cell([para("", { after: 0 })], { width: W[0], borders: noBorders }),
        cell([para([run(k, { bold: grand, color: grand ? "FFFFFF" : C.muted })], { after: 0 })], { width: W[1], fill: grand ? C.primary : undefined, borders: noBorders }),
        cell([para([run(v, { bold: grand, size: grand ? 20 : 18, color: grand ? "FFFFFF" : C.text })], { align: AlignmentType.RIGHT, after: 0 })], { width: W[2], fill: grand ? C.primary : undefined, borders: noBorders }),
      ] });
      return [new Table({ width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: W, borders: noBorders, rows: [...b.rows.map(([k, v]) => row(k, v)), row(b.total[0], b.total[1], true)] })];
    }
    case "words":
      return [new Paragraph({
        children: [run(b.text, { italics: true })],
        shading: { type: ShadingType.CLEAR, color: "auto", fill: C.soft },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 6 } },
        spacing: { before: 100, after: 160 },
      })];
    case "kv": {
      const W = [2000, PAGE_W - 2000];
      return [
        ...(b.title ? [para([run(b.title, { bold: true, color: C.primary, size: 19 })], { before: 120, after: 40 })] : []),
        new Table({
          width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: W, borders: noBorders,
          rows: b.rows.map(([k, v]) => new TableRow({ children: [cell([para([run(k, { bold: true })], { after: 0 })], { width: W[0] }), cell([para(v, { after: 0 })], { width: W[1] })] })),
        }),
        para("", { after: 80 }),
      ];
    }
    case "clauses":
      return b.items.flatMap((c, i) => [
        para([run(`Pasal ${i + 1}`, { bold: true })], { align: AlignmentType.CENTER, before: 160, after: 0 }),
        para([run(c.title.toUpperCase(), { bold: true })], { align: AlignmentType.CENTER, after: 60 }),
        ...paragraphs(c.body),
      ]);
    case "signatures":
      return [para("", { after: 120 }), signTable(b.items), para("", { after: 120 })];
    case "note":
      return [new Paragraph({
        children: [run(b.text, { size: 16, color: C.muted })],
        border: { top: thin(), bottom: thin(), left: thin(), right: thin() },
        spacing: { before: 160, after: 160 },
      })];
  }
}

function signTable(sigs: Signature[]) {
  const W = sigs.map(() => Math.floor(PAGE_W / sigs.length));
  const block = (sig: Signature) => [
    para(sig.lead, { after: 0 }), para([run(sig.org ?? " ", { bold: true })], { after: sig.stamp ? 120 : 700 }),
    ...(sig.stamp ? [para([run("[ Meterai Rp10.000 ]", { size: 14, color: C.muted })], { after: 480 })] : []),
    para([run(sig.name, { bold: true, underline: true })], { after: 0 }), para(sig.title, { after: 0 }),
    ...(sig.extra ? [para([run(sig.extra, { size: 15, color: C.muted })], { after: 0 })] : []),
  ];
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: W, borders: noBorders,
    rows: [new TableRow({ cantSplit: true, children: sigs.map((sig, i) => cell(block(sig), { width: W[i] })) })],
  });
}

const WATERMARK_TEXT = {
  DRAFT: "DRAFT — belum disetujui, jangan dikirim ke customer",
  LUNAS: "LUNAS",
  DIBATALKAN: "DIBATALKAN — dokumen ini tidak berlaku",
};

return async function renderDocx(d: DocModel) {
  const meta = (k: string, v: string) => para([run(k, { color: C.muted }), run(`: ${v}`)], { after: 20 });
  const doc = new Document({
    creator: L.company, title: d.fileName, subject: d.title,
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1900, bottom: 1200, left: 1134, right: 1134, header: 400, footer: 400 } } },
      headers: { default: letterhead() },
      footers: { default: footer(d.number) },
      children: [
        ...(d.watermark ? [para([run(WATERMARK_TEXT[d.watermark], { bold: true, color: d.watermark === "LUNAS" ? "047857" : "B91C1C", size: 16 })], { align: AlignmentType.CENTER, after: 60 })] : []),
        para([run(d.title, { bold: true, size: 24, color: C.primary })], { align: AlignmentType.CENTER, after: 0, before: 120 }),
        para([run(`No. ${d.number}`, { color: C.muted, size: 17 })], { align: AlignmentType.CENTER, after: 240 }),
        ...(d.recipient || d.meta ? [new Table({
          width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: [PAGE_W * 0.55, PAGE_W * 0.45], borders: noBorders,
          rows: [new TableRow({ children: [
            cell(d.recipient ? [
              para([run(d.recipient.label.toUpperCase(), { bold: true, size: 14, color: C.muted })], { after: 20 }),
              para([run(d.recipient.name, { bold: true })], { after: 0 }),
              ...d.recipient.lines.map(l => para(l, { after: 0 })),
            ] : [para("")], { width: PAGE_W * 0.55 }),
            cell((d.meta ?? []).map(([k, v]) => meta(k, v)).concat(d.meta?.length ? [] : [para("")]), { width: PAGE_W * 0.45 }),
          ] })],
        }), para("", { after: 80 })] : []),
        ...d.blocks.flatMap(blockToDocx),
        ...(d.signatures?.length ? [para("", { after: 120 }), signTable(d.signatures)] : []),
      ],
    }],
  });
  return Packer.toBuffer(doc);
};
}

export async function renderDocx(d: DocModel) {
  return createDocxKit(d.brand ?? DEFAULT_BRAND)(d);
}
