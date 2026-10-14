import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/actions/auth";
import { getAssistantContext } from "@/app/ai-context";
import { aiStream, AiError, isAiConfigured, type AiMessage } from "@/lib/ai";
import { getJson, setJson } from "@/lib/kvStore";

export const maxDuration = 60;

const DAILY_LIMIT = 40; // pesan per user per hari (hemat kuota tier gratis)
const MAX_HISTORY = 10;
const MAX_CHARS = 2000;

const SYSTEM_PROMPT = `You are "QMS Assistant", the AI assistant inside a QMS ERP system (ISO 9001) used by an Indonesian manufacturing company.
You help users understand their quality data: non-conformances (NC/NCR), customer complaints, calibration, risks, training, audits, documents, suppliers, HSE incidents, MOC, production work orders, maintenance and welders.

Rules:
- Answer ONLY from the ERP data snapshot provided below. Never invent records, numbers, names or dates. If the data does not contain the answer, say so plainly.
- Quote record numbers (e.g. NC-1234, risk numbers, serial numbers) so users can find them. Compare dates against "today" to decide what is overdue or due soon.
- You are read-only: you cannot create, edit or delete data. If asked to, explain which module/menu the user should use instead.
- You may give ISO 9001 guidance (cite clauses) and practical quality-management advice.
- Reply in the same language the user writes in (Bahasa Indonesia or English).
- Be concise. Use short paragraphs, **bold** for key items and "- " bullet lists. No tables, no headings.`;

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  // /api tidak dilindungi middleware, jadi cek login di sini.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ error: "AI belum dikonfigurasi." }, { status: 503 });

  let body: { messages?: IncomingMessage[]; page?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request tidak valid." }, { status: 400 });
  }

  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Pesan kosong." }, { status: 400 });
  }

  // Batas pemakaian harian per user.
  const usageKey = `ai_chat_usage:${user.id}:${new Date().toISOString().split("T")[0]}`;
  const used = await getJson<number>(usageKey, 0);
  if (used >= DAILY_LIMIT) {
    return NextResponse.json({ error: `Batas ${DAILY_LIMIT} pesan AI per hari sudah tercapai. Coba lagi besok.` }, { status: 429 });
  }

  try {
    const context = await getAssistantContext();
    const page = typeof body.page === "string" ? body.page.slice(0, 100) : "/";
    const messages: AiMessage[] = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\nCurrent user: ${user.name} (${user.role}, ${user.department}). They are viewing page: ${page}.\n\nERP data snapshot (JSON):\n${JSON.stringify(context)}`,
      },
      ...history,
    ];

    const { stream, model } = await aiStream(messages);
    await setJson(usageKey, used + 1);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-AI-Model": model,
      },
    });
  } catch (err) {
    console.error("[ai-chat]", err);
    const message = err instanceof AiError ? err.message : "Gagal menghubungi AI.";
    return NextResponse.json({ error: message }, { status: err instanceof AiError && err.status === 429 ? 429 : 502 });
  }
}
