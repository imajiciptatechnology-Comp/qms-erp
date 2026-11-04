import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../server";
import { TOLL_METHODS, driverFlags, vehicleFlags, type Flag } from "../lib";
import { Card } from "../ui";

function Flags({ flags, ok = "Siap" }: { flags: Flag[]; ok?: string }) {
  if (flags.length === 0) return <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">{ok}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map(f => <span key={f.text} className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${f.level === "red" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>{f.text}</span>)}
    </span>
  );
}

const th = "text-left font-semibold px-5 py-2.5 whitespace-nowrap";
const td = "px-5 py-2.5 align-top";

export default async function FleetPage() {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const [vehicles, drivers, helpers, types] = await Promise.all([
    prisma.vehicle.findMany({ include: { truckType: true }, orderBy: [{ truckType: { sortOrder: "asc" } }, { plateNo: "asc" }] }),
    prisma.driver.findMany({ include: { qualifications: { include: { truckType: true } } }, orderBy: { code: "asc" } }),
    prisma.helper.findMany({ orderBy: { code: "asc" } }),
    prisma.truckType.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const driverName = new Map(drivers.map(d => [d.id, d.name]));

  return (
    <div className="space-y-6">
      <Card title={`Trucks (${vehicles.length})`} actions={<span className="text-xs text-slate-500">Status kelayakan awal · blokir & override di Tahap 2</span>}>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-slate-50">
              <tr>{["Nopol", "Jenis", "Merek / tahun", "Odometer", "STNK", "KIR", "Servis berikut", "Tol", "Kondisi"].map(h => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td className={`${td} font-semibold whitespace-nowrap`}>{v.plateNo}</td>
                  <td className={`${td} whitespace-nowrap`}>{v.truckType.name}</td>
                  <td className={td}>{v.brand} · {v.year}</td>
                  <td className={`${td} tabular-nums whitespace-nowrap`}>{v.odometerKm.toLocaleString("id-ID")} km</td>
                  <td className={`${td} whitespace-nowrap`}>{v.stnkExpiry}</td>
                  <td className={`${td} whitespace-nowrap`}>{v.kirExpiry}</td>
                  <td className={`${td} whitespace-nowrap`}>{v.nextServiceDate}<br /><span className="text-xs text-slate-500">{v.nextServiceKm?.toLocaleString("id-ID")} km</span></td>
                  <td className={td}><span title={TOLL_METHODS[v.tollMethod]}>{v.tollMethod}</span>{v.tollCardNo ? <span className="block text-xs text-slate-500">{v.tollCardNo}</span> : null}</td>
                  <td className={td}><Flags flags={vehicleFlags(v)} />{v.notes && <p className="text-xs text-slate-500 mt-1 max-w-xs">{v.notes}</p>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3">Metode tol: {Object.entries(TOLL_METHODS).map(([k, v]) => `${k} = ${v}`).join(" · ")}.</p>
      </Card>

      <Card title={`Driver pool (${drivers.length}) — cross vehicle type`}>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-slate-50">
              <tr>{["Kode", "Nama", "SIM", "Berlaku s/d", "Pengalaman", "Training", "Boleh membawa", "Catatan"].map(h => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drivers.map(d => {
                const allowed = new Set(d.qualifications.filter(q => q.basis !== "manual-revoke").map(q => q.truckTypeId));
                return (
                  <tr key={d.id}>
                    <td className={`${td} whitespace-nowrap text-slate-500`}>{d.code}</td>
                    <td className={`${td} font-medium whitespace-nowrap`}>{d.name}{d.userEmail ? <span className="block text-xs text-slate-500">login: {d.userEmail}</span> : null}</td>
                    <td className={`${td} whitespace-nowrap`}>{d.simClass}</td>
                    <td className={td}><span className="whitespace-nowrap">{d.simExpiry}</span> <Flags flags={driverFlags(d)} ok="Berlaku" /></td>
                    <td className={`${td} whitespace-nowrap`}>{String(d.experienceYears).replace(".", ",")} th</td>
                    <td className={td}>{[d.defensiveTraining && "Defensive driving", d.trailerCertified && "Sertifikat trailer"].filter(Boolean).join(", ") || <span className="text-slate-400">—</span>}</td>
                    <td className={td}>
                      <span className="flex flex-wrap gap-1">
                        {types.map(t => (
                          <span key={t.id} className={`text-xs px-1.5 py-0.5 rounded border whitespace-nowrap ${allowed.has(t.id) ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-300 border-slate-100 line-through"}`}>{t.code}</span>
                        ))}
                      </span>
                    </td>
                    <td className={`${td} text-xs text-slate-500 max-w-xs`}>{d.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3">Kualifikasi otomatis dari golongan SIM, training, dan pengalaman (CDE/CDD: B1 · Fuso: ≥1 th · Tronton: defensive driving + ≥2 th · Trailer: B2 + defensive driving + sertifikat trailer).</p>
      </Card>

      <Card title={`Helper (kenek) pool (${helpers.length})`}>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-slate-50">
              <tr>{["Kode", "Nama", "HP", "No. KTP (dummy)", "Pasangan sopir langganan", "Status"].map(h => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {helpers.map(h => (
                <tr key={h.id}>
                  <td className={`${td} text-slate-500`}>{h.code}</td>
                  <td className={`${td} font-medium`}>{h.name}</td>
                  <td className={td}>{h.phone}</td>
                  <td className={`${td} tabular-nums`}>{h.idCardNo}</td>
                  <td className={td}>{h.preferredDriverId ? driverName.get(h.preferredDriverId) : <span className="text-slate-400">—</span>}</td>
                  <td className={td}>{h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3">Kenek wajib untuk Tronton & Trailer, dipilih per trip saat dispatch (Tahap 2).</p>
      </Card>
    </div>
  );
}
