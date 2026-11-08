// Menyusun DocModel dari data database untuk setiap jenis dokumen Sales.
import { prisma } from "@/lib/prisma";
import { invoiceState, rupiah } from "../lib";
import { AGREEMENT_TITLE, buildClauses, visitSchedule, type Clause } from "./contractTemplates";
import { bulanTahun, hari, safeName, tanggal, terbilang, terbilangRupiah } from "./format";
import { LETTERHEAD as L } from "./letterhead";
import type { Block, DocModel } from "./model";

export const DOC_KINDS = ["quotation", "invoice", "receipt", "contract", "bast", "order-confirmation", "reminder", "packing-list", "delivery-order", "training-report", "training-certificate"] as const;
/** Dokumen milik modul Contract & Shipping / Training & CS (akses mengikuti modul tsb). */
export const SHIPPING_DOCS: DocKind[] = ["packing-list", "delivery-order"];
export const SERVICE_DOCS: DocKind[] = ["training-report", "training-certificate"];
export type DocKind = (typeof DOC_KINDS)[number];

const S = L.signatories;
const lines = (...v: (string | null | undefined)[]) => v.filter((x): x is string => !!x && !!x.trim());
const itemColumns = [
  { label: "No", width: 4, align: "center" as const },
  { label: "Deskripsi & Spesifikasi", width: 46 },
  { label: "Qty", width: 10, align: "right" as const },
  { label: "Harga Satuan", width: 18, align: "right" as const },
  { label: "Jumlah", width: 18, align: "right" as const },
];
const qty = (q: number, unit: string) => `${q.toLocaleString("id-ID")} ${unit}`;

// ---------------------------------------------------------
// Penawaran
// ---------------------------------------------------------
async function quotation(id: string): Promise<DocModel | null> {
  const q = await prisma.quotation.findUnique({ where: { id }, include: { customer: true, items: { orderBy: { sortOrder: "asc" } } } });
  if (!q) return null;
  const sales = await prisma.user.findFirst({ where: { name: q.salesName }, select: { phone: true, email: true } });
  const number = q.revision ? `${q.quotationNo} Rev.${q.revision}` : q.quotationNo;
  return {
    fileName: safeName(`Penawaran ${q.quotationNo}${q.revision ? ` Rev${q.revision}` : ""} - ${q.customer.name}`),
    title: "SURAT PENAWARAN HARGA", number,
    watermark: ["Draft", "Waiting Approval"].includes(q.status) ? "DRAFT" : undefined,
    recipient: { label: "Kepada Yth.", name: q.customer.name, lines: lines(q.customer.address, q.attention && `U.p. ${q.attention}`) },
    meta: [["Tanggal", `${L.city}, ${tanggal(q.date)}`], ["Perihal", q.subject], ["Berlaku s/d", tanggal(q.validUntil)]],
    blocks: [
      { type: "para", text: q.introText ?? "" },
      { type: "table", columns: itemColumns, rows: q.items.map((it, i) => [
        String(i + 1), { text: it.description, bold: true, sub: it.specs }, qty(it.qty, it.unit),
        { text: rupiah(it.unitPrice), note: it.discountPercent > 0 ? `Diskon ${it.discountPercent}%` : null }, { text: rupiah(it.lineTotal), bold: true },
      ]) },
      { type: "totals", rows: [["Subtotal", rupiah(q.subtotal)], ...(q.discountAmount > 0 ? [[`Diskon ${q.discountPercent}%`, `− ${rupiah(q.discountAmount)}`] as [string, string]] : []), [`PPN ${q.taxPercent}%`, rupiah(q.taxAmount)]], total: ["TOTAL", rupiah(q.total)] },
      { type: "words", text: `Terbilang: ${terbilangRupiah(q.total)}` },
      { type: "kv", title: "Syarat & Ketentuan", rows: [
        ...(q.paymentTerms ? [["Pembayaran", q.paymentTerms] as [string, string]] : []),
        ...(q.deliveryTerms ? [["Pengiriman", q.deliveryTerms] as [string, string]] : []),
        ...(q.warrantyTerms ? [["Garansi", q.warrantyTerms] as [string, string]] : []),
        ["Masa berlaku", `Penawaran berlaku sampai ${tanggal(q.validUntil)}.`], ["Rekening", L.bank],
      ] },
      { type: "para", text: q.closingText ?? "" },
    ],
    signatures: [
      { lead: "Hormat kami,", org: L.company, name: q.salesName, title: "Sales Engineer", extra: [sales?.phone, sales?.email].filter(Boolean).join(" · ") },
      ...(q.approvedBy ? [{ lead: "Mengetahui,", name: q.approvedBy, title: "Sales Manager" }] : []),
    ],
  };
}

