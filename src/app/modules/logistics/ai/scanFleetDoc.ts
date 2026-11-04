// Scan AI dokumen armada & sopir (STNK, pengesahan pajak/PKB, KIR, polis asuransi, SIM, sertifikat training, nota servis).
// AI hanya membaca: hasilnya draft yang diperiksa user sebelum disimpan. Dipakai form di ERP dan bot Telegram.
import { aiComplete, parseAiJson } from "@/lib/ai";

export const SCAN_DOC_TYPES = ["STNK", "PKB", "KIR", "INSURANCE", "SIM", "TRAINING_DEFENSIVE", "TRAINING_TRAILER", "SERVICE", "OTHER"] as const;
export type ScanDocType = (typeof SCAN_DOC_TYPES)[number];

export type FleetScanFields = {
  docNo?: string; plateNo?: string; holderName?: string; simClass?: string; issuer?: string;
  validFrom?: string; validUntil?: string; amount?: number; paidDate?: string;
  serviceDate?: string; odometerKm?: number; workshop?: string; items?: string; cost?: number;
};

export type FleetScanResult = { detectedType: ScanDocType; detectedLabel: string; fields: FleetScanFields; model: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DESCRIPTIONS: Record<ScanDocType, string> = {
  STNK: "STNK (Surat Tanda Nomor Kendaraan), 5-year registration card",
  PKB: "annual vehicle tax proof: STNK annual endorsement (pengesahan), SKPD/e-SKPD, or PKB payment receipt (bukti bayar pajak)",
  KIR: "KIR test card/book (buku/kartu uji berkala kendaraan)",
  INSURANCE: "vehicle insurance policy (polis asuransi kendaraan)",
  SIM: "Indonesian driving licence (SIM)",
  TRAINING_DEFENSIVE: "defensive driving training certificate",
  TRAINING_TRAILER: "trailer/container driving certificate",
  SERVICE: "workshop service invoice / work order (nota servis bengkel)",
  OTHER: "something else",
};

/** `expected` (opsional) membantu AI memilih jenis bila ragu; hasil tetap melaporkan jenis yang terdeteksi. */
export async function scanFleetDocument(imageDataUrl: string, expected?: ScanDocType): Promise<FleetScanResult> {
  const prompt = `This image is a photo/scan of an Indonesian fleet document for a trucking company.
Classify it as one of: ${SCAN_DOC_TYPES.map(t => `"${t}" = ${DESCRIPTIONS[t]}`).join("; ")}.${expected ? `\nThe user expects "${expected}", but report what the image really shows.` : ""}

Then extract only values explicitly printed (use "" or null if absent/unreadable):
- docNo: document number (No. STNK / No. SKPD / No. uji KIR / policy number / SIM number / certificate number / invoice number)
- plateNo: vehicle plate (e.g. "B 9408 FXD") if printed
- holderName: owner / licence holder / insured name
- simClass: for SIM only, one of "B1 Umum", "B2 Umum", "B1", "B2", "A", "C"
- issuer: issuing office, insurer, training institute or workshop
- validFrom, validUntil: YYYY-MM-DD. For PKB, validUntil = next tax due date ("berlaku s/d" / "masa pajak s/d"). Convert Indonesian month names.
- amount: tax / premium amount in rupiah as a number
- paidDate: tax payment date YYYY-MM-DD
- serviceDate (YYYY-MM-DD), odometerKm (number), workshop, items (short list of jobs/parts), cost (number) — for SERVICE only

Respond ONLY with JSON: { "docType": "...", "label": "short Indonesian name of what it is", "fields": { ... } }`;

  const { text, model } = await aiComplete(
    [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageDataUrl } }] }],
    { json: true, maxTokens: 1200, temperature: 0, reasoningEffort: "low" },
  );
  const raw = parseAiJson<{ docType?: string; label?: string; fields?: Record<string, unknown> }>(text);
  const f = raw.fields && typeof raw.fields === "object" ? raw.fields : {};
  const str = (k: string, max = 200) => (typeof f[k] === "string" && (f[k] as string).trim() ? (f[k] as string).trim().slice(0, max) : undefined);
  const date = (k: string) => { const v = str(k, 10); return v && DATE_RE.test(v) ? v : undefined; };
  const num = (k: string) => {
    const v = f[k];
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".")) : NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  let simClass = str("simClass", 20);
  if (simClass && /^B ?1/i.test(simClass)) simClass = "B1 Umum";
  else if (simClass && /^B ?2/i.test(simClass)) simClass = "B2 Umum";
  else simClass = undefined;

  const detectedType = (SCAN_DOC_TYPES as readonly string[]).includes(String(raw.docType)) ? (raw.docType as ScanDocType) : "OTHER";
  const fields: FleetScanFields = {
    docNo: str("docNo", 60), plateNo: str("plateNo", 20)?.toUpperCase(), holderName: str("holderName", 120), simClass, issuer: str("issuer", 120),
    validFrom: date("validFrom"), validUntil: date("validUntil"), amount: num("amount"), paidDate: date("paidDate"),
    serviceDate: date("serviceDate"), odometerKm: num("odometerKm"), workshop: str("workshop", 120), items: str("items", 1000), cost: num("cost"),
  };
  for (const k of Object.keys(fields) as (keyof FleetScanFields)[]) if (fields[k] === undefined) delete fields[k];
  return { detectedType, detectedLabel: typeof raw.label === "string" ? raw.label.slice(0, 80) : detectedType, fields, model };
}
