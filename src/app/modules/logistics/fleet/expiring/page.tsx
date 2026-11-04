import Link from "next/link";
import { after } from "next/server";
import { CalendarClock } from "lucide-react";
import { getLogisticsAccess } from "../../server";
import { getExpiringDocuments, maybeRunFleetReminders } from "../../fleetDocs";
import { daysLeftText } from "../../lib";
import { Card, StatCard } from "../../ui";

const th = "text-left font-semibold px-5 py-2.5 whitespace-nowrap";
const td = "px-5 py-2.5 align-top";

export default async function ExpiringDocuments() {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const items = await getExpiringDocuments(60);
  after(() => maybeRunFleetReminders());
  const expired = items.filter(i => i.level === "expired");
  const within30 = items.filter(i => i.level !== "expired" && i.daysLeft <= 30);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Expired" value={expired.length} sub="sudah lewat masa berlaku" icon={<CalendarClock className="w-6 h-6" />} tone={expired.length ? "red" : "slate"} />
        <StatCard label="≤ 30 days" value={within30.length} sub="segera urus perpanjangan" icon={<CalendarClock className="w-6 h-6" />} tone={within30.length ? "amber" : "slate"} />
        <StatCard label="≤ 60 days" value={items.length - expired.length} sub="total dalam 60 hari" icon={<CalendarClock className="w-6 h-6" />} tone="blue" />
      </div>
      <Card title={`Expiring documents (${items.length})`} actions={<span className="text-xs text-slate-500">Habis dalam 60 hari · urut dari yang paling dekat</span>}>
        {items.length === 0 ? <p className="text-sm text-slate-500">Tidak ada dokumen yang habis dalam 60 hari.</p> : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 bg-slate-50">
                <tr>{["Berlaku s/d", "Sisa", "Dokumen", "Truk / sopir", "Nomor", "Pengingat", ""].map(h => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(i => {
                  const href = `/modules/logistics/fleet/${i.owner === "vehicle" ? "vehicles" : "drivers"}/${i.ownerId}?tab=documents`;
                  return (
                    <tr key={i.key} className={i.level === "expired" ? "bg-red-50/40" : ""}>
                      <td className={`${td} whitespace-nowrap font-medium`}>{i.validUntil}</td>
                      <td className={td}><span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${i.level === "expired" ? "bg-red-50 text-red-700 border-red-200" : i.daysLeft <= 30 ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>{daysLeftText(i.daysLeft)}</span></td>
                      <td className={`${td} whitespace-nowrap`}>{i.docLabel}</td>
                      <td className={td}><Link href={href} className="font-medium text-blue-700 hover:underline whitespace-nowrap">{i.ownerLabel}</Link><span className="block text-xs text-slate-500">{i.ownerSub}</span></td>
                      <td className={`${td} tabular-nums text-xs whitespace-nowrap`}>{i.docNo ?? "—"}</td>
                      <td className={`${td} text-xs text-slate-500 whitespace-nowrap`}>{i.remindDays.join(" & ")} hari sebelum</td>
                      <td className={td}>{(access.canFleet || (access.canFinance && i.docType === "PKB")) && <Link href={href} className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap">Upload new</Link>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-3">Pengingat otomatis masuk ke notifikasi ERP (Fleet Manager) saat dokumen mencapai ambang pengingat atau habis. Pengingat SIM juga dikirim ke sopir lewat bot Telegram bila sudah terhubung.</p>
      </Card>
    </div>
  );
}