// ---------------------------------------------------------
// Invoice & kwitansi
// ---------------------------------------------------------
async function invoice(id: string): Promise<DocModel | null> {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { customer: true, items: { orderBy: { sortOrder: "asc" } }, salesOrder: { include: { items: { orderBy: { sortOrder: "asc" } } } }, contract: true },
  });
  if (!inv) return null;
  const state = invoiceState(inv);
  const ref = inv.salesOrder ? `PO ${inv.salesOrder.customerPoNo} · ${inv.salesOrder.soNo}` : inv.contract ? `Kontrak ${inv.contract.contractNo}` : "-";
  const rows = inv.items.length
    ? inv.items.map((it, i) => [String(i + 1), { text: it.description, bold: true }, qty(it.qty, it.unit), rupiah(it.unitPrice), { text: rupiah(it.lineTotal), bold: true }])
    : [[
        "1",
        { text: `${inv.termLabel}${inv.termPercent && inv.termPercent < 100 && !inv.termLabel.includes("%") ? ` (${inv.termPercent}% dari nilai pesanan)` : ""}`, bold: true,
          sub: inv.salesOrder ? `Atas PO ${inv.salesOrder.customerPoNo} (${inv.salesOrder.soNo}): ${inv.salesOrder.items.map(i => `${i.qty} ${i.unit} ${i.description.split(" — ")[0]}`).join("; ")}` : inv.contract ? `${inv.contract.title}${inv.periodLabel ? ` — ${inv.periodLabel}` : ""}` : null },
        "1", rupiah(inv.subtotal), { text: rupiah(inv.subtotal), bold: true },
      ]];
  const remaining = inv.total - inv.paidAmount;
  return {
    fileName: safeName(`Invoice ${inv.invoiceNo} - ${inv.customer.name}`),
    title: "INVOICE", number: inv.invoiceNo,
    watermark: state === "Paid" ? "LUNAS" : state === "Cancelled" ? "DIBATALKAN" : undefined,
    recipient: { label: "Ditagihkan kepada", name: inv.customer.name, lines: lines(inv.customer.address, inv.customer.npwp && `NPWP ${inv.customer.npwp}`) },
    meta: [["Tanggal", tanggal(inv.invoiceDate)], ["Jatuh tempo", tanggal(inv.dueDate)], ["Referensi", ref], ...(inv.fakturPajakNo ? [["Faktur pajak", inv.fakturPajakNo] as [string, string]] : [])],
    blocks: [
      { type: "table", columns: itemColumns, rows },
      { type: "totals", rows: [["DPP", rupiah(inv.subtotal)], ["PPN 11%", rupiah(inv.taxAmount)]], total: ["TOTAL TAGIHAN", rupiah(inv.total)] },
      { type: "words", text: `Terbilang: ${terbilangRupiah(inv.total)}` },
      { type: "kv", title: "Pembayaran", rows: [
        ["Transfer ke", L.bank],
        ["Berita transfer", inv.invoiceNo],
        ...(inv.paidAmount > 0 && state !== "Paid" ? [["Sudah dibayar", rupiah(inv.paidAmount)] as [string, string], ["Sisa tagihan", rupiah(remaining)] as [string, string]] : []),
      ] },
      { type: "note", text: "Mohon cantumkan nomor invoice pada berita transfer dan kirimkan bukti pembayaran ke " + L.email + "." },
    ],
    signatures: [{ lead: `${L.city}, ${tanggal(inv.invoiceDate)}`, org: L.company, name: S.finance.name, title: S.finance.title }],
  };
}

