// Data catatan P2H untuk halaman log & trip. Bukan "use server" — hanya dipanggil dari halaman server.
import { prisma } from "@/lib/prisma";
import type { ChatProof, P2HCheck } from "./P2HRecordView";

/**
 * Pesan masuk dari sopir (teks, voice, foto, tombol) yang membentuk satu catatan P2H:
 * sejak P2H sebelumnya di trip yang sama (atau sejak trip dibuat) sampai catatan ini tersimpan.
 */
export async function chatProofFor(check: P2HCheck & { tripId: string | null }, windowStart: string): Promise<ChatProof[]> {
  if (!check.tripId || check.source === "Kantor") return [];
  const until = new Date(Date.parse(check.at) + 5_000).toISOString();
  const rows = await prisma.chatMessage.findMany({
    where: { tripId: check.tripId, direction: "in", at: { gt: windowStart, lte: until }, kind: { in: ["text", "voice", "photo", "button"] } },
    orderBy: { at: "asc" }, take: 200,
    select: { id: true, at: true, kind: true, text: true, fileUrl: true, channel: true, chatId: true },
  });
  // Hanya percakapan P2H: mulai dari pesan pembuka P2H, tanpa tombol menu/status yang bukan bagian P2H.
  const NOISE = /^(Status →|📋 Tugas saya|\/tugas|❓ Bantuan|\/help|\/start)/;
  const start = rows.findIndex(r => /P2H|p2h/.test(r.text ?? ""));
  return (start > 0 ? rows.slice(start) : rows).filter(r => !NOISE.test(r.text ?? ""));
}

/** Nama pengirim: sopir (Telegram/simulator) atau petugas kantor (P2H ulang di pool). */
export function submittedBy(check: Pick<P2HCheck, "source" | "notes">, driverName: string | null | undefined) {
  if (check.source === "Kantor") return check.notes?.match(/oleh (.+)$/)?.[1] ?? "Kantor";
  if (check.source === "Demo Data") return "Data demo";
  return driverName ?? "Sopir";
}
