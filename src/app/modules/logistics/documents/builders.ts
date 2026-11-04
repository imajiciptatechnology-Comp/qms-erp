// Dokumen ber-kop PT Arunika Trans Nusantara (kop dari CompanyProfile), memakai engine dokumen Sales.
import { prisma } from "@/lib/prisma";
import type { DocModel } from "@/app/modules/sales/documents/model";
import { safeName, tanggal, terbilangRupiah } from "@/app/modules/sales/documents/format";
import { getLogisticsBrand } from "../server";
import { rupiah, type PriceLine } from "../lib";

export const LOG_DOC_KINDS = ["charter-quote"] as const;
export type LogDocKind = (typeof LOG_DOC_KINDS)[number];

/** Penawaran tarif charter (status Draft) / Konfirmasi order charter (Confirmed dst.). */
async function charterQuote(id: string): Promise<DocModel | null> {
  const o = await prisma.charterOrder.findUnique({ where: { id }, include: { client: true, route: true, truckType: true, stops: { orderBy: { seq: "asc" } } } });
  if (!o) return null;
  const { brand, city, bank, signers } = await getLogisticsBrand();
  const cs = signers.find(s => s.key === "cs") ?? { name: o.createdBy, title: "Admin Order" };
  const director = signers.find(s => s.key === "director");
  const isQuote = o.status === "Draft";
  const lines = JSON.parse(o.breakdownJson || "[]") as PriceLine[];
  const date = o.createdAt.slice(0, 10);

  return {
    brand,
    fileName: safeName(`${isQuote ? "Penawaran" : "Konfirmasi"} ${o.orderNo} ${o.client.name}`),
    title: isQuote ? "PENAWARAN TARIF CHARTER" : "KONFIRMASI ORDER CHARTER",
    number: o.orderNo,
    watermark: o.status === "Cancelled" ? "DIBATALKAN" : undefined,
    recipient: { label: "Kepada Yth.", name: o.client.name, lines: [o.client.contactName ? `u.p. ${o.client.contactName}` : "", o.client.address ?? "", o.client.city ?? ""].filter(Boolean) },
    meta: [["Tanggal", `${city}, ${tanggal(date)}`], ["Ref. klien", o.clientRef || "-"], ["Jenis truk", o.truckType.name]],
    blocks: [
      { type: "para", text: isQuote
        ? `Dengan hormat, menindaklanjuti permintaan Bapak/Ibu, bersama ini kami sampaikan penawaran tarif sewa truk (charter FTL) dengan rincian sebagai berikut.`
        : `Dengan hormat, bersama ini kami konfirmasikan order sewa truk (charter FTL) dari ${o.client.name} dengan rincian sebagai berikut.` },
      { type: "kv", title: "Rincian pengiriman", rows: [
        ["Rute", `${o.route.origin} → ${o.route.destination} (±${o.route.distanceKm} km, ±${o.route.durationHours} jam)`],
        ["Jadwal muat", `${tanggal(o.loadDate)}${o.loadTime ? `, pukul ${o.loadTime} WIB` : ""}`],
        ["Lokasi muat", `${o.originName}${o.originAddress ? `, ${o.originAddress}` : ""}`],
        ["Titik bongkar", o.stops.map(s => `${s.seq}. ${s.name}${s.city ? ` (${s.city})` : ""}`).join("; ")],
        ["Muatan", `${o.truckType.name} (${o.truckType.capacityTon} ton) · ${o.cargoDesc}${o.cargoWeightTon ? `, ±${o.cargoWeightTon} ton` : ""}${o.cargoValue ? `, nilai barang ${rupiah(o.cargoValue)}` : ""}`],
      ] },
      { type: "table", columns: [{ label: "No", width: 0.5, align: "center" }, { label: "Uraian", width: 5 }, { label: "Jumlah (Rp)", width: 2, align: "right" }],
        rows: lines.map((l, i) => [String(i + 1), { text: l.label, sub: l.detail }, (l.amount < 0 ? "− " : "") + Math.abs(Math.round(l.amount)).toLocaleString("id-ID")]) },
      { type: "totals", rows: [
        ...(o.discountAmount > 0 ? [[`Diskon kontrak ${o.discountPercent}%`, `− ${rupiah(o.discountAmount)}`] as [string, string]] : []),
        ["Subtotal (DPP)", rupiah(o.subtotal)], [`PPN ${o.taxPercent}%`, rupiah(o.taxAmount)],
      ], total: ["TOTAL", rupiah(o.total)] },
      { type: "words", text: `Terbilang: ${terbilangRupiah(o.total)}` },
      { type: "kv", title: "Ketentuan", rows: [
        ["Tarif & bayar", `Sekali jalan, termasuk BBM, tol, dan sopir. Pembayaran ${o.client.paymentTerms} setelah invoice dan ePOD diterima.`],
        ["Rekening", bank],
        ...(isQuote ? [["Masa berlaku", "Penawaran berlaku 14 hari sejak tanggal surat."] as [string, string]] : []),
      ] },
    ],
    signatures: [
      { lead: "Hormat kami,", org: brand.company, name: cs.name, title: cs.title },
      ...(director ? [{ lead: "Mengetahui,", org: brand.company, name: director.name, title: director.title }] : []),
    ],
  };
}

export async function buildLogisticsDocument(kind: LogDocKind, id: string) {
  switch (kind) {
    case "charter-quote": return charterQuote(id);
  }
}
