// Dokumen ber-kop PT Arunika Trans Nusantara (kop dari CompanyProfile), memakai engine dokumen Sales.
import { prisma } from "@/lib/prisma";
import type { DocModel } from "@/app/modules/sales/documents/model";
import { safeName, tanggal, terbilangRupiah } from "@/app/modules/sales/documents/format";
import { getLogisticsBrand } from "../server";
import { rupiah, type PriceLine } from "../lib";
import { P2H_ITEMS, parseP2HRecord } from "../p2hLib";
import { TRIP_STATUSES } from "../trackingLib";

export const LOG_DOC_KINDS = ["charter-quote", "surat-jalan", "p2h", "trip-report", "invoice"] as const;
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
    include: { vehicle: { include: { truckType: true } }, driver: true, helper: true, route: true, client: true, order: { include: { stops: { orderBy: { seq: "asc" } } } }, overrides: true,
      events: { where: { status: "SJHandover" }, orderBy: { at: "desc" }, take: 1, select: { by: true } } },
  });
  if (!t || !t.suratJalanNo) return null;
  const { brand, city, signers } = await getLogisticsBrand();
  const o = t.order;
  const date = (t.suratJalanAt ?? t.createdAt).slice(0, 10);
  const stops = o?.stops ?? [];
  // Multi-drop: satu Surat Jalan, tapi tiap titik bongkar punya baris tanda terima sendiri.
  const multiDrop = stops.length > 1;
  // Penanda tangan kantor = petugas yang menyerahkan SJ ke sopir; SJ yang terbit otomatis (P2H lolos) tidak punya nama orang.
  const issuer = t.events[0]?.by ?? (t.suratJalanBy && !t.suratJalanBy.startsWith("Sistem") ? t.suratJalanBy : null) ?? signers.find(s => s.key === "fleet")?.name ?? "(.................................)";
  const office = [
    { lead: "Dikeluarkan oleh,", org: brand.company, name: issuer, title: "Dispatcher" },
    { lead: "Pengemudi,", name: t.driver.name, title: `Sopir · ${t.vehicle.plateNo}` },
  ];
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
        // Multi-drop: titik bongkar sudah ada di tabel tanda terima.
        ...(multiDrop ? [] : [["Titik bongkar", stops.map(s => `${s.seq}. ${s.name}`).join("; ") || "-"] as [string, string]]),
      ] },
      { type: "table", columns: [{ label: "No", width: 0.5, align: "center" }, { label: "Uraian muatan", width: 4 }, { label: "Berat", width: 1.2, align: "right" }, { label: "Jumlah diterima", width: 1.6, align: "center" }, { label: "Catatan", width: 1.8 }],
        rows: [["1", { text: o?.cargoDesc ?? "-", sub: o?.cargoValue ? `Nilai barang ${rupiah(o.cargoValue)}` : null }, o?.cargoWeightTon ? `${o.cargoWeightTon} ton` : "-", "", ""]] },
      { type: "kv", title: "Segel", rows: [["No. segel", "........................................ (diisi saat muat)"], ["Kondisi segel saat bongkar", "Utuh / Rusak *coret salah satu"]] },
      ...(t.overrides.length ? [{ type: "note" as const, text: `Catatan dispatch: trip ini berjalan dengan ${t.overrides.length} override (${t.overrides.map(x => `#${x.condition.split(":")[0]} oleh ${x.byName}`).join(", ")}). Detail tercatat di sistem.` }] : []),
      // Multi-drop: tanda tangan kantor & sopir di atas, lalu tabel tanda terima (bisa berlanjut ke halaman 2).
      ...(multiDrop ? [
        { type: "signatures" as const, items: office },
        { type: "heading" as const, text: `Tanda terima per titik bongkar (${stops.length} titik) — tiap penerima menandatangani barisnya sendiri` },
        { type: "table" as const,
          columns: [{ label: "No", width: 0.5, align: "center" as const }, { label: "Titik bongkar", width: 2.6 }, { label: "Jumlah diterima", width: 1.3, align: "center" as const }, { label: "Tiba (tgl/jam)", width: 1.3, align: "center" as const }, { label: "Nama, tanda tangan & stempel penerima", width: 2.6 }, { label: "Catatan selisih / kerusakan", width: 1.4 }],
          rows: stops.map(s => [String(s.seq), { text: s.name, sub: [s.address, s.city].filter(Boolean).join(", ") || null }, "", "", { text: "\n\n", sub: "Nama: ................................" }, ""]) },
      ] : [
        { type: "note" as const, text: "Barang diterima dalam keadaan baik dan jumlah sesuai, kecuali dicatat di kolom catatan. Selisih/kerusakan wajib ditulis sebelum tanda tangan." },
      ]),
    ],
    signatures: multiDrop ? undefined : [...office, { lead: "Diterima oleh,", name: "(.................................)", title: "Nama, tanda tangan & stempel penerima" }],
  };
}

