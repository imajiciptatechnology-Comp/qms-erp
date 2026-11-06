// Pesan otomatis kantor → sopir lewat bot (Telegram & Driver simulator) saat trip berubah:
// tugas baru di-dispatch, Surat Jalan terbit, trip dibatalkan. Sopir tidak perlu membuka "📋 Tugas saya";
// tombol itu tetap bekerja seperti biasa. Bukan "use server" — hanya dipanggil dari kode server.
import { prisma } from "@/lib/prisma";
import type { InlineButton } from "@/lib/telegram";
import { closeTripChat, sendPlacesToDriver, sendToDriver } from "./telegramBot";

export { closeTripChat };

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
    ``,
    `Langkah sebelum berangkat:`,
    `1️⃣ Isi P2H — tekan 📝 Isi P2H di bawah. Surat Jalan terbit setelah P2H lolos.`,
    `2️⃣ Datang ke kantor: tanda tangan & ambil Surat Jalan (+ dokumen order, uang jalan).`,
    `3️⃣ Tekan 🚚 Berangkat di 📋 Tugas saya, lalu bagikan 📍 Lokasi Live.`,
    `📍 Lokasi tiap titik muat & bongkar dikirim di bawah — tekan pin untuk peta, 🧭 Petunjuk arah untuk navigasi.`,
  ].filter(l => l !== null).join("\n");
  const inline: InlineButton[][] = [[{ text: "📝 Isi P2H", callback_data: `p2hstart:${t.id}` }], [{ text: "📋 Lihat tugas", callback_data: "task" }]];
  const sent = await sendToDriver(t.driverId, text, { sentBy: by, tripId: t.id, inline }).catch(() => false);
  // Pin lokasi per titik (seperti share location), sesudah pesan tugas.
  if (sent) await sendPlacesToDriver(t.driverId, t.id, by).catch(err => console.error("[notify] places", err));
  await noteOnTrip(t.id, sent, "Tugas baru", by);
  return sent;
}

/** Surat Jalan diterbitkan dispatcher (P2H sudah lolos, override selesai). Terbit otomatis saat P2H dikabari lewat finishP2H. */
export async function notifyDriverSuratJalan(tripId: string, by: string): Promise<boolean> {
  const t = await prisma.trip.findUnique({ where: { id: tripId }, include: { vehicle: true } });
  if (!t?.suratJalanNo || t.status !== "Scheduled") return false;
  const inline: InlineButton[][] = t.p2hDoneAt ? [[{ text: "📋 Lihat tugas", callback_data: "task" }]] : [[{ text: "📝 Isi P2H", callback_data: `p2hstart:${t.id}` }], [{ text: "📋 Lihat tugas", callback_data: "task" }]];
  const sent = await sendToDriver(t.driverId, `📄 Surat Jalan ${t.suratJalanNo} untuk ${t.tripNo} (${t.vehicle.plateNo}) sudah terbit.\n${t.p2hDoneAt ? "P2H sudah lolos — silakan ke kantor untuk tanda tangan & ambil Surat Jalan, lalu tekan 🚚 Berangkat." : "Isi 📝 P2H dulu, lalu ke kantor ambil Surat Jalan, baru tekan 🚚 Berangkat."}`, { sentBy: by, tripId, inline }).catch(() => false);
  await noteOnTrip(t.id, sent, `Kabar Surat Jalan ${t.suratJalanNo}`, by);
  return sent;
}

/** Trip dibatalkan kantor sebelum berangkat. */
export async function notifyDriverCancelled(tripId: string, reason: string, by: string): Promise<boolean> {
  const t = await prisma.trip.findUnique({ where: { id: tripId }, include: { vehicle: true } });
  if (!t) return false;
  const links = await prisma.chatChannelLink.count({ where: { driverId: t.driverId, active: true, chatId: { not: null } } });
  await closeTripChat(t.driverId, tripId, `❌ Tugas ${t.tripNo} (${t.vehicle.plateNo}) DIBATALKAN oleh kantor (${by}).\nAlasan: ${reason.slice(0, 300)}\nTidak perlu berangkat. Percakapan trip ini ditutup; pesan berikutnya masuk chat pribadi.`, by);
  const sent = links > 0;
  await noteOnTrip(t.id, sent, "Kabar pembatalan", by);
  return sent;
}

/** Surat Jalan sudah diambil sopir di kantor → boleh berangkat. */
export async function notifyDriverHandover(tripId: string, by: string): Promise<boolean> {
  const t = await prisma.trip.findUnique({ where: { id: tripId }, include: { vehicle: true } });
  if (!t || t.status !== "Scheduled") return false;
  const inline: InlineButton[][] = [[{ text: "🚚 Berangkat ke lokasi muat", callback_data: `st:${t.id}:ToLoad` }], [{ text: "📋 Lihat tugas", callback_data: "task" }]];
  const sent = await sendToDriver(t.driverId, `✅ Surat Jalan ${t.suratJalanNo} sudah Bapak terima di kantor (${by}).\nSilakan berangkat — tekan 🚚 Berangkat saat mulai jalan, lalu bagikan 📍 Lokasi Live (📎 → Lokasi → Bagikan Lokasi Live) supaya kantor & klien bisa memantau.`, { sentBy: by, tripId, inline }).catch(() => false);
  await noteOnTrip(t.id, sent, "Kabar serah terima Surat Jalan", by);
  return sent;
}