async function receipt(paymentId: string): Promise<DocModel | null> {
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { invoice: { include: { customer: true, salesOrder: true, contract: true } } } });
  if (!p) return null;
  const inv = p.invoice;
  const number = p.receiptNo ?? `KWT-${p.id.slice(-8).toUpperCase()}`;
  return {
    fileName: safeName(`Kwitansi ${number} - ${inv.customer.name}`),
    title: "KWITANSI", number,
    meta: [["Tanggal", tanggal(p.paymentDate)], ["Invoice", inv.invoiceNo]],
    blocks: [
      { type: "kv", rows: [
        ["Telah terima dari", inv.customer.name],
        ["Uang sejumlah", terbilangRupiah(p.amount)],
        ["Untuk pembayaran", `${inv.termLabel} — invoice ${inv.invoiceNo}${inv.salesOrder ? ` (PO ${inv.salesOrder.customerPoNo})` : inv.contract ? ` (kontrak ${inv.contract.contractNo})` : ""}`],
        ["Metode", `${p.method}${p.reference ? ` · ${p.reference}` : ""}`],
      ] },
      { type: "totals", rows: [], total: ["JUMLAH", rupiah(p.amount)] },
    ],
    // Kwitansi ≥ Rp5 juta wajib bermeterai.
    signatures: [{ lead: `${L.city}, ${tanggal(p.paymentDate)}`, org: L.company, name: p.receivedBy, title: "Finance", stamp: p.amount >= 5_000_000 }],
  };
}

// ---------------------------------------------------------
// Kontrak: perjanjian (AMC/Kalibrasi/Service) atau sertifikat garansi
// ---------------------------------------------------------
type Covered = { product: string; serialNumber: string; location?: string };

