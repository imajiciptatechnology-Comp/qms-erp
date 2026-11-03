// Membuat draft penawaran dengan AI berdasarkan penawaran-penawaran sebelumnya.
// AI hanya memilih produk dari katalog + menulis teks; harga selalu diambil dari master produk.
import { prisma } from "@/lib/prisma";
import { aiComplete, parseAiJson } from "@/lib/ai";
import { DEFAULT_TEXT, addDays, today } from "../lib";
import type { QuotationInput } from "../server";

const MAX_DISCOUNT = 30;

type AiAnswer = {
  subject?: string;
  items?: { sku?: string; qty?: number; discountPercent?: number }[];
  discountPercent?: number;
  introText?: string;
  closingText?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  validityDays?: number;
  unmatched?: string[];
  explanation?: string;
};

export type AiDraftResult = {
  draft: QuotationInput;
  /** Penjelasan singkat untuk sales: referensi yang dipakai, asumsi, hal yang perlu dicek. */
  explanation: string;
  references: string[];
  unmatched: string[];
  model: string;
};

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(Math.max(v, min), max) : fallback;
};

/** Penawaran contoh: customer yang sama dulu, lalu jenis customer yang sama, lalu yang diterima customer. */
async function pickExamples(customerId: string, customerType: string) {
  const include = { items: { orderBy: { sortOrder: "asc" as const } }, customer: { select: { name: true, type: true } } };
  const notDraft = { status: { notIn: ["Draft", "Superseded"] } };
  const same = await prisma.quotation.findMany({ where: { customerId, ...notDraft }, include, orderBy: { date: "desc" }, take: 2 });
  const similar = await prisma.quotation.findMany({
    where: { customerId: { not: customerId }, customer: { type: customerType }, ...notDraft }, include, orderBy: { date: "desc" }, take: 2,
  });
  const accepted = await prisma.quotation.findMany({ where: { status: "Accepted", id: { notIn: [...same, ...similar].map(q => q.id) } }, include, orderBy: { date: "desc" }, take: 2 });
  return [...same, ...similar, ...accepted].slice(0, 3);
}

