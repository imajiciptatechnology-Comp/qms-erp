"use server";

// Master armada: tambah/edit truk, sopir, kenek (Fleet Manager).
import { prisma } from "@/lib/prisma";
import { guardAccess, runAction } from "../server";
import { syncAutoQualifications } from "../fleetDocs";

const run = (fn: () => Promise<string | void>) => runAction(fn, { uniqueMessage: "Data dengan nomor/kode yang sama sudah ada." });
const guardFleet = async () => (await guardAccess(a => a.canFleet, "Hanya Fleet Manager yang bisa mengelola data armada & kru.")).user;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === "string" && v.trim() ? v.trim() : null; };
const req = (fd: FormData, k: string, label: string) => { const v = str(fd, k); if (!v) throw new Error(`${label} wajib diisi.`); return v; };
const date = (fd: FormData, k: string, label: string) => { const v = str(fd, k); if (v && !DATE_RE.test(v)) throw new Error(`${label} harus tanggal.`); return v; };
const num = (fd: FormData, k: string, label: string, opts: { min?: number; max?: number } = {}) => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n) || n < (opts.min ?? 0) || (opts.max != null && n > opts.max)) throw new Error(`${label} tidak valid.`);
  return n;
};
const plateOf = (p: string) => p.toUpperCase().replace(/\s+/g, " ").trim();

/** Tambah (id kosong) atau edit truk. Masa berlaku boleh diisi langsung; versi dokumen tetap lewat tab Documents. */
export async function saveVehicle(fd: FormData) {
  return run(async () => {
    await guardFleet();
    const id = str(fd, "id");
    const plateNo = plateOf(req(fd, "plateNo", "Nomor polisi"));
    if (!/^[A-Z]{1,2} \d{1,4}( [A-Z]{1,3})?$/.test(plateNo)) throw new Error("Format nopol mis. \"B 9101 FXA\".");
    const truckTypeId = req(fd, "truckTypeId", "Jenis truk");
    await prisma.truckType.findUniqueOrThrow({ where: { id: truckTypeId } });
    const status = str(fd, "status") ?? "Ready";
    if (!["Ready", "In Repair", "Inactive"].includes(status)) throw new Error("Status tidak valid.");
    const tollMethod = str(fd, "tollMethod") ?? "A";
    if (!["A", "B", "C"].includes(tollMethod)) throw new Error("Metode tol tidak valid.");
    const year = num(fd, "year", "Tahun", { min: 1980, max: new Date().getFullYear() + 1 });
    const data = {
      plateNo, truckTypeId, brand: str(fd, "brand"), year: year == null ? null : Math.round(year), status,
      odometerKm: num(fd, "odometerKm", "Odometer") ?? 0,
      stnkExpiry: date(fd, "stnkExpiry", "STNK berlaku s/d"), pkbExpiry: date(fd, "pkbExpiry", "Pajak jatuh tempo"), kirExpiry: date(fd, "kirExpiry", "KIR berlaku s/d"),
      insuranceExpiry: date(fd, "insuranceExpiry", "Asuransi berlaku s/d"), nextServiceDate: date(fd, "nextServiceDate", "Servis berikutnya"),
      nextServiceKm: num(fd, "nextServiceKm", "Servis berikutnya (km)"), tollMethod, tollCardNo: str(fd, "tollCardNo"), notes: str(fd, "notes"),
    };
    if (id) {
      await prisma.vehicle.update({ where: { id }, data });
      return id;
    }
    return (await prisma.vehicle.create({ data })).id;
  });
}

async function nextCode(prefix: "SPR" | "KNK") {
  const rows = prefix === "SPR"
    ? await prisma.driver.findMany({ where: { code: { startsWith: prefix } }, select: { code: true } })
    : await prisma.helper.findMany({ where: { code: { startsWith: prefix } }, select: { code: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(r.code.split("-").pop()) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(2, "0")}`;
}

/** Tambah / edit sopir. Kualifikasi jenis truk dihitung ulang otomatis dari SIM, training, dan pengalaman. */
export async function saveDriver(fd: FormData) {
  return run(async () => {
    await guardFleet();
    const id = str(fd, "id");
    const simClass = req(fd, "simClass", "Golongan SIM");
    if (!["B1 Umum", "B2 Umum"].includes(simClass)) throw new Error("Golongan SIM harus B1 Umum atau B2 Umum.");
    const simExpiry = date(fd, "simExpiry", "SIM berlaku s/d");
    if (!simExpiry) throw new Error("Masa berlaku SIM wajib diisi.");
    const status = str(fd, "status") ?? "Active";
    if (!["Active", "Inactive"].includes(status)) throw new Error("Status tidak valid.");
    const data = {
      name: req(fd, "name", "Nama"), phone: str(fd, "phone"), simClass, simNo: str(fd, "simNo"), simExpiry,
      experienceYears: num(fd, "experienceYears", "Pengalaman", { max: 50 }) ?? 0,
      defensiveTraining: fd.get("defensiveTraining") === "on", trailerCertified: fd.get("trailerCertified") === "on", status, notes: str(fd, "notes"),
    };
    const driver = id ? await prisma.driver.update({ where: { id }, data }) : await prisma.driver.create({ data: { ...data, code: await nextCode("SPR") } });
    await syncAutoQualifications(driver);
    return driver.id;
  });
}

export async function saveHelper(fd: FormData) {
  return run(async () => {
    await guardFleet();
    const id = str(fd, "id");
    const idCardNo = str(fd, "idCardNo");
    if (idCardNo && !/^\d{16}$/.test(idCardNo)) throw new Error("No. KTP harus 16 digit.");
    const preferredDriverId = str(fd, "preferredDriverId");
    if (preferredDriverId) await prisma.driver.findUniqueOrThrow({ where: { id: preferredDriverId } });
    const status = str(fd, "status") ?? "Active";
    const data = { name: req(fd, "name", "Nama"), phone: str(fd, "phone"), idCardNo, preferredDriverId, status: status === "Inactive" ? "Inactive" : "Active", notes: str(fd, "notes") };
    if (id) {
      await prisma.helper.update({ where: { id }, data });
      return id;
    }
    return (await prisma.helper.create({ data: { ...data, code: await nextCode("KNK") } })).id;
  });
}
