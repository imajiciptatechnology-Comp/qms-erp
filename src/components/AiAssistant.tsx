"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X, Send, RotateCcw } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "NC mana saja yang sudah overdue?",
  "Ringkas kondisi QMS hari ini",
  "Alat apa yang kalibrasinya jatuh tempo?",
  "Risiko level High apa saja yang masih open?",
];

/** Render markdown sederhana (**bold** dan daftar "- ") tanpa innerHTML. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
  );
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

export default function AiAssistant() {
  const pathname = usePathname();
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
    setMessages([...history, { role: "assistant", content: "" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, page: pathname }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Gagal menghubungi AI.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: answer }]);
      }
      if (!answer.trim()) throw new Error("AI tidak memberikan jawaban. Coba lagi.");
    } catch (err) {
      setMessages(history); // buang bubble kosong
      setError(err instanceof Error ? err.message : "Gagal menghubungi AI.");
    } finally {
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
                <p className="text-[11px] text-violet-100 leading-tight">Answers from your ERP data · read-only</p>
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
                  Halo! Tanyakan apa saja tentang data QMS: NC, complaint, kalibrasi, risiko, training, audit, dan lainnya.
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
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-md"
                  }`}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : m.content ? (
                    <MessageBody content={m.content} />
                  ) : (
                    <span className="inline-flex gap-1 py-1" aria-label="AI is typing">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                    </span>
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
