// Draft kontrak layanan (AMC/Kalibrasi/Service) dengan AI.
// AI hanya memilih alat dari installed base & menulis teks; nilai dari harga master, pasal hukum tidak disentuh.
import { prisma } from "@/lib/prisma";
import { aiComplete, parseAiJson } from "@/lib/ai";
import { buildClauses } from "../documents/contractTemplates";
import { addDays, today } from "../lib";
import type { ContractInput, ContractItem } from "../actions";

/** Pasal yang boleh disesuaikan AI. Nilai/periode (angka) dan pasal hukum selalu dari template. */
const AI_EDITABLE = ["scope", "visits", "obligationsFirst", "obligationsSecond", "exclusions", "spareparts"];

type AiAnswer = {
  itemIndexes?: number[];
  title?: string;
  startDate?: string;
  durationMonths?: number;
  visitsPerYear?: number;
  responseTime?: string;
  billingSchedule?: string;
  sparePartDiscount?: number;
  scope?: string;
  paymentTerms?: string;
  clauseEdits?: { key?: string; body?: string }[];
  explanation?: string;
};

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(Math.max(v, min), max) : fallback;
};

export async function generateContractDraft(input: {
  customerId: string; type: string; request: string; installedBase: ContractItem[]; deadline?: number;
}): Promise<{ draft: ContractInput; explanation: string; references: string[]; model: string }> {
  const request = input.request.trim().slice(0, 1500);
  if (!request) throw new Error("Tuliskan kebutuhan kontrak terlebih dahulu.");
  const type = ["AMC", "Kalibrasi", "Service"].includes(input.type) ? input.type : "AMC";
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new Error("Customer tidak ditemukan.");
  if (input.installedBase.length === 0) throw new Error("Customer ini belum punya alat terpasang tercatat. Isi alat secara manual di form.");

  const [previous, prices] = await Promise.all([
    prisma.contract.findMany({ where: { OR: [{ customerId: customer.id }, { type }], type: { not: "Garansi" } }, orderBy: { startDate: "desc" }, take: 3, include: { customer: { select: { name: true } } } }),
    prisma.product.findMany({ where: { category: "Jasa" }, select: { sku: true, name: true, price: true } }),
  ]);
  const priceOf = (suffix: string) => prices.find(p => p.sku.endsWith(suffix))?.price ?? 0;

  const system = `Kamu asisten sales PT Labtech Penta International (distributor & servis alat laboratorium, Indonesia).
Tugas: menyusun DRAFT kontrak layanan jenis ${type} dalam Bahasa Indonesia formal berdasarkan kebutuhan user.

Aturan:
- Pilih alat HANYA dari daftar "alatTerpasang" memakai nomor indeksnya ("itemIndexes"). Jika user menyebut "semua alat", pilih semua yang relevan. Jangan mengarang alat.
- Jangan menentukan nilai/harga: sistem menghitungnya dari harga master.
- visitsPerYear: AMC biasanya 2, Kalibrasi 1, Service 0 (on-call) — ikuti permintaan user bila disebut.
- billingSchedule: "Upfront" (100% di awal) kecuali user minta per triwulan → "Quarterly".
- responseTime: misalnya "2x24 jam hari kerja" bila tidak disebut.
- scope: 1–3 kalimat ruang lingkup yang spesifik untuk alat & kebutuhan customer.
- clauseEdits: opsional, hanya untuk key ${AI_EDITABLE.join(", ")} bila kebutuhan user memerlukan penyesuaian (mis. respon 1x24 jam, kunjungan tambahan). Pasal lain tidak boleh diubah.
- explanation: 1–2 kalimat untuk sales: asumsi yang diambil dan hal yang perlu dicek.
Jawab HANYA JSON: {"itemIndexes": number[], "title": string, "startDate": "YYYY-MM-DD"|null, "durationMonths": number, "visitsPerYear": number, "responseTime": string, "billingSchedule": "Upfront"|"Quarterly", "sparePartDiscount": number, "scope": string, "paymentTerms": string, "clauseEdits": [{"key": string, "body": string}], "explanation": string}`;

  const user = JSON.stringify({
    kebutuhan: request, hariIni: today(),
    customer: { name: customer.name, type: customer.type, paymentTerms: customer.paymentTerms },
    alatTerpasang: input.installedBase.map((it, i) => `${i} | ${it.product} | S/N ${it.serialNumber}`),
    kontrakSebelumnya: previous.map(p => ({ no: p.contractNo, customer: p.customer.name, type: p.type, title: p.title, visitsPerYear: p.visitsPerYear, responseTime: p.responseTime, billingSchedule: p.billingSchedule, scope: p.scope })),
    templatePasal: buildClauses({ type, startDate: today(), endDate: addDays(today(), 364), visitsPerYear: type === "AMC" ? 2 : 1, value: 0, itemCount: 1 })
      .filter(c => AI_EDITABLE.includes(c.key)).map(c => ({ key: c.key, title: c.title, body: c.body })),
  });

  const { text, model } = await aiComplete([{ role: "system", content: system }, { role: "user", content: user }], {
    json: true, maxTokens: 8192, temperature: 0.3, reasoningEffort: "low", deadline: input.deadline ?? Date.now() + 55_000, attemptMs: 25_000,
  });
  let ans: AiAnswer;
  try {
    ans = parseAiJson<AiAnswer>(text);
  } catch (err) {
    console.warn(`[ai-contract] ${model}: JSON tidak valid (${text.length} karakter), akhir: ${JSON.stringify(text.slice(-200))}`);
    throw err;
  }

  const items = [...new Set((ans.itemIndexes ?? []).map(Number))].filter(i => Number.isInteger(i) && i >= 0 && i < input.installedBase.length).map(i => input.installedBase[i]);
  if (items.length === 0) throw new Error("AI tidak memilih alat yang cocok. Perjelas alat yang dicakup, atau pilih manual di form.");

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(ans.startDate ?? "") && ans.startDate! >= today() ? ans.startDate! : today();
  const months = clamp(ans.durationMonths, 1, 36, 12);
  const end = new Date(startDate + "T00:00:00");
  end.setMonth(end.getMonth() + months);
  end.setDate(end.getDate() - 1);
  const endDate = end.toISOString().split("T")[0];
  const visitsPerYear = type === "Service" ? null : clamp(ans.visitsPerYear, 1, 12, type === "AMC" ? 2 : 1);
  // Nilai selalu dari harga master × jumlah alat (× kunjungan untuk kalibrasi) × lama kontrak (tahun).
  const years = months / 12;
  const value = Math.round(type === "AMC" ? priceOf("SRV-002") * items.length * years
    : type === "Kalibrasi" ? priceOf("SRV-001") * items.length * (visitsPerYear ?? 1) * years : 0);
  const billingSchedule = ans.billingSchedule === "Quarterly" ? "Quarterly" : "Upfront";
  // Diskon suku cadang AMC default 15% kecuali user menyebut angka lain (AI sering mengisi 0 bila tidak disebut).
  const sparePartDiscount = type === "AMC" ? (Number(ans.sparePartDiscount) > 0 ? clamp(ans.sparePartDiscount, 0, 30, 15) : 15) : null;
  const responseTime = str(ans.responseTime) || "2x24 jam hari kerja";
  const scope = str(ans.scope);
  const paymentTerms = str(ans.paymentTerms);

  const clauses = buildClauses({ type, startDate, endDate, visitsPerYear, responseTime, value, paymentTerms, billingSchedule, sparePartDiscount, scope, itemCount: items.length });
  for (const edit of ans.clauseEdits ?? []) {
    const target = clauses.find(c => c.key === edit.key);
    if (target && !target.locked && AI_EDITABLE.includes(target.key) && target.key !== "scope" && str(edit.body)) target.body = str(edit.body);
  }

  return {
    draft: {
      customerId: customer.id, type, title: str(ans.title) || `Kontrak ${type} ${customer.name}`, startDate, endDate, value, visitsPerYear,
      coveredItems: items, scope, responseTime, paymentTerms, billingSchedule, sparePartDiscount,
      signatoryName: customer.signatoryName || customer.contactName || "", signatoryTitle: customer.signatoryTitle || customer.contactTitle || "",
      clauses, picName: "", notes: `Draft AI dari permintaan: "${request.slice(0, 300)}"`,
    },
    explanation: str(ans.explanation),
    references: previous.map(p => p.contractNo),
    model,
  };
}