async function contract(id: string): Promise<DocModel | null> {
  const c = await prisma.contract.findUnique({ where: { id }, include: { customer: true, salesOrder: true } });
  if (!c) return null;
  const items = JSON.parse(c.coveredItemsJson || "[]") as Covered[];
  const itemTable: Block = {
    type: "table",
    columns: [{ label: "No", width: 5, align: "center" }, { label: "Peralatan", width: 50 }, { label: "No. Seri", width: 25 }, { label: "Lokasi", width: 20 }],
    rows: items.map((it, i) => [String(i + 1), { text: it.product, bold: true }, it.serialNumber || "-", it.location || "-"]),
  };
  const draft = ["Draft", "Waiting Approval"].includes(c.status);

  if (c.type === "Garansi") {
    return {
      fileName: safeName(`Sertifikat Garansi ${c.contractNo} - ${c.customer.name}`),
      title: "SERTIFIKAT GARANSI", number: c.contractNo,
      recipient: { label: "Diberikan kepada", name: c.customer.name, lines: lines(c.customer.address) },
      meta: [["Periode", `${tanggal(c.startDate)} – ${tanggal(c.endDate)}`], ...(c.salesOrder ? [["Sales Order", c.salesOrder.soNo] as [string, string], ["BAST", c.salesOrder.bastNo ?? "-"] as [string, string]] : [])],
      blocks: [
        { type: "para", text: `Dengan ini ${L.company} menjamin peralatan berikut terhadap cacat bahan dan cacat produksi selama masa garansi, terhitung sejak tanggal serah terima (BAST).` },
        itemTable,
        { type: "kv", title: "Ketentuan Garansi", rows: [
          ["Cakupan", "Penggantian suku cadang dan jasa perbaikan akibat cacat bahan/produksi tanpa biaya."],
          ["Tidak termasuk", "Kerusakan akibat salah pakai, kelalaian, bencana, sumber listrik tidak stabil, bahan habis pakai, serta perbaikan oleh pihak lain."],
          ["Klaim", `Hubungi layanan purna jual ${L.phone} / ${L.email} dengan menyebutkan nomor sertifikat dan nomor seri alat.`],
          ["Waktu respon", c.responseTime || "2x24 jam hari kerja"],
        ] },
        { type: "note", text: "Garansi tidak berlaku apabila segel atau label nomor seri rusak/hilang. Simpan sertifikat ini sebagai bukti garansi." },
      ],
      signatures: [{ lead: `${L.city}, ${tanggal(c.startDate)}`, org: L.company, name: S.service.name, title: S.service.title }],
    };
  }

  const saved = JSON.parse(c.clausesJson || "[]") as Clause[];
  // Kontrak lama (sebelum ada form perjanjian) memakai pasal baku dari datanya sendiri.
  const clauses = saved.length ? saved : buildClauses({
    type: c.type, startDate: c.startDate, endDate: c.endDate, visitsPerYear: c.visitsPerYear, responseTime: c.responseTime, value: c.value,
    paymentTerms: c.paymentTerms, billingSchedule: c.billingSchedule, sparePartDiscount: c.sparePartDiscount, scope: c.scope, itemCount: items.length,
  });
  const schedule = visitSchedule(c.startDate, c.endDate, c.visitsPerYear);
  const signDate = c.approvedAt ?? c.startDate;
  return {
    fileName: safeName(`Perjanjian ${c.contractNo} - ${c.customer.name}`),
    title: AGREEMENT_TITLE[c.type] ?? `PERJANJIAN ${c.type.toUpperCase()}`, number: c.contractNo,
    watermark: draft ? "DRAFT" : undefined,
    blocks: [
      { type: "para", text: `Pada hari ini ${hari(signDate)}, tanggal ${terbilang(Number(signDate.slice(8, 10)))} bulan ${bulanTahun(signDate)}, yang bertanda tangan di bawah ini:` },
      { type: "kv", rows: [
        ["Nama", S.director.name], ["Jabatan", S.director.title], ["Perusahaan", L.company], ["Alamat", L.address],
      ] },
      { type: "para", text: "dalam hal ini bertindak untuk dan atas nama perusahaan tersebut, selanjutnya disebut PIHAK PERTAMA.", align: "left" },
      { type: "kv", rows: [
        ["Nama", c.signatoryName || c.customer.signatoryName || c.customer.contactName || "...................."],
        ["Jabatan", c.signatoryTitle || c.customer.signatoryTitle || c.customer.contactTitle || "...................."],
        ["Instansi", c.customer.name], ["Alamat", c.customer.address || "-"],
      ] },
      { type: "para", text: "dalam hal ini bertindak untuk dan atas nama instansi tersebut, selanjutnya disebut PIHAK KEDUA. PIHAK PERTAMA dan PIHAK KEDUA secara bersama-sama disebut PARA PIHAK, sepakat untuk mengikatkan diri dalam Perjanjian dengan ketentuan sebagai berikut:", align: "justify" },
      { type: "clauses", items: clauses.map(cl => ({ title: cl.title, body: cl.body })) },
      { type: "signatures", items: [
        { lead: "PIHAK PERTAMA", org: L.company, name: S.director.name, title: S.director.title },
        { lead: "PIHAK KEDUA", org: c.customer.name, name: c.signatoryName || c.customer.signatoryName || c.customer.contactName || "....................", title: c.signatoryTitle || c.customer.signatoryTitle || c.customer.contactTitle || "", stamp: true },
      ] },
      { type: "heading", text: "Lampiran 1 — Daftar Peralatan" },
      itemTable,
      ...(schedule.length ? [
        { type: "heading", text: "Lampiran 2 — Rencana Jadwal Kunjungan" } as Block,
        { type: "table", columns: [{ label: "Kunjungan", width: 20, align: "center" }, { label: "Rencana Bulan", width: 40 }, { label: "Kegiatan", width: 40 }],
          rows: schedule.map((d, i) => [String(i + 1), bulanTahun(d), c.type === "Kalibrasi" ? "Kalibrasi on-site + sertifikat" : "Preventive maintenance + laporan"]) } as Block,
      ] : []),
    ],
  };
}

