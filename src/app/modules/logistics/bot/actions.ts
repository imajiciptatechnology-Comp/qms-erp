"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getBotUsername, isTelegramConfigured, tg, webhookSecret } from "@/lib/telegram";
import { getLogisticsAccess } from "../server";
import { createLiveTrip } from "../tripOps";
import { sendToDriver } from "./telegramBot";

type Access = Awaited<ReturnType<typeof getLogisticsAccess>>["access"];
async function guard(check: (a: Access) => boolean) {
  const { user, access } = await getLogisticsAccess();
  if (!user) throw new Error("Silakan login terlebih dahulu.");
  if (!check(access)) throw new Error("Role Anda tidak punya akses untuk aksi ini.");
  return user;
}
const fail = (err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : "Terjadi kesalahan." });

/** Fleet Manager: link undangan sekali pakai (berlaku 7 hari) untuk menghubungkan Telegram sopir. */
export async function createTelegramInvite(driverId: string) {
  try {
    const user = await guard(a => a.canFleet);
    if (!isTelegramConfigured()) throw new Error("Bot Telegram belum dikonfigurasi (env TELEGRAM_BOT_TOKEN & TELEGRAM_WEBHOOK_SECRET di Vercel).");
    await prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
    const username = await getBotUsername();
    const code = crypto.randomBytes(9).toString("base64url");
    // Undangan lama yang belum dipakai dinonaktifkan; yang sudah terhubung tetap aktif sampai sopir membuka link baru.
    await prisma.chatChannelLink.updateMany({ where: { driverId, chatId: null }, data: { active: false } });
    await prisma.chatChannelLink.create({ data: { driverId, inviteCode: code, inviteExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), createdBy: user.name, createdAt: new Date().toISOString() } });
    revalidatePath(`/modules/logistics/fleet/drivers/${driverId}`);
    return { ok: true as const, url: `https://t.me/${username}?start=${code}` };
  } catch (err) { return fail(err); }
}

export async function unlinkTelegram(driverId: string) {
  try {
    await guard(a => a.canFleet);
    await prisma.chatChannelLink.updateMany({ where: { driverId }, data: { active: false, chatId: null } });
    revalidatePath(`/modules/logistics/fleet/drivers/${driverId}`);
    return { ok: true as const };
  } catch (err) { return fail(err); }
}

/** Dispatcher → sopir lewat bot. */
export async function sendDriverMessage(driverId: string, text: string) {
  try {
    const user = await guard(a => a.canDispatch);
    const body = text.trim();
    if (!body) throw new Error("Pesan kosong.");
    if (body.length > 1000) throw new Error("Pesan terlalu panjang (maks. 1000 karakter).");
    const trip = await prisma.trip.findFirst({ where: { driverId, isSimulated: false, status: { notIn: ["Completed", "Cancelled"] } }, select: { id: true } });
    const sent = await sendToDriver(driverId, `📣 Pesan dari kantor (${user.name}):\n${body}`, { sentBy: user.name, tripId: trip?.id });
    if (!sent) throw new Error("Sopir ini belum terhubung (Telegram / Driver simulator).");
    return { ok: true as const };
  } catch (err) { return fail(err); }
}

export type ChatFeedItem = { id: string; driverId: string | null; driverName: string | null; direction: string; kind: string; text: string | null; fileUrl: string | null; sentBy: string | null; at: string };

export async function getChatFeed(driverId?: string | null): Promise<{ ok: true; items: ChatFeedItem[] } | { ok: false; error: string }> {
  try {
    await guard(a => a.canView);
    const rows = await prisma.chatMessage.findMany({ where: driverId ? { driverId } : {}, orderBy: { at: "desc" }, take: 60, include: { driver: { select: { name: true } } } });
    return { ok: true, items: rows.reverse().map(r => ({ id: r.id, driverId: r.driverId, driverName: r.driver?.name ?? null, direction: r.direction, kind: r.kind, text: r.text, fileUrl: r.fileUrl, sentBy: r.sentBy, at: r.at })) };
  } catch (err) { return fail(err); }
}

/** Trip live untuk demo bot (sementara sebelum papan dispatch Tahap 2). Sopir dikabari lewat bot. */
export async function startLiveTrip(input: { driverId: string; vehicleId: string; orderId?: string | null; routeId?: string | null }) {
  try {
    const user = await guard(a => a.canDispatch);
    const { trip, vehicle, route, order, stopNames } = await createLiveTrip(input, user.name);
    // Kanal Telegram & Driver simulator; sendToDriver melewati kanal yang gagal.
    const notified = await sendToDriver(input.driverId,
      `🆕 Tugas baru ${trip.tripNo}\n${vehicle.plateNo} · ${route.origin} → ${route.destination}${order ? `\nMuat: ${order.originName} · ${order.loadDate} ${order.loadTime ?? ""}` : ""}\nBongkar: ${stopNames.join("; ")}\n\nIsi ✅ P2H dulu, lalu tekan 🚚 Berangkat.`,
      { sentBy: user.name, tripId: trip.id, inline: [[{ text: "📋 Lihat tugas", callback_data: "task" }]] }).catch(() => false);
    revalidatePath("/modules/logistics/tracking");
    return { ok: true as const, tripNo: trip.tripNo, notified };
  } catch (err) { return fail(err); }
}

/** Super Admin: daftarkan webhook ke Telegram (sekali, atau setelah ganti domain/secret). */
export async function registerTelegramWebhook() {
  try {
    const { access } = await getLogisticsAccess();
    if (!access.isSuperAdmin) throw new Error("Hanya Super Admin.");
    if (!isTelegramConfigured()) throw new Error("Isi env TELEGRAM_BOT_TOKEN & TELEGRAM_WEBHOOK_SECRET di Vercel, lalu deploy ulang.");
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (!host) throw new Error("Host tidak diketahui.");
    const url = `${proto}://${host}/api/telegram/webhook`;
    await tg("setWebhook", { url, secret_token: webhookSecret(), allowed_updates: ["message", "edited_message", "callback_query"], drop_pending_updates: true });
    await tg("setMyCommands", { commands: [{ command: "tugas", description: "Lihat tugas & tombol status" }, { command: "p2h", description: "Pemeriksaan harian kendaraan" }, { command: "help", description: "Bantuan" }] }).catch(() => {});
    return { ok: true as const, url, username: await getBotUsername() };
  } catch (err) { return fail(err); }
}

export async function getTelegramStatus() {
  try {
    await guard(a => a.canView);
    if (!isTelegramConfigured()) return { ok: true as const, configured: false as const };
    const [username, info] = await Promise.all([getBotUsername(), tg<{ url: string; pending_update_count: number; last_error_message?: string }>("getWebhookInfo")]);
    return { ok: true as const, configured: true as const, username, webhookUrl: info.url || null, pending: info.pending_update_count, lastError: info.last_error_message ?? null };
  } catch (err) { return fail(err); }
}
