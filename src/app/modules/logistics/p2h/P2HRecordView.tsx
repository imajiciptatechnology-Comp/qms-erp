// Satu catatan P2H sebagai bukti (server component): hasil per item, keterangan & foto, odometer,
// identitas pengirim, dan pesan sopir di chat yang membentuk catatan ini.
import { CheckCircle2, XCircle, MinusCircle, MessageSquare, Camera, Mic, MousePointerClick } from "lucide-react";
import { P2H_ITEMS, parseP2HRecord } from "../p2hLib";

export type P2HCheck = { id: string; at: string; resultJson: string; criticalFails: string | null; otherFails: string | null; notes: string | null; source: string };
export type ChatProof = { id: string; at: string; kind: string; text: string | null; fileUrl: string | null; channel: string; chatId: string };

export const p2hFmt = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" });

export function p2hVerdict(c: Pick<P2HCheck, "criticalFails" | "otherFails">) {
  if (c.criticalFails) return { key: "fail", text: `Gagal (kritis): ${c.criticalFails}`, short: "Gagal", cls: "bg-red-50 text-red-700 border-red-200" };
  if (c.otherFails) return { key: "override", text: `Perlu override Fleet: ${c.otherFails}`, short: "Perlu override", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  return { key: "pass", text: "Lolos — semua item baik", short: "Lolos", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

const KIND_ICON: Record<string, typeof MessageSquare> = { text: MessageSquare, photo: Camera, voice: Mic, button: MousePointerClick };

export default function P2HRecordView({ check, submittedBy, proof }: { check: P2HCheck; submittedBy: string; proof?: ChatProof[] }) {
  const rec = parseP2HRecord(check.resultJson);
  const v = p2hVerdict(check);
  // Data lama (sebelum checklist rinci) tidak punya semua item: tampilkan hanya yang tercatat.
  const items = P2H_ITEMS.filter(i => rec.items[i.key] != null);
  const sourceText = check.source === "Kantor" ? "Dicatat di kantor" : check.source === "Simulator" ? "Driver simulator (demo)" : check.source === "Telegram" ? "Telegram sopir" : check.source;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${v.cls}`}>{v.text}</span>
        {rec.odometerKm != null && <span className="text-xs text-slate-600">Odometer {rec.odometerKm.toLocaleString("id-ID")} km</span>}
        <span className="text-xs text-slate-500">{p2hFmt(check.at)} · {sourceText} · {submittedBy}</span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {items.map(i => {
          const mark = rec.items[i.key];
          const d = rec.details[i.key];
          return (
            <li key={i.key} className={mark === "fail" ? "sm:col-span-2 rounded-lg border border-red-200 bg-red-50/50 p-2" : "flex items-center gap-1.5"}>
              <span className="flex items-center gap-1.5">
                {mark === "ok" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-label="baik" />
                  : mark === "fail" ? <XCircle className="w-4 h-4 text-red-600 shrink-0" aria-label="bermasalah" />
                  : <MinusCircle className="w-4 h-4 text-slate-400 shrink-0" aria-label="tidak dicek" />}
                <span className={mark === "fail" ? "font-medium text-red-800" : "text-slate-700"}>{i.label}{i.critical ? " *" : ""}</span>
              </span>
              {mark === "fail" && (d?.note || d?.photos?.length) ? (
                <div className="mt-1 pl-6 space-y-1.5">
                  {d.note && <p className="text-xs text-slate-700">{d.note}</p>}
                  {d.photos?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {d.photos.map((u, k) => (
                        <a key={k} href={u} target="_blank" rel="noreferrer" title={`Foto ${i.label} ${k + 1}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt={`Foto ${i.label} ${k + 1}`} className="w-24 h-20 object-cover rounded border border-slate-200 bg-slate-50" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-500">* item kritis — bermasalah = blokir #2 (tidak bisa di-override). Item lain bermasalah = #7, override Fleet Manager.</p>
      {check.notes && !Object.keys(rec.details).length && <p className="text-xs text-slate-600">Catatan: {check.notes}</p>}

      {proof && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Bukti dari chat sopir ({proof.length})</p>
          {proof.length === 0 ? <p className="text-xs text-slate-500 mt-1">{check.source === "Kantor" ? "Dicatat langsung di kantor — tidak ada chat." : "Tidak ada pesan sopir yang tercatat untuk pemeriksaan ini."}</p> : (
            <>
              <p className="text-xs text-slate-500 mt-0.5">Kanal {proof[0].channel === "simulator" ? "Driver simulator" : "Telegram"} · chat id {proof[0].chatId}</p>
              <ol className="mt-2 space-y-1.5">
                {proof.map(m => {
                  const Icon = KIND_ICON[m.kind] ?? MessageSquare;
                  return (
                    <li key={m.id} className="flex gap-2 text-xs">
                      <span className="text-slate-400 tabular-nums whitespace-nowrap">{new Date(m.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" })}</span>
                      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-label={m.kind} />
                      <span className="text-slate-700 min-w-0">
                        {m.text ?? ""}
                        {m.fileUrl && <a href={m.fileUrl} target="_blank" rel="noreferrer" className="ml-1 text-blue-700 hover:underline">lihat foto</a>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}