// ---------------------------------------------------------
// Sales order: konfirmasi pesanan & BAST
// ---------------------------------------------------------
async function salesOrderDoc(id: string, kind: "bast" | "order-confirmation"): Promise<DocModel | null> {
  const so = await prisma.salesOrder.findUnique({ where: { id }, include: { customer: true, items: { orderBy: { sortOrder: "asc" } }, quotation: true } });
  if (!so) return null;
  const recipient = { label: "Kepada Yth.", name: so.customer.name, lines: lines(so.deliveryAddress ?? so.customer.address, so.customer.contactName && `U.p. ${so.customer.contactName}`) };
  const custSigner = so.customer.signatoryName || so.customer.contactName || "....................";
  const custTitle = so.customer.signatoryTitle || so.customer.contactTitle || "";

  if (kind === "order-confirmation") {
    const schedule = JSON.parse(so.paymentScheduleJson || "[]") as { label: string; percent: number; trigger: string }[];
    return {
      fileName: safeName(`Konfirmasi Pesanan ${so.soNo} - ${so.customer.name}`),
      title: "KONFIRMASI PESANAN", number: so.soNo,
      watermark: ["Contract Review", "Cancelled"].includes(so.status) ? (so.status === "Cancelled" ? "DIBATALKAN" : "DRAFT") : undefined,
      recipient, meta: [["Tanggal", tanggal(so.orderDate)], ["No. PO", `${so.customerPoNo} (${tanggal(so.customerPoDate)})`], ...(so.quotation ? [["Penawaran", `${so.quotation.quotationNo} Rev.${so.quotation.revision}`] as [string, string]] : [])],
      blocks: [
        { type: "para", text: `Dengan hormat,\n\nTerima kasih atas kepercayaan Bapak/Ibu. Dengan ini kami mengonfirmasi bahwa Purchase Order No. ${so.customerPoNo} telah kami terima dan disetujui dengan rincian sebagai berikut:` },
        { type: "table", columns: itemColumns, rows: so.items.map((it, i) => [String(i + 1), { text: it.description, bold: true }, qty(it.qty, it.unit), rupiah(it.unitPrice), { text: rupiah(it.lineTotal), bold: true }]) },
        { type: "totals", rows: [["DPP", rupiah(so.subtotal)], ["PPN 11%", rupiah(so.taxAmount)]], total: ["TOTAL", rupiah(so.total)] },
        { type: "words", text: `Terbilang: ${terbilangRupiah(so.total)}` },
        { type: "kv", title: "Ketentuan Pelaksanaan", rows: [
          ["Alamat kirim", so.deliveryAddress ?? so.customer.address ?? "-"],
          ["Target kirim", tanggal(so.expectedDelivery)],
          ["Termin bayar", schedule.map(t => `${t.label} (${t.trigger.toLowerCase()})`).join("; ") || "-"],
        ] },
        { type: "para", text: "Tim kami akan menghubungi Bapak/Ibu untuk koordinasi jadwal pengiriman dan instalasi. Mohon informasikan kepada kami apabila terdapat ketidaksesuaian pada rincian di atas." },
      ],
      signatures: [{ lead: "Hormat kami,", org: L.company, name: S.sales.name, title: S.sales.title }],
    };
  }

  return {
    fileName: safeName(`BAST ${so.bastNo ?? so.soNo} - ${so.customer.name}`),
    title: "BERITA ACARA SERAH TERIMA", number: so.bastNo ?? `(draft) ${so.soNo}`,
    watermark: so.bastNo ? undefined : "DRAFT",
    recipient, meta: [["Tanggal", tanggal(so.bastDate ?? so.installationDate)], ["No. PO", so.customerPoNo], ["Sales Order", so.soNo]],
    blocks: [
      { type: "para", text: `Pada hari ini${so.bastDate ? ` ${hari(so.bastDate)}, ${tanggal(so.bastDate)}` : ", .................... "}, telah dilakukan serah terima peralatan berikut dari ${L.company} (PIHAK YANG MENYERAHKAN) kepada ${so.customer.name} (PIHAK YANG MENERIMA):` },
      { type: "table", columns: [{ label: "No", width: 5, align: "center" }, { label: "Peralatan", width: 50 }, { label: "Qty", width: 12, align: "right" }, { label: "No. Seri", width: 33 }],
        rows: so.items.map((it, i) => [String(i + 1), { text: it.description, bold: true }, qty(it.qty, it.unit), it.serialNumbers || "...................."]) },
      { type: "kv", title: "Hasil Pemeriksaan", rows: [
        ["Kondisi barang", "Baik, lengkap, dan sesuai spesifikasi pada PO"],
        ["Instalasi", "Telah dipasang dan diuji fungsi (commissioning)"],
        ["Training", "Telah dilaksanakan untuk operator Pihak Yang Menerima"],
        ["Dokumen", "Manual, sertifikat pabrikan/kalibrasi, dan kartu garansi"],
      ] },
      { type: "para", text: "Dengan ditandatanganinya Berita Acara ini, masa garansi peralatan dimulai sejak tanggal serah terima. Berita Acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya." },
    ],
    signatures: [
      { lead: "Yang Menyerahkan,", org: L.company, name: S.service.name, title: S.service.title },
      { lead: "Yang Menerima,", org: so.customer.name, name: custSigner, title: custTitle },
    ],
  };
}

