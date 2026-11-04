// AI untuk bot sopir (rancangan 10.3). AI hanya membaca & menyusun jawaban; status/hitungan tetap oleh kode.
import { aiComplete, parseAiJson } from "@/lib/ai";
import { P2H_ITEMS, type P2HResult } from "../tripOps";

export type PhotoKind = "cargo" | "seal" | "receipt" | "pod" | "document" | "damage" | "other";
export type PhotoAnalysis = {
  kind: PhotoKind; summary: string;
  fields: { count?: number; unit?: string; sealNo?: string; receiptType?: string; amount?: number; date?: string; liters?: number; receiverName?: string; discrepancy?: string; documentType?: string };
  model: string;
};

const KINDS: PhotoKind[] = ["cargo", "seal", "receipt", "pod", "document", "damage", "other"];

/** Foto dari sopir: muatan/segel, nota (BBM/tol/parkir), surat jalan bertanda tangan (POD), dokumen (SIM/STNK/KIR), kerusakan. */
export async function analyzeDriverPhoto(imageDataUrl: string, context: string): Promise<PhotoAnalysis> {
  const prompt = `A truck driver of an Indonesian trucking company sent this photo in a chat. Trip context: ${context}
Classify it: "cargo" (load/pallets/cartons in the truck), "seal" (container/truck seal with number), "receipt" (fuel/toll/parking/weighbridge receipt), "pod" (signed delivery note / surat jalan with receiver signature), "document" (driving licence SIM, STNK, KIR, tax proof, insurance), "damage" (vehicle or cargo damage), "other".
Extract only what is visible: count + unit (koli/palet/karton) for cargo, sealNo, receiptType (BBM/tol/parkir/timbangan) + amount (rupiah number) + liters + date (YYYY-MM-DD), receiverName + discrepancy (shortage/damage notes) for pod, documentType for document.
Write "summary": one or two short Indonesian sentences for the driver confirming what was read (e.g. "Terbaca 24 palet, segel no. 004512.").
Respond ONLY with JSON: { "kind": "...", "summary": "...", "fields": { ... } }`;
  const { text, model } = await aiComplete(
    [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageDataUrl } }] }],
    { json: true, maxTokens: 700, temperature: 0, reasoningEffort: "low", deadline: Date.now() + 40_000 },
  );
  const raw = parseAiJson<{ kind?: string; summary?: string; fields?: Record<string, unknown> }>(text);
  const f = raw.fields ?? {};
  const num = (v: unknown) => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 ? n : undefined; };
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : undefined);
  return {
    kind: KINDS.includes(raw.kind as PhotoKind) ? (raw.kind as PhotoKind) : "other",
    summary: str(raw.summary) ?? "Foto diterima.",
    fields: {
      count: num(f.count), unit: str(f.unit), sealNo: str(f.sealNo), receiptType: str(f.receiptType), amount: num(f.amount), date: str(f.date),
      liters: num(f.liters), receiverName: str(f.receiverName), discrepancy: str(f.discrepancy), documentType: str(f.documentType),
    },
    model,
  };
}

export type DriverIntent = { intent: "question" | "problem" | "status" | "p2h" | "other"; reply: string; problemSummary?: string; model: string };

/** Teks/suara bebas dari sopir. Jawaban hanya dari data trip milik sopir itu sendiri (`context`). */
export async function interpretDriverText(text: string, context: string): Promise<DriverIntent> {
  const { text: out, model } = await aiComplete([
    { role: "system", content: `Anda bot WhatsApp/Telegram untuk sopir truk PT Arunika Trans Nusantara. Jawab singkat, sopan, bahasa Indonesia sehari-hari (panggil "Pak"). Hanya pakai DATA SOPIR berikut; jangan mengarang alamat, jam, angka, atau data sopir lain. Kalau datanya tidak ada, bilang belum tersedia dan sarankan menghubungi dispatcher.\nDATA SOPIR:\n${context}` },
    { role: "user", content: `Pesan sopir: """${text.slice(0, 1500)}"""\n\nTentukan intent: "question" (bertanya), "problem" (melapor masalah: ban bocor, macet parah, kecelakaan, mogok, muatan rusak, dll.), "status" (memberi kabar posisi/status trip), "p2h" (melaporkan kondisi kendaraan untuk pemeriksaan harian), "other".\nJawab JSON: { "intent": "...", "reply": "jawaban untuk sopir", "problemSummary": "ringkasan masalah untuk dispatcher (hanya jika problem)" }` },
  ], { json: true, maxTokens: 500, temperature: 0.2, reasoningEffort: "low", deadline: Date.now() + 40_000 });
  const raw = parseAiJson<{ intent?: string; reply?: string; problemSummary?: string }>(out);
  const intents = ["question", "problem", "status", "p2h", "other"] as const;
  return {
    intent: intents.includes(raw.intent as (typeof intents)[number]) ? (raw.intent as DriverIntent["intent"]) : "other",
    reply: typeof raw.reply === "string" && raw.reply.trim() ? raw.reply.trim().slice(0, 1500) : "Pesan diterima, Pak.",
    problemSummary: typeof raw.problemSummary === "string" ? raw.problemSummary.slice(0, 300) : undefined,
    model,
  };
}

/** P2H dari teks/suara: "rem aman, ban kiri depan kurang angin, wiper rusak" → checklist. */
export async function parseP2HText(text: string): Promise<{ result: P2HResult; notes: string; model: string }> {
  const items = P2H_ITEMS.map(i => `"${i.key}" (${i.label})`).join(", ");
  const { text: out, model } = await aiComplete([
    { role: "user", content: `Laporan pemeriksaan harian kendaraan (P2H) dari sopir truk: """${text.slice(0, 1500)}"""\nUntuk setiap item ${items}, isi "ok" bila sopir menyatakan baik/aman/normal, "fail" bila rusak/bermasalah/kurang (mis. ban kurang angin = fail), atau "unknown" bila tidak disebut. Kalau sopir bilang "semua aman/oke" tanpa pengecualian, semua item "ok".\nJawab JSON: { "items": { ${P2H_ITEMS.map(i => `"${i.key}": "ok|fail|unknown"`).join(", ")} }, "notes": "catatan singkat masalah yang disebut" }` },
  ], { json: true, maxTokens: 400, temperature: 0, reasoningEffort: "low", deadline: Date.now() + 40_000 });
  const raw = parseAiJson<{ items?: Record<string, string>; notes?: string }>(out);
  const result: P2HResult = {};
  for (const i of P2H_ITEMS) {
    const v = raw.items?.[i.key];
    result[i.key] = v === "ok" || v === "fail" ? v : "unknown";
  }
  return { result, notes: typeof raw.notes === "string" ? raw.notes.slice(0, 300) : "", model };
}
