// Menyusun DocModel dari data database untuk setiap jenis dokumen Sales.
import { prisma } from "@/lib/prisma";
import { invoiceState, isExportCustomer, money, roundMoney } from "../lib";
import { AGREEMENT_TITLE, buildClauses, visitSchedule, type Clause } from "./contractTemplates";
import { amountInWords, bulanTahun, dateEn, hari, safeName, tanggal, terbilang } from "./format";
import { LETTERHEAD as L } from "./letterhead";
import type { Block, DocModel } from "./model";

export const DOC_KINDS = ["quotation", "invoice", "receipt", "contract", "bast", "order-confirmation", "proforma-invoice", "credit-note", "reminder", "packing-list", "delivery-order", "commercial-invoice", "training-report", "training-certificate"] as const;
/** Dokumen milik modul Contract & Shipping / Training & CS (akses mengikuti modul tsb). */
export const SHIPPING_DOCS: DocKind[] = ["packing-list", "delivery-order", "commercial-invoice"];
export const SERVICE_DOCS: DocKind[] = ["training-report", "training-certificate"];
export type DocKind = (typeof DOC_KINDS)[number];

const S = L.signatories;
const lines = (...v: (string | null | undefined)[]) => v.filter((x): x is string => !!x && !!x.trim());
/** Baris negara untuk alamat customer luar negeri (dilewati bila alamat sudah menyebut negaranya). */
/** Label termin bayar (konstanta berbahasa Indonesia) untuk dokumen berbahasa Inggris. */
const TERM_EN: [RegExp, string][] = [
  [/L\/C cair sebelum barang dikirim/i, "L/C honoured before shipment"], [/Setelah PO diterima/i, "upon receipt of PO"], [/Sebelum barang dikirim/i, "before shipment"],
  [/Setelah BAST instalasi/i, "after installation handover (BAST)"], [/Setelah BAST/i, "after handover (BAST)"], [/Setelah barang diterima/i, "upon receipt of goods"],
  [/^Pembayaran/i, "Payment"], [/^Pelunasan/i, "Balance"], [/^DP\b/i, "Advance"], [/^Termin/i, "Progress payment"], [/^Retensi/i, "Retention"],
];
const termEn = (t: string) => TERM_EN.reduce((x, [re, en]) => x.replace(re, en), t);
const countryLine = (c: { country: string }, address?: string | null) =>
  isExportCustomer(c) && !(address ?? "").toLowerCase().includes(c.country.toLowerCase()) ? c.country : null;
