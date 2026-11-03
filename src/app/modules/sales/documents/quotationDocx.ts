import fs from "fs";
import path from "path";
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, VerticalAlignTable, WidthType, type IBorderOptions, type TableVerticalAlign, type ParagraphChild,
} from "docx";
import { LETTERHEAD as L } from "./letterhead";
import type { QuotationDoc } from "./quotationDoc";

const C = Object.fromEntries(Object.entries(L.colors).map(([k, v]) => [k, v.replace("#", "")])) as Record<keyof typeof L.colors, string>;
const FONT = "Arial";
const PAGE_W = 9638; // A4 dikurangi margin 2 cm kiri-kanan, dalam twip

const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
const thin = (color = C.line): IBorderOptions => ({ style: BorderStyle.SINGLE, size: 4, color });

const run = (text: string, o: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 18, bold: o.bold, italics: o.italics, color: o.color ?? C.text });
const para = (children: ParagraphChild[] | string, o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; before?: number } = {}) =>
  new Paragraph({ children: typeof children === "string" ? [run(children)] : children, alignment: o.align, spacing: { after: o.after ?? 60, before: o.before ?? 0, line: 276 } });
/** Teks multi-paragraf (dipisah baris kosong) dari database. */
const paragraphs = (text: string) => text.split(/\n\s*\n/).map(p => para([run(p.replace(/\n/g, " "))], { align: AlignmentType.JUSTIFIED, after: 100 }));

function cell(children: Paragraph[], o: { width: number; fill?: string; borders?: object; vAlign?: TableVerticalAlign } = { width: 0 }) {
  return new TableCell({
    children, width: { size: o.width, type: WidthType.DXA }, verticalAlign: o.vAlign,
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 40, bottom: 40, left: 100, right: 100 }, borders: o.borders,
  });
}

function letterhead() {
  const logo = fs.readFileSync(path.join(process.cwd(), "assets", "brand", "lpi-logo.png"));
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

function footer(d: QuotationDoc) {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 4 } },
        tabStops: [{ type: "right", position: PAGE_W }],
        children: [
          run(L.company, { bold: true, size: 14, color: C.primary }),
          run(`\t${d.number}  ·  Hal. `, { size: 14, color: C.muted }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: C.muted }),
          run("/", { size: 14, color: C.muted }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14, color: C.muted }),
        ],
      }),
      para([run(`${L.address} · NPWP ${L.npwp}`, { size: 14, color: C.muted })], { after: 0 }),
    ],
  });
}

function itemsTable(d: QuotationDoc) {
  const W = [500, PAGE_W - 500 - 1000 - 1800 - 1900, 1000, 1800, 1900];
  const head = ["No", "Deskripsi & Spesifikasi", "Qty", "Harga Satuan", "Jumlah"];
  const right = (i: number) => (i >= 2 ? AlignmentType.RIGHT : i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT);
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: W,
    borders: { top: thin(), bottom: thin(), left: thin(), right: thin(), insideHorizontal: thin(), insideVertical: none },
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h, i) => cell([para([run(h, { bold: true, size: 16, color: "FFFFFF" })], { align: right(i), after: 0 })], { width: W[i], fill: C.primary })) }),
      ...d.items.map(it => new TableRow({ cantSplit: true, children: [
        cell([para(String(it.no), { align: AlignmentType.CENTER, after: 0 })], { width: W[0] }),
        cell([
          para([run(it.description, { bold: true })], { after: it.specs ? 30 : 0 }),
          ...(it.specs ? [para([run(it.specs, { size: 15, color: C.muted })], { after: 0 })] : []),
        ], { width: W[1] }),
        cell([para(it.qty, { align: AlignmentType.RIGHT, after: 0 })], { width: W[2] }),
        cell([para(it.unitPrice, { align: AlignmentType.RIGHT, after: 0 }), ...(it.discount ? [para([run(it.discount, { size: 14, color: "B45309" })], { align: AlignmentType.RIGHT, after: 0 })] : [])], { width: W[3] }),
        cell([para([run(it.lineTotal, { bold: true })], { align: AlignmentType.RIGHT, after: 0 })], { width: W[4] }),
      ] })),
    ],
  });
}

