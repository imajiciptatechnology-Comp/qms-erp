"use server";

// Driver simulator (demo tanpa HP): layar chat sopir di browser yang memakai logika bot Telegram yang sama.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getJson, setJson } from "@/lib/kvStore";
import { uploadToStorage } from "@/lib/uploadFile";
import { getLogisticsAccess } from "../server";
import { ACTIVE_TRIP_STATUSES, parsePlan, pointAlong, type LatLng } from "../trackingLib";
import { handleTelegramUpdate, type TgUpdate } from "./telegramBot";

async function guard() {
  const { user, access } = await getLogisticsAccess();
  if (!user) throw new Error("Silakan login terlebih dahulu.");
  if (!access.canDispatch) throw new Error("Driver simulator hanya untuk Dispatcher / Ops / Super Admin.");
  return user;
}
const fail = (err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : "Terjadi kesalahan." });
const chatIdOf = (driverId: string) => `sim-${driverId}`;

/** Hubungkan sopir ke kanal simulator (tanpa undangan). */
async function ensureLink(driverId: string, by: string) {
  const chatId = chatIdOf(driverId);
  const existing = await prisma.chatChannelLink.findFirst({ where: { channel: "simulator", chatId } });
  if (existing) {
    if (!existing.active) await prisma.chatChannelLink.update({ where: { id: existing.id }, data: { active: true } });
    return chatId;
  }
  const now = new Date().toISOString();
  await prisma.chatChannelLink.create({ data: { channel: "simulator", driverId, chatId, inviteCode: `sim-${crypto.randomBytes(8).toString("hex")}`, inviteExpiresAt: now, linkedAt: now, chatName: "Driver simulator", createdBy: by, createdAt: now } });
  return chatId;
}

/** Dipanggil saat sopir dipilih di simulator, supaya pesan "Tugas baru" dari kantor ikut masuk. */
export async function simConnect(driverId: string) {
  try {
    const user = await guard();
    await prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
    await ensureLink(driverId, user.name);
    return { ok: true as const };
  } catch (err) { return fail(err); }
}

let seq = 1;
function update(chatId: string, driverName: string, extra: Partial<NonNullable<TgUpdate["message"]>>, edited = false): TgUpdate {
  const msg = { message_id: seq++, chat: { id: chatId, type: "private" }, from: { id: 0, first_name: driverName }, date: Math.floor(Date.now() / 1000), ...extra };
  return edited ? { update_id: seq++, edited_message: msg } : { update_id: seq++, message: msg };
}

export type SimInput = { type: "text"; text: string } | { type: "button"; data: string } | { type: "photo"; dataUrl: string; caption?: string } | { type: "location" };

export async function simSend(driverId: string, input: SimInput) {
  try {
    const user = await guard();
    const driver = await prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
    const chatId = await ensureLink(driverId, user.name);
    if (input.type === "text") {
      const text = input.text.trim().slice(0, 1500);
      if (!text) return { ok: true as const };
      await handleTelegramUpdate(update(chatId, driver.name, { text }));
    } else if (input.type === "button") {
      await handleTelegramUpdate({ update_id: seq++, callback_query: { id: String(seq++), from: { id: 0, first_name: driver.name }, data: input.data, message: update(chatId, driver.name, {}).message } });
    } else if (input.type === "photo") {
      const m = input.dataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
      if (!m || input.dataUrl.length > 4_000_000) throw new Error("Foto harus JPG/PNG maks. ±3 MB.");
      const url = await uploadToStorage(`logistics/telegram/${driverId}`, new File([Buffer.from(m[2], "base64")], `sim-${Date.now()}.jpg`, { type: `image/${m[1]}` }));
      await handleTelegramUpdate(update(chatId, driver.name, { photo: [{ file_id: `url:${url}`, width: 1200, height: 900, file_size: 100_000 }], caption: input.caption }));
    } else {
      const pos = await nextPosition(driverId, false);
      await handleTelegramUpdate(update(chatId, driver.name, { location: { latitude: pos[0], longitude: pos[1], live_period: 28_800 } }));
    }
    return { ok: true as const };
  } catch (err) { return fail(err); }
}

