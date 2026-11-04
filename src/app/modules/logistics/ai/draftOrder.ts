// Order charter dari teks/chat bebas atau suara. AI hanya MENGISI DRAFT: memilih klien, rute, dan
// jenis truk dari master data (pakai kode), lalu membaca tanggal, muatan, dan titik bongkar.
// Harga TIDAK PERNAH dari AI — selalu dihitung kode dari tabel tarif (computeCharterPrice).
import { prisma } from "@/lib/prisma";
import { aiComplete, parseAiJson } from "@/lib/ai";
import { addDays, today } from "../lib";
import type { OrderInput } from "../server";

type AiAnswer = {
  clientCode?: string | null;
  routeCode?: string | null;
  truckTypeCode?: string | null;
  loadDate?: string | null;
  loadTime?: string | null;
  originName?: string | null;
  stops?: { name?: string; city?: string }[];
  cargoDesc?: string | null;
  cargoWeightTon?: number | null;
  cargoValue?: number | null;
  overnightDays?: number | null;
  tkbm?: boolean;
  escort?: boolean;
  insurance?: boolean;
  returnLoad?: boolean;
  clientRef?: string | null;
  uncertain?: string[];
  explanation?: string;
};

/** Nama field yang ditandai "perlu dicek" di form. */
export type DraftField = "clientId" | "routeId" | "truckTypeId" | "loadDate" | "loadTime" | "originName" | "stops" | "cargoDesc" | "cargoWeightTon" | "cargoValue" | "options";

export type OrderDraftResult = {
  draft: OrderInput;
  /** Field yang tidak terbaca jelas / ditebak → wajib dicek user. */
  uncertain: DraftField[];
  /** Catatan untuk admin: asumsi AI dan hal yang perlu dicek. */
  explanation: string;
  warnings: string[];
  model: string;
};

