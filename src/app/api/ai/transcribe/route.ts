import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/actions/auth";
import { AiError, aiComplete, isAiConfigured } from "@/lib/ai";
import { getJson, setJson } from "@/lib/kvStore";

export const maxDuration = 60;

const DAILY_LIMIT = 60; // rekaman per user per hari (cadangan saat Web Speech browser tidak tersedia)
const MAX_BYTES = 3 * 1024 * 1024; // ±90 detik WAV mono 16 kHz

/** POST multipart "audio" (WAV) → { text } — dipakai tombol mikrofon jika browser tidak punya Web Speech. */
export async function POST(req: Request) {
  // /api tidak dilindungi middleware, jadi cek login di sini.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ error: "AI belum dikonfigurasi." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "Rekaman kosong." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "Rekaman terlalu panjang (maks. ±90 detik)." }, { status: 413 });

  const usageKey = `ai_transcribe_usage:${user.id}:${new Date().toISOString().split("T")[0]}`;
  const used = await getJson<number>(usageKey, 0);
  if (used >= DAILY_LIMIT) return NextResponse.json({ error: `Batas ${DAILY_LIMIT} rekaman suara per hari sudah tercapai.` }, { status: 429 });

  try {
    const data = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const { text } = await aiComplete([
      { role: "system", content: "Kamu mentranskripsikan rekaman suara pengguna ERP (Bahasa Indonesia, kadang bercampur istilah Inggris/teknis seperti nama alat laboratorium). Tulis persis apa yang diucapkan dengan ejaan dan tanda baca yang wajar. Jangan menjawab, menerjemahkan, atau menambah apa pun. Jika tidak ada ucapan yang jelas, jawab dengan string kosong." },
      { role: "user", content: [
        { type: "text", text: "Transkripsikan rekaman ini." },
        { type: "input_audio", input_audio: { data, format: "wav" } },
      ] },
    ], { maxTokens: 600, temperature: 0, deadline: Date.now() + 50_000 });
    await setJson(usageKey, used + 1);
    return NextResponse.json({ text: text.trim().replace(/^["“]|["”]$/g, "") });
  } catch (err) {
    console.error("[ai-transcribe]", err);
    // aiComplete melempar error jika jawaban kosong — anggap tidak ada ucapan.
    if (err instanceof AiError && err.message.includes("tidak mengembalikan")) return NextResponse.json({ text: "" });
    return NextResponse.json({ error: err instanceof AiError ? err.message : "Gagal mengubah suara menjadi teks." }, { status: 502 });
  }
}
