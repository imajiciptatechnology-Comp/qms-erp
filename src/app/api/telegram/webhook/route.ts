// Webhook bot Telegram sopir (rancangan 10.3). Balas 200 secepatnya; proses di after() supaya tidak kena batas waktu.
import { after } from "next/server";
import { isTelegramConfigured, verifyWebhookSecret } from "@/lib/telegram";
import { handleTelegramUpdate, type TgUpdate } from "@/app/modules/logistics/bot/telegramBot";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isTelegramConfigured()) return new Response("Telegram belum dikonfigurasi", { status: 404 });
  if (!verifyWebhookSecret(req.headers.get("x-telegram-bot-api-secret-token"))) return new Response("Forbidden", { status: 403 });
  let update: TgUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  after(async () => {
    try {
      await handleTelegramUpdate(update);
    } catch (err) {
      console.error("[telegram webhook]", err);
    }
  });
  return Response.json({ ok: true });
}