/** Kolom tabel item; valuta asing ditulis di judul kolom. */
const itemCols = (en: boolean, cur = "IDR") => {
  const c = cur === "IDR" && !en ? "" : ` (${cur})`;
  return [
    { label: "No", width: 4, align: "center" as const },
    { label: en ? "Description & Specifications" : "Deskripsi & Spesifikasi", width: 46 },
    { label: "Qty", width: 10, align: "right" as const },
    { label: `${en ? "Unit Price" : "Harga Satuan"}${c}`, width: 18, align: "right" as const },
    { label: `${en ? "Amount" : "Jumlah"}${c}`, width: 18, align: "right" as const },
  ];
};
const qty = (q: number, unit: string, en = false) => `${q.toLocaleString(en ? "en-US" : "id-ID")} ${unit}`;
/** Angka tanpa kode valuta (judul kolom sudah menyebut valutanya). */
const num = (n: number, cur = "IDR") => (cur === "IDR" ? Math.round(n).toLocaleString("id-ID") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// ---------------------------------------------------------
// Penawaran
// ---------------------------------------------------------
async function quotation(id: string): Promise<DocModel | null> {
  const q = await prisma.quotation.findUnique({ where: { id }, include: { customer: true, items: { orderBy: { sortOrder: "asc" } } } });
  if (!q) return null;
  const sales = await prisma.user.findFirst({ where: { name: q.salesName }, select: { phone: true, email: true } });
  const en = isExportCustomer(q.customer);
  const cur = q.currency;
  const m = (n: number) => money(n, cur);
  const number = q.revision ? `${q.quotationNo} Rev.${q.revision}` : q.quotationNo;
  return {
    lang: en ? "en" : "id",
    fileName: safeName(`${en ? "Quotation" : "Penawaran"} ${q.quotationNo}${q.revision ? ` Rev${q.revision}` : ""} - ${q.customer.name}`),
    title: en ? "QUOTATION" : "SURAT PENAWARAN HARGA", number,
    watermark: ["Draft", "Waiting Approval"].includes(q.status) ? "DRAFT" : undefined,
    recipient: { label: en ? "To" : "Kepada Yth.", name: q.customer.name, lines: lines(q.customer.address, countryLine(q.customer, q.customer.address), q.attention && (en ? `Attn. ${q.attention}` : `U.p. ${q.attention}`)) },
    meta: en
      ? [["Date", `${L.city}, ${dateEn(q.date)}`], ["Subject", q.subject], ["Valid until", dateEn(q.validUntil)], ["Currency", cur]]
      : [["Tanggal", `${L.city}, ${tanggal(q.date)}`], ["Perihal", q.subject], ["Berlaku s/d", tanggal(q.validUntil)], ...(cur !== "IDR" ? [["Mata uang", cur] as [string, string]] : [])],
    blocks: [
      { type: "para", text: q.introText ?? "" },
      { type: "table", columns: itemCols(en, cur), rows: q.items.map((it, i) => [
        String(i + 1), { text: it.description, bold: true, sub: it.specs }, qty(it.qty, it.unit, en),
        { text: m(it.unitPrice), note: it.discountPercent > 0 ? `${en ? "Discount" : "Diskon"} ${it.discountPercent}%` : null }, { text: m(it.lineTotal), bold: true },
      ]) },
      { type: "totals", rows: [
        ["Subtotal", m(q.subtotal)],
        ...(q.discountAmount > 0 ? [[`${en ? "Discount" : "Diskon"} ${q.discountPercent}%`, `− ${m(q.discountAmount)}`] as [string, string]] : []),
        ...(q.taxPercent > 0 || !en ? [[`${en ? "VAT" : "PPN"} ${q.taxPercent}%`, m(q.taxAmount)] as [string, string]] : []),
      ], total: ["TOTAL", m(q.total)] },
      { type: "words", text: amountInWords(q.total, cur, en ? "en" : "id") },
      { type: "kv", title: en ? "Terms & Conditions" : "Syarat & Ketentuan", rows: [
        ...(q.paymentTerms ? [[en ? "Payment" : "Pembayaran", q.paymentTerms] as [string, string]] : []),
        ...(q.deliveryTerms ? [[en ? "Delivery" : "Pengiriman", q.deliveryTerms] as [string, string]] : []),
        ...(q.warrantyTerms ? [[en ? "Warranty" : "Garansi", q.warrantyTerms] as [string, string]] : []),
        ...(en ? [["Country of origin", "Indonesia"] as [string, string]] : []),
        en ? ["Validity", `This quotation is valid until ${dateEn(q.validUntil)}.`] : ["Masa berlaku", `Penawaran berlaku sampai ${tanggal(q.validUntil)}.`],
        [en ? "Bank" : "Rekening", cur === "IDR" ? L.bank : L.bankIntl],
      ] },
      { type: "para", text: q.closingText ?? "" },
    ],
    signatures: [
      { lead: en ? "Sincerely," : "Hormat kami,", org: L.company, name: q.salesName, title: "Sales Engineer", extra: [sales?.phone, sales?.email].filter(Boolean).join(" · ") },
      ...(q.approvedBy ? [{ lead: en ? "Acknowledged by," : "Mengetahui,", name: q.approvedBy, title: "Sales Manager" }] : []),
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
  const en = isExportCustomer(inv.customer);
  const cur = inv.currency;
  const m = (n: number) => money(n, cur);
  const state = invoiceState(inv);
  const ref = inv.salesOrder ? `PO ${inv.salesOrder.customerPoNo} · ${inv.salesOrder.soNo}` : inv.contract ? `${en ? "Contract" : "Kontrak"} ${inv.contract.contractNo}` : "-";
  const termNote = inv.termPercent && inv.termPercent < 100 && !inv.termLabel.includes("%") ? (en ? ` (${inv.termPercent}% of order value)` : ` (${inv.termPercent}% dari nilai pesanan)`) : "";
  const rows = inv.items.length
    ? inv.items.map((it, i) => [String(i + 1), { text: it.description, bold: true }, qty(it.qty, it.unit, en), m(it.unitPrice), { text: m(it.lineTotal), bold: true }])
    : [[
        "1",
        { text: `${en ? termEn(inv.termLabel) : inv.termLabel}${termNote}`, bold: true,
          sub: inv.salesOrder ? `${en ? "Against" : "Atas"} PO ${inv.salesOrder.customerPoNo} (${inv.salesOrder.soNo}): ${inv.salesOrder.items.map(i => `${i.qty} ${i.unit} ${i.description.split(" — ")[0]}`).join("; ")}` : inv.contract ? `${inv.contract.title}${inv.periodLabel ? ` — ${inv.periodLabel}` : ""}` : null },
        "1", m(inv.subtotal), { text: m(inv.subtotal), bold: true },
      ]];
  const remaining = inv.total - inv.paidAmount;
  return {
    lang: en ? "en" : "id",
    fileName: safeName(`Invoice ${inv.invoiceNo} - ${inv.customer.name}`),
    title: "INVOICE", number: inv.invoiceNo,
    watermark: state === "Paid" ? (en ? "PAID" : "LUNAS") : state === "Cancelled" ? (en ? "CANCELLED" : "DIBATALKAN") : undefined,
    recipient: { label: en ? "Bill to" : "Ditagihkan kepada", name: inv.customer.name, lines: lines(inv.customer.address, countryLine(inv.customer, inv.customer.address), !en && inv.customer.npwp ? `NPWP ${inv.customer.npwp}` : null) },
    meta: en
      ? [["Date", dateEn(inv.invoiceDate)], ["Due date", dateEn(inv.dueDate)], ["Reference", ref], ["Currency", cur]]
      : [["Tanggal", tanggal(inv.invoiceDate)], ["Jatuh tempo", tanggal(inv.dueDate)], ["Referensi", ref], ...(inv.fakturPajakNo ? [["Faktur pajak", inv.fakturPajakNo] as [string, string]] : []), ...(cur !== "IDR" ? [["Mata uang", cur] as [string, string]] : [])],
    blocks: [
      { type: "table", columns: itemCols(en, cur), rows },
      { type: "totals", rows: [
        [en ? "Subtotal" : "DPP", m(inv.subtotal)],
        ...(inv.taxPercent > 0 || !en ? [[`${en ? "VAT" : "PPN"} ${inv.taxPercent}%`, m(inv.taxAmount)] as [string, string]] : []),
      ], total: [en ? "TOTAL DUE" : "TOTAL TAGIHAN", m(inv.total)] },
      { type: "words", text: amountInWords(inv.total, cur, en ? "en" : "id") },
      { type: "kv", title: en ? "Payment" : "Pembayaran", rows: [
        [en ? "Bank" : "Transfer ke", cur === "IDR" ? L.bank : L.bankIntl],
        [en ? "Payment reference" : "Berita transfer", inv.invoiceNo],
        ...(inv.paidAmount > 0 && state !== "Paid" ? [[en ? "Paid" : "Sudah dibayar", m(inv.paidAmount)] as [string, string], [en ? "Balance due" : "Sisa tagihan", m(remaining)] as [string, string]] : []),
      ] },
      { type: "note", text: en
        ? `Please quote the invoice number on your remittance and send the payment advice to ${L.email}. Bank charges outside Indonesia are for the buyer's account.`
        : "Mohon cantumkan nomor invoice pada berita transfer dan kirimkan bukti pembayaran ke " + L.email + "." },
    ],
    signatures: [{ lead: `${L.city}, ${en ? dateEn(inv.invoiceDate) : tanggal(inv.invoiceDate)}`, org: L.company, name: S.finance.name, title: S.finance.title }],
  };
}

async function receipt(paymentId: string): Promise<DocModel | null> {
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { invoice: { include: { customer: true, salesOrder: true, contract: true } } } });
  if (!p) return null;
  const inv = p.invoice;
  const en = isExportCustomer(inv.customer);
  const cur = inv.currency;
  const number = p.receiptNo ?? `KWT-${p.id.slice(-8).toUpperCase()}`;
  const forWhat = `${inv.termLabel} — invoice ${inv.invoiceNo}${inv.salesOrder ? ` (PO ${inv.salesOrder.customerPoNo})` : inv.contract ? ` (${en ? "contract" : "kontrak"} ${inv.contract.contractNo})` : ""}`;
  return {
    lang: en ? "en" : "id",
    fileName: safeName(`${en ? "Receipt" : "Kwitansi"} ${number} - ${inv.customer.name}`),
    title: en ? "RECEIPT" : "KWITANSI", number,
    meta: [[en ? "Date" : "Tanggal", en ? dateEn(p.paymentDate) : tanggal(p.paymentDate)], ["Invoice", inv.invoiceNo]],
    blocks: [
      { type: "kv", rows: [
        [en ? "Received from" : "Telah terima dari", inv.customer.name],
        [en ? "Amount" : "Uang sejumlah", amountInWords(p.amount, cur, en ? "en" : "id").replace(/^(Terbilang|Say): /, "")],
        [en ? "Payment for" : "Untuk pembayaran", forWhat],
        [en ? "Method" : "Metode", `${p.method}${p.reference ? ` · ${p.reference}` : ""}`],
      ] },
      { type: "totals", rows: [], total: [en ? "AMOUNT" : "JUMLAH", money(p.amount, cur)] },
    ],
    // Kwitansi Rupiah ≥ Rp5 juta wajib bermeterai.
    signatures: [{ lead: `${L.city}, ${en ? dateEn(p.paymentDate) : tanggal(p.paymentDate)}`, org: L.company, name: p.receivedBy, title: "Finance", stamp: !en && cur === "IDR" && p.amount >= 5_000_000 }],
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
    const en = isExportCustomer(so.customer);
    const cur = so.currency;
    const m = (n: number) => money(n, cur);
    return {
      lang: en ? "en" : "id",
      fileName: safeName(`${en ? "Order Confirmation" : "Konfirmasi Pesanan"} ${so.soNo} - ${so.customer.name}`),
      title: en ? "ORDER CONFIRMATION" : "KONFIRMASI PESANAN", number: so.soNo,
      watermark: ["Contract Review", "Cancelled"].includes(so.status) ? (so.status === "Cancelled" ? (en ? "CANCELLED" : "DIBATALKAN") : "DRAFT") : undefined,
      recipient: en ? { label: "To", name: so.customer.name, lines: lines(so.deliveryAddress ?? so.customer.address, countryLine(so.customer, so.deliveryAddress ?? so.customer.address), so.customer.contactName && `Attn. ${so.customer.contactName}`) } : recipient,
      meta: en
        ? [["Date", dateEn(so.orderDate)], ["PO No.", `${so.customerPoNo} (${dateEn(so.customerPoDate)})`], ...(so.quotation ? [["Quotation", `${so.quotation.quotationNo} Rev.${so.quotation.revision}`] as [string, string]] : []), ["Currency", cur]]
        : [["Tanggal", tanggal(so.orderDate)], ["No. PO", `${so.customerPoNo} (${tanggal(so.customerPoDate)})`], ...(so.quotation ? [["Penawaran", `${so.quotation.quotationNo} Rev.${so.quotation.revision}`] as [string, string]] : []), ...(cur !== "IDR" ? [["Mata uang", cur] as [string, string]] : [])],
      blocks: [
        { type: "para", text: en
          ? `Dear Sir/Madam,\n\nThank you for your order. We hereby confirm that Purchase Order No. ${so.customerPoNo} has been received and accepted with the following details:`
          : `Dengan hormat,\n\nTerima kasih atas kepercayaan Bapak/Ibu. Dengan ini kami mengonfirmasi bahwa Purchase Order No. ${so.customerPoNo} telah kami terima dan disetujui dengan rincian sebagai berikut:` },
        { type: "table", columns: itemCols(en, cur), rows: so.items.map((it, i) => [String(i + 1), { text: it.description, bold: true }, qty(it.qty, it.unit, en), m(it.unitPrice), { text: m(it.lineTotal), bold: true }]) },
        { type: "totals", rows: [
          [en ? "Subtotal" : "DPP", m(so.subtotal)],
          ...(so.taxPercent > 0 || !en ? [[`${en ? "VAT" : "PPN"} ${so.taxPercent}%`, m(so.taxAmount)] as [string, string]] : []),
        ], total: ["TOTAL", m(so.total)] },
        { type: "words", text: amountInWords(so.total, cur, en ? "en" : "id") },
        { type: "kv", title: en ? "Execution" : "Ketentuan Pelaksanaan", rows: [
          [en ? "Delivery address" : "Alamat kirim", so.deliveryAddress ?? so.customer.address ?? "-"],
          [en ? "Estimated shipment" : "Target kirim", en ? dateEn(so.expectedDelivery) : tanggal(so.expectedDelivery)],
          [en ? "Payment terms" : "Termin bayar", schedule.map(t => en ? `${termEn(t.label)} (${termEn(t.trigger)})` : `${t.label} (${t.trigger.toLowerCase()})`).join("; ") || "-"],
          ...(so.lcNo ? [["L/C", `${so.lcNo}${so.lcIssuingBank ? ` · ${so.lcIssuingBank}` : ""}`] as [string, string]] : []),
        ] },
        { type: "para", text: en
          ? "Our team will contact you to coordinate shipment, installation and training schedules. Please inform us of any discrepancy in the details above."
          : "Tim kami akan menghubungi Bapak/Ibu untuk koordinasi jadwal pengiriman dan instalasi. Mohon informasikan kepada kami apabila terdapat ketidaksesuaian pada rincian di atas." },
      ],
      signatures: [{ lead: en ? "Sincerely," : "Hormat kami,", org: L.company, name: S.sales.name, title: S.sales.title }],
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
        rows: [[{ text: inv.invoiceNo, bold: true, sub: inv.salesOrder ? `PO ${inv.salesOrder.customerPoNo}` : inv.termLabel }, tanggal(inv.invoiceDate), tanggal(inv.dueDate), money(inv.total, inv.currency), { text: money(inv.total - inv.paidAmount, inv.currency), bold: true }]] },
      { type: "kv", rows: [["Rekening", inv.currency === "IDR" ? L.bank : L.bankIntl], ["Konfirmasi", `${L.phone} · ${L.email}`]] },
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

// ---------------------------------------------------------
// Dokumen ekspor: Proforma Invoice (dari SO) & Commercial Invoice (dari shipment)
// ---------------------------------------------------------
type Sched = { label: string; percent: number; trigger: string };

/** Kode HS per productId (dari master produk). */
async function hsCodes(productIds: (string | null)[]) {
  const ids = productIds.filter((x): x is string => !!x);
  const rows = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, hsCode: true } }) : [];
  return new Map(rows.map(r => [r.id, r.hsCode]));
}

