// Alur P2H rinci di bot sopir (Telegram & Driver simulator): tampilan checklist & status alur. Fungsi murni.
//
// 1. Checklist: setiap item harus ditekan sendiri (⬜ → ✅ → ❌). "Selesai cek" baru diterima bila semua item dicek.
// 2. Item ❌: wajib keterangan (ketik/voice) dan/atau foto, satu per satu.
// 3. Odometer: sopir mengetik angka km.
// 4. Disimpan (recordP2H) → ringkasan + tindak lanjut (blokir #2 / override #7 / lolos).
// Voice note atau teks bebas di langkah 1 diisi otomatis oleh AI sebagai saran; sopir tetap mengecek sisanya.
import type { InlineButton } from "@/lib/telegram";
import { P2H_ITEMS, p2hItem, type P2HDetail } from "../p2hLib";

export type P2HFlowState = {
  awaiting: "p2h-check" | "p2h-detail" | "p2h-odo";
  tripId: string;
  marks: Record<string, "ok" | "fail">;
  details: Record<string, P2HDetail>;
  /** Item ❌ yang masih perlu keterangan (urut); `current` = yang sedang ditanyakan. */
  queue?: string[];
  current?: string;
  /** Pesan checklist: id ChatMessage (simulator & log) dan message_id Telegram (untuk edit tombol). */
  logId?: string | null;
  msgId?: number | null;
  aiNotes?: string;
};

export const isP2HFlow = (s: { awaiting?: string }): s is P2HFlowState => typeof s.awaiting === "string" && s.awaiting.startsWith("p2h-");

const markIcon = (m?: "ok" | "fail") => (m === "ok" ? "✅" : m === "fail" ? "❌" : "⬜");

/** ⬜ → ✅ → ❌ → ✅ … */
export const nextMark = (m?: "ok" | "fail"): "ok" | "fail" => (m === "ok" ? "fail" : "ok");

export function checklistButtons(tripId: string, marks: P2HFlowState["marks"]): InlineButton[][] {
  const rows: InlineButton[][] = [];
  for (let i = 0; i < P2H_ITEMS.length; i += 2) {
    rows.push(P2H_ITEMS.slice(i, i + 2).map(it => ({ text: `${markIcon(marks[it.key])} ${it.label}${it.critical ? "*" : ""}`, callback_data: `pc:${tripId}:${it.key}` })));
  }
  rows.push([{ text: "📤 Selesai cek", callback_data: `pc:${tripId}:done` }]);
  return rows;
}

export const uncheckedItems = (marks: P2HFlowState["marks"]) => P2H_ITEMS.filter(i => !marks[i.key]);

export function checklistText(plateNo: string, prefilled = false) {
  return [
    `📝 P2H ${plateNo} — periksa satu per satu, lalu tekan tombolnya:`,
    "⬜ belum dicek → tekan sekali ✅ baik → tekan lagi ❌ bermasalah. (* = item kritis: bermasalah = truk tidak boleh jalan)",
    "",
    P2H_ITEMS.map(i => `• ${i.label}${i.critical ? "*" : ""}: ${i.hint}`).join("\n"),
    "",
    prefilled
      ? "Sebagian sudah diisi dari pesan Bapak — cek lagi & lengkapi yang ⬜, lalu tekan 📤 Selesai cek."
      : "Bisa juga kirim 🎤 voice note (mis. \"rem pakem, ban kiri depan kurang angin, wiper rusak\") untuk mengisi otomatis.",
  ].join("\n");
}

export function detailPrompt(key: string, remaining: number) {
  const it = p2hItem(key);
  return `❌ ${it?.label ?? key}${it?.critical ? " (kritis)" : ""} bermasalah.\nJelaskan masalahnya — ketik atau 🎤 voice note — dan kirim 📷 foto bagian yang bermasalah bila bisa.${remaining > 1 ? `\n(${remaining - 1} item bermasalah lain menyusul.)` : ""}`;
}

export const detailButtons = (tripId: string): InlineButton[][] => [[{ text: "➡️ Lanjut", callback_data: `pd:${tripId}:next` }]];

export const hasDetail = (d?: P2HDetail) => Boolean(d?.note?.trim() || d?.photos?.length);

export function odometerPrompt(currentKm: number) {
  return `🔢 Terakhir: ketik angka ODOMETER sekarang (km), mis. ${Math.round(currentKm + 120).toLocaleString("id-ID")}.\nOdometer tercatat di sistem: ${Math.round(currentKm).toLocaleString("id-ID")} km.`;
}

/** Validasi angka odometer terhadap km tercatat (menangkap salah ketik). */
export function odometerProblem(km: number, currentKm: number) {
  if (km < currentKm - 50) return `Angka ${km.toLocaleString("id-ID")} lebih kecil dari odometer tercatat (${Math.round(currentKm).toLocaleString("id-ID")} km). Cek lagi angkanya.`;
  if (km > currentKm + 5_000) return `Angka ${km.toLocaleString("id-ID")} km jauh di atas odometer tercatat (${Math.round(currentKm).toLocaleString("id-ID")} km). Cek lagi, mungkin salah ketik.`;
  return null;
}

export function summaryLines(marks: P2HFlowState["marks"], details: Record<string, P2HDetail>) {
  return P2H_ITEMS.map(i => {
    const d = details[i.key];
    const extra = marks[i.key] === "fail" && hasDetail(d) ? ` — ${d!.note ?? ""}${d!.photos?.length ? ` 📷${d!.photos.length}` : ""}` : "";
    return `${markIcon(marks[i.key])} ${i.label}${extra}`;
  }).join("\n");
}
