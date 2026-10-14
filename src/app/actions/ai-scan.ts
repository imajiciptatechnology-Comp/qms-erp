"use server";

import { getCurrentUser } from "@/app/actions/auth";
import { aiComplete, parseAiJson, AiError, isAiConfigured } from "@/lib/ai";
import { getJson, setJson } from "@/lib/kvStore";

export type ScanFormType = "nc" | "calibration";
export type ScanResult =
  | {
      ok: true;
      fields: Record<string, string>;
      /** Label field penting yang tidak ditemukan di dokumen. */
      missing: string[];
      /** Diisi kalau dokumen tampaknya bukan jenis yang diharapkan form ini. */
      mismatch?: { expected: string; detected: string };
      model: string;
    }
  | { ok: false; error: string };

type FieldSpec = {
  label: string;
  description: string;
  options?: string[];
  date?: boolean;
  /** Tidak dilaporkan sebagai "tidak ditemukan" kalau kosong. */
  optional?: boolean;
};

/**
 * Definisi field per form: nama field = atribut `name`/key state di form ERP.
 * `options` membatasi nilai ke pilihan dropdown yang valid.
 */
const FORMS: Record<ScanFormType, { title: string; titleId: string; fields: Record<string, FieldSpec>; example: Record<string, string> }> = {
  nc: {
    title: "Non-Conformance Report (NCR)",
    titleId: "form NCR / laporan ketidaksesuaian",
    fields: {
      source: { label: "Source", description: "Where the NC came from", options: ["Internal Audit", "Customer Complaint", "Process Monitoring", "Supplier Issue", "Management Review", "Other"] },
      department: { label: "Department", description: "Department where the NC occurred", options: ["Top Management", "Quality Assurance", "Production", "Engineering", "HSE", "HR & Admin"] },
      severity: { label: "Severity", description: "NC severity", options: ["Minor", "Major", "Critical"] },
      dueDate: { label: "Due Date", description: "Target date to close the NC / corrective action", date: true },
      detectedBy: { label: "Detected By", description: "Name and/or position of the person who found it" },
      productBatch: { label: "Product / Batch No.", description: "Product, part, or batch/lot number involved" },
      isoClause: { label: "ISO Clause", description: "ISO 9001 clause reference, e.g. 8.5.1", optional: true },
      description: { label: "NC Description", description: "Full description of the problem, location and objective evidence" },
    },
    example: {
      source: "Process Monitoring",
      department: "Production",
      severity: "Major",
      dueDate: "2026-11-15",
      detectedBy: "Budi Santoso / QC Inspector",
      productBatch: "BATCH-2026-0412",
      isoClause: "8.5.1",
      description: "Outer diameter of shaft measured 25.12 mm vs spec 25.00 ±0.05 mm on 12 of 50 samples at CNC line 2.",
    },
  },
  calibration: {
    title: "Calibration Certificate",
    titleId: "sertifikat kalibrasi",
    fields: {
      date: { label: "Calibration Date", description: "Date the calibration was performed", date: true },
      // Kalau kosong, form menghitungnya dari frekuensi kalibrasi alat.
      nextDueDate: { label: "Next Due Date", description: "Next calibration due date / recommended recalibration date, if printed", date: true, optional: true },
      certificateNo: { label: "Certificate Number", description: "Certificate number" },
      calibratedBy: { label: "Calibrated By", description: "Calibration laboratory / company name (or 'Internal Lab')" },
      result: { label: "Result", description: "Overall result: Pass = within tolerance, Adjusted = passed after adjustment, Fail = out of tolerance/rejected", options: ["Pass", "Adjusted", "Fail"] },
      masterEquipmentUsed: { label: "Master Equipment", description: "Reference/master standard used, if listed", optional: true },
      remarks: { label: "Remarks", description: "Short summary of measured results, uncertainty, or notes on the certificate", optional: true },
    },
    example: {
      date: "2026-03-10",
      nextDueDate: "2027-03-10",
      certificateNo: "KAL-2026-00871",
      calibratedBy: "PT Kalibrasi Presisi Indonesia (KAN LK-123-IDN)",
      result: "Pass",
      masterEquipmentUsed: "Gauge Block Set GB-01",
      remarks: "All points within ±0.02 mm. Expanded uncertainty 0.01 mm (k=2).",
    },
  },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_IMAGE_CHARS = 4_000_000; // ~3 MB gambar; di bawah batas body Vercel
const DAILY_LIMIT = 30;

export async function scanDocument(formType: ScanFormType, imageDataUrl: string): Promise<ScanResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan login terlebih dahulu." };
  if (!isAiConfigured()) return { ok: false, error: "AI belum dikonfigurasi." };

  const form = FORMS[formType];
  if (!form) return { ok: false, error: "Jenis form tidak dikenal." };
  if (typeof imageDataUrl !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(imageDataUrl)) {
    return { ok: false, error: "File harus berupa gambar (JPG/PNG)." };
  }
  if (imageDataUrl.length > MAX_IMAGE_CHARS) return { ok: false, error: "Gambar terlalu besar." };

  const usageKey = `ai_scan_usage:${user.id}:${new Date().toISOString().split("T")[0]}`;
  const used = await getJson<number>(usageKey, 0);
  if (used >= DAILY_LIMIT) return { ok: false, error: `Batas ${DAILY_LIMIT} scan per hari sudah tercapai.` };

  const fieldList = Object.entries(form.fields)
    .map(([name, f]) => `- "${name}": ${f.description}${f.options ? ` — must be exactly one of: ${f.options.join(" | ")}` : ""}${f.date ? " — format YYYY-MM-DD" : ""}`)
    .join("\n");

  const prompt = `The user is filling an ERP form for a ${form.title} and uploaded this image (a scan or photo, Indonesian or English, printed or handwritten).

Step 1 — identify the document. Decide what kind of document the image actually shows (e.g. "NCR form", "calibration certificate", "invoice", "delivery note", "purchase order", "inspection report", "photo, not a document").
Set "isExpectedDocument" to true only if it really is a ${form.title} or an equivalent document for the same purpose. Set "detectedDocumentType" to a short name of what it is, in Indonesian.

Step 2 — extract values for these form fields:
${fieldList}

Rules:
- Extract a field whenever the document explicitly states a value with the same meaning, EVEN IF isExpectedDocument is false. Example: a material request with a row "Departemen: Production" → department = "Production"; a row "Produk / No. Batch: X" → productBatch = "X".
- Do NOT put text with a different meaning into a field just to fill it: e.g. "Diminta oleh" (requested by) is not "detected by", "Dibutuhkan tanggal" (needed by) is not a due date for closing an NC, and an invoice's item list is not an NC description.
- If a field is not present or unreadable, use an empty string "".
- Convert dates to YYYY-MM-DD (Indonesian month names: Januari, Februari, Maret, April, Mei, Juni, Juli, Agustus, September, Oktober, November, Desember).
- For fields with fixed options, pick the matching option exactly as written; map ticked checkboxes to the option. If nothing matches, use "".

Example of the "fields" object for a correct ${form.title} (different document):
${JSON.stringify(form.example, null, 2)}

Respond ONLY with JSON in this shape:
{ "isExpectedDocument": true|false, "detectedDocumentType": "…", "fields": { ${Object.keys(form.fields).map(k => `"${k}": "…"`).join(", ")} } }`;

  try {
    const { text, model } = await aiComplete(
      [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      { json: true, maxTokens: 1500, temperature: 0 }
    );
    await setJson(usageKey, used + 1);

    const raw = parseAiJson<{ isExpectedDocument?: unknown; detectedDocumentType?: unknown; fields?: Record<string, unknown> }>(text);
    const rawFields = raw.fields && typeof raw.fields === "object" ? raw.fields : (raw as Record<string, unknown>);

    const fields: Record<string, string> = {};
    for (const [name, spec] of Object.entries(form.fields)) {
      const value = typeof rawFields[name] === "string" ? (rawFields[name] as string).trim() : "";
      if (!value) continue;
      if (spec.options) {
        const match = spec.options.find(o => o.toLowerCase() === value.toLowerCase());
        if (match) fields[name] = match;
      } else if (spec.date) {
        if (DATE_RE.test(value)) fields[name] = value;
      } else {
        fields[name] = value.slice(0, 2000);
      }
    }

    const detected = typeof raw.detectedDocumentType === "string" && raw.detectedDocumentType.trim()
      ? raw.detectedDocumentType.trim().slice(0, 80)
      : "dokumen lain";
    const mismatch = raw.isExpectedDocument === false ? { expected: form.titleId, detected } : undefined;

    if (Object.keys(fields).length === 0) {
      return {
        ok: false,
        error: mismatch
          ? `Dokumen ini terbaca sebagai "${detected}", bukan ${form.titleId}. Tidak ada field yang bisa diisi.`
          : "AI tidak menemukan data yang cocok di gambar ini. Pastikan foto jelas dan sesuai jenis form.",
      };
    }

    const missing = Object.entries(form.fields)
      .filter(([name, spec]) => !spec.optional && !fields[name])
      .map(([, spec]) => spec.label);

    return { ok: true, fields, missing, mismatch, model };
  } catch (err) {
    console.error("[ai-scan]", err);
    return { ok: false, error: err instanceof AiError ? err.message : "Gagal memproses gambar." };
  }
}