// ---------------------------------------------------------
// Surat pengingat pembayaran (isi disusun AI, angka dari data)
// ---------------------------------------------------------
const REMINDER_TITLE = ["", "SURAT PENGINGAT PEMBAYARAN", "SURAT PERINGATAN PEMBAYARAN", "SURAT PERINGATAN TERAKHIR"];

async function reminder(id: string): Promise<DocModel | null> {
  const r = await prisma.paymentReminder.findUnique({ where: { id }, include: { invoice: { include: { customer: true, salesOrder: true } } } });
  if (!r) return null;
  const inv = r.invoice;
  return {
    fileName: safeName(`${REMINDER_TITLE[r.level].toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase())} ${r.letterNo} - ${inv.customer.name}`),
    title: REMINDER_TITLE[r.level] ?? REMINDER_TITLE[1], number: r.letterNo,
    recipient: { label: "Kepada Yth.", name: inv.customer.name, lines: lines(inv.customer.address, inv.customer.contactName && `U.p. ${inv.customer.contactName}`) },
    meta: [["Tanggal", `${L.city}, ${tanggal(r.date)}`], ["Perihal", r.subject]],
    blocks: [
      { type: "para", text: r.body },
      { type: "table", columns: [{ label: "No. Invoice", width: 26 }, { label: "Tanggal", width: 16 }, { label: "Jatuh Tempo", width: 16 }, { label: "Total", width: 21, align: "right" }, { label: "Sisa Tagihan", width: 21, align: "right" }],
        rows: [[{ text: inv.invoiceNo, bold: true, sub: inv.salesOrder ? `PO ${inv.salesOrder.customerPoNo}` : inv.termLabel }, tanggal(inv.invoiceDate), tanggal(inv.dueDate), rupiah(inv.total), { text: rupiah(inv.total - inv.paidAmount), bold: true }]] },
      { type: "kv", rows: [["Rekening", L.bank], ["Konfirmasi", `${L.phone} · ${L.email}`]] },
      { type: "para", text: "Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih." },
      { type: "note", text: "Abaikan surat ini apabila pembayaran telah dilakukan, dan mohon kirimkan bukti transfer kepada kami." },
    ],
    signatures: [{ lead: "Hormat kami,", org: L.company, name: S.finance.name, title: S.finance.title }],
  };
}

// ---------------------------------------------------------
// Contract & Shipping: Packing List & Surat Jalan
// ---------------------------------------------------------
type Crate = { crateNo: string; contents: string; dims?: string; grossKg?: number | null; netKg?: number | null };