/** Proforma invoice: dasar pembukaan L/C / pembayaran DP oleh buyer. Nomor mengikuti SO (LPI/PI/…). */
async function proformaInvoice(id: string): Promise<DocModel | null> {
  const so = await prisma.salesOrder.findUnique({ where: { id }, include: { customer: true, items: { orderBy: { sortOrder: "asc" } }, quotation: true } });
  if (!so) return null;
  const en = isExportCustomer(so.customer);
  const cur = so.currency;
  const m = (n: number) => money(n, cur);
  const hs = await hsCodes(so.items.map(i => i.productId));
  const schedule = JSON.parse(so.paymentScheduleJson || "[]") as Sched[];
  const number = so.soNo.replace("/SO/", "/PI/");
  const discount = roundMoney(so.items.reduce((t, i) => t + i.lineTotal, 0) - so.subtotal, cur);
  const d = (iso?: string | null) => (en ? dateEn(iso) : tanggal(iso));
  return {
    lang: en ? "en" : "id",
    fileName: safeName(`Proforma Invoice ${number} - ${so.customer.name}`),
    title: "PROFORMA INVOICE", number,
    watermark: so.status === "Cancelled" ? (en ? "CANCELLED" : "DIBATALKAN") : undefined,
    recipient: { label: en ? "Buyer" : "Pembeli", name: so.customer.name, lines: lines(so.customer.address, countryLine(so.customer, so.customer.address), so.customer.contactName && `${en ? "Attn." : "U.p."} ${so.customer.contactName}`) },
    meta: [
      [en ? "Date" : "Tanggal", d(so.orderDate)],
      [en ? "Buyer's PO" : "PO pembeli", `${so.customerPoNo} (${d(so.customerPoDate)})`],
      ["Sales Order", so.soNo],
      [en ? "Currency" : "Mata uang", cur],
    ],
    blocks: [
      { type: "para", text: en
        ? `With reference to your Purchase Order No. ${so.customerPoNo}, we are pleased to issue this proforma invoice. Kindly arrange the payment or open the Letter of Credit in accordance with the terms below.`
        : `Menindaklanjuti Purchase Order No. ${so.customerPoNo}, bersama ini kami sampaikan proforma invoice sebagai dasar pembayaran sesuai ketentuan di bawah ini.` },
      { type: "table", columns: itemCols(en, cur), rows: so.items.map((it, i) => {
        const code = it.productId ? hs.get(it.productId) : null;
        return [String(i + 1), { text: it.description, bold: true, sub: code ? `HS Code ${code}` : null }, qty(it.qty, it.unit, en), num(it.unitPrice, cur), { text: num(it.lineTotal, cur), bold: true }];
      }) },
      { type: "totals", rows: [
        ...(discount > 0 ? [["Subtotal", m(so.subtotal + discount)] as [string, string], [en ? "Discount" : "Diskon", `− ${m(discount)}`] as [string, string]] : [[en ? "Subtotal" : "DPP", m(so.subtotal)] as [string, string]]),
        ...(so.taxPercent > 0 || !en ? [[`${en ? "VAT" : "PPN"} ${so.taxPercent}%`, m(so.taxAmount)] as [string, string]] : []),
      ], total: ["TOTAL", m(so.total)] },
      { type: "words", text: amountInWords(so.total, cur, en ? "en" : "id") },
      { type: "kv", title: en ? "Terms" : "Ketentuan", rows: [
        [en ? "Payment" : "Pembayaran", schedule.map(t => `${en ? termEn(t.label) : t.label} — ${m(roundMoney(so.total * t.percent / 100, cur))} (${en ? termEn(t.trigger) : t.trigger.toLowerCase()})`).join("\n") || "-"],
        ...(so.quotation?.deliveryTerms ? [[en ? "Delivery" : "Pengiriman", so.quotation.deliveryTerms] as [string, string]] : []),
        [en ? "Estimated shipment" : "Perkiraan kirim", d(so.expectedDelivery)],
        [en ? "Port of loading" : "Pelabuhan muat", L.portOfLoading],
        [en ? "Country of origin" : "Negara asal", "Indonesia"],
        ...(so.lcNo ? [["L/C", `${so.lcNo}${so.lcIssuingBank ? ` · ${so.lcIssuingBank}` : ""}${so.lcLatestShipment ? ` · latest shipment ${d(so.lcLatestShipment)}` : ""}${so.lcExpiryDate ? ` · expiry ${d(so.lcExpiryDate)}` : ""}`] as [string, string]] : []),
        [en ? "Beneficiary bank" : "Rekening", cur === "IDR" ? L.bank : L.bankIntl],
      ] },
      { type: "note", text: en
        ? "This proforma invoice is issued for payment / L/C opening purposes only and is not a tax invoice. Goods will be shipped after full payment has been received."
        : "Proforma invoice ini hanya untuk keperluan pembayaran dan bukan faktur pajak. Barang dikirim setelah pembayaran lunas diterima." },
    ],
    signatures: [{ lead: `${L.city}, ${d(so.orderDate)}`, org: L.company, name: S.sales.name, title: S.sales.title }],
  };
}