export async function generateQuotationDraft(input: { customerId: string; request: string; opportunityId?: string | null; deadline?: number }): Promise<AiDraftResult> {
  const request = input.request.trim().slice(0, 1500);
  if (!request) throw new Error("Tuliskan kebutuhan customer terlebih dahulu.");

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new Error("Customer tidak ditemukan.");
  const [products, examples, opportunity] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    pickExamples(customer.id, customer.type),
    input.opportunityId ? prisma.opportunity.findUnique({ where: { id: input.opportunityId } }) : null,
  ]);

  // Prompt sengaja ringkas: prompt besar membuat model lambat (timeout di Vercel) dan jawaban terpotong.
  const catalog = products.map(p => `${p.sku} | ${p.name} (${p.model ? `${p.brand} ${p.model}` : p.brand}) | ${p.unit} | Rp${p.price} | ${p.availability === "Indent" ? `indent ${p.leadTimeWeeks ?? "?"} mgg` : "ready"}`);
  const exampleDocs = examples.map((q, i) => ({
    no: `${q.quotationNo} Rev.${q.revision}`, customer: `${q.customer.name} (${q.customer.type})`, status: q.status, subject: q.subject,
    items: q.items.map(it => `${it.qty}× ${it.description}${it.discountPercent ? ` (diskon ${it.discountPercent}%)` : ""}`), discountPercent: q.discountPercent,
    paymentTerms: q.paymentTerms, deliveryTerms: q.deliveryTerms, warrantyTerms: q.warrantyTerms,
    // Teks surat lengkap cukup dari satu contoh sebagai acuan gaya bahasa.
    ...(i === 0 ? { introText: q.introText, closingText: q.closingText } : {}),
  }));

  const system = `Kamu adalah asisten sales PT Labtech Penta International (distributor alat laboratorium, B2B, Indonesia).
Tugasmu: menyusun DRAFT surat penawaran harga dalam Bahasa Indonesia formal, meniru gaya bahasa, struktur, dan syarat dari contoh penawaran sebelumnya.

Aturan:
- Item HANYA boleh dari katalog (pakai "sku" persis). Jangan mengarang produk atau harga. Harga diisi sistem dari katalog.
- Jika kebutuhan mencakup alat yang perlu dipasang (bukan jasa atau alat portable kecil), tambahkan jasa "Instalasi, Commissioning & Training" (sku LPI-SRV-003) bila ada di katalog dan belum diminta, sejumlah unit alat tersebut — kecuali user bilang tidak perlu.
- Kebutuhan yang tidak ada di katalog tulis di "unmatched", jangan dipaksakan.
- Diskon hanya jika diminta user atau lazim di contoh untuk customer yang sama; maksimal ${MAX_DISCOUNT}%. Diskon di atas 10% nanti butuh persetujuan Sales Manager.
- introText: pembuka surat seperti contoh (diawali "Dengan hormat,"), sebutkan alat yang ditawarkan. closingText: penutup seperti contoh. Masing-masing maksimal ±80 kata. Pisahkan paragraf dengan baris kosong.
- Syarat pembayaran sesuaikan termin customer (${customer.paymentTerms}); untuk instansi pemerintah ikuti pola contoh pemerintah. Pengiriman: sebut indent bila ada item indent.
- explanation: 1-3 kalimat untuk sales (bukan untuk customer): contoh mana yang dijadikan acuan, asumsi yang kamu ambil, dan hal yang perlu dicek.

Jawab HANYA JSON dengan bentuk:
{"subject": string, "items": [{"sku": string, "qty": number, "discountPercent": number}], "discountPercent": number, "introText": string, "closingText": string, "paymentTerms": string, "deliveryTerms": string, "warrantyTerms": string, "validityDays": number, "unmatched": string[], "explanation": string}`;

  const user = JSON.stringify({
    kebutuhan: request,
    customer: { name: customer.name, type: customer.type, city: customer.city, contact: customer.contactName, paymentTerms: customer.paymentTerms },
    opportunity: opportunity ? { title: opportunity.title, notes: opportunity.notes } : undefined,
    contohPenawaranSebelumnya: exampleDocs,
    katalog: { format: "sku | nama (merek model) | satuan | harga | ketersediaan", items: catalog },
  });

  const { text, model } = await aiComplete([{ role: "system", content: system }, { role: "user", content: user }], {
    json: true, maxTokens: 8192, temperature: 0.3, reasoningEffort: "low",
    deadline: input.deadline ?? Date.now() + 55_000, attemptMs: 40_000,
  });
  let ans: AiAnswer;
  try {
    ans = parseAiJson<AiAnswer>(text);
  } catch (err) {
    console.warn(`[ai-draft] ${model}: JSON tidak valid (${text.length} karakter), akhir: ${JSON.stringify(text.slice(-200))}`);
    throw err;
  }

  // Validasi keras: hanya SKU katalog, harga dari database, angka dibatasi.
  const bySku = new Map(products.map(p => [p.sku.toUpperCase(), p]));
  const unmatched = (ans.unmatched ?? []).filter(s => typeof s === "string" && s.trim()).map(s => s.trim());
  const items = [];
  for (const it of ans.items ?? []) {
    const p = bySku.get(String(it.sku ?? "").toUpperCase());
    if (!p) {
      if (it.sku) unmatched.push(`SKU tidak dikenal: ${it.sku}`);
      continue;
    }
    items.push({
      productId: p.id, description: p.model ? `${p.name} — ${p.brand} ${p.model}` : `${p.name} — ${p.brand}`, specs: p.specs ?? "",
      qty: clamp(it.qty, 1, 999, 1), unit: p.unit, unitPrice: p.price, discountPercent: clamp(it.discountPercent, 0, MAX_DISCOUNT, 0),
    });
  }
  if (items.length === 0) {
    throw new Error(unmatched.length ? `AI tidak menemukan produk yang cocok di katalog: ${unmatched.join("; ")}` : "AI tidak menemukan produk yang cocok di katalog. Perjelas kebutuhannya.");
  }

  const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);
  return {
    draft: {
      customerId: customer.id, opportunityId: input.opportunityId || null, date: today(), validUntil: addDays(today(), clamp(ans.validityDays, 7, 90, 30)),
      subject: str(ans.subject, "Penawaran Harga Peralatan Laboratorium"), attention: customer.contactName ?? "",
      introText: str(ans.introText, DEFAULT_TEXT.intro("")), closingText: str(ans.closingText, DEFAULT_TEXT.closing),
      discountPercent: clamp(ans.discountPercent, 0, MAX_DISCOUNT, 0),
      paymentTerms: str(ans.paymentTerms, DEFAULT_TEXT.payment), deliveryTerms: str(ans.deliveryTerms, DEFAULT_TEXT.delivery), warrantyTerms: str(ans.warrantyTerms, DEFAULT_TEXT.warranty),
      notes: `Draft AI dari permintaan: "${request.slice(0, 300)}"`, items,
    },
    explanation: str(ans.explanation, ""),
    references: examples.map(q => `${q.quotationNo} Rev.${q.revision}`),
    unmatched,
    model,
  };
}
