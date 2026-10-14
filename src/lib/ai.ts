/**
 * Satu-satunya pintu ke penyedia AI. Semua provider yang dipakai (Gemini,
 * Meta Model API/Muse, OpenRouter, Groq) kompatibel dengan format OpenAI
 * Chat Completions, jadi ganti provider cukup lewat env, tanpa ubah kode:
 *   AI_BASE_URL  mis. https://generativelanguage.googleapis.com/v1beta/openai/
 *   AI_API_KEY   key dari provider (hanya di server)
 *   AI_MODEL     mis. gemini-3.8-flash
 */

export type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string | AiContentPart[];
};

export class AiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

// Buang spasi & BOM yang kadang ikut tertempel saat mengisi env.
const env = (name: string) => process.env[name]?.replace(/^﻿/, "").trim();

function getConfig() {
  const baseUrl = env("AI_BASE_URL");
  const apiKey = env("AI_API_KEY");
  const model = env("AI_MODEL");
  if (!baseUrl || !apiKey || !model) {
    throw new AiError("AI belum dikonfigurasi. Set AI_BASE_URL, AI_API_KEY, dan AI_MODEL di environment.");
  }
  // AI_FALLBACK_MODELS (opsional, dipisah koma): dicoba berurutan kalau model
  // utama sedang sibuk (503) atau kena limit (429) — umum di tier gratis.
  const fallbacks = (env("AI_FALLBACK_MODELS") || "").split(",").map(m => m.trim()).filter(Boolean);
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, models: [model, ...fallbacks] };
}

export function isAiConfigured() {
  return Boolean(env("AI_BASE_URL") && env("AI_API_KEY") && env("AI_MODEL"));
}

/**
 * Panggil model dan kembalikan teks jawabannya. Kalau model sedang sibuk,
 * kena limit, atau timeout, otomatis pindah ke model fallback berikutnya.
 */
export async function aiComplete(
  messages: AiMessage[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number } = {}
): Promise<{ text: string; model: string }> {
  const { baseUrl, apiKey, models } = getConfig();
  const deadline = Date.now() + 55_000; // di bawah maxDuration 60 detik
  let lastStatus: number | undefined;

  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < 5_000) break;

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxTokens ?? 2048,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(remaining),
      });
    } catch (err) {
      console.warn(`[ai] ${model} gagal/timeout, coba model berikutnya`, err);
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? "";
      if (text) return { text, model };
      console.warn(`[ai] ${model} mengembalikan jawaban kosong`);
      continue;
    }

    lastStatus = res.status;
    const detail = (await res.text()).slice(0, 300);
    if (res.status === 429 || res.status >= 500) {
      console.warn(`[ai] ${model} → ${res.status}, coba model berikutnya: ${detail}`);
      continue;
    }
    throw new AiError(`Permintaan AI gagal (${res.status}): ${detail}`, res.status);
  }

  if (lastStatus === 429) throw new AiError("Kuota AI gratis sedang habis/terbatas. Coba lagi beberapa saat lagi.", 429);
  throw new AiError("Model AI sedang sibuk. Coba lagi beberapa saat lagi.", lastStatus);
}

/** Ambil objek JSON dari jawaban model (toleran terhadap ```json fence```). */
export function parseAiJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new AiError("Format jawaban AI tidak valid.");
  }
}