/** Commercial invoice untuk pengiriman ekspor (bahasa Inggris, nilai barang tanpa PPN). */
async function commercialInvoice(id: string): Promise<DocModel | null> {
  const s = await prisma.salesShipment.findUnique({ where: { id }, include: { customer: true, salesOrder: { include: { items: { orderBy: { sortOrder: "asc" } } } } } });
  if (!s) return null;
  const so = s.salesOrder;
  const cur = so.currency;
  const m = (n: number) => money(n, cur);
  const hs = await hsCodes(so.items.map(i => i.productId));
  const crates = JSON.parse(s.packagesJson || "[]") as Crate[];
  const gross = crates.reduce((t, c) => t + (Number(c.grossKg) || 0), 0);
  const net = crates.reduce((t, c) => t + (Number(c.netKg) || 0), 0);
  const kg = (n: number) => (n ? `${n.toLocaleString("en-US")} kg` : "-");
  const itemsTotal = roundMoney(so.items.reduce((t, i) => t + i.lineTotal, 0), cur);
  const discount = roundMoney(itemsTotal - so.subtotal, cur);
  const invDate = s.shippedAt?.slice(0, 10) ?? s.etd ?? s.createdAt.slice(0, 10);
  const number = s.shipmentNo.replace("/SHP/", "/CI/");
  return {
    lang: "en",
    fileName: safeName(`Commercial Invoice ${number} - ${s.customer.name}`),
    title: "COMMERCIAL INVOICE", number,
    watermark: s.status === "Cancelled" ? "CANCELLED" : s.status === "Draft" ? "DRAFT" : undefined,
    recipient: { label: "Consignee", name: s.customer.name, lines: lines(s.customer.address, countryLine(s.customer, s.customer.address), s.customer.contactName && `Attn. ${s.customer.contactName}${s.customer.contactPhone ? ` (${s.customer.contactPhone})` : ""}`) },
    meta: [
      ["Date", dateEn(invDate)],
      ["Buyer's PO", so.customerPoNo],
      ["Sales Order", so.soNo],
      ["Currency", cur],
      ...(so.lcNo ? [["L/C No.", so.lcNo] as [string, string]] : []),
    ],
    blocks: [
      { type: "kv", title: "Shipment", rows: [
        ["Shipper / Manufacturer", `${L.company}, ${L.factory}`],
        ["Port of loading", s.origin === "Batam" ? L.portOfLoading : s.origin],
        ["Destination", s.destination],
        ["Terms of delivery", s.incoterm ? `${s.incoterm}${s.incoterm === "EXW" || s.incoterm === "FCA" || s.incoterm === "FOB" ? ` ${s.origin}` : ` ${s.destination}`} (Incoterms 2020)` : "-"],
        ["Mode", ({ Laut: "Sea freight", Udara: "Air freight", Darat: "Land" } as Record<string, string>)[s.mode] ?? s.mode],
        ...(s.vessel ? [["Vessel / flight", s.vessel] as [string, string]] : []),
        ...(s.awbNo ? [["B/L / AWB No.", s.awbNo] as [string, string]] : []),
        ...(s.containerNo ? [["Container", s.containerNo] as [string, string]] : []),
        ["Country of origin", "Indonesia"],
      ] },
      { type: "table", columns: [
        { label: "No", width: 5, align: "center" }, { label: "Description of goods", width: 39 }, { label: "HS Code", width: 12 },
        { label: "Qty", width: 10, align: "right" }, { label: `Unit Price (${cur})`, width: 16, align: "right" }, { label: `Amount (${cur})`, width: 18, align: "right" },
      ], rows: so.items.map((it, i) => [
        String(i + 1), { text: it.description, bold: true }, (it.productId && hs.get(it.productId)) || "-",
        qty(it.qty, it.unit, true), num(it.unitPrice, cur), { text: num(it.lineTotal, cur), bold: true },
      ]) },
      { type: "totals", rows: [
        ...(discount > 0 ? [["Subtotal", m(itemsTotal)] as [string, string], ["Discount", `− ${m(discount)}`] as [string, string]] : []),
        ...(so.taxPercent > 0 ? [[`VAT ${so.taxPercent}%`, m(so.taxAmount)] as [string, string]] : []),
      ], total: [`TOTAL ${s.incoterm ?? ""}`.trim(), m(so.taxPercent > 0 ? so.total : so.subtotal)] },
      { type: "words", text: amountInWords(so.taxPercent > 0 ? so.total : so.subtotal, cur, "en") },
      { type: "kv", title: "Packing", rows: [
        ["Packages", `${crates.length} wooden crate(s)`],
        ["Total net weight", kg(net)],
        ["Total gross weight", kg(gross)],
      ] },
      { type: "para", text: "We hereby certify that this invoice shows the actual price of the goods described, that all particulars are true and correct, and that the goods are of Indonesian origin." },
    ],
    signatures: [{ lead: `Batam, ${dateEn(invDate)}`, org: L.company, name: S.shipping.name, title: S.shipping.title }],
  };
}

