// Pesan otomatis kantor → sopir lewat bot (Telegram & Driver simulator) saat trip berubah:
// tugas baru di-dispatch, Surat Jalan terbit, trip dibatalkan. Sopir tidak perlu membuka "📋 Tugas saya";
// tombol itu tetap bekerja seperti biasa. Bukan "use server" — hanya dipanggil dari kode server.
import { prisma } from "@/lib/prisma";
import type { InlineButton } from "@/lib/telegram";
import { sendToDriver } from "./telegramBot";

const wib = (iso: string | null | undefined, withDay = true) =>
  iso ? new Date(iso).toLocaleString("id-ID", { ...(withDay ? { weekday: "short", day: "2-digit", month: "short" } : {}), hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "-";

/** Catat di timeline trip apakah sopir sudah dikabari (supaya dispatcher tahu perlu telepon atau tidak). */
async function noteOnTrip(tripId: string, sent: boolean, what: string, by: string) {
  await prisma.tripEvent.create({ data: {
    tripId, status: "Notify", at: new Date().toISOString(), source: "Kantor", by,
    label: sent ? `${what} dikirim ke sopir lewat bot` : `${what} TIDAK terkirim — sopir belum terhubung ke bot Telegram, kabari lewat telepon`,
  } }).catch(() => {});
}

/** Tugas baru: dikirim begitu trip di-assign (papan Dispatch atau trip live demo). */
export async function notifyDriverNewTrip(tripId: string, by: string): Promise<boolean> {
  const t = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { vehicle: { include: { truckType: true } }, route: true, client: true, helper: true, order: { include: { stops: { orderBy: { seq: "asc" } } } } },
  });
  if (!t || t.status !== "Scheduled") return false;
  const stops = t.order?.stops.map((s, i) => `   ${i + 1}. ${s.name}${s.city ? `, ${s.city}` : ""}`).join("\n") ?? `   1. ${t.route?.destination ?? "-"}`;
  const text = [
    `🆕 TUGAS BARU dari kantor (${by})`,
    ``,
    `🚛 ${t.tripNo} · ${t.vehicle.plateNo} (${t.vehicle.truckType.name})`,
    t.client ? `Klien: ${t.client.name}${t.order ? ` · ${t.order.orderNo}` : ""}` : null,
    t.route ? `Rute: ${t.route.origin} → ${t.route.destination}` : null,
    `Muat: ${t.order?.originName ?? "Pool"}${t.order ? ` · ${t.order.loadDate} ${t.order.loadTime ?? ""}`.trimEnd() : ""}`,
    `Bongkar:\n${stops}`,
    t.order?.cargoDesc ? `Muatan: ${t.order.cargoDesc}${t.order.cargoWeightTon ? ` (${t.order.cargoWeightTon} ton)` : ""}` : null,
    t.helper ? `Kenek: ${t.helper.name}` : null,
    `Berangkat dari pool: ${wib(t.plannedStart)}`,
    t.suratJalanNo ? `📄 Surat Jalan ${t.suratJalanNo} sudah terbit.` : `📄 Surat Jalan menyusul (menunggu persetujuan kantor) — bot akan mengabari.`,
    ``,
    `Sebelum berangkat: tekan 📝 Isi P2H di bawah. Saat jalan: tekan 🚚 Berangkat di 📋 Tugas saya.`,
  ].filter(l => l !== null).join("\n");
  const inline: InlineButton[][] = [[{ text: "📝 Isi P2H", callback_data: `p2hstart:${t.id}` }], [{ text: "📋 Lihat tugas", callback_data: "task" }]];
  const sent = await sendToDriver(t.driverId, text, { sentBy: by, tripId: t.id, inline }).catch(() => false);
  await noteOnTrip(t.id, sent, "Tugas baru", by);
  return sent;
}

/** Surat Jalan terbit setelah override (atau diterbitkan manual oleh dispatcher). */
export async function notifyDriverSuratJalan(tripId: string, by: string): Promise<boolean> {
  const t = await prisma.trip.findUnique({ where: { id: tripId }, include: { vehicle: true } });
  if (!t?.suratJalanNo || t.status !== "Scheduled") return false;
  const inline: InlineButton[][] = t.p2hDoneAt ? [[{ text: "📋 Lihat tugas", callback_data: "task" }]] : [[{ text: "📝 Isi P2H", callback_data: `p2hstart:${t.id}` }], [{ text: "📋 Lihat tugas", callback_data: "task" }]];
  const sent = await sendToDriver(t.driverId, `📄 Surat Jalan ${t.suratJalanNo} untuk ${t.tripNo} (${t.vehicle.plateNo}) sudah terbit.\n${t.p2hDoneAt ? "P2H sudah lolos — silakan tekan 🚚 Berangkat saat jalan." : "Isi 📝 P2H dulu, lalu tekan 🚚 Berangkat."}`, { sentBy: by, tripId, inline }).catch(() => false);
  await noteOnTrip(t.id, sent, `Kabar Surat Jalan ${t.suratJalanNo}`, by);
  return sent;
}

/** Trip dibatalkan kantor sebelum berangkat. */
export async function notifyDriverCancelled(tripId: string, reason: string, by: string): Promise<boolean> {
  const t = await prisma.trip.findUnique({ where: { id: tripId }, include: { vehicle: true } });
  if (!t) return false;
  const sent = await sendToDriver(t.driverId, `❌ Tugas ${t.tripNo} (${t.vehicle.plateNo}) DIBATALKAN oleh kantor (${by}).\nAlasan: ${reason.slice(0, 300)}\nTidak perlu berangkat. Tunggu tugas berikutnya di chat ini.`, { sentBy: by, tripId }).catch(() => false);
  await noteOnTrip(t.id, sent, "Kabar pembatalan", by);
  return sent;
}
