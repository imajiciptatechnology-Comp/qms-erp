/**
 * Klien Telegram Bot API (gratis). Aktif hanya bila env diisi:
 *   TELEGRAM_BOT_TOKEN       token dari @BotFather (hanya di server/Vercel)
 *   TELEGRAM_WEBHOOK_SECRET  teks acak; dikirim Telegram di header X-Telegram-Bot-Api-Secret-Token
 *   TELEGRAM_API_BASE        (opsional) untuk uji lokal dengan server tiruan
 * Tanpa env, semua fitur Telegram nonaktif dan aplikasi tetap jalan.
 */
import crypto from "crypto";

const env = (name: string) => process.env[name]?.replace(/^﻿/, "").trim() || "";

export const isTelegramConfigured = () => Boolean(env("TELEGRAM_BOT_TOKEN") && env("TELEGRAM_WEBHOOK_SECRET"));

const base = () => (env("TELEGRAM_API_BASE") || "https://api.telegram.org").replace(/\/+$/, "");

export class TelegramError extends Error {}

export async function tg<T = unknown>(method: string, body?: Record<string, unknown>): Promise<T> {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) throw new TelegramError("Bot Telegram belum dikonfigurasi (TELEGRAM_BOT_TOKEN).");
  const res = await fetch(`${base()}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!data?.ok) throw new TelegramError(`Telegram ${method} gagal: ${data?.description ?? res.status}`);
  return data.result as T;
}

/** Bandingkan secret webhook tanpa membocorkan waktu. */
export function verifyWebhookSecret(header: string | null) {
  const secret = env("TELEGRAM_WEBHOOK_SECRET");
  if (!secret || !header) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const webhookSecret = () => env("TELEGRAM_WEBHOOK_SECRET");

let botUsername: string | null = null;
export async function getBotUsername() {
  if (botUsername) return botUsername;
  const me = await tg<{ username: string }>("getMe");
  botUsername = me.username;
  return botUsername;
}

export type InlineButton = { text: string; callback_data?: string; url?: string };

export async function sendMessage(chatId: string, text: string, opts: { inline?: InlineButton[][]; keyboard?: unknown; html?: boolean } = {}) {
  return tg<{ message_id: number }>("sendMessage", {
    chat_id: chatId, text: text.slice(0, 4000), ...(opts.html ? { parse_mode: "HTML" } : {}),
    ...(opts.inline ? { reply_markup: { inline_keyboard: opts.inline } } : opts.keyboard ? { reply_markup: opts.keyboard } : {}),
  });
}

/** Unduh file (foto/voice) dari Telegram. Batas Bot API: 20 MB. */
export async function downloadFile(fileId: string): Promise<{ bytes: Buffer; path: string }> {
  const file = await tg<{ file_path: string; file_size?: number }>("getFile", { file_id: fileId });
  if (file.file_size && file.file_size > 8 * 1024 * 1024) throw new TelegramError("File terlalu besar.");
  const res = await fetch(`${base()}/file/bot${env("TELEGRAM_BOT_TOKEN")}/${file.file_path}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new TelegramError(`Gagal mengunduh file (${res.status}).`);
  return { bytes: Buffer.from(await res.arrayBuffer()), path: file.file_path };
}
