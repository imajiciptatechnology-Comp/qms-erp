/**
 * Satu-satunya pintu ke penyedia AI. Semua provider yang dipakai (Gemini,
 * Meta Model API/Muse, OpenRouter, Groq) kompatibel dengan format OpenAI
 * Chat Completions, jadi ganti provider cukup lewat env, tanpa ubah kode:
 *   AI_BASE_URL         mis. https://generativelanguage.googleapis.com/v1beta/openai/
 *   AI_API_KEY          key dari provider (hanya di server)
 *   AI_MODEL            mis. gemini-3.8-flash
 *   AI_FALLBACK_MODELS  (opsional) model cadangan, dipisah koma
 *   AI_AGENT_MODEL      (opsional) model cepat untuk langkah tool calling assistant
 */

export type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type AiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  [extra: string]: unknown; // mis. thought signature Gemini — harus dikirim balik apa adanya
};

export type AiMessage =
  | { role: "system" | "user"; content: string | AiContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: AiToolCall[]; [extra: string]: unknown }
  | { role: "tool"; tool_call_id: string; content: string };

export type AiTool = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
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
  // Model cadangan dicoba berurutan kalau model utama sibuk (503), kena limit
  // (429) atau timeout — umum di tier gratis.
  const fallbacks = (env("AI_FALLBACK_MODELS") || "").split(",").map(m => m.trim()).filter(Boolean);
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, models: [model, ...fallbacks] };
}

export function isAiConfigured() {
  return Boolean(env("AI_BASE_URL") && env("AI_API_KEY") && env("AI_MODEL"));
}

type RequestOpts = {
  /** Batas waktu absolut (epoch ms) untuk seluruh percobaan. */
  deadline?: number;
  /** Batas waktu per percobaan model (kecuali model terakhir). */
  attemptMs?: number;
  /** Model yang dicoba lebih dulu, sebelum AI_MODEL & fallback. */
  preferModel?: string;
};

/**
 * Kirim satu request Chat Completions dengan fallback model.
 * Kembalikan `choices[0].message` mentah beserta model yang menjawab.
 */
async function requestWithFallback(
  body: Record<string, unknown>,
  { deadline = Date.now() + 55_000, attemptMs = 25_000, preferModel }: RequestOpts = {}
): Promise<{ message: Record<string, unknown>; model: string }> {
  const config = getConfig();
  const models = [...new Set([preferModel, ...config.models].filter((m): m is string => Boolean(m)))];
  let lastStatus: number | undefined;

  for (const [i, model] of models.entries()) {
    const remaining = deadline - Date.now();
    if (remaining < 4_000) break;
    // Model yang menggantung tidak boleh menghabiskan seluruh waktu.
    const isLast = i === models.length - 1;
    const timeout = isLast ? remaining : Math.min(remaining, attemptMs);

    let res: Response;
    try {
      res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model }),
        signal: AbortSignal.timeout(timeout),
      });
    } catch (err) {
      console.warn(`[ai] ${model} gagal/timeout, coba model berikutnya`, err);
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const message = data?.choices?.[0]?.message;
      const hasOutput = message && (message.content || (Array.isArray(message.tool_calls) && message.tool_calls.length));
      if (hasOutput) return { message, model };
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

/** Panggil model dan kembalikan teks jawabannya. */
export async function aiComplete(
  messages: AiMessage[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number } = {}
): Promise<{ text: string; model: string }> {
  const { message, model } = await requestWithFallback({
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2048,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  });
  const text = typeof message.content === "string" ? message.content : "";
  if (!text) throw new AiError("AI tidak mengembalikan jawaban.");
  return { text, model };
}

/**
 * Satu langkah agent: model boleh menjawab teks atau meminta tool. Pesan
 * assistant dikembalikan mentah supaya bisa ditambahkan lagi ke riwayat apa
 * adanya (Gemini mewajibkan thought signature ikut dikirim balik).
 */
export async function aiAgentStep(
  messages: AiMessage[],
  tools: AiTool[],
  opts: { deadline: number; toolChoice?: "auto" | "none"; maxTokens?: number }
): Promise<{ message: Extract<AiMessage, { role: "assistant" }>; model: string }> {
  const { message, model } = await requestWithFallback(
    {
      messages,
      tools,
      tool_choice: opts.toolChoice ?? "auto",
      temperature: 0.2,
      max_tokens: opts.maxTokens ?? 1500,
    },
    { deadline: opts.deadline, attemptMs: 20_000, preferModel: env("AI_AGENT_MODEL") }
  );
  return { message: { ...message, role: "assistant" } as Extract<AiMessage, { role: "assistant" }>, model };
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
