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

function getConfig() {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new AiError("AI belum dikonfigurasi. Set AI_BASE_URL, AI_API_KEY, dan AI_MODEL di environment.");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model };
}

export function isAiConfigured() {
  return Boolean(process.env.AI_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL);
}

/** Panggil model dan kembalikan teks jawabannya. Retry sekali untuk 429/5xx. */
export async function aiComplete(
  messages: AiMessage[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number } = {}
): Promise<{ text: string; model: string }> {
  const { baseUrl, apiKey, model } = getConfig();

  const body = JSON.stringify({
    model,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2048,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(50_000),
    });

    if (res.ok) {
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? "";
      if (!text) throw new AiError("AI tidak mengembalikan jawaban.");
      return { text, model };
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt === 0) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    const detail = (await res.text()).slice(0, 300);
    if (res.status === 429) throw new AiError("Kuota AI sedang habis/terbatas. Coba lagi beberapa saat lagi.", 429);
    throw new AiError(`Permintaan AI gagal (${res.status}): ${detail}`, res.status);
  }
  throw new AiError("Permintaan AI gagal.");
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
