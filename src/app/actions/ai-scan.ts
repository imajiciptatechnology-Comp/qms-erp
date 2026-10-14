"use server";

import { getCurrentUser } from "@/app/actions/auth";
import { aiComplete, parseAiJson, AiError, isAiConfigured } from "@/lib/ai";
import { getJson, setJson } from "@/lib/kvStore";

export type ScanFormType = "nc" | "calibration";
export type ScanResult =
  | { ok: true; fields: Record<string, string>; model: string }
  | { ok: false; error: string };

type FieldSpec = { description: string; options?: string[]; date?: boolean };

/**
 * Definisi field per form: nama field = atribut `name`/key state di form ERP.
 * `options` membatasi nilai ke pilihan dropdown yang valid.
 */
const FORMS: Record<ScanFormType, { title: string; fields: Record<string, FieldSpec>; example: Record<string, string> }> = {
  nc: {
    title: "Non-Conformance Report (NCR)",
    fields: {
      source: { description: "Where the NC came from", options: ["Internal Audit", "Customer Complaint", "Process Monitoring", "Supplier Issue", "Management Review", "Other"] },
      department: { description: "Department where the NC occurred", options: ["Top Management", "Quality Assurance", "Production", "Engineering", "HSE", "HR & Admin"] },
      severity: { description: "NC severity", options: ["Minor", "Major", "Critical"] },
      dueDate: { description: "Target date to close the NC / corrective action", date: true },
      detectedBy: { description: "Name and/or position of the person who found it" },
      productBatch: { description: "Product, part, or batch/lot number involved" },
      isoClause: { description: "ISO 9001 clause reference, e.g. 8.5.1" },
      description: { description: "Full description of the problem, location and objective evidence" },
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
    fields: {
      date: { description: "Date the calibration was performed", date: true },
      nextDueDate: { description: "Next calibration due date / recommended recalibration date, if printed", date: true },
      certificateNo: { description: "Certificate number" },
      calibratedBy: { description: "Calibration laboratory / company name (or 'Internal Lab')" },
      result: { description: "Overall result: Pass = within tolerance, Adjusted = passed after adjustment, Fail = out of tolerance/rejected", options: ["Pass", "Adjusted", "Fail"] },
      masterEquipmentUsed: { description: "Reference/master standard used, if listed" },
      remarks: { description: "Short summary of measured results, uncertainty, or notes on the certificate" },
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

  const prompt = `This image is a scanned or photographed ${form.title} (it may be in Indonesian or English, printed or handwritten).
Extract the values needed to fill the ERP form fields below.

Fields:
${fieldList}

Rules:
- Only use information visible in the image. If a field is not present or unreadable, use an empty string "".
- Convert dates to YYYY-MM-DD (Indonesian month names: Januari, Februari, Maret, April, Mei, Juni, Juli, Agustus, September, Oktober, November, Desember).
- For fields with fixed options, pick the closest matching option exactly as written; map ticked checkboxes to the option.
- Keep the description/remarks text faithful to the document; you may join lines into sentences.

Example of a correctly filled answer (different document):
${JSON.stringify(form.example, null, 2)}

Respond ONLY with a JSON object containing exactly these keys: ${Object.keys(form.fields).join(", ")}.`;

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

    const raw = parseAiJson<Record<string, unknown>>(text);
    const fields: Record<string, string> = {};
    for (const [name, spec] of Object.entries(form.fields)) {
      const value = typeof raw[name] === "string" ? (raw[name] as string).trim() : "";
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

    if (Object.keys(fields).length === 0) {
      return { ok: false, error: "AI tidak menemukan data yang cocok di gambar ini. Pastikan foto jelas dan sesuai jenis form." };
    }
    return { ok: true, fields, model };
  } catch (err) {
    console.error("[ai-scan]", err);
    return { ok: false, error: err instanceof AiError ? err.message : "Gagal memproses gambar." };
  }
}
