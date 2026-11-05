import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../../server";
import { TRIP_STATUSES } from "../../trackingLib";
import { Card, InfoRow } from "../../ui";
import P2HRecordView from "../P2HRecordView";
import { chatProofFor, submittedBy } from "../data";
import { DeleteP2HButton } from "../../trips/[id]/TripControls";

/** Satu catatan P2H lengkap: hasil per item, keterangan/foto, dan pesan sopir di chat sebagai bukti. */
export default async function P2HRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const { id } = await params;
  const check = await prisma.preTripCheck.findUnique({
    where: { id },
    include: { vehicle: { include: { truckType: { select: { name: true } } } }, trip: { select: { id: true, tripNo: true, status: true, createdAt: true, suratJalanNo: true } } },
  });
  if (!check) notFound();
  const [driver, previous, link] = await Promise.all([
    check.driverId ? prisma.driver.findUnique({ where: { id: check.driverId }, select: { id: true, name: true, code: true } }) : null,
    check.tripId ? prisma.preTripCheck.findFirst({ where: { tripId: check.tripId, at: { lt: check.at } }, orderBy: { at: "desc" }, select: { at: true } }) : null,
    check.driverId ? prisma.chatChannelLink.findFirst({ where: { driverId: check.driverId, channel: "telegram", chatId: { not: null } }, select: { chatUsername: true, chatName: true, linkedAt: true } }) : null,
  ]);
  const proof = await chatProofFor(check, previous?.at ?? check.trip?.createdAt ?? check.at);
  const by = submittedBy(check, driver?.name);

  return (
    <div className="space-y-6">
      <Link href="/modules/logistics/p2h" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> P2H records</Link>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2">
          <Card title={`P2H ${check.vehicle.plateNo}`}>
            <P2HRecordView check={check} submittedBy={by} proof={proof} />
          </Card>
        </div>
        <Card title="Record">
          <InfoRow label="Truk"><Link href={`/modules/logistics/fleet/vehicles/${check.vehicleId}`} className="text-blue-700 hover:underline">{check.vehicle.plateNo}</Link> · {check.vehicle.truckType.name}</InfoRow>
          <InfoRow label="Trip">{check.trip ? <><Link href={`/modules/logistics/trips/${check.trip.id}`} className="text-blue-700 hover:underline">{check.trip.tripNo}</Link> · {TRIP_STATUSES[check.trip.status]?.label ?? check.trip.status}</> : "— (P2H di pool)"}</InfoRow>
          <InfoRow label="Diisi oleh">{driver ? <Link href={`/modules/logistics/fleet/drivers/${driver.id}`} className="text-blue-700 hover:underline">{by}</Link> : by}{driver ? ` · ${driver.code}` : ""}</InfoRow>
          <InfoRow label="Kanal">{check.source}{check.source === "Telegram" && link ? ` · ${link.chatName ?? ""}${link.chatUsername ? ` (@${link.chatUsername})` : ""}` : ""}</InfoRow>
          <InfoRow label="Surat Jalan">{check.trip?.suratJalanNo ?? "—"}</InfoRow>
          <InfoRow label="ID catatan"><span className="font-mono text-xs">{check.id}</span></InfoRow>
          <p className="text-xs text-slate-500 mt-3">Catatan P2H tidak bisa diubah. P2H ulang (mis. setelah perbaikan) disimpan sebagai catatan baru.</p>
          {(access.canFleet || access.canDispatch) && (!check.trip || ["Scheduled", "Cancelled"].includes(check.trip.status) || access.isSuperAdmin) && (
            <div className="mt-4 pt-3 border-t border-slate-100"><DeleteP2HButton id={check.id} /></div>
          )}
        </Card>
      </div>
    </div>
  );
}
