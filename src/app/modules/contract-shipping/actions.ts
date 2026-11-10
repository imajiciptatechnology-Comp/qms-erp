"use server";

// Modul Contract & Shipping (Labtech): status produksi (manual), pengiriman per Sales Order dengan
// gerbang pelunasan, dan izin khusus kirim-sebelum-lunas yang disetujui di Dashboard Persetujuan Sales.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type CurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { notifyPermission } from "@/lib/notificationStore";
import { PERM, PRODUCTION_LABEL, PRODUCTION_STATUSES, canSeeShipping, defaultShipmentDocs, orderPaidStatus, salesAccess, today, type CratePackage, money } from "@/app/modules/sales/lib";
import { addHistory, firstHistory, nextDocNo } from "@/app/modules/sales/server";

type Result = { success: true; id?: string } | { success: false; message: string };

async function guard(need: "view" | "manage" | "approve"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Silakan login terlebih dahulu.");
  const a = salesAccess(user, await getRolesConfig());
  const ok = need === "view" ? canSeeShipping(a) : need === "manage" ? a.canShipping : a.canApprove;
  if (!ok) throw new Error("Anda tidak punya akses untuk aksi ini.");
  return user;
}

async function run(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const id = await fn();
    revalidatePath("/modules", "layout");
    return { success: true, id: id || undefined };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Terjadi kesalahan." };
  }
}

const ACTIVE_ORDER = ["Confirmed", "In Delivery", "Installed"];
const orderInclude = {
  customer: { select: { id: true, name: true, city: true } },
  invoices: { select: { status: true, paidAmount: true, total: true } },
  salesShipments: { select: { id: true, shipmentNo: true, status: true, exceptionStatus: true } },
} as const;

// ---------------------------------------------------------
// Query
// ---------------------------------------------------------