function totalsTable(d: QuotationDoc) {
  const W = [PAGE_W - 4400, 2300, 2100];
  const row = (k: string, v: string, grand = false) => new TableRow({ children: [
    cell([para("", { after: 0 })], { width: W[0], borders: noBorders }),
    cell([para([run(k, { bold: grand, color: grand ? "FFFFFF" : C.muted })], { after: 0 })], { width: W[1], fill: grand ? C.primary : undefined, borders: noBorders }),
    cell([para([run(v, { bold: grand, size: grand ? 20 : 18, color: grand ? "FFFFFF" : C.text })], { align: AlignmentType.RIGHT, after: 0 })], { width: W[2], fill: grand ? C.primary : undefined, borders: noBorders }),
  ] });
  return new Table({ width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: W, borders: noBorders, rows: [...d.totals.map(([k, v]) => row(k, v)), row("TOTAL", d.total, true)] });
}

function termsTable(d: QuotationDoc) {
  const W = [1700, PAGE_W - 1700];
  const rows = [...d.terms, ["Rekening", L.bank] as [string, string]];
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: W, borders: noBorders,
    rows: rows.map(([k, v]) => new TableRow({ children: [cell([para([run(k, { bold: true })], { after: 0 })], { width: W[0] }), cell([para(v, { after: 0 })], { width: W[1] })] })),
  });
}

function signTable(d: QuotationDoc) {
  const W = [PAGE_W / 2, PAGE_W / 2];
  const block = (lead: string, second: string, name: string, title: string, extra?: string) => [
    para(lead, { after: 0 }), para([run(second, { bold: true })], { after: 700 }),
    para([new TextRun({ text: name, font: FONT, size: 18, bold: true, underline: {} })], { after: 0 }), para(title, { after: 0 }),
    ...(extra ? [para([run(extra, { size: 15, color: C.muted })], { after: 0 })] : []),
  ];
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: W, borders: noBorders,
    rows: [new TableRow({ cantSplit: true, children: [
      cell(block("Hormat kami,", L.company, d.signer.name, d.signer.title, d.signer.contact || undefined), { width: W[0] }),
      cell(d.approver ? block("Mengetahui,", " ", d.approver.name, d.approver.title) : [para("")], { width: W[1] }),
    ] })],
  });
}

export async function renderQuotationDocx(d: QuotationDoc) {
  const meta = (k: string, v: string) => para([run(k, { color: C.muted }), run(`: ${v}`)], { after: 20 });
  const doc = new Document({
    creator: L.company, title: d.fileName, subject: d.subject,
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1900, bottom: 1200, left: 1134, right: 1134, header: 400, footer: 400 } } },
      headers: { default: letterhead() },
      footers: { default: footer(d) },
      children: [
        ...(d.draft ? [para([run("DRAFT — belum disetujui, jangan dikirim ke customer", { bold: true, color: "B91C1C", size: 16 })], { align: AlignmentType.CENTER, after: 60 })] : []),
        para([run("SURAT PENAWARAN HARGA", { bold: true, size: 24, color: C.primary })], { align: AlignmentType.CENTER, after: 0, before: 120 }),
        para([run(`No. ${d.number}`, { color: C.muted, size: 17 })], { align: AlignmentType.CENTER, after: 240 }),
        new Table({
          width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: [PAGE_W * 0.55, PAGE_W * 0.45], borders: noBorders,
          rows: [new TableRow({ children: [
            cell([
              para([run("KEPADA YTH.", { bold: true, size: 14, color: C.muted })], { after: 20 }),
              para([run(d.customer.name, { bold: true })], { after: 0 }),
              ...(d.customer.address ? [para(d.customer.address, { after: 0 })] : []),
              ...(d.attention ? [para(`U.p. ${d.attention}`, { before: 40 })] : []),
            ], { width: PAGE_W * 0.55 }),
            cell([meta("Tanggal", `${L.city}, ${d.date}`), meta("Perihal", d.subject), meta("Berlaku s/d", d.validUntil)], { width: PAGE_W * 0.45 }),
          ] })],
        }),
        para("", { after: 40 }),
        ...paragraphs(d.intro),
        itemsTable(d),
        para("", { after: 60 }),
        totalsTable(d),
        new Paragraph({
          children: [run(`Terbilang: ${d.totalWords}`, { italics: true })],
          shading: { type: ShadingType.CLEAR, color: "auto", fill: C.soft },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 6 } },
          spacing: { before: 100, after: 160 },
        }),
        para([run("Syarat & Ketentuan", { bold: true, color: C.primary, size: 19 })], { after: 40 }),
        termsTable(d),
        para("", { after: 120 }),
        ...paragraphs(d.closing),
        signTable(d),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}
