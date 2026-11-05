// Rincian P2H trip (server component): item per item, keterangan & foto item bermasalah, odometer.
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { Card } from "../../ui";
import { P2H_ITEMS, parseP2HRecord } from "../../p2hLib";

type Check = { id: string; at: string; resultJson: string; criticalFails: string | null; otherFails: string | null; notes: string | null; source: string };

const fmt = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

export default function P2HCard({ checks, driverName }: { checks: Check[]; driverName: string }) {
  if (!checks.length) {
    return <Card title="Pre-trip check (P2H)"><p className="text-sm text-slate-500">Sopir belum mengisi P2H untuk trip ini.</p></Card>;
  }
  const [last, ...older] = checks;
  const rec = parseP2HRecord(last.resultJson);
  const verdict = last.criticalFails ? { text: `Gagal (kritis): ${last.criticalFails}`, cls: "bg-red-50 text-red-700 border-red-200" }
    : last.otherFails ? { text: `Perlu override Fleet: ${last.otherFails}`, cls: "bg-amber-50 text-amber-800 border-amber-200" }
    : { text: "Lolos — semua item baik", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  // Data lama (sebelum checklist rinci) tidak punya semua item: tampilkan hanya yang tercatat.
  const items = P2H_ITEMS.filter(i => rec.items[i.key] != null);
  return (
    <Card title="Pre-trip check (P2H)" actions={<span className="text-xs text-slate-500">{fmt(last.at)} · {last.source}{last.source !== "Kantor" ? ` · ${driverName}` : ""}</span>}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${verdict.cls}`}>{verdict.text}</span>
        {rec.odometerKm != null && <span className="text-xs text-slate-600">Odometer {rec.odometerKm.toLocaleString("id-ID")} km</span>}
        {older.length > 0 && <span className="text-xs text-slate-500">({older.length} pemeriksaan sebelumnya)</span>}
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
                <div className="mt-1 ml-5.5 space-y-1.5">
                  {d.note && <p className="text-xs text-slate-700">{d.note}</p>}
                  {d.photos?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {d.photos.map((u, k) => (
                        <a key={k} href={u} target="_blank" rel="noreferrer" title={`Foto ${i.label} ${k + 1}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt={`Foto ${i.label} ${k + 1}`} className="w-20 h-16 object-cover rounded border border-slate-200" />
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
      <p className="text-xs text-slate-500 mt-3">* item kritis — bermasalah = blokir #2 (tidak bisa di-override). Item lain bermasalah = #7, override Fleet Manager.</p>
      {last.notes && !Object.keys(rec.details).length && <p className="text-xs text-slate-600 mt-1">Catatan: {last.notes}</p>}
    </Card>
  );
}
