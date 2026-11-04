import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../../../server";
import { TOLL_METHODS, VEHICLE_DOC_TYPES, daysLeftText, expiryState, rupiah, vehicleFlags, type Flag } from "../../../lib";
import { Card, InfoRow } from "../../../ui";
import { DocTable, Tabs } from "../../DocTable";
import { AddDocumentForm, AddServiceForm } from "../../DocumentForms";
import { CloseServiceButton, OfficeP2HButton } from "../../FleetButtons";
import { VehicleForm } from "../../MasterForms";
import { LEVEL_LABEL, vehicleConditions } from "../../../dispatchRules";

function Flags({ flags }: { flags: Flag[] }) {
  if (!flags.length) return <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">Siap</span>;
  return <span className="flex flex-wrap gap-1">{flags.map(f => <span key={f.text} className={`text-xs px-2 py-0.5 rounded-full border ${f.level === "red" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>{f.text}</span>)}</span>;
}

export default async function VehicleDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const v = await prisma.vehicle.findUnique({
    where: { id },
    include: { truckType: true, documents: { orderBy: { createdAt: "desc" } }, services: { orderBy: [{ serviceDate: "desc" }, { odometerKm: "desc" }] }, preTripChecks: { orderBy: { at: "desc" }, take: 1 } },
  });
  if (!v) notFound();
  const conds = vehicleConditions({ ...v, services: v.services.filter(x => x.status === "Open") });
  const flags: Flag[] = [...conds.map(c => ({ level: c.level === "none" ? "red" : "amber", text: `#${c.code} ${c.text}` }) as Flag), ...vehicleFlags(v).filter(f => f.level === "amber" && !conds.some(c => c.text.startsWith(f.text.split(" ")[0])))];
  const p2h = v.preTripChecks[0];
  const base = `/modules/logistics/fleet/vehicles/${v.id}`;
  const drafts = v.documents.filter(d => d.status === "Draft").length;
  const types = Object.entries(VEHICLE_DOC_TYPES).map(([value, s]) => ({ value, label: s.label, hint: s.hint }));
  const canAddDoc = access.canFleet || access.canFinance;
  const expiryRows = Object.entries(VEHICLE_DOC_TYPES).map(([t, s]) => ({ t, s, date: v[s.field], st: expiryState(v[s.field], s.remindDays) }));

  return (
    <div className="space-y-4">
      <Link href="/modules/logistics/fleet" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> Fleet & Crew</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800">{v.plateNo}</h2>
        <span className="text-sm text-slate-500">{v.truckType.name} · {v.brand} · {v.year}</span>
        <Flags flags={flags} />
        {access.canFleet && <span className="ml-auto"><VehicleForm types={(await prisma.truckType.findMany({ orderBy: { sortOrder: "asc" } })).map(t => ({ id: t.id, label: `${t.name} (${t.capacityTon} ton)` }))}
          initial={{ id: v.id, plateNo: v.plateNo, truckTypeId: v.truckTypeId, brand: v.brand, year: v.year, status: v.status, odometerKm: v.odometerKm, stnkExpiry: v.stnkExpiry, pkbExpiry: v.pkbExpiry, kirExpiry: v.kirExpiry, insuranceExpiry: v.insuranceExpiry, nextServiceDate: v.nextServiceDate, nextServiceKm: v.nextServiceKm, tollMethod: v.tollMethod, tollCardNo: v.tollCardNo, notes: v.notes }} /></span>}
      </div>
      <Tabs base={base} tab={tab} items={[{ id: "overview", label: "Overview" }, { id: "documents", label: "Documents", count: v.documents.length }, { id: "service", label: "Service history", count: v.services.length }]} />

      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Vehicle">
            <InfoRow label="Jenis">{v.truckType.name} ({v.truckType.capacityTon} ton · {v.truckType.volumeM3} m³)</InfoRow>
            <InfoRow label="Status">{v.status}</InfoRow>
            <InfoRow label="Odometer">{v.odometerKm.toLocaleString("id-ID")} km</InfoRow>
            <InfoRow label="Metode tol">{v.tollMethod} — {TOLL_METHODS[v.tollMethod]}{v.tollCardNo ? ` · ${v.tollCardNo}` : ""}</InfoRow>
            {v.notes && <InfoRow label="Catatan">{v.notes}</InfoRow>}
          </Card>
          <Card title="Dispatch readiness (3.5)">
            {conds.length === 0 ? <p className="text-sm text-emerald-700">Siap jalan — tidak ada kondisi blokir.</p> : (
              <ul className="space-y-1 text-sm">{conds.map(c => <li key={c.key} className={c.level === "none" ? "text-red-700" : "text-amber-800"}>#{c.code} {c.text} <span className="text-xs opacity-75">· {LEVEL_LABEL[c.level]}</span></li>)}</ul>
            )}
            <p className="text-xs text-slate-500 mt-3">P2H terakhir: {p2h ? `${p2h.at.slice(0, 16).replace("T", " ")} · ${p2h.criticalFails ? `gagal kritis (${p2h.criticalFails})` : p2h.otherFails ? `gagal non-kritis (${p2h.otherFails})` : "semua OK"} · ${p2h.source}` : "—"}</p>
            {access.canFleet && p2h && (p2h.criticalFails || p2h.otherFails) && <div className="mt-2"><OfficeP2HButton vehicleId={v.id} /></div>}
          </Card>
          <Card title="Validity (from verified documents)" actions={<Link href={`${base}?tab=documents`} className="text-sm text-blue-700 hover:underline">Documents{drafts ? ` · ${drafts} draft` : ""}</Link>}>
            <ul className="divide-y divide-slate-100 -my-2 text-sm">
              {expiryRows.map(({ t, s, date, st }) => (
                <li key={t} className="py-2 flex items-center justify-between gap-3">
                  <span>{s.label}</span>
                  <span className="flex items-center gap-2 whitespace-nowrap"><b>{date ?? "—"}</b>
                    {st.level !== "none" && <span className={`text-xs px-2 py-0.5 rounded-full border ${st.level === "expired" ? "bg-red-50 text-red-700 border-red-200" : st.level === "remind" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{daysLeftText(st.daysLeft)}</span>}
                  </span>
                </li>
              ))}
              <li className="py-2 flex items-center justify-between gap-3">
                <span>Servis berkala berikutnya</span>
                <span className="whitespace-nowrap"><b>{v.nextServiceDate ?? "—"}</b> · {v.nextServiceKm?.toLocaleString("id-ID") ?? "—"} km</span>
              </li>
            </ul>
          </Card>
        </div>
      )}

      {tab === "documents" && (
        <Card title="Documents (STNK, pajak/PKB, KIR, asuransi)" actions={<span className="text-xs text-slate-500">Riwayat versi — dokumen lama tidak dihapus</span>}>
          <div className="space-y-4">
            {canAddDoc && (
              <AddDocumentForm kind="vehicle" ownerId={v.id} plateNo={v.plateNo} canChooseStatus={access.canFleet}
                types={access.canFleet ? types : types.filter(t => t.value === "PKB")} label={access.canFleet ? "Add document" : "Record tax payment (PKB)"} />
            )}
            <DocTable kind="vehicle" docs={v.documents} types={VEHICLE_DOC_TYPES} canVerify={access.canFleet} />
            <p className="text-xs text-slate-500">Masa berlaku di data truk diisi otomatis dari dokumen <b>Verified</b> dengan tanggal berlaku paling akhir. Draft (mis. kiriman sopir lewat Telegram) belum dipakai sampai diverifikasi Fleet Manager.</p>
          </div>
        </Card>
      )}

      {tab === "service" && (
        <Card title="Service history">
          <div className="space-y-4">
            {access.canFleet && <AddServiceForm vehicleId={v.id} odometerKm={v.odometerKm} />}
            {v.services.length === 0 ? <p className="text-sm text-slate-500">Belum ada riwayat servis.</p> : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-slate-500 bg-slate-50">
                    <tr>{["Tanggal", "Km", "Jenis", "Bengkel", "Pekerjaan", "Biaya", "Jadwal berikut", "Nota"].map(h => <th key={h} className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {v.services.map(s => (
                      <tr key={s.id}>
                        <td className="px-4 py-2.5 whitespace-nowrap">{s.serviceDate}</td>
                        <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{s.odometerKm.toLocaleString("id-ID")}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${s.kind === "Berkala" ? "bg-blue-50 text-blue-700 border-blue-200" : s.kind === "Request" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>{s.kind === "Request" ? "Maintenance request" : s.kind}{s.system ? ` · ${s.system}` : ""}</span>
                          {s.status === "Open" && <span className="block mt-1 text-xs text-red-700 font-semibold">Open</span>}
                          {s.status === "Open" && access.canFleet && <span className="block mt-1"><CloseServiceButton id={s.id} /></span>}
                        </td>
                        <td className="px-4 py-2.5">{s.workshop}</td>
                        <td className="px-4 py-2.5 max-w-xs">{s.items}{s.notes && <span className="block text-xs text-slate-500">{s.notes}</span>}</td>
                        <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{rupiah(s.cost)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs">{s.kind === "Berkala" ? <>{s.nextServiceDate}<br />{s.nextServiceKm?.toLocaleString("id-ID")} km</> : "—"}</td>
                        <td className="px-4 py-2.5">{s.fileUrl ? <Link href={s.fileUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-1 text-xs"><FileText className="w-3.5 h-3.5" /> Lihat</Link> : <span className="text-xs text-slate-400">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-slate-500">Servis <b>Berkala</b> terakhir menentukan jadwal servis berikutnya (default +90 hari / +10.000 km). Overdue ≤ 14 hari / ≤ 1.000 km → blokir #6 (override Fleet); lebih dari itu → #10 (Direktur).</p>
          </div>
        </Card>
      )}
    </div>
  );
}