// ---------------------------------------------------------
// Nota kredit
// ---------------------------------------------------------
async function creditNote(id: string): Promise<DocModel | null> {
  const c = await prisma.creditNote.findUnique({ where: { id }, include: { customer: true, invoice: { include: { salesOrder: true } } } });
  if (!c) return null;
  const en = isExportCustomer(c.customer);
  const cur = c.currency;
  const m = (n: number) => money(n, cur);
  const inv = c.invoice;
  const d = (iso?: string | null) => (en ? dateEn(iso) : tanggal(iso));
  return {
    lang: en ? "en" : "id",
    fileName: safeName(`${en ? "Credit Note" : "Nota Kredit"} ${c.creditNoteNo} - ${c.customer.name}`),
    title: en ? "CREDIT NOTE" : "NOTA KREDIT", number: c.creditNoteNo,
    recipient: { label: en ? "To" : "Kepada", name: c.customer.name, lines: lines(c.customer.address, countryLine(c.customer, c.customer.address), !en && c.customer.npwp ? `NPWP ${c.customer.npwp}` : null) },
    meta: [
      [en ? "Date" : "Tanggal", d(c.date)],
      [en ? "Invoice" : "Atas invoice", `${inv.invoiceNo} (${d(inv.invoiceDate)})`],
      ...(inv.salesOrder ? [["PO", inv.salesOrder.customerPoNo] as [string, string]] : []),
      ...(!en && inv.fakturPajakNo ? [["Faktur pajak asal", inv.fakturPajakNo] as [string, string]] : []),
    ],
    blocks: [
      { type: "para", text: en
        ? `We hereby credit your account for the following, reducing the amount due on invoice ${inv.invoiceNo}:`
        : `Dengan ini kami mengkreditkan tagihan Bapak/Ibu atas invoice ${inv.invoiceNo} dengan rincian sebagai berikut:` },
      { type: "table", columns: [{ label: "No", width: 6, align: "center" }, { label: en ? "Description" : "Keterangan", width: 70 }, { label: `${en ? "Amount" : "Jumlah"}${cur === "IDR" && !en ? "" : ` (${cur})`}`, width: 24, align: "right" }],
        rows: [["1", { text: c.reason, bold: true }, num(c.subtotal, cur)]] },
      { type: "totals", rows: [
        [en ? "Subtotal" : "DPP", m(c.subtotal)],
        ...(c.taxAmount > 0 || !en ? [[`${en ? "VAT" : "PPN"} ${inv.taxPercent}%`, m(c.taxAmount)] as [string, string]] : []),
      ], total: [en ? "TOTAL CREDIT" : "TOTAL KREDIT", m(c.total)] },
      { type: "words", text: amountInWords(c.total, cur, en ? "en" : "id") },
      { type: "kv", rows: [
        [en ? "Invoice total" : "Total invoice", m(inv.total)],
        [en ? "Balance after credit" : "Sisa tagihan setelah kredit", m(Math.max(0, roundMoney(inv.total - inv.paidAmount, cur)))],
      ] },
    ],
    signatures: [{ lead: `${L.city}, ${d(c.date)}`, org: L.company, name: S.finance.name, title: S.finance.title }],
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
    case "proforma-invoice": return proformaInvoice(id);
    case "credit-note": return creditNote(id);
    case "commercial-invoice": return commercialInvoice(id);
    case "reminder": return reminder(id);
  }
}