async function shipmentDoc(id: string, kind: "packing-list" | "delivery-order"): Promise<DocModel | null> {
  const s = await prisma.salesShipment.findUnique({ where: { id }, include: { customer: true, salesOrder: true } });
  if (!s) return null;
  const crates = JSON.parse(s.packagesJson || "[]") as Crate[];
  const kg = (n?: number | null) => (n ? `${Number(n).toLocaleString("id-ID")} kg` : "-");
  const gross = crates.reduce((t, c) => t + (Number(c.grossKg) || 0), 0);
  const net = crates.reduce((t, c) => t + (Number(c.netKg) || 0), 0);
  const recipient = { label: kind === "packing-list" ? "Consignee" : "Kepada Yth.", name: s.customer.name, lines: lines(s.destination, s.customer.contactName && `U.p. ${s.customer.contactName}${s.customer.contactPhone ? ` (${s.customer.contactPhone})` : ""}`) };
  const watermark = s.status === "Cancelled" ? "DIBATALKAN" as const : s.status === "Draft" ? "DRAFT" as const : undefined;
  const route: [string, string][] = [
    ["Sales Order / PO", `${s.salesOrder.soNo} / ${s.salesOrder.customerPoNo}`],
    ["Moda", `${s.mode}${s.incoterm ? ` · ${s.incoterm}` : ""} (${s.scope})`],
    ["Rute", `${s.origin} → ${s.destination}`],
    ...(s.forwarder ? [["Forwarder", s.forwarder] as [string, string]] : []),
    ...(s.vessel ? [["Kapal / penerbangan", s.vessel] as [string, string]] : []),
    ...(s.awbNo ? [["B/L / AWB", s.awbNo] as [string, string]] : []),
    ...(s.containerNo ? [["Kontainer", s.containerNo] as [string, string]] : []),
  ];

  if (kind === "packing-list") {
    return {
      fileName: safeName(`Packing List ${s.shipmentNo} - ${s.customer.name}`), title: "PACKING LIST", number: s.shipmentNo, watermark, recipient,
      meta: [["Tanggal", tanggal(s.etd ?? s.createdAt)], ["ETD / ETA", `${tanggal(s.etd)} / ${tanggal(s.eta)}`]],
      blocks: [
        { type: "kv", title: "Pengiriman", rows: route },
        { type: "table", columns: [{ label: "No. Peti", width: 14 }, { label: "Isi", width: 44 }, { label: "Dimensi (cm)", width: 16 }, { label: "Gross", width: 13, align: "right" }, { label: "Net", width: 13, align: "right" }],
          rows: crates.map(c => [{ text: c.crateNo, bold: true }, c.contents, c.dims || "-", kg(c.grossKg), kg(c.netKg)]) },
        { type: "totals", rows: [["Jumlah peti", `${crates.length} peti`], ["Total net", kg(net)]], total: ["TOTAL GROSS", kg(gross)] },
        { type: "note", text: "Barang diproduksi oleh PT Labtech Penta International, Batam, Indonesia. Mohon periksa jumlah dan kondisi peti saat penerimaan." },
      ],
      signatures: [{ lead: "Disiapkan oleh,", org: L.company, name: S.shipping.name, title: S.shipping.title }],
    };
  }
  return {
    fileName: safeName(`Surat Jalan ${s.shipmentNo} - ${s.customer.name}`), title: "SURAT JALAN / DELIVERY ORDER", number: s.shipmentNo, watermark, recipient,
    meta: [["Tanggal kirim", tanggal(s.shippedAt ?? s.etd)], ["Alamat kirim", s.destination]],
    blocks: [
      { type: "para", text: "Bersama ini kami kirimkan barang-barang berikut dalam keadaan baik:" },
      { type: "table", columns: [{ label: "No", width: 6, align: "center" }, { label: "No. Peti", width: 16 }, { label: "Isi", width: 58 }, { label: "Gross", width: 20, align: "right" }],
        rows: crates.map((c, i) => [String(i + 1), { text: c.crateNo, bold: true }, c.contents, kg(c.grossKg)]) },
      { type: "kv", title: "Pengiriman", rows: route },
      { type: "para", text: "Mohon tanda tangan dan cap pada kolom penerima sebagai bukti barang telah diterima. Instalasi dan training akan dijadwalkan oleh tim Training & Customer Service kami." },
    ],
    signatures: [
      { lead: "Pengirim,", org: L.company, name: S.shipping.name, title: S.shipping.title },
      { lead: "Penerima,", org: s.customer.name, name: s.receivedBy || "....................", title: "" },
    ],
  };
}

// ---------------------------------------------------------
// Training & Customer Service: laporan & sertifikat training
// ---------------------------------------------------------
type Person = { name: string; title?: string; attended: boolean; pre?: number | null; post?: number | null };

