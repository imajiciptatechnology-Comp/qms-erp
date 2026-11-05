// Riwayat P2H trip (server component): pemeriksaan terbaru terbuka, yang sebelumnya bisa dibuka.
// Bukti chat sopir per pemeriksaan ada di halaman P2H records/[id].
import Link from "next/link";
import { Card } from "../../ui";
import P2HRecordView, { p2hFmt, p2hVerdict, type P2HCheck } from "../../p2h/P2HRecordView";
import { submittedBy } from "../../p2h/data";

export default function P2HCard({ checks, driverName }: { checks: (P2HCheck & { driverId: string | null })[]; driverName: string }) {
  if (!checks.length) {
    return <Card title="Pre-trip check (P2H)"><p className="text-sm text-slate-500">Sopir belum mengisi P2H untuk trip ini.</p></Card>;
  }
  const [last, ...older] = checks; // urut terbaru dulu
  const proofLink = (id: string) => <Link href={`/modules/logistics/p2h/${id}`} className="text-xs font-medium text-blue-700 hover:underline">Lihat bukti chat sopir →</Link>;
  return (
    <Card title={`Pre-trip check (P2H)${checks.length > 1 ? ` · ${checks.length} kali` : ""}`} actions={proofLink(last.id)}>
      <P2HRecordView check={last} submittedBy={submittedBy(last, driverName)} />
      {older.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3 space-y-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pemeriksaan sebelumnya</p>
          {older.map(c => {
            const v = p2hVerdict(c);
            return (
              <details key={c.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <summary className="cursor-pointer text-sm flex flex-wrap items-center gap-2">
                  <span className="text-slate-700">{p2hFmt(c.at)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${v.cls}`}>{v.short}</span>
                  <span className="text-xs text-slate-500">{[c.criticalFails, c.otherFails].filter(Boolean).join(", ")}</span>
                </summary>
                <div className="mt-3 space-y-2">
                  <P2HRecordView check={c} submittedBy={submittedBy(c, driverName)} />
                  {proofLink(c.id)}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </Card>
  );
}
