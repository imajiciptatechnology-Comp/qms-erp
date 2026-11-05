"use server";

import { prisma } from "@/lib/prisma";
import { AiError, isAiConfigured } from "@/lib/ai";
import { uploadToStorage } from "@/lib/uploadFile";
import { guardAccess as guard, runAction as run } from "../server";
import { consumeDailyQuota } from "../dbUtil";
import { P2H_ITEMS } from "../p2hLib";
import { DRIVER_DOC_TYPES, SERVICE_INTERVAL, VEHICLE_DOC_TYPES, addDays, today } from "../lib";
import { assertRejectable, ownerFieldsBefore, rememberBeforeVerify, restoreAfterReject, syncDriverFromDocs, syncVehicleFromDocs } from "../fleetDocs";
import { scanFleetDocument, type FleetScanResult, type ScanDocType } from "../ai/scanFleetDoc";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILE = 4 * 1024 * 1024; // batas body Vercel ±4,5 MB
const FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const s = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === "string" && v.trim() ? v.trim() : null; };
const d = (fd: FormData, k: string, label: string) => {
  const v = s(fd, k);
  if (v && !DATE_RE.test(v)) throw new Error(`${label} harus berformat tanggal.`);
  return v;
};
const n = (fd: FormData, k: string) => { const v = s(fd, k); if (v == null) return null; const x = Number(v); if (!Number.isFinite(x) || x < 0) throw new Error("Nominal/angka tidak valid."); return x; };

async function storeFile(fd: FormData, folder: string) {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { fileUrl: null, fileName: null };
  if (file.size > MAX_FILE) throw new Error("File terlalu besar (maks. 4 MB). Foto dikecilkan otomatis; untuk PDF, kompres dulu.");
  if (!FILE_TYPES.includes(file.type)) throw new Error("File harus berupa foto (JPG/PNG/WebP) atau PDF.");
  return { fileUrl: await uploadToStorage(folder, file), fileName: file.name.slice(0, 120) };
}

// ---------------------------------------------------------
// Scan AI
// ---------------------------------------------------------

const DAILY_SCAN_LIMIT = 40;

export async function scanFleetDoc(expected: ScanDocType, imageDataUrl: string): Promise<{ ok: true; result: FleetScanResult } | { ok: false; error: string }> {
  try {
    const { user } = await guard(a => a.canFleet || a.canFinance);
    if (!isAiConfigured()) return { ok: false, error: "AI belum dikonfigurasi. Isi manual." };
    if (typeof imageDataUrl !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(imageDataUrl)) return { ok: false, error: "Scan AI hanya untuk foto (JPG/PNG). PDF diisi manual." };
    if (imageDataUrl.length > 4_000_000) return { ok: false, error: "Gambar terlalu besar." };
    if (!(await consumeDailyQuota(`ai_scan_usage:${user.id}`, DAILY_SCAN_LIMIT))) return { ok: false, error: `Batas ${DAILY_SCAN_LIMIT} scan per hari sudah tercapai.` };
    const result = await scanFleetDocument(imageDataUrl, expected);
    return { ok: true, result };
  } catch (err) {
    console.error("[logistics scan]", err);
    return { ok: false, error: err instanceof AiError || err instanceof Error ? err.message : "Gagal membaca dokumen." };
  }
}

// ---------------------------------------------------------
// Dokumen truk
// ---------------------------------------------------------

export async function saveVehicleDocument(fd: FormData) {
  return run(async () => {
    const { user, access } = await guard(a => a.canFleet || a.canFinance);
    const vehicleId = s(fd, "vehicleId");
    const docType = s(fd, "docType") ?? "";
    if (!vehicleId) throw new Error("Truk tidak diketahui.");
    if (!VEHICLE_DOC_TYPES[docType]) throw new Error("Pilih jenis dokumen.");
    // Kasir/Finance hanya mencatat pembayaran pajak.
    if (!access.canFleet && docType !== "PKB") throw new Error("Role Anda hanya bisa mencatat pembayaran pajak kendaraan (PKB).");
    const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    const validUntil = d(fd, "validUntil", "Berlaku s/d");
    const status = access.canFleet && s(fd, "status") === "Draft" ? "Draft" : "Verified";
    if (status === "Verified" && !validUntil) throw new Error("Tanggal berlaku s/d wajib diisi untuk dokumen terverifikasi.");
    const validFrom = d(fd, "validFrom", "Berlaku dari");
    if (validFrom && validUntil && validFrom > validUntil) throw new Error("Tanggal berlaku dari harus sebelum berlaku s/d.");
    const file = await storeFile(fd, `logistics/vehicles/${vehicleId}`);
    const now = new Date().toISOString();
    const before = status === "Verified" ? await ownerFieldsBefore("vehicle", vehicleId, docType) : {};
    const doc = await prisma.vehicleDocument.create({ data: {
      vehicleId, docType, docNo: s(fd, "docNo"), holderName: s(fd, "holderName"), validFrom, validUntil,
      amount: n(fd, "amount"), paidDate: d(fd, "paidDate", "Tanggal bayar"), ...file, aiJson: s(fd, "aiJson"),
      source: s(fd, "source") === "Scan AI" ? "Scan AI" : "Manual", status, notes: s(fd, "notes"),
      createdBy: user.name, createdAt: now, ...(status === "Verified" ? { verifiedBy: user.name, verifiedAt: now } : {}),
    } });
    if (status === "Verified") await rememberBeforeVerify(doc.id, before);
    await syncVehicleFromDocs(vehicle.id);
    return doc.id;
  });
}

