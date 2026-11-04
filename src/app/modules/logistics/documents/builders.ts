// Dokumen ber-kop PT Arunika Trans Nusantara (kop dari CompanyProfile), memakai engine dokumen Sales.
import { prisma } from "@/lib/prisma";
import type { DocModel } from "@/app/modules/sales/documents/model";
import { safeName, tanggal, terbilangRupiah } from "@/app/modules/sales/documents/format";
import { getLogisticsBrand } from "../server";
import { rupiah, type PriceLine } from "../lib";

export const LOG_DOC_KINDS = ["charter-quote", "surat-jalan"] as const;
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

/** Surat Jalan (rancangan P1.6): truk, sopir, kenek, muatan, segel, rute, titik bongkar, tanda tangan. Hanya bila sudah terbit. */
async function suratJalan(id: string): Promise<DocModel | null> {
  const t = await prisma.trip.findUnique({
    where: { id },
    include: { vehicle: { include: { truckType: true } }, driver: true, helper: true, route: true, client: true, order: { include: { stops: { orderBy: { seq: "asc" } } } }, overrides: true },
  });
  if (!t || !t.suratJalanNo) return null;
  const { brand, city, signers } = await getLogisticsBrand();
  const o = t.order;
  const date = (t.suratJalanAt ?? t.createdAt).slice(0, 10);
  const stops = o?.stops ?? [];
  return {
    brand,
    fileName: safeName(`Surat Jalan ${t.suratJalanNo} ${t.vehicle.plateNo}`),
    title: "SURAT JALAN",
    number: t.suratJalanNo,
    watermark: t.status === "Cancelled" ? "DIBATALKAN" : undefined,
    recipient: { label: "Kepada Yth. (penerima barang)", name: t.client?.name ?? "-", lines: stops.map(s => `${s.seq}. ${s.name}${s.city ? `, ${s.city}` : ""}`) },
    meta: [["Tanggal", `${city}, ${tanggal(date)}`], ["No. trip", t.tripNo], ["No. order", o?.orderNo ?? "-"], ["Ref. klien", o?.clientRef || "-"]],
    blocks: [
      { type: "kv", title: "Armada & kru", rows: [
        ["Kendaraan", `${t.vehicle.plateNo} · ${t.vehicle.truckType.name} (${t.vehicle.truckType.capacityTon} ton) · ${t.vehicle.brand ?? ""}`],
        ["Sopir", `${t.driver.name} (${t.driver.code}) · SIM ${t.driver.simClass} ${t.driver.simNo ?? ""} · HP ${t.driver.phone ?? "-"}`],
        ["Kenek", t.helper ? `${t.helper.name} (${t.helper.code})` : "-"],
      ] },
      { type: "kv", title: "Rute & jadwal", rows: [
        ["Rute", t.route ? `${t.route.origin} → ${t.route.destination} (±${t.route.distanceKm} km)` : "-"],
        ["Muat", o ? `${o.originName}${o.originAddress ? `, ${o.originAddress}` : ""} · ${tanggal(o.loadDate)}${o.loadTime ? ` pukul ${o.loadTime}` : ""}` : "-"],
        ["Titik bongkar", stops.map(s => `${s.seq}. ${s.name}`).join("; ") || "-"],
      ] },
      { type: "table", columns: [{ label: "No", width: 0.5, align: "center" }, { label: "Uraian muatan", width: 4 }, { label: "Berat", width: 1.2, align: "right" }, { label: "Jumlah diterima", width: 1.6, align: "center" }, { label: "Catatan", width: 1.8 }],
        rows: [["1", { text: o?.cargoDesc ?? "-", sub: o?.cargoValue ? `Nilai barang ${rupiah(o.cargoValue)}` : null }, o?.cargoWeightTon ? `${o.cargoWeightTon} ton` : "-", "", ""]] },
      { type: "kv", title: "Segel", rows: [["No. segel", "........................................ (diisi saat muat)"], ["Kondisi segel saat bongkar", "Utuh / Rusak *coret salah satu"]] },
      ...(t.overrides.length ? [{ type: "note" as const, text: `Catatan dispatch: trip ini berjalan dengan ${t.overrides.length} override (${t.overrides.map(x => `#${x.condition.split(":")[0]} oleh ${x.byName}`).join(", ")}). Detail tercatat di sistem.` }] : []),
      { type: "note", text: "Barang diterima dalam keadaan baik dan jumlah sesuai, kecuali dicatat di kolom catatan. Selisih/kerusakan wajib ditulis sebelum tanda tangan." },
    ],
    signatures: [
      { lead: "Dikeluarkan oleh,", org: brand.company, name: t.suratJalanBy ?? signers.find(s => s.key === "fleet")?.name ?? "", title: "Dispatcher" },
      { lead: "Pengemudi,", name: t.driver.name, title: `Sopir · ${t.vehicle.plateNo}` },
      { lead: "Diterima oleh,", name: "(.................................)", title: "Nama, tanda tangan & stempel penerima" },
    ],
  };
}

export async function buildLogisticsDocument(kind: LogDocKind, id: string) {
  switch (kind) {
    case "charter-quote": return charterQuote(id);
    case "surat-jalan": return suratJalan(id);
  }
}