/** Tanggal + jam WIB, tanpa emoji (font PDF tidak punya glyph emoji). */
const jam = (iso?: string | null) => iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB" : "-";
const plain = (s?: string | null) => (s ?? "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}/g, " ").trim();
const docDate = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

/** Laporan P2H (pemeriksaan harian) per pemeriksaan: hasil tiap item, keputusan layak/tidak layak jalan, tindak lanjut. */
async function p2hReport(id: string): Promise<DocModel | null> {
  const c = await prisma.preTripCheck.findUnique({ where: { id }, include: { vehicle: { include: { truckType: true } }, trip: { include: { driver: true, client: true, route: true } } } });
  if (!c) return null;
  const { brand, city, signers } = await getLogisticsBrand();
  const driver = c.trip?.driver ?? (c.driverId ? await prisma.driver.findUnique({ where: { id: c.driverId } }) : null);
  const rec = parseP2HRecord(c.resultJson);
  const items = P2H_ITEMS.filter(i => rec.items[i.key] != null);
  const failed = Boolean(c.criticalFails);
  const needsOverride = !failed && Boolean(c.otherFails);
  const verdict = failed ? "TIDAK LAYAK JALAN" : needsOverride ? "LAYAK BERSYARAT (perlu override Fleet Manager)" : "LAYAK JALAN";
  const fleet = signers.find(s => s.key === "fleet");
  const no = `P2H/${c.vehicle.plateNo.replace(/\s+/g, "")}/${docDate(c.at).replace(/-/g, "")}/${c.id.slice(-4).toUpperCase()}`;
  return {
    brand,
    fileName: safeName(`Laporan P2H ${c.vehicle.plateNo} ${docDate(c.at)}${failed ? " GAGAL" : ""}`),
    title: "LAPORAN PEMERIKSAAN HARIAN KENDARAAN (P2H)",
    number: no,
    watermark: failed ? "GAGAL" : undefined,
    meta: [["Tanggal", `${city}, ${tanggal(docDate(c.at))}`], ["Waktu periksa", jam(c.at)], ["No. trip", c.trip?.tripNo ?? "-"], ["Sumber", c.source]],
    blocks: [
      { type: "kv", title: "Kendaraan & pemeriksa", rows: [
        ["Kendaraan", `${c.vehicle.plateNo} · ${c.vehicle.truckType.name} · ${c.vehicle.brand ?? ""}`],
        ["Odometer", rec.odometerKm != null ? `${rec.odometerKm.toLocaleString("id-ID")} km` : "-"],
        ["Pengemudi", driver ? `${driver.name} (${driver.code})` : "-"],
        ["Tugas", c.trip ? `${c.trip.client?.name ?? "-"} · ${c.trip.route ? `${c.trip.route.origin} → ${c.trip.route.destination}` : "-"}` : "-"],
      ] },
      { type: "table", columns: [{ label: "No", width: 0.5, align: "center" }, { label: "Item pemeriksaan", width: 3.2 }, { label: "Kategori", width: 1.1, align: "center" }, { label: "Hasil", width: 1.1, align: "center" }, { label: "Keterangan", width: 3 }],
        rows: items.map((i, n) => {
          const m = rec.items[i.key]; const d = rec.details[i.key];
          const note = [plain(d?.note), d?.photos?.length ? `${d.photos.length} foto bukti (tersimpan di sistem)` : ""].filter(Boolean).join(" · ");
          return [String(n + 1), { text: i.label, sub: i.hint }, i.critical ? "Kritis" : "Umum", { text: m === "ok" ? "Baik" : m === "fail" ? "TIDAK BAIK" : "-", bold: m === "fail" }, note || "-"];
        }) },
      { type: "kv", title: "Keputusan", rows: [
        ["Status kendaraan", verdict],
        ...(c.criticalFails ? [["Item kritis gagal", c.criticalFails] as [string, string]] : []),
        ...(c.otherFails ? [["Item umum gagal", c.otherFails] as [string, string]] : []),
        ...(c.notes ? [["Catatan", plain(c.notes)] as [string, string]] : []),
      ] },
      failed
        ? { type: "note", text: "Kendaraan DILARANG BERANGKAT. Surat Jalan tidak diterbitkan sampai kerusakan diperbaiki dan P2H ulang dinyatakan lolos. Dispatcher wajib mengganti armada atau menjadwal ulang, dan Fleet/Workshop menindaklanjuti perbaikan." }
        : needsOverride
          ? { type: "note", text: "Item non-kritis bermasalah: kendaraan boleh berangkat setelah override Fleet Manager dicatat di sistem. Perbaikan dijadwalkan otomatis sesudah trip selesai." }
          : { type: "note", text: "Seluruh item kritis dalam kondisi baik. Kendaraan layak jalan dan Surat Jalan dapat diterbitkan." },
    ],
    signatures: [
      { lead: "Diperiksa oleh,", name: driver?.name ?? "(.................................)", title: "Pengemudi" },
      { lead: "Diketahui,", org: brand.company, name: fleet?.name ?? "(.................................)", title: fleet?.title ?? "Fleet Manager" },
    ],
  };
}

/** Laporan perjalanan & bukti pengiriman (ePOD): kronologi trip dari P2H sampai selesai. */
async function tripReport(id: string): Promise<DocModel | null> {
  const t = await prisma.trip.findUnique({ where: { id }, include: {
    vehicle: { include: { truckType: true } }, driver: true, helper: true, route: true, client: true,
    order: { include: { stops: { orderBy: { seq: "asc" } } } }, events: { orderBy: { at: "asc" } }, preTripChecks: { orderBy: { at: "asc" } },
  } });
  if (!t) return null;
  const { brand, city, signers } = await getLogisticsBrand();
  const o = t.order;
  const ev = t.events;
  const unload = ev.filter(e => e.status === "Unloading");
  // Selesai bongkar di titik k = kejadian pertama sesudah "tiba bongkar" ke-k yang meninggalkan titik itu.
  const leftStop = unload.map(u => ev.find(e => e.at > u.at && ["InTransit", "Returning", "Completed"].includes(e.status)));
  const pods = ev.filter(e => e.status === "Photo" && /ePOD|bertanda tangan/i.test(e.label));
  const photos = ev.filter(e => e.status === "Photo");
  const handover = ev.find(e => e.status === "SJHandover");
  const done = t.status === "Completed";
  const hours = t.startedAt && t.completedAt ? (new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime()) / 3_600_000 : null;
  const late = t.promisedArrival && unload[0] ? new Date(unload[0].at) > new Date(t.promisedArrival) : null;
  const ops = signers.find(s => s.key === "ops") ?? signers.find(s => s.key === "fleet");
  return {
    brand,
    fileName: safeName(`Laporan Trip ${t.tripNo} ${t.vehicle.plateNo}`),
    title: "LAPORAN PERJALANAN & BUKTI PENGIRIMAN (ePOD)",
    number: t.tripNo,
    watermark: t.status === "Cancelled" ? "DIBATALKAN" : done ? undefined : "DRAFT",
    recipient: { label: "Klien", name: t.client?.name ?? "-", lines: o ? [`Order ${o.orderNo}${o.clientRef ? ` · ref ${o.clientRef}` : ""}`] : [] },
    meta: [["Tanggal", `${city}, ${tanggal(docDate(t.completedAt ?? t.createdAt))}`], ["Status", TRIP_STATUSES[t.status]?.label ?? t.status], ["Surat Jalan", t.suratJalanNo ?? "-"]],
    blocks: [
      { type: "kv", title: "Ringkasan", rows: [
        ["Armada", `${t.vehicle.plateNo} · ${t.vehicle.truckType.name} · sopir ${t.driver.name}${t.helper ? `, kenek ${t.helper.name}` : ""}`],
        ["Rute", t.route ? `${t.route.origin} → ${t.route.destination} (±${t.route.distanceKm} km)` : "-"],
        ["Muatan", o ? `${o.cargoDesc}${o.cargoWeightTon ? `, ±${o.cargoWeightTon} ton` : ""}` : "-"],
        ["P2H", t.preTripChecks.length ? t.preTripChecks.map((c, i) => `#${i + 1} ${jam(c.at)}: ${c.criticalFails ? `GAGAL (${c.criticalFails})` : c.otherFails ? `perlu override (${c.otherFails})` : "lolos"}`).join("; ") : "-"],
        ["Serah terima SJ", handover ? `${jam(handover.at)} · ${plain(handover.note) || "-"}` : "-"],
        ["Berangkat", jam(t.startedAt)],
        ["Selesai", jam(t.completedAt)],
        ["Durasi", hours != null ? `${hours.toFixed(1).replace(".", ",")} jam` : "-"],
        ["Ketepatan tiba", t.promisedArrival ? `janji ${jam(t.promisedArrival)} · ${late == null ? "-" : late ? "TERLAMBAT" : "tepat waktu"}` : "-"],
      ] },
      ...(o?.stops.length ? [{ type: "table" as const, columns: [{ label: "No", width: 0.5, align: "center" as const }, { label: "Titik bongkar", width: 3.4 }, { label: "Tiba", width: 1.9, align: "center" as const }, { label: "Selesai bongkar", width: 1.9, align: "center" as const }],
        rows: o.stops.map((s, i) => [String(s.seq), { text: s.name, sub: [s.address, s.city].filter(Boolean).join(", ") || null }, jam(unload[i]?.at), jam(leftStop[i]?.at)]) }] : []),
      { type: "heading", text: "Kronologi" },
      { type: "table", columns: [{ label: "Waktu", width: 1.9 }, { label: "Kejadian", width: 4.4 }, { label: "Oleh / sumber", width: 1.7 }],
        rows: ev.map(e => [jam(e.at), { text: plain(e.label), sub: e.status === "Photo" ? null : plain(e.note) || null }, `${e.by ?? "-"} · ${e.source}`]) },
      { type: "kv", title: "Bukti pengiriman", rows: [
        ["ePOD (SJ bertanda tangan)", pods.length ? pods.map(p => `${jam(p.at)} — ${plain(p.label)}`).join("; ") : "belum ada foto ePOD"],
        ["Foto lain", `${Math.max(0, photos.length - pods.length)} foto (muatan/segel/nota) tersimpan di sistem`],
      ] },
      { type: "note", text: done ? "Trip telah selesai. Laporan ini menjadi lampiran penagihan (invoice) kepada klien." : "Trip belum selesai — laporan sementara." },
    ],
    signatures: [
      { lead: "Pengemudi,", name: t.driver.name, title: `Sopir · ${t.vehicle.plateNo}` },
      { lead: "Diverifikasi oleh,", org: brand.company, name: ops?.name ?? "(.................................)", title: ops?.title ?? "Operasional" },
    ],
  };
}

/** Invoice charter: diterbitkan setelah trip selesai (order Completed); lampiran = laporan trip/ePOD. */
async function invoice(id: string): Promise<DocModel | null> {
  const o = await prisma.charterOrder.findUnique({ where: { id }, include: { client: true, route: true, truckType: true } });
  if (!o) return null;
  // Hanya trip yang benar-benar jalan; trip dibatalkan (mis. P2H gagal lalu ganti truk) tidak ditagihkan.
  const trips = await prisma.trip.findMany({ where: { orderId: id, status: { not: "Cancelled" } }, include: { vehicle: true }, orderBy: { createdAt: "asc" } });
  const { brand, city, bank, signers } = await getLogisticsBrand();
  const finance = signers.find(s => s.key === "finance") ?? signers.find(s => s.key === "director");
  const lines = JSON.parse(o.breakdownJson || "[]") as PriceLine[];
  const doneTrip = trips.find(t => t.status === "Completed");
  const date = docDate(doneTrip?.completedAt ?? new Date().toISOString());
  const days = parseInt(o.client.paymentTerms) || 30;
  const due = new Date(new Date(date + "T00:00:00Z").getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const invNo = `INV-${o.orderNo}`;
  return {
    brand,
    fileName: safeName(`Invoice ${invNo} ${o.client.name}`),
    title: "INVOICE",
    number: invNo,
    watermark: o.status === "Cancelled" ? "DIBATALKAN" : o.status !== "Completed" ? "DRAFT" : undefined,
    recipient: { label: "Ditagihkan kepada", name: o.client.name, lines: [o.client.contactName ? `u.p. ${o.client.contactName}` : "", o.client.address ?? "", o.client.city ?? ""].filter(Boolean) },
    meta: [["Tanggal", `${city}, ${tanggal(date)}`], ["Jatuh tempo", tanggal(due)], ["No. order", o.orderNo], ["Ref. klien", o.clientRef || "-"]],
    blocks: [
      { type: "kv", title: "Rincian jasa", rows: [
        ["Jasa", `Sewa truk charter (FTL) ${o.truckType.name}`],
        ["Rute", `${o.route.origin} → ${o.route.destination} (±${o.route.distanceKm} km)`],
        ["Trip", trips.map(t => `${t.tripNo} · ${t.vehicle.plateNo} · SJ ${t.suratJalanNo ?? "-"}${t.completedAt ? ` · selesai ${tanggal(docDate(t.completedAt))}` : ""}`).join("; ") || "-"],
        ["Muatan", `${o.cargoDesc}${o.cargoWeightTon ? `, ±${o.cargoWeightTon} ton` : ""}`],
      ] },
      { type: "table", columns: [{ label: "No", width: 0.5, align: "center" }, { label: "Uraian", width: 5 }, { label: "Jumlah (Rp)", width: 2, align: "right" }],
        rows: lines.map((l, i) => [String(i + 1), { text: l.label, sub: l.detail }, (l.amount < 0 ? "− " : "") + Math.abs(Math.round(l.amount)).toLocaleString("id-ID")]) },
      { type: "totals", rows: [
        ...(o.discountAmount > 0 ? [[`Diskon kontrak ${o.discountPercent}%`, `− ${rupiah(o.discountAmount)}`] as [string, string]] : []),
        ["Subtotal (DPP)", rupiah(o.subtotal)], [`PPN ${o.taxPercent}%`, rupiah(o.taxAmount)],
      ], total: ["TOTAL TAGIHAN", rupiah(o.total)] },
      { type: "words", text: `Terbilang: ${terbilangRupiah(o.total)}` },
      { type: "kv", title: "Pembayaran", rows: [["Transfer ke", bank], ["Termin", `${o.client.paymentTerms} sejak tanggal invoice`], ["Lampiran", "Surat Jalan bertanda tangan (ePOD) & Laporan Perjalanan"]] },
    ],
    signatures: [{ lead: "Hormat kami,", org: brand.company, name: finance?.name ?? "(.................................)", title: finance?.title ?? "Finance", stamp: true }],
  };
}

export async function buildLogisticsDocument(kind: LogDocKind, id: string) {
  switch (kind) {
    case "charter-quote": return charterQuote(id);
    case "surat-jalan": return suratJalan(id);
    case "p2h": return p2hReport(id);
    case "trip-report": return tripReport(id);
    case "invoice": return invoice(id);
  }
}
