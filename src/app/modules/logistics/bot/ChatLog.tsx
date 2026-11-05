// Riwayat chat bot ↔ sopir ↔ kantor (server component). Dipakai di catatan trip dan chat pribadi sopir.
import { Image as ImageIcon, MapPin, Mic, MousePointerClick } from "lucide-react";

export type ChatRow = { id: string; at: string; direction: string; kind: string; text: string | null; fileUrl: string | null; sentBy: string | null; channel: string };

const time = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const ICON: Record<string, typeof Mic> = { photo: ImageIcon, voice: Mic, location: MapPin, button: MousePointerClick };

export default function ChatLog({ rows, empty, driverName }: { rows: ChatRow[]; empty: string; driverName: string }) {
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  // Pesan kantor/bot yang dikirim ke dua kanal sekaligus (Telegram + simulator) cukup tampil sekali.
  const shown = rows.filter((m, i) => !(m.direction !== "in" && rows.slice(Math.max(0, i - 3), i).some(p =>
    p.direction === m.direction && p.kind === m.kind && p.text === m.text && p.channel !== m.channel && Math.abs(Date.parse(p.at) - Date.parse(m.at)) < 10_000)));
  return (
    <ol className="space-y-2 max-h-[520px] overflow-y-auto pr-1" aria-label="Riwayat chat">
      {shown.map(m => {
        if (m.kind === "close" || m.kind === "system") {
          return <li key={m.id} className="text-center"><span className="inline-block text-xs text-slate-600 bg-slate-100 rounded-full px-3 py-1 whitespace-pre-wrap">{m.text} · {time(m.at)}</span></li>;
        }
        const inbound = m.direction === "in";
        const Icon = ICON[m.kind];
        const who = inbound ? driverName : m.sentBy && m.sentBy !== "Bot" ? `Kantor · ${m.sentBy}` : "Bot";
        return (
          <li key={m.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${inbound ? "bg-emerald-50 border border-emerald-100" : "bg-slate-50 border border-slate-200"}`}>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                {Icon && <Icon className="w-3 h-3" aria-label={m.kind} />}{who} · {time(m.at)}{m.channel === "simulator" ? " · simulator" : ""}
              </p>
              {m.text && <p className="whitespace-pre-wrap text-slate-800 mt-0.5">{m.text}</p>}
              {m.fileUrl && <a href={m.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-700 hover:underline">Lihat foto</a>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