export async function getShippingOverview() {
  await guard("view");
  const [orders, shipments, contracts] = await Promise.all([
    prisma.salesOrder.findMany({ where: { status: { in: ["Confirmed", "In Delivery"] } }, include: orderInclude, orderBy: { orderDate: "asc" } }),
    prisma.salesShipment.findMany({ where: { status: { in: ["Draft", "Ready", "Shipped"] } }, include: { customer: { select: { name: true } }, salesOrder: { select: { soNo: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.contract.findMany({ where: { status: { in: ["Waiting Approval", "Active", "Approved", "Sent"] } }, include: { customer: { select: { name: true } } }, orderBy: { endDate: "asc" } }),
  ]);
  return { orders: orders.map(o => ({ ...o, payment: orderPaidStatus(o) })), shipments, contracts };
}

/** Sales Order yang sedang diproduksi / dikirim, lengkap dengan status bayar & shipment. */
export async function getProductionOrders() {
  await guard("view");
  const orders = await prisma.salesOrder.findMany({
    where: { status: { in: ACTIVE_ORDER } },
    include: { ...orderInclude, items: { select: { description: true, qty: true, unit: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { orderDate: "asc" },
  });
  return orders.map(o => ({ ...o, payment: orderPaidStatus(o) }));
}

export async function getShipments() {
  await guard("view");
  return prisma.salesShipment.findMany({ include: { customer: { select: { name: true } }, salesOrder: { select: { soNo: true, customerPoNo: true } } }, orderBy: { createdAt: "desc" } });
}

export async function getShipment(id: string) {
  await guard("view");
  const s = await prisma.salesShipment.findUnique({
    where: { id },
    include: {
      customer: true,
      salesOrder: { include: { items: { orderBy: { sortOrder: "asc" } }, invoices: { select: { id: true, invoiceNo: true, termLabel: true, total: true, paidAmount: true, status: true, dueDate: true, currency: true } } } },
      serviceJobs: { select: { id: true, jobNo: true, status: true, type: true } },
    },
  });
  if (!s) return null;
  return { ...s, payment: orderPaidStatus(s.salesOrder) };
}

/** Sales Order yang bisa dibuatkan shipment (sudah dikonfirmasi, belum dibatalkan / selesai). */
export async function getShipmentFormData() {
  await guard("manage");
  const orders = await prisma.salesOrder.findMany({
    where: { status: { in: ["Confirmed", "In Delivery"] } },
    include: { customer: { select: { name: true, address: true, city: true } }, items: { orderBy: { sortOrder: "asc" } }, invoices: { select: { status: true, paidAmount: true } } },
    orderBy: { orderDate: "desc" },
  });
  return orders.map(o => ({
    id: o.id, soNo: o.soNo, customerPoNo: o.customerPoNo, customer: o.customer.name, deliveryAddress: o.deliveryAddress ?? o.customer.address ?? o.customer.city ?? "",
    productionStatus: o.productionStatus, payment: orderPaidStatus(o), currency: o.currency,
    items: o.items.map(i => ({ description: i.description, qty: i.qty, unit: i.unit })),
  }));
}

// ---------------------------------------------------------
// Produksi (manual — belum ada modul produksi)
// ---------------------------------------------------------

export async function updateProduction(salesOrderId: string, data: { status: string; start?: string; target?: string; notes?: string }) {
  return run(async () => {
    const user = await guard("manage");
    if (!(PRODUCTION_STATUSES as readonly string[]).includes(data.status)) throw new Error("Status produksi tidak dikenal.");
    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId } });
    if (!ACTIVE_ORDER.includes(so.status)) throw new Error("Status produksi hanya untuk order yang sudah dikonfirmasi.");
    const changed = so.productionStatus !== data.status;
    await prisma.salesOrder.update({ where: { id: so.id }, data: {
      productionStatus: data.status, productionStart: data.start || null, productionTarget: data.target || null, productionNotes: data.notes?.trim() || null,
      historyJson: changed ? addHistory(so.historyJson, user.name, `Produksi: ${PRODUCTION_LABEL[so.productionStatus] ?? so.productionStatus} → ${PRODUCTION_LABEL[data.status]}`) : so.historyJson,
    } });
    if (changed && data.status === "Ready to Ship") {
      const paid = orderPaidStatus(await prisma.salesOrder.findUniqueOrThrow({ where: { id: so.id }, include: { invoices: true } }));
      await notifyPermission(PERM.shipping, `${so.soNo} siap kirim${paid.fullyPaid ? "" : " — menunggu pelunasan"}`, `/modules/contract-shipping/production`);
      if (!paid.fullyPaid) await notifyPermission(PERM.finance, `${so.soNo} siap kirim, sisa tagihan perlu dilunasi sebelum pengiriman`, `/modules/sales/orders/${so.id}`);
    }
  });
}

// ---------------------------------------------------------
// Shipment
// ---------------------------------------------------------

export type ShipmentInput = {
  salesOrderId: string; scope: string; incoterm?: string; mode: string; forwarder?: string; origin?: string; destination: string;
  etd?: string; eta?: string; awbNo?: string; vessel?: string; containerNo?: string; notes?: string; packages: CratePackage[];
};

function shipmentFields(d: ShipmentInput) {
  if (!d.destination?.trim()) throw new Error("Tujuan pengiriman wajib diisi.");
  if (!["Domestik", "Ekspor"].includes(d.scope)) throw new Error("Pilih domestik atau ekspor.");
  if (d.scope === "Ekspor" && !d.incoterm) throw new Error("Incoterms wajib untuk pengiriman ekspor.");
  const packages = d.packages.filter(p => p.contents?.trim()).map((p, i) => ({
    crateNo: p.crateNo?.trim() || `C-${String(i + 1).padStart(2, "0")}`, contents: p.contents.trim(), dims: p.dims?.trim() || "",
    grossKg: p.grossKg ? Number(p.grossKg) : null, netKg: p.netKg ? Number(p.netKg) : null,
  }));
  return {
    scope: d.scope, incoterm: d.incoterm || null, mode: d.mode, forwarder: d.forwarder?.trim() || null, origin: d.origin?.trim() || "Batam",
    destination: d.destination.trim(), etd: d.etd || null, eta: d.eta || null, awbNo: d.awbNo?.trim() || null, vessel: d.vessel?.trim() || null,
    containerNo: d.containerNo?.trim() || null, notes: d.notes?.trim() || null, packagesJson: JSON.stringify(packages),
  };
}

export async function createShipment(data: ShipmentInput) {
  return run(async () => {
    const user = await guard("manage");
    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: data.salesOrderId } });
    if (!["Confirmed", "In Delivery"].includes(so.status)) throw new Error("Shipment hanya untuk Sales Order yang sudah dikonfirmasi.");
    const s = await prisma.salesShipment.create({ data: {
      ...shipmentFields(data), shipmentNo: await nextDocNo("SHP", today()), salesOrderId: so.id, customerId: so.customerId,
      status: "Draft", docsJson: JSON.stringify(defaultShipmentDocs(data.scope)), createdBy: user.name, createdAt: today(),
      historyJson: firstHistory(user.name, `Shipment dibuat untuk ${so.soNo}`),
    } });
    return s.id;
  });
}

export async function updateShipment(id: string, data: ShipmentInput) {
  return run(async () => {
    const user = await guard("manage");
    const s = await prisma.salesShipment.findUniqueOrThrow({ where: { id } });
    if (!["Draft", "Ready"].includes(s.status)) throw new Error("Shipment yang sudah dikirim tidak bisa diubah.");
    const fields = shipmentFields(data);
    // Dokumen kepabeanan ditambahkan bila lingkup berubah menjadi ekspor.
    let docs = JSON.parse(s.docsJson) as { name: string; done: boolean }[];
    if (fields.scope !== s.scope) {
      const wanted = defaultShipmentDocs(fields.scope);
      docs = wanted.map(w => docs.find(d => d.name === w.name) ?? w);
    }
    await prisma.salesShipment.update({ where: { id }, data: { ...fields, docsJson: JSON.stringify(docs), historyJson: addHistory(s.historyJson, user.name, "Data shipment diperbarui") } });
    return id;
  });
}

export async function toggleShipmentDoc(id: string, index: number) {
  return run(async () => {
    await guard("manage");
    const s = await prisma.salesShipment.findUniqueOrThrow({ where: { id } });
    if (s.status === "Cancelled") throw new Error("Shipment dibatalkan.");
    const docs = JSON.parse(s.docsJson) as { name: string; done: boolean }[];
    if (!docs[index]) throw new Error("Dokumen tidak ditemukan.");
    docs[index].done = !docs[index].done;
    await prisma.salesShipment.update({ where: { id }, data: { docsJson: JSON.stringify(docs) } });
  });
}

export async function addShipmentDoc(id: string, name: string) {
  return run(async () => {
    await guard("manage");
    if (!name?.trim()) throw new Error("Nama dokumen wajib diisi.");
    const s = await prisma.salesShipment.findUniqueOrThrow({ where: { id } });
    const docs = JSON.parse(s.docsJson) as { name: string; done: boolean }[];
    docs.push({ name: name.trim(), done: false });
    await prisma.salesShipment.update({ where: { id }, data: { docsJson: JSON.stringify(docs) } });
  });
}

/** Izin khusus kirim sebelum lunas — diputuskan Sales Manager di Dashboard Persetujuan. */
export async function requestShipmentException(id: string, reason: string) {
  return run(async () => {
    const user = await guard("manage");
    if (!reason?.trim()) throw new Error("Alasan izin khusus wajib diisi.");
    const s = await prisma.salesShipment.findUniqueOrThrow({ where: { id }, include: { salesOrder: { include: { invoices: true } }, customer: { select: { name: true } } } });
    if (s.status !== "Draft") throw new Error("Izin khusus hanya untuk shipment berstatus Draft.");
    if (orderPaidStatus(s.salesOrder).fullyPaid) throw new Error("Order sudah lunas — tidak perlu izin khusus.");
    if (s.exceptionStatus === "Waiting Approval") throw new Error("Izin khusus sedang menunggu persetujuan.");
    await prisma.salesShipment.update({ where: { id }, data: {
      exceptionStatus: "Waiting Approval", exceptionReason: reason.trim(), exceptionRequestedBy: user.name, exceptionDecidedBy: null, exceptionDecidedAt: null, exceptionNote: null,
      historyJson: addHistory(s.historyJson, user.name, `Minta izin kirim sebelum lunas: ${reason.trim()}`),
    } });
    await notifyPermission(PERM.approve, `Izin kirim sebelum lunas: ${s.shipmentNo} (${s.customer.name})`, `/modules/sales/approvals`);
  });
}

export async function decideShipmentException(id: string, decision: "approve" | "reject", note?: string) {
  return run(async () => {
    const user = await guard("approve");
    const s = await prisma.salesShipment.findUniqueOrThrow({ where: { id } });
    if (s.exceptionStatus !== "Waiting Approval") throw new Error("Tidak ada izin khusus yang menunggu persetujuan.");
    if (decision === "reject" && !note?.trim()) throw new Error("Alasan penolakan wajib diisi.");
    const to = decision === "approve" ? "Approved" : "Rejected";
    await prisma.salesShipment.update({ where: { id }, data: {
      exceptionStatus: to, exceptionDecidedBy: user.name, exceptionDecidedAt: today(), exceptionNote: note?.trim() || null,
      historyJson: addHistory(s.historyJson, user.name, `Izin kirim sebelum lunas ${decision === "approve" ? "DISETUJUI" : "DITOLAK"}${note?.trim() ? `: ${note.trim()}` : ""}`),
    } });
    await notifyPermission(PERM.shipping, `Izin khusus ${s.shipmentNo} ${decision === "approve" ? "disetujui" : "ditolak"}`, `/modules/contract-shipping/shipments/${id}`);
  });
}

/** Cek gerbang pelunasan & kesiapan produksi. */
async function assertCanShip(shipmentId: string) {
  const s = await prisma.salesShipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { salesOrder: { include: { invoices: true } } } });
  const pay = orderPaidStatus(s.salesOrder);
  if (!pay.fullyPaid && s.exceptionStatus !== "Approved") {
    throw new Error(`Order belum lunas (sisa ${money(pay.remaining, s.salesOrder.currency)}). Lunasi dulu, atau ajukan izin khusus ke Sales Manager.`);
  }
  if (s.salesOrder.productionStatus !== "Ready to Ship") throw new Error("Produksi belum berstatus Siap kirim.");
  return s;
}

