// Bot Telegram sopir (rancangan 10.3). Dipanggil webhook di after(): balasan dikirim lewat sendMessage.
// Tombol status & lokasi tanpa AI; AI hanya untuk foto, suara, dan teks bebas (dibatasi per sopir per hari).
import { prisma } from "@/lib/prisma";
import { AiError, aiTranscribeAudio, isAiConfigured } from "@/lib/ai";
import { downloadFile as tgDownload, sendMessage as tgSend, tg as tgApi, type InlineButton } from "@/lib/telegram";
import { uploadToStorage } from "@/lib/uploadFile";
import { DRIVER_DOC_TYPES, VEHICLE_DOC_TYPES } from "../lib";
import { ACTIVE_TRIP_STATUSES, TRIP_STATUSES, haversineKm } from "../trackingLib";
import { notifyPermission } from "../fleetDocs";
import { consumeDailyQuota } from "../dbUtil";
import { scanFleetDocument } from "../ai/scanFleetDoc";
import { applyTripStatus, nextActions, recordP2H, stopsTotalOf } from "../tripOps";
import { P2H_ITEMS, p2hItem, parseOdometer, type P2HResult } from "../p2hLib";
import { checklistButtons, checklistText, detailButtons, detailPrompt, hasDetail, isP2HFlow, odometerPrompt, odometerProblem, summaryLines, uncheckedItems, type P2HFlowState } from "./p2hFlow";
import { analyzeDriverPhoto, interpretDriverText, parseP2HText } from "./ai";

// ---------- Tipe update Telegram (yang dipakai saja) ----------
type TgUser = { id: number; username?: string; first_name?: string; last_name?: string };
type TgMessage = {
  message_id: number; chat: { id: number | string; type: string }; from?: TgUser; date: number; text?: string; caption?: string;
  photo?: { file_id: string; width: number; height: number; file_size?: number }[];
  voice?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
  audio?: { file_id: string; mime_type?: string };
  location?: { latitude: number; longitude: number; live_period?: number; heading?: number };
  document?: { file_id: string; mime_type?: string; file_name?: string };
};
export type TgUpdate = {
  update_id: number; message?: TgMessage; edited_message?: TgMessage;
  callback_query?: { id: string; from: TgUser; message?: TgMessage; data?: string };
};

const MAIN_KEYBOARD = {
  keyboard: [[{ text: "📋 Tugas saya" }, { text: "✅ P2H" }], [{ text: "📍 Kirim lokasi", request_location: true }, { text: "❓ Bantuan" }]],
  resize_keyboard: true, is_persistent: true,
};
const HELP = [
  "Yang bisa Bapak lakukan di sini:",
  "• 📋 Tugas saya — lihat trip & tekan tombol status (berangkat, tiba muat, selesai muat, tiba bongkar, selesai bongkar).",
  "• ✅ P2H — pemeriksaan harian sebelum berangkat: cek 15 item satu per satu (✅/❌), item bermasalah wajib diberi keterangan/foto, lalu ketik odometer. Voice note \"rem pakem, ban kiri bocor\" bisa mengisi otomatis.",
  "• 📍 Lokasi live — tekan 📎 → Lokasi → Bagikan Lokasi Live (8 jam) supaya kantor bisa memantau.",
  "• 📷 Kirim foto muatan/segel, nota BBM/tol, surat jalan bertanda tangan, atau SIM/STNK baru.",
  "• Tanya bebas, mis. \"alamat bongkar kedua di mana?\" atau lapor \"ban bocor di tol km 120\".",
].join("\n");

const DAILY_AI_LIMIT = 40;
const MAX_VOICE_SECONDS = 180;

/** Chat dari Driver simulator di browser (demo tanpa HP): "sim-<driverId>". Tidak ada panggilan ke Telegram. */
export const isSimChat = (chatId: string) => chatId.startsWith("sim-");
const sendMessage = (chatId: string, text: string, opts: { inline?: InlineButton[][]; keyboard?: unknown } = {}) =>
  isSimChat(chatId) ? Promise.resolve({ message_id: 0 }) : tgSend(chatId, text, opts);
