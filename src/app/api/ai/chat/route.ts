import { NextResponse } from "next/server";
import { getCurrentUser, getRolesConfig, type CurrentUser } from "@/app/actions/auth";
import { aiAgentStep, AiError, isAiConfigured, type AiMessage } from "@/lib/ai";
import { getJson, setJson } from "@/lib/kvStore";
import { AGENT_TOOLS, runTool, toolStatus, type AgentEvent, type ToolContext } from "@/app/ai-agent/tools";
import { AGENT_MODULES, AGENT_PAGES } from "@/app/ai-agent/modules";

export const maxDuration = 60;

const DAILY_LIMIT = 40; // pertanyaan per user per hari (hemat kuota tier gratis)
const MAX_HISTORY = 10;
const MAX_CHARS = 2000;
const MAX_STEPS = 5; // panggilan model per pertanyaan
const TIME_BUDGET_MS = 52_000; // di bawah maxDuration

function systemPrompt(user: CurrentUser, page: string, modules: string[]) {
  return `You are "QMS Assistant", an AI assistant inside a QMS ERP (ISO 9001) used by an Indonesian manufacturing company.
You can look up data AND act in the app through tools: search records, open pages or records on the user's screen, offer file downloads, and export lists to CSV.

Rules:
- Get facts ONLY from tools. Never invent records, numbers, names, dates or files. If a tool finds nothing, say so.
- When the user asks to open/show a page or record, call open_page / open_record. To download a file, call download_file. To export a list, call export_records. Do not just describe how to do it.
- Only call open_*, download_file or export_records when the user asks for that action. A request to list or show data ("daftar", "tampilkan", "apa saja") needs search_records only.
- Always answer the actual question in full after using tools (e.g. list every record found with its key fields), not just a note.
- If a lookup returns several candidates, ask the user which one (list their refs) instead of guessing.
- Use as few tool calls as possible; prefer one search with a good filter. Compare dates with today (${new Date().toISOString().split("T")[0]}) for overdue/due soon.
- You cannot create, edit, approve or delete data. If asked, explain which page to use and offer to open it.
- You may give ISO 9001 guidance (cite clauses).
- Reply in the user's language (Bahasa Indonesia or English). Be concise: short paragraphs, **bold** key items, "- " bullets. Mention record refs (e.g. NC-3400). After an action, confirm it in one short sentence.

User: ${user.name} (${user.role}, ${user.department}). Current page: ${page}.
Modules this user may access: ${modules.join(", ") || "none"}.`;
}

type IncomingMessage = { role: "user" | "assistant"; content: string };

/** "buka NC-3400" → langsung buka tanpa memanggil AI (instan & tanpa kuota). */
async function tryFastOpen(text: string, ctx: ToolContext): Promise<boolean> {
  const m = text.trim().match(/^(?:tolong\s+)?(?:buka|bukakan|open|lihat)\s+([A-Za-z]{2,}[-/][\w\-/.]+)\s*$/i);
  if (!m) return false;
  const ref = m[1];
  for (const mod of Object.values(AGENT_MODULES)) {
    if (!mod.detailPath || mod.refField === "id" || !ctx.canAccess(mod.perm)) continue;
    const row = await mod.table().findFirst({ where: { [mod.refField]: { equals: ref, mode: "insensitive" } }, select: { id: true, [mod.refField]: true } });
    if (row) {
      const label = String(row[mod.refField]);
      ctx.emit({ t: "navigate", path: mod.detailPath(row.id), label });
      ctx.emit({ t: "text", text: `Membuka **${label}** (${mod.label}).` });
      ctx.emit({ t: "done" });
      return true;
    }
  }
  return false;
}

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

  const usageKey = `ai_chat_usage:${user.id}:${new Date().toISOString().split("T")[0]}`;
  const used = await getJson<number>(usageKey, 0);

  // Hak akses modul mengikuti rolesConfig, sama seperti menu Sidebar.
  const rolesConfig = await getRolesConfig();
  const role = rolesConfig.find((r: any) => r.name === user.role);
  const canAccess = (perm?: string) => {
    if (!perm) return true;
    if (!role) return false;
    return role.permissions.includes("all") || role.permissions.includes(perm);
  };
  const page = typeof body.page === "string" ? body.page.slice(0, 100) : "/";
  // Tab yang dibuka sebelum deploy masih memakai widget lama yang membaca
  // jawaban sebagai teks biasa. Widget baru mengirim header ini.
  const eventsProtocol = req.headers.get("x-chat-protocol") === "events";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let acted = false;
      const emit = (e: AgentEvent) => {
        if (e.t === "navigate" || e.t === "download" || e.t === "export") acted = true;
        if (eventsProtocol) {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } else if (e.t === "text" || e.t === "error") {
          controller.enqueue(encoder.encode((e.t === "text" ? e.text : e.message) + "\n"));
        }
      };
      const ctx: ToolContext = { user, canAccess, emit };

      try {
        if (await tryFastOpen(history[history.length - 1].content, ctx)) return;

        if (used >= DAILY_LIMIT) {
          emit({ t: "error", message: `Batas ${DAILY_LIMIT} pertanyaan AI per hari sudah tercapai. Coba lagi besok.` });
          return;
        }

        const accessible = Object.entries(AGENT_PAGES).filter(([, p]) => canAccess(p.perm)).map(([id]) => id);
        const messages: AiMessage[] = [{ role: "system", content: systemPrompt(user, page, accessible) }, ...history];
        const deadline = Date.now() + TIME_BUDGET_MS;
        let counted = false;
        let model: string | undefined;

        for (let step = 0; step < MAX_STEPS; step++) {
          const remaining = deadline - Date.now();
          if (remaining < 6_000) break;
          // Langkah terakhir / waktu tipis: paksa model langsung menjawab.
          const mustAnswer = step === MAX_STEPS - 1 || remaining < 15_000;

          const res = await aiAgentStep(messages, AGENT_TOOLS, { deadline, toolChoice: mustAnswer ? "none" : "auto" });
          model = res.model;
          if (!counted) {
            await setJson(usageKey, used + 1);
            counted = true;
          }

          const calls = mustAnswer ? [] : res.message.tool_calls ?? [];
          if (calls.length === 0) {
            const text = typeof res.message.content === "string" ? res.message.content.trim() : "";
            emit({ t: "text", text: text || (acted ? "Selesai." : "Maaf, AI tidak memberikan jawaban. Coba ulangi pertanyaannya.") });
            emit({ t: "done", model });
            return;
          }

          messages.push(res.message);
          for (const call of calls) {
            let args: Record<string, any> = {};
            try {
              args = JSON.parse(call.function.arguments || "{}");
            } catch {
              // argumen rusak: biarkan kosong, tool akan mengembalikan error
            }
            emit({ t: "status", text: toolStatus(call.function.name, args) });
            let result: unknown;
            try {
              result = await runTool(call.function.name, args, ctx);
            } catch (err) {
              console.error("[ai-chat] tool", call.function.name, err);
              result = { error: "Tool gagal dijalankan." };
            }
            messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 12_000) });
          }
        }

        // Waktu/langkah habis sebelum model sempat menjawab.
        emit(acted
          ? { t: "text", text: "Selesai." }
          : { t: "error", message: "AI terlalu lama menjawab. Coba pertanyaan yang lebih spesifik atau ulangi sebentar lagi." });
        emit({ t: "done", model });
      } catch (err) {
        console.error("[ai-chat]", err);
        emit({ t: "error", message: err instanceof AiError ? err.message : "Gagal menghubungi AI." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": eventsProtocol ? "application/x-ndjson; charset=utf-8" : "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
