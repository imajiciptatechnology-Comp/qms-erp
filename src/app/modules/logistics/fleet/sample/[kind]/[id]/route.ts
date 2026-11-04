// Gambar contoh dokumen dummy (berwatermark "CONTOH") untuk data demo — dibuat dari data di database, tanpa file di storage.
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "../../../../server";
import { DRIVER_DOC_TYPES, VEHICLE_DOC_TYPES, rupiah } from "../../../../lib";

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function svg(title: string, subtitle: string, rows: [string, string][], color: string) {
  const lines = rows.map(([k, v], i) => `<text x="48" y="${168 + i * 40}" font-size="20" fill="#475569">${esc(k)}</text><text x="330" y="${168 + i * 40}" font-size="22" font-weight="600" fill="#0f172a">: ${esc(v)}</text>`).join("");
  const h = 230 + rows.length * 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${h}" viewBox="0 0 1000 ${h}" font-family="Arial, Helvetica, sans-serif">
<rect width="1000" height="${h}" fill="#fdfcf7"/><rect x="12" y="12" width="976" height="${h - 24}" fill="none" stroke="${color}" stroke-width="4" rx="18"/>
<rect x="12" y="12" width="976" height="96" fill="${color}" rx="18"/><rect x="12" y="80" width="976" height="28" fill="${color}"/>
<text x="48" y="60" font-size="28" font-weight="700" fill="#fff">${esc(title)}</text><text x="48" y="94" font-size="17" fill="#fff" opacity=".85">${esc(subtitle)}</text>
${lines}
<text x="48" y="${h - 36}" font-size="15" fill="#94a3b8">Dokumen dummy untuk demo PT Arunika Trans Nusantara (fiktif) — bukan dokumen asli.</text>
<text x="500" y="${h / 2 + 40}" font-size="150" font-weight="900" fill="#dc2626" opacity=".16" text-anchor="middle" transform="rotate(-18 500 ${h / 2})">CONTOH</text>
</svg>`;
}

const TITLES: Record<string, [string, string]> = {
  STNK: ["STNK — Surat Tanda Nomor Kendaraan", "Contoh dokumen registrasi kendaraan"],
  PKB: ["Bukti Bayar Pajak Kendaraan (PKB)", "Contoh pengesahan tahunan / SKPD"],
  KIR: ["Kartu Uji Berkala (KIR)", "Contoh kartu uji kendaraan barang"],
  INSURANCE: ["Polis Asuransi Kendaraan", "Contoh ikhtisar polis"],
  SIM: ["SIM — Surat Izin Mengemudi", "Contoh kartu SIM"],
  TRAINING_DEFENSIVE: ["Sertifikat Defensive Driving", "Contoh sertifikat pelatihan"],
  TRAINING_TRAILER: ["Sertifikat Pengemudi Trailer/Kontainer", "Contoh sertifikat kompetensi"],
};

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return new Response("Forbidden", { status: 403 });
  const { kind, id } = await params;
  let body: string | null = null;
  if (kind === "vehicle") {
    const d = await prisma.vehicleDocument.findUnique({ where: { id }, include: { vehicle: { include: { truckType: true } } } });
    if (d) {
      const [title, sub] = TITLES[d.docType] ?? [VEHICLE_DOC_TYPES[d.docType]?.label ?? d.docType, ""];
      const rows: [string, string][] = [["Nomor", d.docNo ?? "-"], ["Nomor polisi", d.vehicle.plateNo], ["Merek / jenis", `${d.vehicle.brand ?? ""} · ${d.vehicle.truckType.name}`], [d.docType === "INSURANCE" ? "Penanggung" : "Nama pemilik", d.holderName ?? "-"]];
      if (d.validFrom) rows.push(["Berlaku dari", d.validFrom]);
      rows.push([d.docType === "PKB" ? "Pajak berlaku s/d" : "Berlaku s/d", d.validUntil ?? "-"]);
      if (d.amount) rows.push([d.docType === "PKB" ? "Jumlah pajak" : "Premi", rupiah(d.amount)]);
      if (d.paidDate) rows.push(["Tanggal bayar", d.paidDate]);
      body = svg(title, sub, rows, d.docType === "KIR" ? "#047857" : d.docType === "PKB" ? "#b45309" : d.docType === "INSURANCE" ? "#6d28d9" : "#1d4ed8");
    }
  } else if (kind === "driver") {
    const d = await prisma.driverDocument.findUnique({ where: { id }, include: { driver: true } });
    if (d) {
      const [title, sub] = TITLES[d.docType] ?? [DRIVER_DOC_TYPES[d.docType]?.label ?? d.docType, ""];
      const rows: [string, string][] = [["Nomor", d.docNo ?? "-"], ["Nama", d.holderName ?? d.driver.name]];
      if (d.simClass) rows.push(["Golongan", d.simClass]);
      if (d.issuer) rows.push(["Penerbit", d.issuer]);
      if (d.validFrom) rows.push(["Berlaku dari", d.validFrom]);
      rows.push(["Berlaku s/d", d.validUntil ?? "-"]);
      body = svg(title, sub, rows, d.docType === "SIM" ? "#0f766e" : "#9a3412");
    }
  } else if (kind === "service") {
    const s = await prisma.vehicleServiceRecord.findUnique({ where: { id }, include: { vehicle: true } });
    if (s) body = svg("Nota Servis Bengkel", s.workshop, [["Tanggal", s.serviceDate], ["Nomor polisi", s.vehicle.plateNo], ["Odometer", `${s.odometerKm.toLocaleString("id-ID")} km`], ["Jenis", s.kind], ["Pekerjaan", s.items.slice(0, 48)], ["Total biaya", rupiah(s.cost)]], "#334155");
  }
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "private, max-age=300" } });
}
