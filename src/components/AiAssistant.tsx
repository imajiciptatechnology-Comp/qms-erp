"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquareText, X, Send, RotateCcw, ArrowRight, Download, FileSpreadsheet, Loader2, ExternalLink } from "lucide-react";
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

/**
 * Model kadang menulis tombol/link palsu ("[Download audit.csv]", "[NC-3400](/modules/…)").
 * Tombol asli sudah tampil sebagai kartu aksi, jadi buang yang palsu.
 */
function stripFakeLinks(content: string) {
  return content
    .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, "$1") // [teks](url) → teks
    .split("\n")
    .filter(line => !/^\s*\[(?:download|unduh|buka|open|lihat)[^\]]*\]\s*$/i.test(line)) // baris "[Download …]"
    .join("\n");
}

function MessageBody({ content: raw }: { content: string }) {
  const content = stripFakeLinks(raw);
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

/** Kartu aksi yang dilakukan assistant: netral seperti baris daftar ERP, ikon biru, label aksi di kanan. */
function ActionCard({ action }: { action: ChatAction }) {
  const base =
    "group flex items-center gap-2.5 w-full text-left text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
  const verb = "ml-auto shrink-0 text-[11px] font-semibold text-blue-700 group-hover:underline";
  if (action.kind === "navigate") {
    return (
      <Link href={action.path} className={base}>
        <ArrowRight className="w-3.5 h-3.5 shrink-0 text-blue-600" aria-hidden="true" />
        <span className="min-w-0 truncate"><span className="text-slate-500">Dibuka:</span> <span className="font-semibold">{action.label}</span></span>
        <span className={verb}>Lihat</span>
      </Link>
    );
  }
  if (action.kind === "download") {
    return (
      <a href={action.url} target="_blank" rel="noreferrer" className={base}>
        <Download className="w-3.5 h-3.5 shrink-0 text-blue-600" aria-hidden="true" />
        <span className="min-w-0 truncate font-semibold">{action.name}</span>
        <span className={`${verb} inline-flex items-center gap-1`}>Unduh <ExternalLink className="w-3 h-3" aria-hidden="true" /></span>
      </a>
    );
  }
  return (
    <button type="button" onClick={() => downloadCSV(action.rows, action.filename)} className={base}>
      <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-blue-600" aria-hidden="true" />
      <span className="min-w-0 truncate"><span className="font-semibold">{action.filename}.csv</span> <span className="text-slate-500">· {action.rows.length} baris</span></span>
      <span className={verb}>Unduh lagi</span>
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
          className="print:hidden fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 shadow-md shadow-slate-900/10 hover:border-blue-400 hover:text-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label="Open QMS Assistant"
        >
          <MessageSquareText className="w-[18px] h-[18px] text-blue-600" aria-hidden="true" /> Assistant
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="QMS Assistant"
          className="print:hidden fixed z-40 bottom-4 right-4 left-4 sm:left-auto sm:w-[400px] h-[min(600px,calc(100vh-2rem))] flex flex-col bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/15 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <MessageSquareText className="w-4 h-4 text-blue-600" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-800 leading-tight">QMS Assistant</p>
                <p className="text-xs text-slate-500 leading-tight truncate">Cari data, buka halaman, download &amp; export</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 text-slate-500">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setError(null); }}
                  disabled={loading}
                  className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="Percakapan baru"
                  title="Percakapan baru"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Tutup assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  Tanyakan data QMS, atau minta saya membuka halaman, menyiapkan file untuk diunduh, dan export daftar ke Excel.
                </p>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">Contoh perintah</p>
                  <ul className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                    {SUGGESTIONS.map(s => (
                      <li key={s}>
                        <button
                          onClick={() => send(s)}
                          className="group w-full flex items-center gap-2 text-left text-sm px-3 py-2.5 text-slate-700 hover:bg-blue-50/60 hover:text-blue-800 transition-colors focus-visible:outline-none focus-visible:bg-blue-50"
                        >
                          <span className="flex-1">{s}</span>
                          <ArrowRight className="w-3.5 h-3.5 shrink-0 text-slate-300 group-hover:text-blue-600" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap"
                      : `bg-white border rounded-bl-sm space-y-2 ${m.error ? "text-red-700 border-red-200" : "text-slate-800 border-slate-200"}`
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
                        <p className="flex items-center gap-1.5 text-xs text-slate-500" role="status">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyiapkan jawaban…
                        </p>
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
            className="border-t border-slate-200 px-3 pt-3 pb-2 bg-white"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Tulis pertanyaan atau perintah…"
                aria-label="Pesan"
                className="flex-1 resize-none max-h-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="shrink-0 p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label="Kirim"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">Jawaban dibuat oleh AI dari data ERP. Periksa kembali data penting.</p>
          </form>
        </div>
      )}
    </>
  );
}