const chatAction = (chatId: string) => (isSimChat(chatId) ? Promise.resolve() : tgApi("sendChatAction", { chat_id: chatId, action: "typing" }).then(() => undefined));
const ackCallback = (chatId: string, id: string, text?: string) => (isSimChat(chatId) ? Promise.resolve() : tgApi("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) }).then(() => undefined));
/** File dari simulator sudah ada di storage: fileId "url:<publicUrl>" (hanya untuk chat simulator — bukan dari Telegram). */
async function downloadFile(chatId: string, fileId: string) {
  if (fileId.startsWith("url:")) {
    if (!isSimChat(chatId)) throw new Error("file_id tidak valid.");
    const res = await fetch(fileId.slice(4), { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Gagal mengunduh file (${res.status}).`);
    return { bytes: Buffer.from(await res.arrayBuffer()), path: fileId.slice(4) };
  }
  return tgDownload(fileId);
}
const nowIso = () => new Date().toISOString();

async function log(data: { chatId: string; driverId?: string | null; tripId?: string | null; direction: "in" | "out"; kind: string; text?: string | null; fileUrl?: string | null; aiJson?: string | null; sentBy?: string | null }): Promise<string | null> {
  const row = await prisma.chatMessage.create({ data: { channel: isSimChat(data.chatId) ? "simulator" : "telegram", ...data, at: nowIso() } }).catch(err => { console.error("[bot] log", err); return null; });
  return row?.id ?? null;
}

/** Kirim + catat. Mengembalikan id log & message_id Telegram (untuk mengubah tombol pesan ini nanti). */
async function reply(chatId: string, ctx: { driverId?: string; tripId?: string | null }, text: string, opts: { inline?: InlineButton[][]; keyboard?: unknown } = {}) {
  const sent = await sendMessage(chatId, text, opts.inline?.length === 0 ? { ...opts, inline: undefined } : opts);
  const logId = await log({ chatId, driverId: ctx.driverId, tripId: ctx.tripId, direction: "out", kind: "text", text, sentBy: "Bot", aiJson: opts.inline?.length ? JSON.stringify({ buttons: opts.inline }) : null });
  return { logId, msgId: sent?.message_id || null };
}

/** Ganti tombol pesan yang sudah terkirim (Telegram: editMessageReplyMarkup; simulator & log: kolom aiJson). */
async function editButtons(chatId: string, ref: { logId?: string | null; msgId?: number | null }, inline: InlineButton[][]) {
  if (!isSimChat(chatId) && ref.msgId) await tgApi("editMessageReplyMarkup", { chat_id: chatId, message_id: ref.msgId, reply_markup: { inline_keyboard: inline } }).catch(() => {});
  if (ref.logId) await prisma.chatMessage.update({ where: { id: ref.logId }, data: { aiJson: JSON.stringify({ buttons: inline }) } }).catch(() => {});
}

/** Kuota AI per sopir per hari (WIB), atomik. */
const aiQuotaOk = (driverId: string) => consumeDailyQuota(`ai_bot_usage:${driverId}`, DAILY_AI_LIMIT);

type Ctx = Awaited<ReturnType<typeof loadContext>>;

async function loadContext(chatId: string) {
  const link = await prisma.chatChannelLink.findFirst({ where: { chatId, channel: isSimChat(chatId) ? "simulator" : "telegram", active: true }, include: { driver: true } });
  if (!link) return null;
  const trip = await prisma.trip.findFirst({
    where: { driverId: link.driverId, isSimulated: false, status: { in: ACTIVE_TRIP_STATUSES } }, orderBy: { plannedStart: "asc" },
    include: {
      vehicle: { include: { truckType: true } }, helper: true, route: true, client: true, order: { include: { stops: { orderBy: { seq: "asc" } } } },
      events: { where: { status: "SJHandover" }, take: 1, select: { at: true } },
    },
  });
  return { link, driver: link.driver, trip };
}

function tripText(c: NonNullable<Ctx>) {
  const t = c.trip;
  if (!t) return "Belum ada trip aktif untuk Bapak. Kalau ada tugas baru, bot akan mengabari di sini.";
  const stops = t.order?.stops.map((s, i) => `   ${i + 1}. ${s.name}${s.city ? `, ${s.city}` : ""}`).join("\n") ?? `   1. ${t.route?.destination ?? "-"}`;
  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString("id-ID", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "-");
  return [
    `🚛 ${t.tripNo} · ${t.vehicle.plateNo} (${t.vehicle.truckType.name})`,
    `Klien: ${t.client?.name ?? "-"}${t.order ? ` · ${t.order.orderNo}` : ""}`,
    `Rute: ${t.route ? `${t.route.origin} → ${t.route.destination}` : "-"}`,
    `Muat: ${t.order?.originName ?? "Pool"}${t.order ? ` · ${t.order.loadDate} ${t.order.loadTime ?? ""}` : ""}`,
    `Bongkar:\n${stops}`,
    t.helper ? `Kenek: ${t.helper.name}` : "",
    `Status: ${TRIP_STATUSES[t.status]?.label ?? t.status}`,
    t.status === "Scheduled" ? [
      "Sebelum berangkat:",
      `${t.p2hDoneAt ? "✅" : "⬜"} 1. P2H${t.p2hDoneAt ? " lolos" : " — tekan 📝 Isi P2H"}`,
      `${t.events.length ? "✅" : "⬜"} 2. Surat Jalan${t.events.length ? " sudah diambil di kantor" : t.suratJalanNo ? ` ${t.suratJalanNo} — tanda tangan & ambil di kantor` : " — belum terbit (menunggu kantor)"}`,
      "⬜ 3. Tekan 🚚 Berangkat",
    ].join("\n") : "",
    t.promisedArrival ? `Janji tiba ke klien: ${time(t.promisedArrival)}` : "",
  ].filter(Boolean).join("\n");
}

async function tripButtons(c: NonNullable<Ctx>): Promise<InlineButton[][]> {
  const t = c.trip;
  if (!t) return [];
  const actions = nextActions(t, await stopsTotalOf(t.id));
  const rows: InlineButton[][] = actions.map(a => [{ text: a.label, callback_data: `st:${t.id}:${a.to}` }]);
  if (t.status === "Scheduled" && !t.p2hDoneAt) rows.unshift([{ text: "📝 Isi P2H", callback_data: `p2hstart:${t.id}` }]);
  return rows;
}

/** Data untuk AI: hanya milik sopir ini. */
function aiContext(c: NonNullable<Ctx>) {
  return [
    `Nama sopir: ${c.driver.name} (${c.driver.code}), SIM ${c.driver.simClass} berlaku s/d ${c.driver.simExpiry}.`,
    c.trip ? tripText(c) : "Tidak ada trip aktif.",
    "Saldo uang jalan: fitur uang jalan belum aktif di sistem (menyusul), jadi saldo belum tersedia.",
    "Kontak dispatcher: lewat chat ini (laporan diteruskan otomatis) atau telepon kantor (021) 8900-0000.",
  ].join("\n");
}

// ---------------------------------------------------------

/**
 * `via` memisahkan dua pintu masuk: webhook Telegram (chat.id numerik) dan Driver simulator (chatId "sim-<driverId>").
 * Update Telegram tidak boleh menyamar sebagai kanal simulator, dan sebaliknya.
 */
export async function handleTelegramUpdate(update: TgUpdate, via: "telegram" | "simulator" = "telegram") {
  const cb = update.callback_query;
  const msg = update.message ?? update.edited_message ?? cb?.message;
  if (!msg || msg.chat.type !== "private") return;
  const chatId = String(msg.chat.id);
  if (via === "telegram" ? !/^\d{1,20}$/.test(chatId) : !isSimChat(chatId)) return;

  // Undangan: /start <kode> — hanya dari Telegram asli.
  if (via === "telegram" && update.message?.text?.startsWith("/start")) {
    const code = update.message.text.split(/\s+/)[1]?.trim();
    if (code) return linkChat(chatId, code, update.message.from);
  }

  const c = await loadContext(chatId);
  if (!c) {
    if (cb) await ackCallback(chatId, cb.id).catch(() => {});
    if (!update.edited_message) await sendMessage(chatId, "Maaf, akun Telegram ini belum terhubung ke data sopir PT Arunika Trans Nusantara. Minta link undangan ke Fleet Manager.");
    return;
  }
  const ctx = { driverId: c.driver.id, tripId: c.trip?.id ?? null };

  // Lokasi (sekali kirim atau live). Update live datang sebagai edited_message — dicatat tanpa balasan.
  if (msg.location && !cb) {
    await saveLocation(c, msg.location.latitude, msg.location.longitude, msg.location.heading);
    if (update.message) {
      await log({ chatId, ...ctx, direction: "in", kind: "location", text: `${msg.location.latitude.toFixed(5)}, ${msg.location.longitude.toFixed(5)}${msg.location.live_period ? " (live)" : ""}` });
      await reply(chatId, ctx, msg.location.live_period
        ? "📍 Lokasi live diterima. Kantor bisa memantau posisi Bapak di Fleet Tracking. Terima kasih!"
        : `📍 Lokasi diterima.${c.trip ? "" : " (Belum ada trip aktif.)"} Supaya otomatis terkirim selama perjalanan, pakai 📎 → Lokasi → Bagikan Lokasi Live.`);
    }
    return;
  }
  if (update.edited_message) return;

  if (cb) return handleCallback(c, chatId, cb.id, cb.data ?? "");

  const m = update.message!;
  const menu = ["📋 Tugas saya", "/tugas", "✅ P2H", "/p2h", "❓ Bantuan", "/help", "/start"].includes((m.text ?? "").trim());
  const flow = getState(c);
  if (isP2HFlow(flow) && !menu) {
    if (!c.trip || c.trip.id !== flow.tripId || c.trip.status !== "Scheduled") await setState(c, {});
    else if (m.photo?.length) return handleP2HPhoto(c, chatId, m, flow);
    else if (m.text?.trim()) {
      await log({ chatId, ...ctx, direction: "in", kind: "text", text: m.text.trim() });
      return handleP2HInput(c, chatId, m.text.trim(), flow);
    }
  }
  if (m.photo?.length) return handlePhoto(c, chatId, m);
  if (m.voice || m.audio) {
    if ((m.voice?.duration ?? 0) > MAX_VOICE_SECONDS) return reply(chatId, ctx, `Voice note maksimal ${MAX_VOICE_SECONDS / 60} menit. Mohon dipersingkat atau ketik pesannya, Pak.`);
    return handleVoice(c, chatId, (m.voice ?? m.audio)!.file_id, m.voice?.mime_type ?? m.audio?.mime_type ?? "audio/ogg");
  }
  if (m.document) {
    await log({ chatId, ...ctx, direction: "in", kind: "text", text: `[file] ${m.document.file_name ?? ""}` });
    return reply(chatId, ctx, "Untuk foto dokumen, kirim sebagai Foto (bukan File) supaya bisa dibaca otomatis.");
  }
  const text = (m.text ?? "").trim();
  if (!text) return;
  await log({ chatId, ...ctx, direction: "in", kind: "text", text });
  if (text === "📋 Tugas saya" || text === "/tugas") return reply(chatId, ctx, tripText(c), { inline: await tripButtons(c) });
  if (text === "✅ P2H" || text === "/p2h") return startP2H(c, chatId);
  if (text === "❓ Bantuan" || text === "/help" || text === "/start") return reply(chatId, ctx, HELP, { keyboard: MAIN_KEYBOARD });
  return handleFreeText(c, chatId, text, "text");
}

async function linkChat(chatId: string, code: string, from?: TgUser) {
  const link = await prisma.chatChannelLink.findUnique({ where: { inviteCode: code }, include: { driver: true } });
  if (!link || link.channel !== "telegram" || !link.active || (link.chatId && link.chatId !== chatId) || link.inviteExpiresAt < nowIso()) {
    await sendMessage(chatId, "Link undangan tidak valid atau sudah kedaluwarsa. Minta link baru ke Fleet Manager.");
    return;
  }
  // Satu akun Telegram hanya untuk satu sopir; link lama sopir ini dinonaktifkan.
  await prisma.chatChannelLink.updateMany({ where: { channel: "telegram", chatId, NOT: { id: link.id } }, data: { chatId: null, active: false } });
  await prisma.chatChannelLink.updateMany({ where: { channel: "telegram", driverId: link.driverId, NOT: { id: link.id } }, data: { active: false } });
  await prisma.chatChannelLink.update({ where: { id: link.id }, data: {
    chatId, linkedAt: nowIso(), chatUsername: from?.username ?? null, chatName: [from?.first_name, from?.last_name].filter(Boolean).join(" ") || null,
  } });
  const first = link.driver.name.split(" ")[0];
  await sendMessage(chatId, `Halo Pak ${first}, akun Telegram Bapak sudah terhubung dengan PT Arunika Trans Nusantara (${link.driver.code}). 👋\n\n${HELP}`, { keyboard: MAIN_KEYBOARD });
  await log({ chatId, driverId: link.driverId, direction: "out", kind: "system", text: "Akun Telegram terhubung", sentBy: "Bot" });
}

async function saveLocation(c: NonNullable<Ctx>, lat: number, lng: number, heading?: number) {
  const at = nowIso();
  let speed: number | null = null;
  const t = c.trip;
  if (t?.lastLat != null && t.lastLng != null && t.lastPingAt) {
    const h = (Date.parse(at) - Date.parse(t.lastPingAt)) / 3_600_000;
    if (h > 0.005) speed = Math.round(haversineKm([t.lastLat, t.lastLng], [lat, lng]) / h);
  }
  await prisma.locationPing.create({ data: { tripId: t?.id ?? null, vehicleId: t?.vehicleId ?? null, driverId: c.driver.id, lat, lng, heading: heading ?? null, speedKmh: speed, at, source: "Telegram" } });
  if (t) await prisma.trip.update({ where: { id: t.id }, data: { lastLat: lat, lastLng: lng, lastPingAt: at, lastSpeedKmh: speed } });
}

async function handleCallback(c: NonNullable<Ctx>, chatId: string, cbId: string, data: string) {
  const ctx = { driverId: c.driver.id, tripId: c.trip?.id ?? null };
  const answer = (text?: string) => ackCallback(chatId, cbId, text).catch(() => {});
  const [kind, tripId, to] = data.split(":");
  if (kind === "task") { await answer(); return reply(chatId, ctx, tripText(c), { inline: await tripButtons(c) }); }
  if (!c.trip || c.trip.id !== tripId) { await answer("Trip ini sudah tidak aktif."); return; }
  // P2H: hanya sebelum berangkat. Tombol "semua OK" lama (p2hok) tidak dipakai lagi — P2H wajib per item.
  if (kind === "p2hok" || kind === "p2hstart" || kind === "pc" || kind === "pd") {
    if (c.trip.status !== "Scheduled") { await answer(); return reply(chatId, ctx, "Trip sudah berjalan, jadi P2H tidak diubah lagi.", { inline: await tripButtons(c) }); }
    if (kind === "p2hok" || kind === "p2hstart") {
      await answer();
      await log({ chatId, ...ctx, direction: "in", kind: "button", text: "📝 Isi P2H" });
      return startP2H(c, chatId);
    }
    const flow = getState(c);
    if (!isP2HFlow(flow) || flow.tripId !== c.trip.id) { await answer(); return reply(chatId, ctx, "Tombol ini sudah tidak berlaku. Tekan 📝 Isi P2H untuk mulai lagi.", { inline: await tripButtons(c) }); }
    if (kind === "pc") return handleP2HCheck(c, chatId, flow, to, answer);
    if (kind === "pd" && flow.awaiting === "p2h-detail") { await answer(); return nextP2HDetail(c, chatId, flow); }
    await answer();
    return;
  }
  if (kind === "st") {
    await log({ chatId, ...ctx, direction: "in", kind: "button", text: `Status → ${TRIP_STATUSES[to]?.label ?? to}` });
    try {
      const label = await applyTripStatus(c.trip.id, to, c.driver.name, "Telegram");
      await answer("Status dicatat");
      const fresh = (await loadContext(chatId))!;
      const done = to === "Completed";
      const extra = to === "ToLoad" ? "\nJangan lupa bagikan 📍 Lokasi Live (📎 → Lokasi) selama perjalanan." : to === "Unloading" ? "\nSetelah bongkar, kirim 📷 foto surat jalan bertanda tangan penerima." : "";
      return reply(chatId, ctx, `✔️ ${label} — tercatat ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}.${extra}${done ? "\nTerima kasih, trip selesai. Istirahat yang cukup, Pak." : ""}`, { inline: done ? [] : await tripButtons(fresh) });
    } catch (err) {
      await answer();
      return reply(chatId, ctx, `⚠️ ${err instanceof Error ? err.message : "Gagal mencatat status."}`, { inline: await tripButtons(c) });
    }
  }
  await answer();
}

async function setState(c: NonNullable<Ctx>, state: Record<string, unknown>) {
  await prisma.chatChannelLink.update({ where: { id: c.link.id }, data: { stateJson: JSON.stringify(state) } });
}
const parseState = (json: string | null | undefined) => { try { return JSON.parse(json || "{}") as { awaiting?: string; tripId?: string }; } catch { return {}; } };
const getState = (c: NonNullable<Ctx>) => parseState(c.link.stateJson);

/**
 * Ubah status alur P2H secara atomik (compare-and-swap pada stateJson). Sopir bisa menekan beberapa tombol
 * checklist dalam satu detik; webhook memprosesnya bersamaan, jadi baca-ubah-tulis biasa bisa menghilangkan tap.
 * `fn` menerima salinan status terbaru; kembalikan status baru, atau null untuk tidak mengubah apa-apa.
 * Hasil: { before, after } — after null bila alur sudah tidak aktif atau fn menolak.
 */
async function updateFlow(c: NonNullable<Ctx>, fn: (s: P2HFlowState) => P2HFlowState | Record<string, never> | null) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const row = await prisma.chatChannelLink.findUnique({ where: { id: c.link.id }, select: { stateJson: true } });
    const cur = parseState(row?.stateJson);
    if (!isP2HFlow(cur)) return { before: null, after: null };
    const next = fn(JSON.parse(JSON.stringify(cur)) as P2HFlowState);
    if (!next) return { before: cur, after: null };
    const res = await prisma.chatChannelLink.updateMany({ where: { id: c.link.id, stateJson: row!.stateJson }, data: { stateJson: JSON.stringify(next) } });
    if (res.count) return { before: cur, after: isP2HFlow(next) ? next : null, cleared: !isP2HFlow(next) };
    await new Promise(r => setTimeout(r, 30 + Math.random() * 120 * (attempt + 1))); // jeda acak sebelum coba lagi
  }
  throw new Error("Bot sedang sibuk, tekan lagi tombolnya.");
}

/**
 * Tap checklist: ubah satu item dalam SATU pernyataan SQL (Postgres mengunci baris), jadi banyak tap
 * yang datang bersamaan semuanya tercatat tanpa coba-ulang. Mengembalikan status sesudah tap, atau null
 * bila checklist ini sudah tidak aktif.
 */
async function toggleP2HMark(c: NonNullable<Ctx>, tripId: string, key: string): Promise<P2HFlowState | null> {
  const rows = await prisma.$queryRaw<{ stateJson: string }[]>`
    UPDATE "ChatChannelLink"
    SET "stateJson" = jsonb_set(
      "stateJson"::jsonb, ARRAY['marks', ${key}]::text[],
      to_jsonb(CASE WHEN ("stateJson"::jsonb -> 'marks' ->> ${key}) = 'ok' THEN 'fail' ELSE 'ok' END), true
    )::text
    WHERE "id" = ${c.link.id} AND ("stateJson"::jsonb ->> 'awaiting') = 'p2h-check' AND ("stateJson"::jsonb ->> 'tripId') = ${tripId}
    RETURNING "stateJson"`;
  const s = rows[0] ? parseState(rows[0].stateJson) : null;
  return s && isP2HFlow(s) ? s : null;
}

// ---------------------------------------------------------
// P2H rinci (lihat bot/p2hFlow.ts)
// ---------------------------------------------------------

const p2hSource = (chatId: string) => (isSimChat(chatId) ? "Simulator" : "Telegram");

/** Mulai (atau ulangi) checklist P2H. `prefill` = hasil AI dari voice/teks sopir (hanya ok/fail). */
async function startP2H(c: NonNullable<Ctx>, chatId: string, prefill: Record<string, "ok" | "fail"> = {}, aiNotes?: string) {
  const ctx = { driverId: c.driver.id, tripId: c.trip?.id ?? null };
  if (!c.trip) return reply(chatId, ctx, "Belum ada trip aktif, jadi P2H belum perlu diisi.");
  if (c.trip.status !== "Scheduled") return reply(chatId, ctx, "Trip sudah berjalan; P2H sudah lewat.");
  const prefilled = Object.keys(prefill).length > 0;
  const sent = await reply(chatId, ctx, checklistText(c.trip.vehicle.plateNo, prefilled), { inline: checklistButtons(c.trip.id, prefill) });
  const state: P2HFlowState = { awaiting: "p2h-check", tripId: c.trip.id, marks: prefill, details: {}, logId: sent.logId, msgId: sent.msgId, aiNotes };
  await setState(c, state);
}

async function handleP2HCheck(c: NonNullable<Ctx>, chatId: string, _flow: P2HFlowState, key: string, answer: (t?: string) => Promise<void>) {
  const ctx = { driverId: c.driver.id, tripId: _flow.tripId };
  if (key !== "done") {
    const it = p2hItem(key);
    if (!it) { await answer(); return; }
    const after = await toggleP2HMark(c, _flow.tripId, key);
    if (!after) { await answer("Checklist ini sudah dikirim."); return; }
    await editButtons(chatId, after, checklistButtons(after.tripId, after.marks));
    await answer(`${it.label}: ${after.marks[key] === "ok" ? "baik ✅" : "bermasalah ❌"}`);
    return;
  }
  await answer();
  // Selesai cek: hanya bila semua item sudah dicek; peralihan ke langkah berikut dilakukan sekali (klik ganda aman).
  let missing: ReturnType<typeof uncheckedItems> = [];
  const { before, after } = await updateFlow(c, s => {
    if (s.awaiting !== "p2h-check") return null;
    missing = uncheckedItems(s.marks);
    if (missing.length) return null;
    const fails = P2H_ITEMS.filter(i => s.marks[i.key] === "fail").map(i => i.key);
    return fails.length ? { ...s, awaiting: "p2h-detail", queue: fails.slice(1), current: fails[0] } : { ...s, awaiting: "p2h-odo" };
  });
  if (missing.length) return reply(chatId, ctx, `Masih ${missing.length} item belum dicek: ${missing.map(i => i.label).join(", ")}. Tekan tombolnya di checklist (⬜ → ✅ atau ❌).`);
  if (!after || !before) return;
  await log({ chatId, ...ctx, direction: "in", kind: "button", text: `P2H dicek: ${P2H_ITEMS.filter(i => after.marks[i.key] === "fail").map(i => `❌ ${i.label}`).join(", ") || "semua ✅"}` });
  await editButtons(chatId, after, []); // checklist dikunci
  if (after.awaiting === "p2h-detail") return reply(chatId, ctx, detailPrompt(after.current!, (after.queue?.length ?? 0) + 1), { inline: detailButtons(after.tripId) });
  return reply(chatId, ctx, `✅ Semua item baik.\n\n${odometerPrompt(c.trip!.vehicle.odometerKm)}`);
}

/** Tombol "Lanjut" di langkah keterangan: wajib ada keterangan atau foto untuk item ini. */
async function nextP2HDetail(c: NonNullable<Ctx>, chatId: string, _flow: P2HFlowState) {
  const ctx = { driverId: c.driver.id, tripId: _flow.tripId };
  let blocked: string | null = null;
  const { after } = await updateFlow(c, s => {
    if (s.awaiting !== "p2h-detail" || !s.current) return null;
    if (!hasDetail(s.details[s.current])) { blocked = s.current; return null; }
    const [next, ...rest] = s.queue ?? [];
    return next ? { ...s, queue: rest, current: next } : { ...s, awaiting: "p2h-odo", queue: [], current: undefined };
  });
  if (blocked) return reply(chatId, ctx, `Isi dulu keterangan atau foto untuk ${p2hItem(blocked)?.label ?? blocked}, lalu tekan ➡️ Lanjut.`, { inline: detailButtons(_flow.tripId) });
  if (!after) return;
  if (after.awaiting === "p2h-detail") return reply(chatId, ctx, detailPrompt(after.current!, (after.queue?.length ?? 0) + 1), { inline: detailButtons(after.tripId) });
  return reply(chatId, ctx, odometerPrompt(c.trip!.vehicle.odometerKm));
}

/** Tambah keterangan/foto ke item yang sedang ditanyakan. */
const addDetail = (s: P2HFlowState, note?: string, photo?: string): P2HFlowState | null => {
  if (s.awaiting !== "p2h-detail" || !s.current) return null;
  const d = { ...(s.details[s.current] ?? {}) };
  if (note) d.note = [d.note, note.slice(0, 300)].filter(Boolean).join("; ");
  if (photo) d.photos = [...(d.photos ?? []), photo].slice(0, 5);
  return { ...s, details: { ...s.details, [s.current]: d } };
};

/** Teks (atau hasil transkripsi voice) saat alur P2H berjalan. */
async function handleP2HInput(c: NonNullable<Ctx>, chatId: string, text: string, flow: P2HFlowState) {
  const ctx = { driverId: c.driver.id, tripId: flow.tripId };
  if (flow.awaiting === "p2h-detail" && flow.current) {
    const { after } = await updateFlow(c, s => addDetail(s, text));
    if (!after?.current) return;
    const d = after.details[after.current];
    return reply(chatId, ctx, `📝 Dicatat untuk ${p2hItem(after.current)?.label}: "${d?.note}".\nKirim 📷 foto juga bila ada, lalu tekan ➡️ Lanjut.`, { inline: detailButtons(flow.tripId) });
  }
  if (flow.awaiting === "p2h-odo") {
    const km = parseOdometer(text);
    if (km == null) return reply(chatId, ctx, "Ketik angka odometer saja, mis. 128450.");
    const problem = odometerProblem(km, c.trip!.vehicle.odometerKm);
    if (problem) return reply(chatId, ctx, problem);
    // Alur ditutup secara atomik dulu: dua pesan odometer bersamaan tidak menyimpan P2H dua kali.
    const { before, cleared } = await updateFlow(c, s => (s.awaiting === "p2h-odo" ? {} : null));
    if (!before || !cleared) return;
    return finishP2H(c, chatId, before as P2HFlowState, km);
  }
  // Langkah checklist: teks/voice bebas → AI mengisi saran, sopir mengecek sisanya.
  if (!isAiConfigured()) return reply(chatId, ctx, "Tekan tombol di checklist untuk setiap item (⬜ → ✅ / ❌).");
  if (!(await aiQuotaOk(c.driver.id))) return reply(chatId, ctx, "Batas pesan AI hari ini sudah tercapai. Isi checklist dengan tombol.");
  try {
    const { result, notes } = await parseP2HText(text);
    const cur = parseState((await prisma.chatChannelLink.findUnique({ where: { id: c.link.id }, select: { stateJson: true } }))?.stateJson);
    const base = isP2HFlow(cur) ? cur : flow;
    const marks = { ...base.marks };
    for (const [k, v] of Object.entries(result)) if (v === "ok" || v === "fail") marks[k] = v;
    await editButtons(chatId, base, []); // checklist lama dikunci; checklist baru dikirim di bawah
    return startP2H(c, chatId, marks, [base.aiNotes, notes].filter(Boolean).join("; ") || undefined);
  } catch (err) {
    console.error("[bot] p2h ai", err);
    return reply(chatId, ctx, "Pesan belum bisa dibaca otomatis. Isi checklist dengan tombol ya, Pak.");
  }
}

/** Foto saat alur P2H: menjadi bukti item bermasalah yang sedang ditanyakan. */
async function handleP2HPhoto(c: NonNullable<Ctx>, chatId: string, m: TgMessage, flow: P2HFlowState) {
  const ctx = { driverId: c.driver.id, tripId: flow.tripId };
  if (flow.awaiting !== "p2h-detail" || !flow.current) {
    return reply(chatId, ctx, flow.awaiting === "p2h-odo" ? "Ketik angka odometernya saja, Pak." : "Selesaikan checklist dulu (tekan 📤 Selesai cek). Foto diminta untuk item yang bermasalah.");
  }
  const photo = [...m.photo!].sort((a, b) => b.width * b.height - a.width * a.height).find(p => (p.file_size ?? 0) < 4_000_000) ?? m.photo![0];
  try {
    const fileUrl = photo.file_id.startsWith("url:") && isSimChat(chatId) ? photo.file_id.slice(4)
      : await (async () => { const { bytes } = await downloadFile(chatId, photo.file_id); return uploadToStorage(`logistics/p2h/${flow.tripId}`, new File([new Uint8Array(bytes)], `p2h-${Date.now()}.jpg`, { type: "image/jpeg" })); })();
    await log({ chatId, ...ctx, direction: "in", kind: "photo", text: m.caption ?? `Foto P2H: ${p2hItem(flow.current)?.label}`, fileUrl });
    const { after } = await updateFlow(c, s => addDetail(s, m.caption?.trim() || undefined, fileUrl));
    if (!after?.current) return;
    const d = after.details[after.current] ?? {};
    return reply(chatId, ctx, `📷 Foto ${p2hItem(after.current)?.label} diterima (${d.photos?.length ?? 0}).${d.note ? "" : " Tambahkan keterangan singkat (ketik/voice) bila bisa."} Tekan ➡️ Lanjut bila sudah.`, { inline: detailButtons(flow.tripId) });
  } catch (err) {
    console.error("[bot] p2h photo", err);
    return reply(chatId, ctx, "Foto gagal diterima. Coba kirim ulang, atau ketik keterangannya.", { inline: detailButtons(flow.tripId) });
  }
}

/** Simpan P2H + ringkasan ke sopir + notifikasi Fleet Manager. Status alur sudah ditutup oleh pemanggil. */
async function finishP2H(c: NonNullable<Ctx>, chatId: string, flow: P2HFlowState, odometerKm: number) {
  const ctx = { driverId: c.driver.id, tripId: flow.tripId };
  const result = Object.fromEntries(P2H_ITEMS.map(i => [i.key, flow.marks[i.key] ?? "unknown"])) as P2HResult;
  const res = await recordP2H(flow.tripId, result, flow.aiNotes ?? "", c.driver.name, p2hSource(chatId), { details: flow.details, odometerKm });
  if (res.status === "late") return reply(chatId, ctx, "Trip sudah berjalan, jadi P2H tidak diubah lagi. Laporkan masalah kendaraan dengan pesan biasa (mis. \"ban bocor\").");
  if (res.status === "incomplete") return startP2H(c, chatId, flow.marks);
  const list = `${summaryLines(flow.marks, flow.details)}\n🔢 Odometer ${odometerKm.toLocaleString("id-ID")} km`;
  const plate = c.trip!.vehicle.plateNo;
  const detailText = (keys: string[]) => keys.map(l => { const it = P2H_ITEMS.find(i => i.label === l); const d = it ? flow.details[it.key] : undefined; return `${l}${d?.note ? ` (${d.note})` : ""}`; }).join(", ");
  if (res.status === "failed") {
    await notifyPermission("logistics_fleet", [`P2H GAGAL ${plate} (${c.driver.name}): ${detailText(res.critical!)} — truk tidak boleh berangkat.`], `/modules/logistics/trips/${flow.tripId}`);
    return reply(chatId, ctx, `${list}\n\n⛔ Item kritis bermasalah (${res.critical!.join(", ")}). Truk TIDAK BOLEH berangkat. Fleet Manager sudah diberi tahu; tunggu arahan.`);
  }
  if (res.fails.length) await notifyPermission("logistics_fleet", [`P2H ${plate} (${c.driver.name}): item non-kritis bermasalah — ${detailText(res.fails)}. Perlu override Fleet sebelum berangkat.`], `/modules/logistics/trips/${flow.tripId}`);
  const fresh = (await loadContext(chatId))!;
  return reply(chatId, ctx, res.fails.length
    ? `${list}\n\n⚠️ Item non-kritis bermasalah (${res.fails.join(", ")}). Fleet Manager sudah diberi tahu; tunggu persetujuan (override) sebelum berangkat.`
    : `${list}\n\n✅ P2H lolos. ${fresh.trip?.events.length ? "Surat Jalan sudah diambil — silakan berangkat." : fresh.trip?.suratJalanNo ? "Langkah berikut: datang ke kantor, tanda tangan & ambil Surat Jalan. Setelah itu tekan 🚚 Berangkat." : "Tunggu Surat Jalan terbit, lalu ambil di kantor sebelum berangkat."}`, { inline: await tripButtons(fresh) });
}

async function handleFreeText(c: NonNullable<Ctx>, chatId: string, text: string, source: "text" | "voice") {
  const ctx = { driverId: c.driver.id, tripId: c.trip?.id ?? null };
  if (!isAiConfigured()) return reply(chatId, ctx, "Pesan diterima dan diteruskan ke dispatcher. Gunakan tombol menu untuk status trip.");
  if (!(await aiQuotaOk(c.driver.id))) return reply(chatId, ctx, "Batas pesan AI hari ini sudah tercapai. Pakai tombol menu, atau telepon kantor.");
  const state = getState(c);
  try {
    if (state.awaiting === "p2h") await setState(c, {}); // status lama (sebelum checklist rinci)
    const r = await interpretDriverText(text, aiContext(c));
    if (r.intent === "p2h" && c.trip?.status === "Scheduled") {
      const { result, notes } = await parseP2HText(text);
      const marks = Object.fromEntries(Object.entries(result).filter(([, v]) => v === "ok" || v === "fail")) as Record<string, "ok" | "fail">;
      return await startP2H(c, chatId, marks, notes || undefined);
    }
    await prisma.chatMessage.updateMany({ where: { chatId, direction: "in", at: { gte: new Date(Date.now() - 120_000).toISOString() }, aiJson: null }, data: { aiJson: JSON.stringify({ intent: r.intent, model: r.model }) } });
    if (r.intent === "problem") {
      const summary = r.problemSummary || text.slice(0, 200);
      await notifyPermission("logistics_dispatch", [`Laporan sopir ${c.driver.name}${c.trip ? ` (${c.trip.vehicle.plateNo})` : ""}: ${summary}`], "/modules/logistics/tracking");
      if (c.trip) await prisma.tripEvent.create({ data: { tripId: c.trip.id, status: "Report", label: `Laporan sopir: ${summary}`, at: nowIso(), lat: c.trip.lastLat, lng: c.trip.lastLng, source: "Telegram", by: c.driver.name } });
      return reply(chatId, ctx, `${r.reply}\n\n📨 Laporan sudah diteruskan ke dispatcher.`);
    }
    return reply(chatId, ctx, r.reply, r.intent === "status" && c.trip ? { inline: await tripButtons(c) } : {});
  } catch (err) {
    console.error("[bot] text", source, err);
    return reply(chatId, ctx, err instanceof AiError && err.status === 429 ? "AI sedang sibuk. Pakai tombol menu dulu ya, Pak." : "Maaf, pesan belum bisa diproses. Coba lagi atau pakai tombol menu.");
  }
}

async function handleVoice(c: NonNullable<Ctx>, chatId: string, fileId: string, mime: string) {
  const ctx = { driverId: c.driver.id, tripId: c.trip?.id ?? null };
  if (!isAiConfigured()) return reply(chatId, ctx, "Voice note belum bisa dibaca (AI belum aktif). Silakan ketik pesannya.");
  if (!(await aiQuotaOk(c.driver.id))) return reply(chatId, ctx, "Batas pesan AI hari ini sudah tercapai. Silakan ketik atau pakai tombol menu.");
  await chatAction(chatId).catch(() => {});
  try {
    const { bytes } = await downloadFile(chatId, fileId);
    const { text, model, via } = await aiTranscribeAudio(bytes.toString("base64"), mime.includes("ogg") || !mime ? "audio/ogg" : mime);
    await log({ chatId, ...ctx, direction: "in", kind: "voice", text: text || "(tidak ada ucapan)", aiJson: JSON.stringify({ model, via }) });
    if (!text) return reply(chatId, ctx, "Maaf, suaranya tidak terdengar jelas. Coba ulangi atau ketik pesannya.");
    await reply(chatId, ctx, `🎤 Saya dengar: "${text.slice(0, 500)}"`);
    const flow = getState(c);
    if (isP2HFlow(flow) && c.trip?.id === flow.tripId && c.trip.status === "Scheduled") return handleP2HInput(c, chatId, text, flow);
    return handleFreeText(c, chatId, text, "voice");
  } catch (err) {
    console.error("[bot] voice", err);
    await log({ chatId, ...ctx, direction: "in", kind: "voice", text: "(gagal ditranskripsi)" });
    return reply(chatId, ctx, "Maaf, voice note belum bisa dibaca. Silakan ketik pesannya, Pak.");
  }
}

async function handlePhoto(c: NonNullable<Ctx>, chatId: string, m: TgMessage) {
  const ctx = { driverId: c.driver.id, tripId: c.trip?.id ?? null };
  const photo = [...m.photo!].sort((a, b) => b.width * b.height - a.width * a.height).find(p => (p.file_size ?? 0) < 4_000_000) ?? m.photo![0];
  let fileUrl: string | null = null;
  try {
    const { bytes } = await downloadFile(chatId, photo.file_id);
    fileUrl = photo.file_id.startsWith("url:") ? photo.file_id.slice(4)
      : await uploadToStorage(`logistics/telegram/${c.driver.id}`, new File([new Uint8Array(bytes)], `tg-${Date.now()}.jpg`, { type: "image/jpeg" }));
    await log({ chatId, ...ctx, direction: "in", kind: "photo", text: m.caption ?? null, fileUrl });
    if (!isAiConfigured() || !(await aiQuotaOk(c.driver.id))) return reply(chatId, ctx, "📷 Foto diterima dan disimpan. Terima kasih, Pak.");
    await chatAction(chatId).catch(() => {});
    const dataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    const tripInfo = c.trip ? `${c.trip.vehicle.plateNo}, status ${TRIP_STATUSES[c.trip.status]?.label}, ${c.trip.route?.destination ?? ""}` : "no active trip";
    const a = await analyzeDriverPhoto(dataUrl, tripInfo + (m.caption ? `. Caption: ${m.caption}` : ""));
    await prisma.chatMessage.updateMany({ where: { chatId, fileUrl }, data: { aiJson: JSON.stringify(a) } });

    if (a.kind === "document") return handleDocumentPhoto(c, chatId, dataUrl, fileUrl);
    const f = a.fields;
    const label = { cargo: "Foto muatan", seal: "Foto segel", receipt: "Nota", pod: "Surat jalan bertanda tangan (ePOD)", damage: "Foto kerusakan", other: "Foto", document: "Dokumen" }[a.kind];
    const detail = [f.count ? `${f.count} ${f.unit ?? ""}`.trim() : "", f.sealNo ? `segel ${f.sealNo}` : "", f.receiptType ? `${f.receiptType}` : "", f.amount ? `Rp ${Math.round(f.amount).toLocaleString("id-ID")}` : "", f.liters ? `${f.liters} L` : "", f.receiverName ? `penerima ${f.receiverName}` : "", f.discrepancy ? `catatan: ${f.discrepancy}` : ""].filter(Boolean).join(", ");
    if (c.trip) await prisma.tripEvent.create({ data: { tripId: c.trip.id, status: "Photo", label: `${label}${detail ? `: ${detail}` : ""}`, at: nowIso(), lat: c.trip.lastLat, lng: c.trip.lastLng, note: fileUrl, source: "Telegram", by: c.driver.name } });
    if (a.kind === "damage" || (a.kind === "pod" && f.discrepancy)) {
      await notifyPermission("logistics_dispatch", [`${label} dari ${c.driver.name}${c.trip ? ` (${c.trip.vehicle.plateNo})` : ""}: ${a.summary}`], "/modules/logistics/tracking");
    }
    const tail = a.kind === "receipt" ? "\n(Nota disimpan untuk settlement uang jalan.)" : a.kind === "pod" ? "\nJangan lupa tekan tombol ✅ Selesai bongkar." : "";
    return reply(chatId, ctx, `📷 ${label} diterima. ${a.summary}${tail}`);
  } catch (err) {
    console.error("[bot] photo", err);
    return reply(chatId, ctx, fileUrl ? "📷 Foto disimpan, tapi belum bisa dibaca otomatis. Terima kasih, Pak." : "Maaf, foto gagal diterima. Coba kirim ulang.");
  }
}

/** Foto SIM/STNK/KIR/pajak dari sopir → draft dokumen, diverifikasi Fleet Manager (10.1). */
async function handleDocumentPhoto(c: NonNullable<Ctx>, chatId: string, dataUrl: string, fileUrl: string) {
  const ctx = { driverId: c.driver.id, tripId: c.trip?.id ?? null };
  const scan = await scanFleetDocument(dataUrl);
  const f = scan.fields;
  const base = { docNo: f.docNo ?? null, validFrom: f.validFrom ?? null, validUntil: f.validUntil ?? null, fileUrl, fileName: "foto-telegram.jpg", aiJson: JSON.stringify(scan), source: "Telegram", status: "Draft", notes: `Dikirim ${c.driver.name} lewat Telegram`, createdBy: c.driver.name, createdAt: nowIso() };
  if (DRIVER_DOC_TYPES[scan.detectedType]) {
    await prisma.driverDocument.create({ data: { ...base, driverId: c.driver.id, docType: scan.detectedType, simClass: f.simClass ?? null, holderName: f.holderName ?? null, issuer: f.issuer ?? null } });
    await notifyPermission("logistics_fleet", [`${DRIVER_DOC_TYPES[scan.detectedType].label} baru dari ${c.driver.name} (Telegram) menunggu verifikasi.`], `/modules/logistics/fleet/drivers/${c.driver.id}?tab=documents`);
    return reply(chatId, ctx, `📄 ${DRIVER_DOC_TYPES[scan.detectedType].label} diterima${f.validUntil ? `, berlaku s/d ${f.validUntil}` : ""}. Fleet Manager akan memeriksa dulu sebelum data Bapak diperbarui.`);
  }
  if (VEHICLE_DOC_TYPES[scan.detectedType] && c.trip) {
    await prisma.vehicleDocument.create({ data: { ...base, vehicleId: c.trip.vehicleId, docType: scan.detectedType, holderName: f.holderName ?? null, amount: f.amount ?? null, paidDate: f.paidDate ?? null } });
    await notifyPermission("logistics_fleet", [`${VEHICLE_DOC_TYPES[scan.detectedType].label} ${c.trip.vehicle.plateNo} dari ${c.driver.name} (Telegram) menunggu verifikasi.`], `/modules/logistics/fleet/vehicles/${c.trip.vehicleId}?tab=documents`);
    return reply(chatId, ctx, `📄 ${VEHICLE_DOC_TYPES[scan.detectedType].label} ${c.trip.vehicle.plateNo} diterima${f.validUntil ? `, berlaku s/d ${f.validUntil}` : ""}. Menunggu pemeriksaan Fleet Manager.`);
  }
  return reply(chatId, ctx, `📄 Dokumen terbaca sebagai "${scan.detectedLabel}". Sudah disimpan; Fleet Manager akan memeriksanya.`);
}

// ---------------------------------------------------------
// Dari kantor ke sopir
// ---------------------------------------------------------

/** Kirim pesan ke sopir lewat bot (pesan kantor, pengingat SIM, tugas baru). */
export async function sendToDriver(driverId: string, text: string, opts: { sentBy?: string; tripId?: string | null; inline?: InlineButton[][] } = {}) {
  const links = await prisma.chatChannelLink.findMany({ where: { driverId, active: true, chatId: { not: null } } });
  let sent = false;
  for (const link of links) {
    try {
      await sendMessage(link.chatId!, text, { inline: opts.inline });
      await log({ chatId: link.chatId!, driverId, tripId: opts.tripId ?? null, direction: "out", kind: "text", text, sentBy: opts.sentBy ?? "Bot", aiJson: opts.inline?.length ? JSON.stringify({ buttons: opts.inline }) : null });
      sent = true;
    } catch (err) {
      console.error("[bot] sendToDriver", err);
    }
  }
  return sent;
}
