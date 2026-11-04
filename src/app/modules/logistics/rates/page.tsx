import { prisma } from "@/lib/prisma";
import { getLogisticsAccess, getRateTable } from "../server";
import { rupiah } from "../lib";
import { Card } from "../ui";
import RatesEditor from "./RatesEditor";
import QuickQuote from "./QuickQuote";

export default async function RatesPage() {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const [table, routes] = await Promise.all([getRateTable(), prisma.logisticsRoute.findMany({ orderBy: { sortOrder: "asc" } })]);

  return (
    <div className="space-y-6">
      <Card title="Quick price check">
        <QuickQuote table={table} />
      </Card>

      <RatesEditor table={table} canEdit={access.canRates} />

      <Card title="Routes (origin: Cikarang pool)">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-slate-50">
              <tr>{["Kode", "Rute", "Jarak", "Waktu tempuh", "Tol Gol. I", "Tol Gol. II", "Tol Gol. III–V"].map(h => <th key={h} className="text-left font-semibold px-5 py-2.5 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routes.map(r => (
                <tr key={r.id}>
                  <td className="px-5 py-2.5 font-semibold">{r.code}</td>
                  <td className="px-5 py-2.5">{r.origin} ↔ {r.destination}</td>
                  <td className="px-5 py-2.5 whitespace-nowrap">±{r.distanceKm} km</td>
                  <td className="px-5 py-2.5 whitespace-nowrap">±{String(r.durationHours).replace(".", ",")} jam</td>
                  <td className="px-5 py-2.5 tabular-nums">{rupiah(r.toll1)}</td>
                  <td className="px-5 py-2.5 tabular-nums">{rupiah(r.toll2)}</td>
                  <td className="px-5 py-2.5 tabular-nums">{rupiah(r.toll3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3">Golongan tol: CDE/CDD = Gol. I, Fuso = Gol. II, Tronton/Trailer = Gol. III–V (disederhanakan). Tarif tol dipakai untuk uang jalan (Tahap 3).</p>
      </Card>
    </div>
  );
}
