// Helper server modul Logistik (dipakai server actions, halaman, route dokumen, dan AI).
// Sengaja bukan "use server": fungsi di sini tidak boleh bisa dipanggil langsung dari browser.
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withLock, type Tx } from "./dbUtil";
import { getCurrentUser, getRolesConfig, type CurrentUser } from "@/app/actions/auth";
import type { DocBrand } from "@/app/modules/sales/documents/model";
import { computeCharterPrice, logisticsAccess, today, type LogisticsAccess, type PriceInput, type RateTable } from "./lib";

export async function getLogisticsAccess(): Promise<{ user: CurrentUser | null; access: LogisticsAccess }> {
  const user = await getCurrentUser();
  return { user, access: logisticsAccess(user, user ? await getRolesConfig() : []) };
}

type Need = "view" | "order" | "dispatch" | "fleet" | "rates" | "finance";

/** Server action tidak terlindungi middleware: cek login & izin di setiap aksi. */
export async function guardLogistics(need: Need = "view"): Promise<CurrentUser> {
  const { user } = await guardAccess(a => ({ view: a.canView, order: a.canOrder, dispatch: a.canDispatch, fleet: a.canFleet, rates: a.canRates, finance: a.canFinance }[need]));
  return user;
}

/** Guard dengan aturan bebas (mis. a => a.canFleet || a.canFinance). */
export async function guardAccess(check: (a: LogisticsAccess) => boolean, message = "Role Anda tidak punya akses untuk aksi ini.") {
  const { user, access } = await getLogisticsAccess();
  if (!user) throw new Error("Silakan login terlebih dahulu.");
  if (!check(access)) throw new Error(message);
  return { user, access };
}

export type ActionResult = { success: true; id?: string } | { success: false; message: string };

