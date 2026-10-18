"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, X, Send, RotateCcw, ArrowRight, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadCSV } from "@/lib/exportUtils";

type ChatAction =
  | { kind: "navigate"; path: string; label: string }
  | { kind: "download"; name: string; url: string }
  | { kind: "export"; filename: string; rows: Record<string, unknown>[] };

type ChatMessage = { role: "user" | "assistant"; content: string; actions?: ChatAction[]; status?: string; error?: boolean };

/** Event NDJSON dari /api/ai/chat (lihat AgentEvent di src/app/ai-agent/tools.ts). */
type ServerEvent =
  | { t: "status"; text: string }
  | { t: "text"; text: string }
  | { t: "navigate"; path: string; label: string }
  | { t: "download"; name: string; url: string }
  | { t: "export"; filename: string; rows: Record<string, unknown>[] }
  | { t: "error"; message: string }
  | { t: "done"; model?: string };

const SUGGESTIONS = [
  "Ringkas kondisi QMS hari ini",
  "Tampilkan NC yang overdue lalu buka yang paling lama",
  "Download sertifikat kalibrasi terbaru Digital Caliper",
  "Export risiko yang masih open ke Excel",
];

/** Ringkasan aksi yang ikut dikirim di riwayat, supaya AI tahu apa yang sudah dilakukan. */
function describeActions(actions: ChatAction[] = []) {
  if (!actions.length) return "";
  const parts = actions.map(a =>
    a.kind === "navigate" ? `membuka ${a.label}` : a.kind === "download" ? `menawarkan download ${a.name}` : `export ${a.filename}.csv (${a.rows.length} baris)`
  );
  return `\n(Aksi: ${parts.join("; ")})`;
}

/** Render markdown sederhana (**bold**, *italic*, `kode` dan daftar "- ") tanpa innerHTML. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={i} className="text-[0.85em] px-1 rounded bg-slate-100">{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function MessageBody({ content }: { content: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-0.5">
          {list.map((li, i) => <li key={i}>{renderInline(li)}</li>)}
        </ul>
      );
      list = [];
    }
  };
  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) { list.push(bullet[1]); continue; }
    flush();
    if (line.trim()) blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line.replace(/^#+\s*/, ""))}</p>);
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

function ActionCard({ action }: { action: ChatAction }) {
  const base = "flex items-center gap-2 w-full text-left text-xs font-medium px-2.5 py-2 rounded-lg border transition-colors";
  if (action.kind === "navigate") {
    return (
      <Link href={action.path} className={`${base} border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100`}>
        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">Dibuka: {action.label}</span>
      </Link>
    );
  }
  if (action.kind === "download") {
    return (
      <a href={action.url} target="_blank" rel="noreferrer" className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}>
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{action.name}</span>
      </a>
    );
  }
  return (
    <button type="button" onClick={() => downloadCSV(action.rows, action.filename)}
      className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}>
      <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{action.filename}.csv · {action.rows.length} baris</span>
    </button>
  );
}

export default function AiAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);
    setInput("");
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    const reply: ChatMessage = { role: "assistant", content: "", actions: [] };
    const render = () => setMessages([...history, { ...reply, actions: [...(reply.actions ?? [])] }]);
    render();
    setLoading(true);

    const handle = (e: ServerEvent) => {
      switch (e.t) {
        case "status": reply.status = e.text; break;
        case "text": reply.content += (reply.content ? "\n" : "") + e.text; reply.status = undefined; break;
        case "navigate":
          reply.actions!.push({ kind: "navigate", path: e.path, label: e.label });
          router.push(e.path);
          break;
        case "download": reply.actions!.push({ kind: "download", name: e.name, url: e.url }); break;
        case "export":
          reply.actions!.push({ kind: "export", filename: e.filename, rows: e.rows });
          downloadCSV(e.rows, e.filename);
          break;
        case "error": reply.content += (reply.content ? "\n" : "") + e.message; reply.error = true; reply.status = undefined; break;
        case "done": reply.status = undefined; break;
      }
      render();
    };

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Chat-Protocol": "events" },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content + describeActions(m.actions) })),
          page: pathname,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Gagal menghubungi AI.");
      }

      // Respons berupa NDJSON: satu event JSON per baris.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try { handle(JSON.parse(line)); } catch { /* baris rusak: abaikan */ }
        }
      }
      if (!reply.content.trim() && !reply.actions?.length) throw new Error("AI tidak memberikan jawaban. Coba lagi.");
    } catch (err) {
      setMessages(history); // buang bubble kosong
      setError(err instanceof Error ? err.message : "Gagal menghubungi AI.");
    } finally {
      reply.status = undefined;
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="print:hidden fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-violet-600 text-white text-sm font-semibold shadow-lg shadow-violet-900/20 hover:bg-violet-700 transition-colors"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="w-5 h-5" /> Ask AI
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="QMS Assistant"
          className="print:hidden fixed z-40 bottom-4 right-4 left-4 sm:left-auto sm:w-[400px] h-[min(600px,calc(100vh-2rem))] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/20 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-violet-600 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <div>
                <p className="font-bold text-sm leading-tight">QMS Assistant</p>
                <p className="text-[11px] text-violet-100 leading-tight">Cari data, buka halaman, download & export</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setError(null); }}
                  disabled={loading}
                  className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50"
                  aria-label="New conversation"
                  title="New conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/15" aria-label="Close assistant">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Halo! Saya bisa mencari data QMS, membuka halaman atau record, menyiapkan file untuk di-download, dan export daftar ke Excel. Contoh:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-sm px-3 py-2 rounded-lg border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-violet-600 text-white rounded-br-md whitespace-pre-wrap"
                      : `bg-white border rounded-bl-md space-y-2 ${m.error ? "text-red-700 border-red-200" : "text-slate-800 border-slate-200"}`
                  }`}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : (
                    <>
                      {m.actions && m.actions.length > 0 && (
                        <div className="space-y-1.5">
                          {m.actions.map((a, j) => <ActionCard key={j} action={a} />)}
                        </div>
                      )}
                      {m.content && <MessageBody content={m.content} />}
                      {m.status && (
                        <p className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {m.status}
                        </p>
                      )}
                      {!m.content && !m.status && !m.actions?.length && (
                        <span className="inline-flex gap-1 py-1" aria-label="AI is typing">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          </div>

          <form
            onSubmit={e => { e.preventDefault(); send(input); }}
            className="border-t border-slate-100 p-3 flex items-end gap-2 bg-white"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Tulis pertanyaan…"
              aria-label="Message"
              className="flex-1 resize-none max-h-32 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 p-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