export async function releaseShipment(id: string) {
  return run(async () => {
    const user = await guard("manage");
    const s = await assertCanShip(id);
    if (s.status !== "Draft") throw new Error("Shipment sudah dirilis.");
    if (JSON.parse(s.packagesJson).length === 0) throw new Error("Isi daftar peti/kemasan dulu (untuk Packing List).");
    await prisma.salesShipment.update({ where: { id }, data: {
      status: "Ready", historyJson: addHistory(s.historyJson, user.name, `Dirilis untuk dikirim${s.exceptionStatus === "Approved" ? " (izin khusus)" : " (order lunas)"}`),
    } });
  });
}

export async function markShipped(id: string, data: { shippedAt: string; awbNo?: string; etd?: string; eta?: string }) {
  return run(async () => {
    const user = await guard("manage");
    const s = await assertCanShip(id);
    if (s.status !== "Ready") throw new Error("Rilis shipment dulu sebelum dikirim.");
    if (!data.shippedAt) throw new Error("Tanggal kirim wajib diisi.");
    const ops = [prisma.salesShipment.update({ where: { id }, data: {
      status: "Shipped", shippedAt: data.shippedAt, awbNo: data.awbNo?.trim() || s.awbNo, etd: data.etd || s.etd || data.shippedAt, eta: data.eta || s.eta,
      historyJson: addHistory(s.historyJson, user.name, `Dikirim ${data.shippedAt}${data.awbNo ? ` (B/L / AWB ${data.awbNo})` : ""}`),
    } })];
    if (s.salesOrder.status === "Confirmed") {
      ops.push(prisma.salesOrder.update({ where: { id: s.salesOrderId }, data: { status: "In Delivery", historyJson: addHistory(s.salesOrder.historyJson, user.name, `Status: Confirmed → In Delivery (shipment ${s.shipmentNo})`) } }) as never);
    }
    await prisma.$transaction(ops);
  });
}

