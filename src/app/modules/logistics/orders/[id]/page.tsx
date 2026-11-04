import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../../server";
import { rupiah, type PriceLine } from "../../lib";
import { Card, DocLinks, History, InfoRow, StatusBadge, btnSecondary } from "../../ui";
import PriceBreakdown from "../../PriceBreakdown";
import OrderActions from "./OrderActions";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const { id } = await params;
  const o = await prisma.charterOrder.findUnique({
    where: { id },
    include: { client: true, route: true, truckType: true, stops: { orderBy: { seq: "asc" } } },
  });
  if (!o) notFound();
  const lines = JSON.parse(o.breakdownJson || "[]") as PriceLine[];
  const editable = access.canOrder && ["Draft", "Confirmed"].includes(o.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/modules/logistics/orders" className="text-sm text-slate-500 hover:text-slate-700">← Orders</Link>
          <h2 className="text-xl font-bold text-slate-800">{o.orderNo}</h2>
          <StatusBadge status={o.status} />
          <span className="text-xs text-slate-500">sumber: {o.source}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <DocLinks kind="charter-quote" id={o.id} label={o.status === "Draft" ? "Penawaran" : "Konfirmasi"} />
          {editable && <Link href={`/modules/logistics/orders/${o.id}/edit`} className={btnSecondary}>Edit</Link>}
          {access.canOrder && <OrderActions id={o.id} status={o.status} />}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title="Order">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Klien">{o.client.name}{o.clientRef ? ` · ref ${o.clientRef}` : ""}</InfoRow>
              <InfoRow label="Kontak">{[o.client.contactName, o.client.contactPhone].filter(Boolean).join(" · ")}</InfoRow>
              <InfoRow label="Rute">{o.route.code} · {o.route.origin} → {o.route.destination} (±{o.route.distanceKm} km, ±{o.route.durationHours} jam)</InfoRow>
              <InfoRow label="Jenis truk">{o.truckType.name} ({o.truckType.capacityTon} ton / {o.truckType.volumeM3} m³){o.truckType.requiresHelper ? " · wajib kenek" : ""}</InfoRow>
              <InfoRow label="Muat">{o.loadDate}{o.loadTime ? ` jam ${o.loadTime}` : ""} — {o.originName}{o.originAddress ? `, ${o.originAddress}` : ""}</InfoRow>
              <InfoRow label="Muatan">{o.cargoDesc}{o.cargoWeightTon ? ` · ${o.cargoWeightTon} ton` : ""}{o.cargoVolumeM3 ? ` · ${o.cargoVolumeM3} m³` : ""}{o.cargoValue ? ` · nilai ${rupiah(o.cargoValue)}` : ""}</InfoRow>
              <InfoRow label="Layanan">{[o.tkbm && "TKBM", o.escort && "Pengawalan", o.insurance && "Asuransi muatan", o.returnLoad && "Muatan balik", o.overnightDays > 0 && `Menginap ${o.overnightDays} hari`].filter(Boolean).join(", ") || "—"}</InfoRow>
              <InfoRow label="Catatan">{o.notes}</InfoRow>
              {o.status !== "Cancelled" && (
                <InfoRow label="Link tracking klien">
                  <a href={`/track/${o.trackingToken}`} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline break-all">/track/{o.trackingToken}</a>
                  <span className="block text-xs text-slate-500">Halaman publik tanpa login — kirim ke klien (salin alamat lengkap dari tab yang terbuka).</span>
                </InfoRow>
              )}
            </dl>
          </Card>
          <Card title={`Titik bongkar (${o.stops.length})`}>
            <ol className="space-y-2 text-sm">
              {o.stops.map(s => <li key={s.id}><b>{s.seq}.</b> {s.name}{s.city ? ` — ${s.city}` : ""}</li>)}
            </ol>
          </Card>
          {o.aiNote && (
            <Card title="Teks asli dari klien (dibaca AI)">
              <p className="text-sm text-slate-700 whitespace-pre-line italic">&ldquo;{o.aiNote}&rdquo;</p>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Price (from rate table)">
            <PriceBreakdown price={{ lines, discountPercent: o.discountPercent, discountAmount: o.discountAmount, subtotal: o.subtotal, taxPercent: o.taxPercent, taxAmount: o.taxAmount, total: o.total }} />
          </Card>
          <Card title="History"><History json={o.historyJson} /></Card>
        </div>
      </div>
    </div>
  );
}
