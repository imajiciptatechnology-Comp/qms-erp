"use server";

// Modul Training & Customer Service (Labtech): instalasi/commissioning + training ke client sampai BAST,
// tiket customer service dengan SLA, dan daftar unit terpasang beserta garansinya.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type CurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { notifyPermission } from "@/lib/notificationStore";
import { JOB_MODES, JOB_TYPES, PERM, TICKET_CATEGORIES, TICKET_CHANNELS, TICKET_PRIORITIES, TICKET_SLA_HOURS, TICKET_STATUSES, canSeeService, contractState, salesAccess, today, type ChecklistRow, type Participant } from "@/app/modules/sales/lib";
import { addHistory, completeInstallation, firstHistory, nextDocNo } from "@/app/modules/sales/server";

type Result = { success: true; id?: string } | { success: false; message: string };

async function guard(need: "view" | "manage" | "approve"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Silakan login terlebih dahulu.");
  const a = salesAccess(user, await getRolesConfig());
  const ok = need === "view" ? canSeeService(a) : need === "manage" ? a.canService : a.canApprove;
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

const isService = (desc: string) => /^(Jasa|Instalasi|Kontrak)/i.test(desc);

// ---------------------------------------------------------
// Query
// ---------------------------------------------------------

export async function getServiceOverview() {
  await guard("view");
  const [jobs, tickets, warranties] = await Promise.all([
    prisma.serviceJob.findMany({ where: { status: { notIn: ["Completed", "Cancelled"] } }, include: { customer: { select: { name: true } } }, orderBy: { startDate: "asc" } }),
    prisma.serviceTicket.findMany({ where: { status: { notIn: ["Resolved", "Closed"] } }, include: { customer: { select: { name: true } } }, orderBy: { responseDueAt: "asc" } }),
    prisma.contract.findMany({ where: { type: "Garansi", status: "Active" }, include: { customer: { select: { name: true } } }, orderBy: { endDate: "asc" } }),
  ]);
  const completed = await prisma.serviceJob.findMany({ where: { status: "Completed" }, select: { participantsJson: true, feedbackScore: true } });
  const trained = completed.reduce((n, j) => n + (JSON.parse(j.participantsJson) as Participant[]).filter(p => p.attended).length, 0);
  const scores = completed.map(j => j.feedbackScore).filter((x): x is number => !!x);
  return {
    jobs, tickets, warranties: warranties.map(w => ({ ...w, state: contractState(w) })),
    stats: { trained, avgFeedback: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null, completedJobs: completed.length },
  };
}

export async function getJobs() {
  await guard("view");
  return prisma.serviceJob.findMany({ include: { customer: { select: { name: true } }, salesOrder: { select: { soNo: true } } }, orderBy: [{ createdAt: "desc" }] });
}

export async function getJob(id: string) {
  await guard("view");
  return prisma.serviceJob.findUnique({
    where: { id },
    include: {
      customer: true,
      salesOrder: { select: { id: true, soNo: true, customerPoNo: true, status: true, bastNo: true, items: { orderBy: { sortOrder: "asc" }, select: { id: true, description: true, qty: true, unit: true } } } },
      shipment: { select: { id: true, shipmentNo: true, arrivedAt: true } },
    },
  });
}

export async function getJobFormData() {
  await guard("manage");
  const [customers, orders] = await Promise.all([
    prisma.customer.findMany({ where: { status: "Active" }, orderBy: { name: "asc" }, select: { id: true, name: true, address: true, city: true } }),
    prisma.salesOrder.findMany({ where: { status: { in: ["Confirmed", "In Delivery", "Installed", "Completed"] } }, orderBy: { orderDate: "desc" }, select: { id: true, soNo: true, customerId: true, deliveryAddress: true, status: true } }),
  ]);
  return { customers, orders };
}

// ---------------------------------------------------------
// Instalasi & training
// ---------------------------------------------------------

export type JobInput = {
  customerId: string; salesOrderId?: string | null; type: string; mode: string; location?: string; startDate?: string; endDate?: string;
  technicians?: string; trainerName?: string; topics?: string; notes?: string;
};

function jobFields(d: JobInput) {
  if (!d.customerId) throw new Error("Pilih customer.");
  if (!JOB_TYPES.includes(d.type)) throw new Error("Jenis job tidak dikenal.");
  if (!JOB_MODES.includes(d.mode)) throw new Error("Mode tidak dikenal.");
  if (d.startDate && d.endDate && d.endDate < d.startDate) throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
  return {
    customerId: d.customerId, salesOrderId: d.salesOrderId || null, type: d.type, mode: d.mode, location: d.location?.trim() || null,
    startDate: d.startDate || null, endDate: d.endDate || null, technicians: d.technicians?.trim() || null, trainerName: d.trainerName?.trim() || null,
    topics: d.topics?.trim() || null, notes: d.notes?.trim() || null,
  };
}

/** Checklist instalasi: satu baris per unit trainer di Sales Order. */
async function checklistFor(salesOrderId: string | null): Promise<ChecklistRow[]> {
  if (!salesOrderId) return [];
  const items = await prisma.salesOrderItem.findMany({ where: { salesOrderId }, orderBy: { sortOrder: "asc" } });
  return items.filter(it => !isService(it.description)).flatMap(it =>
    Array.from({ length: Math.max(1, Math.round(it.qty)) }, (_, i) => ({ itemId: it.id, item: it.description, serial: (it.serialNumbers || "").split(",")[i]?.trim() ?? "", installed: false, tested: false })));
}

export async function createJob(data: JobInput) {
  return run(async () => {
    const user = await guard("manage");
    const fields = jobFields(data);
    const job = await prisma.serviceJob.create({ data: {
      ...fields, jobNo: await nextDocNo("SVC", today()), status: "Draft",
      checklistJson: JSON.stringify(fields.type === "Training" ? [] : await checklistFor(fields.salesOrderId)),
      createdBy: user.name, createdAt: today(), historyJson: firstHistory(user.name, "Job dibuat"),
    } });
    return job.id;
  });
}

export async function updateJob(id: string, data: JobInput) {
  return run(async () => {
    const user = await guard("manage");
    const j = await prisma.serviceJob.findUniqueOrThrow({ where: { id } });
    if (!["Draft", "Scheduled"].includes(j.status)) throw new Error("Job yang sedang berjalan / selesai tidak bisa diubah.");
    const fields = jobFields(data);
    // Jadwal yang sudah disetujui lalu diubah harus diajukan ulang.
    const reschedule = j.status === "Scheduled" && (fields.startDate !== j.startDate || fields.endDate !== j.endDate || fields.trainerName !== j.trainerName || fields.location !== j.location);
    const checklist = j.checklistJson === "[]" && fields.type !== "Training" && fields.salesOrderId ? JSON.stringify(await checklistFor(fields.salesOrderId)) : j.checklistJson;
    await prisma.serviceJob.update({ where: { id }, data: {
      ...fields, checklistJson: checklist, ...(reschedule ? { status: "Draft", approvedBy: null, approvedAt: null } : {}),
      historyJson: addHistory(j.historyJson, user.name, reschedule ? "Jadwal diubah — perlu diajukan ulang" : "Data job diperbarui"),
    } });
    return id;
  });
}

export async function submitJob(id: string) {
  return run(async () => {
    const user = await guard("manage");
    const j = await prisma.serviceJob.findUniqueOrThrow({ where: { id }, include: { customer: { select: { name: true } } } });
    if (j.status !== "Draft") throw new Error("Job ini sudah diajukan.");
    if (!j.startDate || !j.endDate) throw new Error("Isi tanggal mulai & selesai dulu.");
    if (!j.trainerName && !j.technicians) throw new Error("Isi trainer atau teknisi yang ditugaskan.");
    await prisma.serviceJob.update({ where: { id }, data: { status: "Waiting Approval", decisionNote: null, historyJson: addHistory(j.historyJson, user.name, "Jadwal diajukan untuk persetujuan") } });
    await notifyPermission(PERM.approve, `Jadwal ${j.type.toLowerCase()} ${j.jobNo} (${j.customer.name}) menunggu persetujuan`, `/modules/sales/approvals`);
  });
}

export async function decideServiceJob(id: string, decision: "approve" | "reject", note?: string) {
  return run(async () => {
    const user = await guard("approve");
    const j = await prisma.serviceJob.findUniqueOrThrow({ where: { id } });
    if (j.status !== "Waiting Approval") throw new Error("Job ini tidak sedang menunggu persetujuan.");
    if (decision === "reject" && !note?.trim()) throw new Error("Tulis alasan penolakan.");
    await prisma.serviceJob.update({ where: { id }, data: decision === "approve"
      ? { status: "Scheduled", approvedBy: user.name, approvedAt: today(), decisionNote: note?.trim() || null, historyJson: addHistory(j.historyJson, user.name, `Jadwal disetujui${note?.trim() ? `: ${note.trim()}` : ""}`) }
      : { status: "Draft", decisionNote: note!.trim(), historyJson: addHistory(j.historyJson, user.name, `Jadwal dikembalikan ke Draft: ${note!.trim()}`) } });
    await notifyPermission(PERM.service, `Jadwal ${j.jobNo} ${decision === "approve" ? "disetujui" : "dikembalikan"}`, `/modules/customer-service/jobs/${id}`);
  });
}

export async function startJob(id: string) {
  return run(async () => {
    const user = await guard("manage");
    const j = await prisma.serviceJob.findUniqueOrThrow({ where: { id } });
    if (j.status !== "Scheduled") throw new Error("Job harus terjadwal (disetujui) sebelum dimulai.");
    await prisma.serviceJob.update({ where: { id }, data: { status: "In Progress", historyJson: addHistory(j.historyJson, user.name, "Pekerjaan di lokasi dimulai") } });
  });
}

export async function saveChecklist(id: string, rows: ChecklistRow[]) {
  return run(async () => {
    await guard("manage");
    const j = await prisma.serviceJob.findUniqueOrThrow({ where: { id } });
    if (["Completed", "Cancelled"].includes(j.status)) throw new Error("Job sudah ditutup.");
    const clean = rows.filter(r => r.item?.trim()).map(r => ({ itemId: r.itemId, item: r.item.trim(), serial: r.serial?.trim() ?? "", installed: !!r.installed, tested: !!r.tested, note: r.note?.trim() || undefined }));
    await prisma.serviceJob.update({ where: { id }, data: { checklistJson: JSON.stringify(clean) } });
  });
}

export async function saveParticipants(id: string, rows: Participant[]) {
  return run(async () => {
    await guard("manage");
    const j = await prisma.serviceJob.findUniqueOrThrow({ where: { id } });
    if (["Completed", "Cancelled"].includes(j.status)) throw new Error("Job sudah ditutup.");
    const score = (v: unknown) => (v === null || v === undefined || v === "" ? null : Math.max(0, Math.min(100, Number(v))));
    const clean = rows.filter(r => r.name?.trim()).map(r => ({ name: r.name.trim(), title: r.title?.trim() || "", attended: !!r.attended, pre: score(r.pre), post: score(r.post) }));
    await prisma.serviceJob.update({ where: { id }, data: { participantsJson: JSON.stringify(clean) } });
  });
}

/** Tutup job dengan BAST. SO terkait ikut menjadi Installed dan kontrak garansi dibuat otomatis. */
export async function completeJob(id: string, data: { bastNo: string; bastDate: string; feedbackScore?: number | null; feedbackNote?: string }) {
  return run(async () => {
    const user = await guard("manage");
    const j = await prisma.serviceJob.findUniqueOrThrow({ where: { id }, include: { salesOrder: true } });
    if (j.status !== "In Progress") throw new Error("Mulai job dulu sebelum ditutup.");
    if (!data.bastNo?.trim() || !data.bastDate) throw new Error("Nomor dan tanggal BAST wajib diisi.");
    const checklist = JSON.parse(j.checklistJson) as ChecklistRow[];
    const participants = JSON.parse(j.participantsJson) as Participant[];
    if (j.type !== "Training" && checklist.some(r => !r.installed || !r.tested)) throw new Error("Semua unit harus terpasang dan lolos uji fungsi.");
    if (j.type !== "Commissioning" && !participants.some(p => p.attended)) throw new Error("Isi daftar hadir peserta training (minimal 1 hadir).");
    if (data.feedbackScore != null && (data.feedbackScore < 1 || data.feedbackScore > 5)) throw new Error("Nilai kepuasan 1–5.");

    if (j.salesOrder && j.salesOrder.status === "In Delivery") {
      const serials: Record<string, string> = {};
      for (const r of checklist) if (r.itemId) serials[r.itemId] = [serials[r.itemId], r.serial].filter(Boolean).join(", ");
      await completeInstallation(user.name, j.salesOrder.id, { bastNo: data.bastNo.trim(), bastDate: data.bastDate, serials });
    }
    await prisma.serviceJob.update({ where: { id }, data: {
      status: "Completed", bastNo: data.bastNo.trim(), bastDate: data.bastDate, feedbackScore: data.feedbackScore ?? null, feedbackNote: data.feedbackNote?.trim() || null,
      historyJson: addHistory(j.historyJson, user.name, `Selesai — BAST ${data.bastNo.trim()} (${data.bastDate})`),
    } });
  });
}

export async function cancelJob(id: string, reason: string) {
  return run(async () => {
    const user = await guard("manage");
    if (!reason?.trim()) throw new Error("Alasan pembatalan wajib diisi.");
    const j = await prisma.serviceJob.findUniqueOrThrow({ where: { id } });
    if (["Completed", "Cancelled"].includes(j.status)) throw new Error("Job sudah ditutup.");
    await prisma.serviceJob.update({ where: { id }, data: { status: "Cancelled", historyJson: addHistory(j.historyJson, user.name, `Dibatalkan: ${reason.trim()}`) } });
  });
}

// ---------------------------------------------------------
// Tiket customer service
// ---------------------------------------------------------

export async function getTickets() {
  await guard("view");
  return prisma.serviceTicket.findMany({ include: { customer: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
}

export async function getTicket(id: string) {
  await guard("view");
  return prisma.serviceTicket.findUnique({ where: { id }, include: { customer: true } });
}

export async function getTicketFormData() {
  await guard("manage");
  const [customers, base] = await Promise.all([
    prisma.customer.findMany({ where: { status: "Active" }, orderBy: { name: "asc" }, select: { id: true, name: true, contactName: true, contactPhone: true } }),
    getInstalledUnits(),
  ]);
  return { customers, units: base };
}

/** Unit terpasang dari SO yang sudah BAST, beserta status garansinya. */
async function getInstalledUnits() {
  const [orders, warranties] = await Promise.all([
    prisma.salesOrder.findMany({ where: { status: { in: ["Installed", "Completed"] } }, include: { items: true, customer: { select: { id: true, name: true } } }, orderBy: { bastDate: "desc" } }),
    prisma.contract.findMany({ where: { type: "Garansi" }, select: { id: true, contractNo: true, salesOrderId: true, startDate: true, endDate: true, status: true, coveredItemsJson: true } }),
  ]);
  return orders.flatMap(so => so.items.filter(it => !isService(it.description)).flatMap(it => {
    const serials = (it.serialNumbers || "").split(",").map(x => x.trim()).filter(Boolean);
    const w = warranties.find(c => c.salesOrderId === so.id);
    const state = w ? contractState(w) : null;
    return Array.from({ length: Math.max(1, Math.round(it.qty)) }, (_, i) => ({
      key: `${it.id}-${i}`, customerId: so.customer.id, customer: so.customer.name, soId: so.id, soNo: so.soNo, bastDate: so.bastDate,
      product: it.description, serialNumber: serials[i] ?? "-",
      warranty: w ? { id: w.id, contractNo: w.contractNo, endDate: w.endDate, state } : null,
    }));
  }));
}

export async function getInstalledBase() {
  await guard("view");
  return getInstalledUnits();
}

export type TicketInput = {
  customerId: string; category: string; priority: string; channel: string; subject: string; description: string;
  productName?: string; serialNumber?: string; reportedBy?: string; contactPhone?: string; assignedTo?: string;
};

export async function createTicket(data: TicketInput) {
  return run(async () => {
    const user = await guard("manage");
    if (!data.customerId) throw new Error("Pilih customer.");
    if (!data.subject?.trim() || !data.description?.trim()) throw new Error("Judul dan uraian wajib diisi.");
    if (!TICKET_CATEGORIES.includes(data.category) || !TICKET_CHANNELS.includes(data.channel) || !(TICKET_PRIORITIES as readonly string[]).includes(data.priority)) throw new Error("Kategori / kanal / prioritas tidak valid.");
    // Garansi: unit dengan nomor seri ini (atau customer ini bila seri kosong) masih dalam kontrak garansi aktif.
    const warranties = await prisma.contract.findMany({ where: { customerId: data.customerId, type: "Garansi", status: "Active" }, select: { endDate: true, status: true, coveredItemsJson: true } });
    const serial = data.serialNumber?.trim();
    const underWarranty = warranties.some(w => contractState(w) !== "Expired" && (!serial || (JSON.parse(w.coveredItemsJson) as { serialNumber: string }[]).some(i => i.serialNumber.split(",").map(x => x.trim()).includes(serial))));
    const due = new Date(Date.now() + (TICKET_SLA_HOURS[data.priority] ?? 48) * 3_600_000).toISOString();
    const t = await prisma.serviceTicket.create({ data: {
      ticketNo: await nextDocNo("TKT", today()), customerId: data.customerId, category: data.category, priority: data.priority, channel: data.channel,
      subject: data.subject.trim(), description: data.description.trim(), productName: data.productName?.trim() || null, serialNumber: serial || null,
      underWarranty, status: "Open", assignedTo: data.assignedTo?.trim() || null, reportedBy: data.reportedBy?.trim() || null, contactPhone: data.contactPhone?.trim() || null,
      responseDueAt: due, createdBy: user.name, createdAt: new Date().toISOString(), historyJson: firstHistory(user.name, `Tiket dibuat via ${data.channel}`),
    } });
    if (data.priority === "Critical" || data.priority === "High") await notifyPermission(PERM.service, `Tiket ${data.priority} ${t.ticketNo}: ${t.subject}`, `/modules/customer-service/tickets/${t.id}`);
    return t.id;
  });
}

export async function updateTicket(id: string, data: { status?: string; assignedTo?: string; note?: string; resolution?: string }) {
  return run(async () => {
    const user = await guard("manage");
    const t = await prisma.serviceTicket.findUniqueOrThrow({ where: { id } });
    if (t.status === "Closed") throw new Error("Tiket sudah ditutup.");
    if (data.status && !TICKET_STATUSES.includes(data.status)) throw new Error("Status tidak dikenal.");
    if (data.status === "Resolved" && !(data.resolution?.trim() || t.resolution)) throw new Error("Tulis penyelesaian sebelum menandai Resolved.");
    const now = new Date().toISOString();
    const changes: string[] = [];
    if (data.status && data.status !== t.status) changes.push(`Status: ${t.status} → ${data.status}`);
    if (data.assignedTo !== undefined && (data.assignedTo.trim() || null) !== t.assignedTo) changes.push(`Ditugaskan ke ${data.assignedTo.trim() || "-"}`);
    if (data.resolution?.trim()) changes.push(`Penyelesaian: ${data.resolution.trim()}`);
    if (data.note?.trim()) changes.push(`Catatan: ${data.note.trim()}`);
    if (!changes.length) throw new Error("Tidak ada perubahan.");
    // Respon pertama = tindakan pertama oleh tim (ubah status / catatan / penugasan) setelah tiket dibuat.
    await prisma.serviceTicket.update({ where: { id }, data: {
      status: data.status ?? t.status, assignedTo: data.assignedTo !== undefined ? data.assignedTo.trim() || null : t.assignedTo,
      resolution: data.resolution?.trim() || t.resolution, firstResponseAt: t.firstResponseAt ?? now,
      resolvedAt: data.status === "Resolved" ? now : data.status && !["Resolved", "Closed"].includes(data.status) ? null : t.resolvedAt,
      historyJson: addHistory(t.historyJson, user.name, changes.join(" · ")),
    } });
  });
}

/** Keluhan mutu produk → modul Customer Complaint QMS (ISO 9001 Cl. 9.1.2 / 10.2). */
export async function escalateTicketToComplaint(id: string) {
  return run(async () => {
    const user = await guard("manage");
    const t = await prisma.serviceTicket.findUniqueOrThrow({ where: { id }, include: { customer: true } });
    if (t.complaintId) throw new Error("Tiket ini sudah diteruskan ke Customer Complaint.");
    const year = new Date().getFullYear();
    const count = (await prisma.complaint.count()) + 1;
    const severity = t.priority;
    const slaDays: Record<string, number> = { Critical: 1, High: 3, Medium: 7, Low: 14 };
    const c = await prisma.complaint.create({ data: {
      id: `COM-${Date.now().toString().slice(-5)}`, complaintNo: `CC-${year}-${String(count).padStart(3, "0")}`,
      source: t.channel === "Email" ? "Email" : t.channel === "Telepon" ? "Phone" : "Other",
      customerName: t.customer.name, customerContact: [t.reportedBy, t.contactPhone].filter(Boolean).join(" · ") || null,
      productService: [t.productName, t.serialNumber && `S/N ${t.serialNumber}`].filter(Boolean).join(" ") || "Trainer Labtech",
      complaintDate: today(), description: `[${t.ticketNo}] ${t.subject}\n\n${t.description}`, category: "Product Quality", severity,
      slaTargetDays: slaDays[severity] ?? 7, status: "Open", picName: t.assignedTo, createdAt: new Date().toISOString(),
      historyJson: JSON.stringify([{ id: Date.now().toString(), date: new Date().toISOString(), userName: user.name, action: `Diteruskan dari tiket CS ${t.ticketNo}` }]),
    } });
    await prisma.serviceTicket.update({ where: { id }, data: { complaintId: c.id, firstResponseAt: t.firstResponseAt ?? new Date().toISOString(), historyJson: addHistory(t.historyJson, user.name, `Diteruskan ke Customer Complaint ${c.complaintNo}`) } });
  });
}