/** Pembungkus server action: error → pesan, sukses → revalidate layout Logistik. */
export async function runAction(fn: () => Promise<string | void>, opts: { uniqueMessage?: string } = {}): Promise<ActionResult> {
  try {
    const id = await fn();
    revalidatePath("/modules/logistics", "layout");
    return { success: true, id: id || undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
    return { success: false, message: opts.uniqueMessage && msg.includes("Unique constraint") ? opts.uniqueMessage : msg };
  }
}

export function addHistory(json: string, userName: string, action: string) {
  const list = JSON.parse(json || "[]");
  list.push({ id: String(list.length + 1), date: new Date().toISOString(), userName, action });
  return JSON.stringify(list);
}

/** Tabel tarif lengkap untuk kalkulator harga (dikirim juga ke browser — tidak ada data rahasia). */
export async function getRateTable(): Promise<RateTable> {
  const [truckTypes, routes, rates, surcharges] = await Promise.all([
    prisma.truckType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.logisticsRoute.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.charterRate.findMany({ select: { routeId: true, truckTypeId: true, price: true } }),
    prisma.rateSurcharge.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return {
    truckTypes: truckTypes.map(t => ({ id: t.id, code: t.code, name: t.name, sizeClass: t.sizeClass, capacityTon: t.capacityTon, volumeM3: t.volumeM3, tollClass: t.tollClass, requiresHelper: t.requiresHelper })),
    routes: routes.map(r => ({ id: r.id, code: r.code, origin: r.origin, destination: r.destination, distanceKm: r.distanceKm, durationHours: r.durationHours })),
    rates,
    surcharges: surcharges.map(s => ({ code: s.code, name: s.name, unit: s.unit, kind: s.kind, smallAmount: s.smallAmount, largeAmount: s.largeAmount, percent: s.percent, minAmount: s.minAmount })),
  };
}

/** Nomor order: ATN/ORD/2026/11/0001 — urut per tahun. */
export async function nextOrderNo(date: string, db: Tx | typeof prisma = prisma) {
  const prefix = `ATN/ORD/${date.slice(0, 4)}/`;
  const rows = await db.charterOrder.findMany({ where: { orderNo: { startsWith: prefix } }, select: { orderNo: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(r.orderNo.split("/").pop()) || 0), 0);
  return `${prefix}${date.slice(5, 7)}/${String(max + 1).padStart(4, "0")}`;
}

export type OrderInput = {
  clientId: string; routeId: string; truckTypeId: string; clientRef?: string;
  loadDate: string; loadTime?: string; originName: string; originAddress?: string;
  cargoDesc: string; cargoWeightTon?: number | null; cargoVolumeM3?: number | null; cargoValue: number;
  stops: { name: string; address?: string; city?: string }[];
  overnightDays: number; tkbm: boolean; escort: boolean; insurance: boolean; returnLoad: boolean;
  discountPercent: number; notes?: string; source?: "Manual" | "Teks" | "Suara"; aiNote?: string;
};

/** Validasi + harga dihitung ulang di server dari tabel tarif (angka dari browser tidak dipercaya). */
export async function orderData(input: OrderInput) {
  if (!input.clientId) throw new Error("Pilih klien.");
  if (!input.routeId || !input.truckTypeId) throw new Error("Pilih rute dan jenis truk.");
  if (!input.loadDate) throw new Error("Tanggal muat wajib diisi.");
  if (!input.originName?.trim()) throw new Error("Lokasi muat wajib diisi.");
  if (!input.cargoDesc?.trim()) throw new Error("Deskripsi muatan wajib diisi.");
  const stops = input.stops.filter(s => s.name?.trim());
  if (stops.length === 0) throw new Error("Tambahkan minimal satu titik bongkar.");
  const table = await getRateTable();
  const type = table.truckTypes.find(t => t.id === input.truckTypeId);
  if (input.cargoWeightTon && type && input.cargoWeightTon > type.capacityTon * 1.1) {
    throw new Error(`Muatan ${input.cargoWeightTon} ton melebihi 110% kapasitas ${type.name} (${type.capacityTon} ton). Pilih truk yang lebih besar.`);
  }
  const priceInput: PriceInput = {
    routeId: input.routeId, truckTypeId: input.truckTypeId, stopCount: stops.length, overnightDays: Math.max(0, Math.floor(input.overnightDays || 0)),
    tkbm: input.tkbm, escort: input.escort, insurance: input.insurance, returnLoad: input.returnLoad, cargoValue: input.cargoValue || 0, discountPercent: input.discountPercent || 0,
  };
  const price = computeCharterPrice(table, priceInput);
  if (!price.ok) throw new Error(price.issues.join(" "));
  return {
    fields: {
      clientId: input.clientId, routeId: input.routeId, truckTypeId: input.truckTypeId, clientRef: input.clientRef?.trim() || null,
      loadDate: input.loadDate, loadTime: input.loadTime || null, originName: input.originName.trim(), originAddress: input.originAddress?.trim() || null,
      cargoDesc: input.cargoDesc.trim(), cargoWeightTon: input.cargoWeightTon ?? null, cargoVolumeM3: input.cargoVolumeM3 ?? null, cargoValue: input.cargoValue || 0,
      overnightDays: priceInput.overnightDays, tkbm: input.tkbm, escort: input.escort, insurance: input.insurance, returnLoad: input.returnLoad,
      discountPercent: price.discountPercent, baseRate: price.baseRate, surchargeTotal: price.surchargeTotal, discountAmount: price.discountAmount,
      subtotal: price.subtotal, taxPercent: price.taxPercent, taxAmount: price.taxAmount, total: price.total, breakdownJson: JSON.stringify(price.lines),
      notes: input.notes?.trim() || null,
    },
    stops: stops.map((s, i) => ({ seq: i + 1, name: s.name.trim(), address: s.address?.trim() || null, city: s.city?.trim() || null })),
  };
}

export async function insertOrder(user: { name: string }, input: OrderInput) {
  const { fields, stops } = await orderData(input);
  const source = input.source ?? "Manual";
  // Nomor dibaca & dipakai di dalam satu kunci supaya dua order bersamaan tidak bentrok nomor.
  return withLock("logistics:order-no", async tx => tx.charterOrder.create({ data: {
    ...fields, orderNo: await nextOrderNo(today(), tx), status: "Draft", source, aiNote: input.aiNote || null,
    trackingToken: crypto.randomBytes(12).toString("hex"), createdBy: user.name, createdAt: new Date().toISOString(),
    historyJson: addHistory("[]", user.name, source === "Manual" ? "Order dibuat" : `Order dibuat dari ${source.toLowerCase()} (draft AI, diperiksa user)`),
    stops: { create: stops },
  } }));
}

/** Kop dokumen dari CompanyProfile "logistics" (PT Arunika Trans Nusantara). */
export async function getLogisticsBrand(): Promise<{ brand: DocBrand; city: string; bank: string; signers: { key: string; name: string; title: string }[] }> {
  const c = await prisma.companyProfile.findUnique({ where: { key: "logistics" } });
  if (!c) throw new Error("Profil perusahaan logistik belum diisi. Jalankan scripts/demo-data/seed-logistics.cjs.");
  return {
    brand: {
      company: c.name, tagline: c.tagline ?? "", address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "", website: c.website ?? "", npwp: c.npwp ?? "",
      colors: { primary: c.primaryColor, accent: c.accentColor, text: "#1E293B", muted: "#64748B", line: "#CBD5E1", soft: "#F1F5F9" },
      logoFile: c.logoPath || "brand/arunika-logo.png",
    },
    city: c.city ?? "",
    bank: c.bank ?? "",
    signers: JSON.parse(c.signersJson || "[]"),
  };
}

/** Data form order: klien + lokasi, tabel tarif. */
export async function getOrderFormData() {
  const [clients, table] = await Promise.all([
    prisma.logisticsClient.findMany({ orderBy: { name: "asc" }, include: { locations: { select: { name: true, city: true, kind: true } } } }),
    getRateTable(),
  ]);
  return {
    clients: clients.map(c => ({ id: c.id, code: c.code, name: c.name, contractDiscountPercent: c.contractDiscountPercent, insuranceRequired: c.insuranceRequired, locations: c.locations })),
    table,
  };
}

/** Order → bentuk input form (untuk edit). */
export async function getOrderInput(id: string): Promise<OrderInput | null> {
  const o = await prisma.charterOrder.findUnique({ where: { id }, include: { stops: { orderBy: { seq: "asc" } } } });
  if (!o) return null;
  return {
    clientId: o.clientId, routeId: o.routeId, truckTypeId: o.truckTypeId, clientRef: o.clientRef ?? "", loadDate: o.loadDate, loadTime: o.loadTime ?? "",
    originName: o.originName, originAddress: o.originAddress ?? "", cargoDesc: o.cargoDesc, cargoWeightTon: o.cargoWeightTon, cargoVolumeM3: o.cargoVolumeM3,
    cargoValue: o.cargoValue, stops: o.stops.map(s => ({ name: s.name, address: s.address ?? "", city: s.city ?? "" })), overnightDays: o.overnightDays,
    tkbm: o.tkbm, escort: o.escort, insurance: o.insurance, returnLoad: o.returnLoad, discountPercent: o.discountPercent, notes: o.notes ?? "",
  };
}