// ---------------------------------------------------------
// Dokumen sopir
// ---------------------------------------------------------

export async function saveDriverDocument(fd: FormData) {
  return run(async () => {
    const { user } = await guard(a => a.canFleet);
    const driverId = s(fd, "driverId");
    const docType = s(fd, "docType") ?? "";
    if (!driverId) throw new Error("Sopir tidak diketahui.");
    if (!DRIVER_DOC_TYPES[docType]) throw new Error("Pilih jenis dokumen.");
    await prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
    const validUntil = d(fd, "validUntil", "Berlaku s/d");
    const status = s(fd, "status") === "Draft" ? "Draft" : "Verified";
    if (status === "Verified" && !validUntil) throw new Error("Tanggal berlaku s/d wajib diisi untuk dokumen terverifikasi.");
    const simClass = docType === "SIM" ? s(fd, "simClass") : null;
    if (docType === "SIM" && status === "Verified" && !["B1 Umum", "B2 Umum"].includes(simClass ?? "")) throw new Error("Pilih golongan SIM (B1 Umum / B2 Umum).");
    const file = await storeFile(fd, `logistics/drivers/${driverId}`);
    const now = new Date().toISOString();
    const before = status === "Verified" ? await ownerFieldsBefore("driver", driverId, docType) : {};
    const doc = await prisma.driverDocument.create({ data: {
      driverId, docType, docNo: s(fd, "docNo"), simClass, holderName: s(fd, "holderName"), issuer: s(fd, "issuer"),
      validFrom: d(fd, "validFrom", "Berlaku dari"), validUntil, ...file, aiJson: s(fd, "aiJson"),
      source: s(fd, "source") === "Scan AI" ? "Scan AI" : "Manual", status, notes: s(fd, "notes"),
      createdBy: user.name, createdAt: now, ...(status === "Verified" ? { verifiedBy: user.name, verifiedAt: now } : {}),
    } });
    if (status === "Verified") await rememberBeforeVerify(doc.id, before);
    await syncDriverFromDocs(driverId);
    return doc.id;
  });
}

// ---------------------------------------------------------
// Verifikasi draft (mis. kiriman sopir lewat Telegram) — Fleet Manager
// ---------------------------------------------------------

export async function setDocumentStatus(kind: "vehicle" | "driver", id: string, status: "Verified" | "Rejected", fields?: { validUntil?: string; simClass?: string }) {
  return run(async () => {
    const { user } = await guard(a => a.canFleet);
    const now = new Date().toISOString();
    if (fields?.validUntil && !DATE_RE.test(fields.validUntil)) throw new Error("Tanggal berlaku s/d tidak valid.");
    if (kind === "vehicle") {
      const doc = await prisma.vehicleDocument.findUniqueOrThrow({ where: { id } });
      const validUntil = fields?.validUntil || doc.validUntil;
      if (status === "Verified" && !validUntil) throw new Error("Isi tanggal berlaku s/d sebelum memverifikasi.");
      if (status === "Rejected") await assertRejectable("vehicle", { id, docType: doc.docType, ownerId: doc.vehicleId, status: doc.status });
      if (status === "Verified" && doc.status !== "Verified") await rememberBeforeVerify(id, await ownerFieldsBefore("vehicle", doc.vehicleId, doc.docType));
      await prisma.vehicleDocument.update({ where: { id }, data: { status, validUntil, verifiedBy: user.name, verifiedAt: now } });
      await syncVehicleFromDocs(doc.vehicleId);
      // Ditolak & tidak ada dokumen Verified lain sejenis → masa berlaku kembali ke nilai sebelum dokumen ini.
      if (status === "Rejected") await restoreAfterReject("vehicle", { id, docType: doc.docType, ownerId: doc.vehicleId });
    } else {
      const doc = await prisma.driverDocument.findUniqueOrThrow({ where: { id } });
      const validUntil = fields?.validUntil || doc.validUntil;
      const simClass = fields?.simClass || doc.simClass;
      if (status === "Verified" && !validUntil) throw new Error("Isi tanggal berlaku s/d sebelum memverifikasi.");
      if (status === "Verified" && doc.docType === "SIM" && !["B1 Umum", "B2 Umum"].includes(simClass ?? "")) throw new Error("Pilih golongan SIM sebelum memverifikasi.");
      if (status === "Rejected") await assertRejectable("driver", { id, docType: doc.docType, ownerId: doc.driverId, status: doc.status });
      if (status === "Verified" && doc.status !== "Verified") await rememberBeforeVerify(id, await ownerFieldsBefore("driver", doc.driverId, doc.docType));
      await prisma.driverDocument.update({ where: { id }, data: { status, validUntil, simClass, verifiedBy: user.name, verifiedAt: now } });
      await syncDriverFromDocs(doc.driverId);
      if (status === "Rejected") await restoreAfterReject("driver", { id, docType: doc.docType, ownerId: doc.driverId });
    }
  });
}