/**
 * Lokasi live tiruan: truk bergerak di sepanjang rencana rute sesuai status trip sekarang
 * (menuju muat / perjalanan ke titik bongkar / kembali). Saat muat/bongkar posisinya diam.
 */
async function nextPosition(driverId: string, advance: boolean): Promise<LatLng> {
  const trip = await prisma.trip.findFirst({ where: { driverId, isSimulated: false, status: { in: ACTIVE_TRIP_STATUSES } }, orderBy: { plannedStart: "asc" } });
  const pool: LatLng = [-6.3008, 107.153];
  if (!trip) return pool;
  const plan = parsePlan(trip.planJson);
  const moving = ["ToLoad", "InTransit", "Returning"].includes(trip.status);
  // Fase yang sesuai: InTransit ke-k = menuju titik bongkar k+1; Unloading ke-k = titik bongkar k+1.
  const same = plan.phases.filter(p => p.status === trip.status);
  const phase = trip.status === "InTransit" || trip.status === "Unloading" ? same[Math.min(trip.stopsDone, same.length - 1)] : same[0];
  if (!phase) return trip.lastLat != null && trip.lastLng != null ? [trip.lastLat, trip.lastLng] : pool;
  const key = `bot_sim_live:${driverId}`;
  const st = await getJson<{ phase: string; frac: number }>(key, { phase: "", frac: 0 });
  const phaseKey = `${trip.id}:${trip.status}:${trip.stopsDone}`;
  let frac = st.phase === phaseKey ? st.frac : 0;
  if (moving && advance) frac = Math.min(1, frac + 0.07);
  await setJson(key, { phase: phaseKey, frac });
  if (!moving || phase.path.length < 2) return phase.path[0];
  return pointAlong(phase.path, frac);
}

/** Satu "tick" lokasi live (dipanggil browser tiap beberapa detik selama berbagi lokasi live). */
export async function simLiveTick(driverId: string) {
  try {
    const user = await guard();
    const driver = await prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
    const chatId = await ensureLink(driverId, user.name);
    const pos = await nextPosition(driverId, true);
    await handleTelegramUpdate(update(chatId, driver.name, { location: { latitude: pos[0], longitude: pos[1], live_period: 28_800 } }, true));
    return { ok: true as const, lat: pos[0], lng: pos[1] };
  } catch (err) { return fail(err); }
}

export type SimMessage = { id: string; direction: string; kind: string; text: string | null; fileUrl: string | null; at: string; buttons: { text: string; callback_data?: string }[][] };

export async function simFeed(driverId: string): Promise<{ ok: true; messages: SimMessage[] } | { ok: false; error: string }> {
  try {
    await guard();
    const rows = await prisma.chatMessage.findMany({ where: { chatId: chatIdOf(driverId) }, orderBy: { at: "desc" }, take: 80 });
    return {
      ok: true,
      messages: rows.reverse().map(r => {
        let buttons: SimMessage["buttons"] = [];
        if (r.direction === "out" && r.aiJson) { try { buttons = JSON.parse(r.aiJson).buttons ?? []; } catch { /* bukan tombol */ } }
        return { id: r.id, direction: r.direction, kind: r.kind, text: r.text, fileUrl: r.fileUrl, at: r.at, buttons };
      }),
    };
  } catch (err) { return fail(err); }
}

/** Mulai ulang percakapan simulator (riwayat chat simulator sopir ini dihapus). */
export async function simReset(driverId: string) {
  try {
    await guard();
    await prisma.chatMessage.deleteMany({ where: { chatId: chatIdOf(driverId) } });
    await setJson(`bot_sim_live:${driverId}`, { phase: "", frac: 0 });
    return { ok: true as const };
  } catch (err) { return fail(err); }
}
