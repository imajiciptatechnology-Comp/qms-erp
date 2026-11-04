import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../../../server";
import { DRIVER_DOC_TYPES, daysLeftText, driverFlags, expiryState } from "../../../lib";
import { Card, InfoRow } from "../../../ui";
import { DocTable, Tabs } from "../../DocTable";
import { AddDocumentForm } from "../../DocumentForms";
import { isTelegramConfigured } from "@/lib/telegram";
import TelegramConnect from "../../../bot/TelegramConnect";

export default async function DriverDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const [d, types] = await Promise.all([
    prisma.driver.findUnique({ where: { id }, include: { qualifications: { include: { truckType: true } }, documents: { orderBy: { createdAt: "desc" } } } }),
    prisma.truckType.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!d) notFound();
  const link = await prisma.chatChannelLink.findFirst({ where: { driverId: d.id, active: true, chatId: { not: null } }, orderBy: { linkedAt: "desc" } });
  const flags = driverFlags(d);
  const base = `/modules/logistics/fleet/drivers/${d.id}`;
  const drafts = d.documents.filter(x => x.status === "Draft").length;
  const allowed = new Set(d.qualifications.filter(q => q.basis !== "manual-revoke").map(q => q.truckTypeId));
  const docTypes = Object.entries(DRIVER_DOC_TYPES).map(([value, s]) => ({ value, label: s.label, hint: s.hint }));
  const latest = (t: string) => d.documents.filter(x => x.docType === t && x.status === "Verified" && x.validUntil).sort((a, b) => b.validUntil!.localeCompare(a.validUntil!))[0];
  const sim = expiryState(d.simExpiry, DRIVER_DOC_TYPES.SIM.remindDays);

  return (
    <div className="space-y-4">
      <Link href="/modules/logistics/fleet" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> Fleet & Crew</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800">{d.name}</h2>
        <span className="text-sm text-slate-500">{d.code} · {d.phone}</span>
        {flags.map(f => <span key={f.text} className={`text-xs px-2 py-0.5 rounded-full border ${f.level === "red" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>{f.text}</span>)}
      </div>
      <Tabs base={base} tab={tab} items={[{ id: "overview", label: "Overview" }, { id: "documents", label: "Documents", count: d.documents.length }]} />

      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Licence & qualification" actions={<Link href={`${base}?tab=documents`} className="text-sm text-blue-700 hover:underline">Documents{drafts ? ` · ${drafts} draft` : ""}</Link>}>
            <InfoRow label="SIM">{d.simClass} · {d.simNo ?? "—"}</InfoRow>
            <InfoRow label="Berlaku s/d"><span className="flex items-center gap-2">{d.simExpiry}
              <span className={`text-xs px-2 py-0.5 rounded-full border ${sim.level === "expired" ? "bg-red-50 text-red-700 border-red-200" : sim.level === "remind" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{daysLeftText(sim.daysLeft)}</span></span></InfoRow>
            <InfoRow label="Pengalaman">{String(d.experienceYears).replace(".", ",")} tahun</InfoRow>
            <InfoRow label="Defensive driving">{d.defensiveTraining ? `Ya${latest("TRAINING_DEFENSIVE") ? ` · s/d ${latest("TRAINING_DEFENSIVE")!.validUntil}` : ""}` : "Belum"}</InfoRow>
            <InfoRow label="Sertifikat trailer">{d.trailerCertified ? `Ya${latest("TRAINING_TRAILER") ? ` · s/d ${latest("TRAINING_TRAILER")!.validUntil}` : ""}` : "Belum"}</InfoRow>
            <InfoRow label="Boleh membawa">
              <span className="flex flex-wrap gap-1">
                {types.map(t => <span key={t.id} className={`text-xs px-1.5 py-0.5 rounded border flex items-center gap-1 ${allowed.has(t.id) ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-300 border-slate-100 line-through"}`}><Truck className="w-3 h-3" />{t.code}</span>)}
              </span>
            </InfoRow>
            {d.notes && <InfoRow label="Catatan">{d.notes}</InfoRow>}
          </Card>
          <Card title="Telegram bot">
            <TelegramConnect driverId={d.id} driverName={d.name} configured={isTelegramConfigured()} canManage={access.canFleet}
              linked={link?.linkedAt ? { chatName: link.chatName, chatUsername: link.chatUsername, linkedAt: link.linkedAt } : null} />
          </Card>
        </div>
      )}

      {tab === "documents" && (
        <Card title="Documents (SIM, training)" actions={<span className="text-xs text-slate-500">Riwayat versi — dokumen lama tidak dihapus</span>}>
          <div className="space-y-4">
            {access.canFleet && <AddDocumentForm kind="driver" ownerId={d.id} ownerName={d.name} types={docTypes} canChooseStatus />}
            <DocTable kind="driver" docs={d.documents} types={DRIVER_DOC_TYPES} canVerify={access.canFleet} />
            <p className="text-xs text-slate-500">SIM Verified terbaru mengisi golongan, nomor, dan masa berlaku sopir; sertifikat training yang habis menggugurkan kualifikasi Tronton/Trailer. Kualifikasi otomatis dihitung ulang setiap dokumen disimpan atau diverifikasi.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