async function trainingDoc(rawId: string, kind: "training-report" | "training-certificate"): Promise<DocModel | null> {
  const [id, idx] = rawId.split("~");
  const j = await prisma.serviceJob.findUnique({ where: { id }, include: { customer: true, salesOrder: { select: { soNo: true } } } });
  if (!j) return null;
  const people = JSON.parse(j.participantsJson || "[]") as Person[];
  const period = j.startDate ? `${tanggal(j.startDate)}${j.endDate && j.endDate !== j.startDate ? ` – ${tanggal(j.endDate)}` : ""}` : "-";
  const topics = j.topics || "Pengoperasian, perawatan, dan pemanfaatan trainer Labtech untuk pembelajaran praktik";

  if (kind === "training-certificate") {
    const n = Number(idx);
    const p = people[n];
    if (!p || !p.attended || j.status !== "Completed") return null;
    return {
      fileName: safeName(`Sertifikat Training ${p.name} - ${j.jobNo}`), title: "SERTIFIKAT PELATIHAN", number: `${j.jobNo}/P${String(n + 1).padStart(2, "0")}`,
      blocks: [
        { type: "para", align: "center", text: "Diberikan kepada" },
        { type: "heading", text: p.name },
        { type: "para", align: "center", text: `${p.title ? `${p.title} — ` : ""}${j.customer.name}` },
        { type: "para", align: "center", text: `atas partisipasinya dalam ${j.type === "Training" ? "pelatihan" : "pelatihan dan serah terima"} peralatan praktik Labtech (Training of Trainers) yang diselenggarakan pada ${period}${j.location ? ` di ${j.location}` : ""}${j.mode === "Online" ? " secara daring" : ""}.` },
        { type: "kv", title: "Materi", rows: [["Topik", topics], ...(typeof p.post === "number" ? [["Nilai akhir", `${p.post}`] as [string, string]] : [])] },
      ],
      signatures: [
        { lead: `${L.city}, ${tanggal(j.bastDate ?? j.endDate ?? j.startDate)}`, org: L.company, name: j.trainerName || S.training.name, title: j.trainerName ? "Trainer" : S.training.title },
        { lead: "Mengetahui,", org: L.company, name: S.training.name, title: S.training.title },
      ],
    };
  }

  const attended = people.filter(p => p.attended);
  const avg = (k: "pre" | "post") => { const v = attended.map(p => p[k]).filter((x): x is number => typeof x === "number"); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const pre = avg("pre");
  const post = avg("post");
  return {
    fileName: safeName(`Laporan Training ${j.jobNo} - ${j.customer.name}`), title: "LAPORAN PELAKSANAAN TRAINING", number: j.jobNo,
    watermark: j.status === "Cancelled" ? "DIBATALKAN" : j.status === "Completed" ? undefined : "DRAFT",
    recipient: { label: "Customer", name: j.customer.name, lines: lines(j.location) },
    meta: [["Periode", period], ["Jenis", `${j.type} · ${j.mode}`], ...(j.salesOrder ? [["Sales Order", j.salesOrder.soNo] as [string, string]] : [])],
    blocks: [
      { type: "kv", title: "Pelaksanaan", rows: [["Trainer", j.trainerName || "-"], ["Teknisi", j.technicians || "-"], ["Materi", topics]] },
      { type: "table", columns: [{ label: "No", width: 6, align: "center" }, { label: "Nama", width: 34 }, { label: "Jabatan", width: 28 }, { label: "Hadir", width: 10, align: "center" }, { label: "Pre", width: 11, align: "right" }, { label: "Post", width: 11, align: "right" }],
        rows: people.map((p, i) => [String(i + 1), { text: p.name, bold: true }, p.title || "-", p.attended ? "Ya" : "Tidak", p.pre ?? "-", p.post ?? "-"].map(v => (typeof v === "number" ? String(v) : v))) },
      { type: "kv", title: "Ringkasan", rows: [
        ["Peserta hadir", `${attended.length} dari ${people.length} orang`],
        ["Rata-rata nilai", pre !== null || post !== null ? `pre-test ${pre ?? "-"} → post-test ${post ?? "-"}` : "-"],
        ["Kepuasan client", j.feedbackScore ? `${j.feedbackScore}/5${j.feedbackNote ? ` — ${j.feedbackNote}` : ""}` : "-"],
        ["BAST", j.bastNo ? `${j.bastNo} (${tanggal(j.bastDate)})` : "-"],
      ] },
    ],
    signatures: [
      { lead: "Trainer,", org: L.company, name: j.trainerName || S.training.name, title: j.trainerName ? "Trainer" : S.training.title },
      { lead: "Mengetahui,", org: j.customer.name, name: j.customer.signatoryName || j.customer.contactName || "....................", title: j.customer.signatoryTitle || j.customer.contactTitle || "" },
    ],
  };
}

export async function buildDocument(kind: DocKind, id: string): Promise<DocModel | null> {
  switch (kind) {
    case "packing-list": return shipmentDoc(id, "packing-list");
    case "delivery-order": return shipmentDoc(id, "delivery-order");
    case "training-report": return trainingDoc(id, "training-report");
    case "training-certificate": return trainingDoc(id, "training-certificate");
    case "quotation": return quotation(id);
    case "invoice": return invoice(id);
    case "receipt": return receipt(id);
    case "contract": return contract(id);
    case "bast": return salesOrderDoc(id, "bast");
    case "order-confirmation": return salesOrderDoc(id, "order-confirmation");
    case "reminder": return reminder(id);
  }
}