const FIELD_MAP: Record<string, DraftField> = {
  clientCode: "clientId", client: "clientId", routeCode: "routeId", route: "routeId", truckTypeCode: "truckTypeId", truckType: "truckTypeId",
  loadDate: "loadDate", loadTime: "loadTime", originName: "originName", origin: "originName", stops: "stops", cargoDesc: "cargoDesc",
  cargoWeightTon: "cargoWeightTon", weight: "cargoWeightTon", cargoValue: "cargoValue", overnightDays: "options", tkbm: "options", escort: "options", insurance: "options",
};

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export async function generateOrderDraft(input: { text: string; source: "Teks" | "Suara"; deadline?: number }): Promise<OrderDraftResult> {
  const text = input.text.trim().slice(0, 2000);
  if (!text) throw new Error("Tempel teks/chat dari klien atau rekam suara terlebih dahulu.");

  const [clients, routes, types, locations] = await Promise.all([
    prisma.logisticsClient.findMany({ orderBy: { name: "asc" } }),
    prisma.logisticsRoute.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.truckType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.logisticsLocation.findMany({ where: { clientId: { not: null } } }),
  ]);

  const now = today();
  const dow = DAYS[new Date(now + "T00:00:00Z").getUTCDay()];
  const system = `Kamu adalah admin order PT Arunika Trans Nusantara (perusahaan truk charter FTL, pool Cikarang).
Tugasmu: membaca permintaan truk dari klien (teks chat/email/transkrip suara, Bahasa Indonesia sehari-hari) lalu mengisi DRAFT order charter.

Aturan:
- Hari ini ${dow}, ${now}. Ubah "besok", "lusa", "Senin depan", dsb. menjadi tanggal YYYY-MM-DD. "pagi" = 06:00, "siang" = 12:00, "sore" = 15:00, "malam" = 19:00 bila jam tidak disebut persis.
- clientCode, routeCode, truckTypeCode HANYA boleh dari daftar (pakai kode persis). Rute ditentukan dari KOTA TUJUAN (asal selalu pool Cikarang/Bekasi/Karawang sekitarnya). Jika tidak ada yang cocok isi null dan masukkan ke "uncertain".
- Jenis truk: ikuti yang disebut (tronton, fuso, engkel=CDE, double/CDD, trailer/kontainer 40). Jika tidak disebut, pilih jenis TERKECIL yang kapasitasnya cukup untuk berat muatan, dan tandai "truckTypeCode" di "uncertain".
- stops: daftar titik bongkar berurutan. Jika klien menyebut jumlah titik (mis. "3 titik bongkar") tanpa nama, pakai lokasi bongkar klien yang dikenal di kota/area tujuan; bila kurang, isi "Titik bongkar N (<kota>)" dan tandai "stops".
- originName: lokasi muat klien yang dikenal (bila tidak disebut, pakai lokasi muat utama klien).
- cargoWeightTon dalam ton (1 ton = 1000 kg). cargoValue dalam rupiah (angka penuh) bila disebut nilai barang.
- tkbm true jika diminta jasa bongkar/muat/kuli; escort true jika diminta pengawalan; insurance true jika diminta asuransi; returnLoad true jika ini muatan balik; overnightDays = jumlah hari menginap/menunggu bila disebut.
- JANGAN mengarang harga. Harga dihitung sistem.
- uncertain: nama field yang kamu tebak atau tidak jelas (pilih dari: clientCode, routeCode, truckTypeCode, loadDate, loadTime, originName, stops, cargoDesc, cargoWeightTon, cargoValue).
- explanation: 1-2 kalimat untuk admin: asumsi yang kamu ambil dan yang perlu dikonfirmasi ke klien.

Jawab HANYA JSON:
{"clientCode": string|null, "routeCode": string|null, "truckTypeCode": string|null, "loadDate": string|null, "loadTime": string|null, "originName": string|null, "stops": [{"name": string, "city": string}], "cargoDesc": string|null, "cargoWeightTon": number|null, "cargoValue": number|null, "overnightDays": number, "tkbm": boolean, "escort": boolean, "insurance": boolean, "returnLoad": boolean, "clientRef": string|null, "uncertain": string[], "explanation": string}`;

  const user = JSON.stringify({
    permintaan: text,
    klien: clients.map(c => ({ code: c.code, name: c.name, alias: c.aliases, industri: c.industry, pola: c.orderPattern,
      lokasiMuat: locations.filter(l => l.clientId === c.id && l.kind === "Muat").map(l => `${l.name} (${l.city})`),
      lokasiBongkar: locations.filter(l => l.clientId === c.id && l.kind === "Bongkar").map(l => `${l.name} (${l.city})`) })),
    rute: routes.map(r => `${r.code}: ${r.origin} → ${r.destination} (±${r.distanceKm} km)`),
    jenisTruk: types.map(t => `${t.code}: ${t.name}, kapasitas ${t.capacityTon} ton / ${t.volumeM3} m3`),
  });

  const { text: answer, model } = await aiComplete([{ role: "system", content: system }, { role: "user", content: user }], {
    json: true, maxTokens: 4096, temperature: 0.1, reasoningEffort: "low",
    deadline: input.deadline ?? Date.now() + 50_000, attemptMs: 22_000,
  });
  const ans = parseAiJson<AiAnswer>(answer);

  // Validasi keras: kode harus ada di master data.
  const uncertain = new Set<DraftField>();
  for (const f of ans.uncertain ?? []) if (FIELD_MAP[f]) uncertain.add(FIELD_MAP[f]);
  const warnings: string[] = [];
  const up = (v: unknown) => String(v ?? "").trim().toUpperCase();

  const client = clients.find(c => c.code.toUpperCase() === up(ans.clientCode));
  if (!client) { uncertain.add("clientId"); if (ans.clientCode) warnings.push(`Klien "${ans.clientCode}" tidak ada di master klien.`); }
  const route = routes.find(r => r.code.toUpperCase() === up(ans.routeCode));
  if (!route) { uncertain.add("routeId"); warnings.push(ans.routeCode ? `Rute "${ans.routeCode}" tidak ada di tabel tarif.` : "Kota tujuan tidak terbaca / belum ada rutenya di tabel tarif."); }
  const weight = Number(ans.cargoWeightTon);
  let type = types.find(t => t.code.toUpperCase() === up(ans.truckTypeCode));
  if (!type && Number.isFinite(weight) && weight > 0) type = types.find(t => t.capacityTon >= weight);
  if (!type || !ans.truckTypeCode) uncertain.add("truckTypeId");
  if (type && Number.isFinite(weight) && weight > type.capacityTon * 1.1) warnings.push(`Muatan ${weight} ton melebihi kapasitas ${type.name} (${type.capacityTon} ton).`);

  let loadDate = /^\d{4}-\d{2}-\d{2}$/.test(String(ans.loadDate ?? "")) ? String(ans.loadDate) : "";
  if (!loadDate || loadDate < now) { loadDate = addDays(now, 1); uncertain.add("loadDate"); }
  const loadTime = /^\d{2}:\d{2}$/.test(String(ans.loadTime ?? "")) ? String(ans.loadTime) : "";
  if (!loadTime) uncertain.add("loadTime");

  const clientLocs = client ? locations.filter(l => l.clientId === client.id) : [];
  // AI kadang menyalin format "Nama (Kota)" dari prompt — cocokkan ke nama lokasi di master data.
  const known = (name: string) => clientLocs.find(l => name === l.name || name.startsWith(l.name + " ("))?.name ?? name;
  const originName = known(String(ans.originName ?? "").trim()) || clientLocs.find(l => l.kind === "Muat")?.name || "";
  if (!originName) uncertain.add("originName");
  const stops = (ans.stops ?? []).filter(s => s && String(s.name ?? "").trim()).slice(0, 10)
    .map(s => ({ name: known(String(s.name).trim()), city: String(s.city ?? "").trim() || route?.destination || "" }));
  if (stops.length === 0) stops.push({ name: route ? `Titik bongkar 1 (${route.destination})` : "Titik bongkar 1", city: route?.destination ?? "" });
  // Nama titik yang masih placeholder harus dilengkapi admin.
  if (stops.some(s => /^Titik bongkar \d/i.test(s.name))) uncertain.add("stops");
  // Jenis truk tidak disebut klien → hasil pilihan AI/kode, wajib dicek.
  if (!/tronton|fuso|engkel|\bcde\b|\bcdd\b|double|trailer|kontainer|container|40 ?ft|wingbox|colt|box/i.test(text)) uncertain.add("truckTypeId");

  const cargoDesc = String(ans.cargoDesc ?? "").trim();
  if (!cargoDesc) uncertain.add("cargoDesc");
  const cargoValue = Math.max(0, Number(ans.cargoValue) || 0);
  const insurance = Boolean(ans.insurance) || Boolean(client?.insuranceRequired);
  if (client?.insuranceRequired && !ans.insurance) warnings.push(`${client.name} wajib asuransi muatan (kontrak) — opsi asuransi diaktifkan otomatis.`);
  if (insurance && !cargoValue) { uncertain.add("cargoValue"); warnings.push("Nilai barang belum disebut — asuransi memakai premi minimum sampai nilai diisi."); }
  const escort = Boolean(ans.escort);
  if (escort && type?.sizeClass === "small") warnings.push(`Pengawalan tidak tersedia untuk ${type.name}.`);

  return {
    draft: {
      clientId: client?.id ?? "", routeId: route?.id ?? "", truckTypeId: type?.id ?? "", clientRef: String(ans.clientRef ?? "").trim(),
      loadDate, loadTime, originName, originAddress: clientLocs.find(l => l.name === originName)?.city ?? "",
      cargoDesc, cargoWeightTon: Number.isFinite(weight) && weight > 0 ? weight : null, cargoVolumeM3: null, cargoValue,
      stops, overnightDays: Math.min(Math.max(Math.floor(Number(ans.overnightDays) || 0), 0), 14),
      tkbm: Boolean(ans.tkbm), escort: escort && type?.sizeClass !== "small", insurance, returnLoad: Boolean(ans.returnLoad),
      // Diskon dari kontrak klien di master data, bukan dari AI.
      discountPercent: client?.contractDiscountPercent ?? 0,
      notes: "", source: input.source, aiNote: text.slice(0, 1000),
    },
    uncertain: [...uncertain],
    explanation: typeof ans.explanation === "string" ? ans.explanation.trim() : "",
    warnings,
    model,
  };
}
