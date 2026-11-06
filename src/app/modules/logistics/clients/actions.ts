"use server";

// Master klien logistik + lokasi muat/bongkar (CS / Operations Manager).
import { prisma } from "@/lib/prisma";
import { guardAccess, runAction } from "../server";
import { inIndonesia, resolveMapsLink } from "../mapsLink";

const run = (fn: () => Promise<string | void>) => runAction(fn, { uniqueMessage: "Kode klien sudah dipakai." });
const guard = async () => (await guardAccess(a => a.canOrder || a.canRates, "Hanya Admin Order / Operations Manager yang bisa mengelola klien.")).user;
const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === "string" && v.trim() ? v.trim() : null; };
const req = (fd: FormData, k: string, label: string) => { const v = str(fd, k); if (!v) throw new Error(`${label} wajib diisi.`); return v; };
const coord = (fd: FormData, k: string, min: number, max: number) => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error("Koordinat tidak valid (contoh: -6.2950, 107.1380).");
  return n;
};

export async function saveClient(fd: FormData) {
  return run(async () => {
    await guard();
    const id = str(fd, "id");
    const code = req(fd, "code", "Kode klien").toUpperCase();
    if (!/^[A-Z0-9]{2,6}$/.test(code)) throw new Error("Kode klien 2–6 huruf/angka, mis. SPL.");
    const email = str(fd, "contactEmail");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Email kontak tidak valid.");
    const disc = Number(str(fd, "contractDiscountPercent") ?? 0);
    if (!Number.isFinite(disc) || disc < 0 || disc > 30) throw new Error("Diskon kontrak 0–30%.");
    const data = {
      code, name: req(fd, "name", "Nama klien"), industry: str(fd, "industry"), address: str(fd, "address"), city: str(fd, "city"),
      contactName: str(fd, "contactName"), contactPhone: str(fd, "contactPhone"), contactEmail: email,
      paymentTerms: str(fd, "paymentTerms") ?? "30 hari", contractDiscountPercent: disc,
      insuranceRequired: fd.get("insuranceRequired") === "on", tollPassThrough: fd.get("tollPassThrough") === "on",
      orderPattern: str(fd, "orderPattern"), aliases: str(fd, "aliases"), notes: str(fd, "notes"),
    };
    if (id) {
      await prisma.logisticsClient.update({ where: { id }, data });
      return id;
    }
    return (await prisma.logisticsClient.create({ data: { ...data, createdAt: new Date().toISOString() } })).id;
  });
}

/** Lokasi muat/bongkar klien. Koordinat opsional (dipakai peta Fleet Tracking & simulasi). */
export async function saveLocation(fd: FormData) {
  return run(async () => {
    await guard();
    const id = str(fd, "id");
    const clientId = req(fd, "clientId", "Klien");
    await prisma.logisticsClient.findUniqueOrThrow({ where: { id: clientId } });
    const kind = str(fd, "kind") === "Bongkar" ? "Bongkar" : "Muat";
    // Link Google Maps (bila diisi) mengalahkan isian latitude/longitude manual.
    const mapsUrl = str(fd, "mapsUrl");
    let lat = coord(fd, "lat", -11.5, 6.5);
    let lng = coord(fd, "lng", 94, 141.5);
    if (mapsUrl) {
      const pos = await resolveMapsLink(mapsUrl);
      if (!inIndonesia(pos)) throw new Error(`Koordinat dari link (${pos[0].toFixed(5)}, ${pos[1].toFixed(5)}) di luar Indonesia. Periksa lagi link-nya.`);
      [lat, lng] = [Math.round(pos[0] * 1e6) / 1e6, Math.round(pos[1] * 1e6) / 1e6];
    }
    if ((lat == null) !== (lng == null)) throw new Error("Isi latitude dan longitude sekaligus, atau kosongkan keduanya.");
    const data = { clientId, name: req(fd, "name", "Nama lokasi"), kind, address: str(fd, "address"), city: req(fd, "city", "Kota"), lat, lng };
    if (id) {
      await prisma.logisticsLocation.update({ where: { id }, data });
      return id;
    }
    return (await prisma.logisticsLocation.create({ data })).id;
  });
}

export async function deleteLocation(id: string) {
  return run(async () => {
    await guard();
    await prisma.logisticsLocation.delete({ where: { id } });
  });
}