// ---------------------------------------------------------
// Riwayat servis
// ---------------------------------------------------------

export async function saveServiceRecord(fd: FormData) {
  return run(async () => {
    const { user } = await guard(a => a.canFleet);
    const vehicleId = s(fd, "vehicleId");
    if (!vehicleId) throw new Error("Truk tidak diketahui.");
    await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    const serviceDate = d(fd, "serviceDate", "Tanggal servis");
    if (!serviceDate) throw new Error("Tanggal servis wajib diisi.");
    if (serviceDate > today()) throw new Error("Tanggal servis tidak boleh di masa depan.");
    const odometerKm = n(fd, "odometerKm");
    if (odometerKm == null) throw new Error("Odometer (km) wajib diisi.");
    const workshop = s(fd, "workshop");
    if (!workshop) throw new Error("Nama bengkel wajib diisi.");
    const items = s(fd, "items");
    if (!items) throw new Error("Isi pekerjaan/sparepart wajib diisi.");
    const kind = s(fd, "kind") === "Perbaikan" ? "Perbaikan" : "Berkala";
    // Servis berkala menghitung ulang jadwal berikutnya (boleh diubah manual di form).
    const nextServiceDate = kind === "Berkala" ? d(fd, "nextServiceDate", "Servis berikutnya") ?? addDays(serviceDate, SERVICE_INTERVAL.days) : null;
    const nextServiceKm = kind === "Berkala" ? n(fd, "nextServiceKm") ?? odometerKm + SERVICE_INTERVAL.km : null;
    const file = await storeFile(fd, `logistics/vehicles/${vehicleId}/service`);
    const rec = await prisma.vehicleServiceRecord.create({ data: {
      vehicleId, serviceDate, odometerKm, workshop, kind, items, cost: n(fd, "cost") ?? 0, ...file,
      nextServiceDate, nextServiceKm, notes: s(fd, "notes"), createdBy: user.name, createdAt: new Date().toISOString(),
    } });
    await syncVehicleFromDocs(vehicleId);
    return rec.id;
  });
}

/** Fleet Manager: tandai perbaikan/maintenance request selesai. Truk "In Repair" kembali Ready bila tidak ada perbaikan terbuka. */
export async function closeServiceRecord(id: string) {
  return run(async () => {
    const { user } = await guard(a => a.canFleet);
    const rec = await prisma.vehicleServiceRecord.findUniqueOrThrow({ where: { id } });
    await prisma.vehicleServiceRecord.update({ where: { id }, data: { status: "Done", notes: [rec.notes, `Selesai: ${user.name} ${today()}`].filter(Boolean).join(" · ") } });
    const open = await prisma.vehicleServiceRecord.count({ where: { vehicleId: rec.vehicleId, status: "Open", kind: "Perbaikan" } });
    const v = await prisma.vehicle.findUniqueOrThrow({ where: { id: rec.vehicleId } });
    if (!open && v.status === "In Repair") await prisma.vehicle.update({ where: { id: v.id }, data: { status: "Ready" } });
    return id;
  });
}

/** Fleet Manager: P2H ulang di pool (semua item OK) setelah perbaikan — membuka blokir #2/#7. */
export async function recordOfficeP2H(vehicleId: string) {
  return run(async () => {
    const { user } = await guard(a => a.canFleet);
    await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    const all = Object.fromEntries(P2H_ITEMS.map(i => [i.key, "ok"]));
    await prisma.preTripCheck.create({ data: { vehicleId, at: new Date().toISOString(), resultJson: JSON.stringify({ items: all, details: {}, odometerKm: null }), notes: `P2H ulang di pool oleh ${user.name}`, source: "Kantor" } });
    return vehicleId;
  });
}