export async function markArrived(id: string, data: { arrivedAt: string; receivedBy: string }) {
  return run(async () => {
    const user = await guard("manage");
    const s = await prisma.salesShipment.findUniqueOrThrow({ where: { id }, include: { salesOrder: { include: { serviceJobs: true, customer: true } } } });
    if (s.status !== "Shipped") throw new Error("Shipment belum dikirim.");
    if (!data.arrivedAt || !data.receivedBy?.trim()) throw new Error("Tanggal tiba dan nama penerima wajib diisi.");
    await prisma.salesShipment.update({ where: { id }, data: {
      status: "Arrived", arrivedAt: data.arrivedAt, receivedBy: data.receivedBy.trim(),
      historyJson: addHistory(s.historyJson, user.name, `Tiba di client ${data.arrivedAt}, diterima ${data.receivedBy.trim()}`),
    } });
    // Barang tiba → siapkan job instalasi & training (Draft) untuk tim Training & Customer Service.
    if (!s.salesOrder.serviceJobs.some(j => j.status !== "Cancelled")) {
      const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: s.salesOrderId }, include: { items: { orderBy: { sortOrder: "asc" } } } });
      const checklist = so.items.filter(it => !/^(Jasa|Instalasi|Kontrak)/i.test(it.description)).flatMap(it =>
        Array.from({ length: Math.max(1, Math.round(it.qty)) }, () => ({ itemId: it.id, item: it.description, serial: "", installed: false, tested: false })));
      const job = await prisma.serviceJob.create({ data: {
        jobNo: await nextDocNo("SVC", today()), salesOrderId: so.id, customerId: so.customerId, shipmentId: s.id, type: "Instalasi & Training",
        mode: "Onsite", location: so.deliveryAddress ?? s.destination, status: "Draft", checklistJson: JSON.stringify(checklist),
        createdBy: user.name, createdAt: today(), historyJson: firstHistory(user.name, `Dibuat otomatis: barang ${s.shipmentNo} tiba di client`),
      } });
      await notifyPermission(PERM.service, `Barang ${so.soNo} tiba di ${s.salesOrder.customer.name} — jadwalkan instalasi & training (${job.jobNo})`, `/modules/customer-service/jobs/${job.id}`);
    }
  });
}

export async function cancelShipment(id: string, reason: string) {
  return run(async () => {
    const user = await guard("manage");
    if (!reason?.trim()) throw new Error("Alasan pembatalan wajib diisi.");
    const s = await prisma.salesShipment.findUniqueOrThrow({ where: { id } });
    if (["Shipped", "Arrived", "Cancelled"].includes(s.status)) throw new Error("Shipment ini tidak bisa dibatalkan.");
    await prisma.salesShipment.update({ where: { id }, data: { status: "Cancelled", historyJson: addHistory(s.historyJson, user.name, `Dibatalkan: ${reason.trim()}`) } });
  });
}
