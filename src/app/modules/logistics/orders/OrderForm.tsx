"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, MessageSquareText, Plus, Sparkles, Trash2 } from "lucide-react";
import VoiceButton from "@/components/VoiceButton";
import { aiDraftOrder, createOrder, updateOrder, type OrderInput } from "../actions";
import { computeCharterPrice, addDays, today, type RateTable } from "../lib";
import { Card, ErrorNote, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../ui";
import PriceBreakdown from "../PriceBreakdown";

type Loc = { name: string; city: string; kind: string };
export type ClientOption = { id: string; code: string; name: string; contractDiscountPercent: number; insuranceRequired: boolean; locations: Loc[] };
type Field = "clientId" | "routeId" | "truckTypeId" | "loadDate" | "loadTime" | "originName" | "stops" | "cargoDesc" | "cargoWeightTon" | "cargoValue" | "options";

/** Contoh permintaan untuk demo (bisa diklik). */
const EXAMPLES = [
  "Sinar Pangan butuh tronton wingbox Cikarang ke Semarang besok pagi, 14 ton, 3 titik bongkar",
  "Pak, dari Elektronika Prima mau kirim TV 320 unit ke Surabaya lusa jam 8, berat kira2 6,5 ton, nilai barang 1,6 M. Minta dikawal ya",
  "Kemas Plastindo order CDD ke Bandung hari Senin siang, botol PET 180 bal sekitar 3,8 ton",
  "Baja Konstruksi perlu trailer 40 ft ke Merak tgl 20 bulan ini, besi beton 24 ton, tolong sekalian TKBM",
  "Agro Tani: pupuk 7 ton ke Cirebon besok sore, nunggu bongkar kemungkinan nginep 1 hari",
];

const blank = (): OrderInput => ({
  clientId: "", routeId: "", truckTypeId: "", clientRef: "", loadDate: addDays(today(), 1), loadTime: "06:00", originName: "", originAddress: "",
  cargoDesc: "", cargoWeightTon: null, cargoVolumeM3: null, cargoValue: 0, stops: [{ name: "", city: "" }],
  overnightDays: 0, tkbm: false, escort: false, insurance: false, returnLoad: false, discountPercent: 0, notes: "", source: "Manual",
});

export default function OrderForm({ clients, table, initial, orderId, aiConfigured }: {
  clients: ClientOption[]; table: RateTable; initial?: OrderInput; orderId?: string; aiConfigured: boolean;
}) {
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const [form, setForm] = useState<OrderInput>(initial ?? blank());
  const [aiText, setAiText] = useState("");
  const [usedVoice, setUsedVoice] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<{ explanation: string; warnings: string[]; model: string } | null>(null);
  const [unsure, setUnsure] = useState<Set<Field>>(new Set());

  const set = <K extends keyof OrderInput>(k: K, v: OrderInput[K], field?: Field) => {
    setForm(f => ({ ...f, [k]: v }));
    if (field) setUnsure(u => { const n = new Set(u); n.delete(field); return n; });
  };
  const client = clients.find(c => c.id === form.clientId);
  const type = table.truckTypes.find(t => t.id === form.truckTypeId);
  const price = useMemo(() => computeCharterPrice(table, {
    routeId: form.routeId, truckTypeId: form.truckTypeId, stopCount: form.stops.filter(s => s.name.trim()).length || 1,
    overnightDays: form.overnightDays, tkbm: form.tkbm, escort: form.escort, insurance: form.insurance, returnLoad: form.returnLoad,
    cargoValue: form.cargoValue, discountPercent: form.discountPercent,
  }), [table, form]);
  const overweight = type && form.cargoWeightTon ? form.cargoWeightTon / type.capacityTon : 0;

  function pickClient(id: string) {
    const c = clients.find(x => x.id === id);
    setForm(f => ({
      ...f, clientId: id, discountPercent: c?.contractDiscountPercent ?? 0, insurance: f.insurance || Boolean(c?.insuranceRequired),
      originName: f.originName || c?.locations.find(l => l.kind === "Muat")?.name || "",
    }));
    setUnsure(u => { const n = new Set(u); n.delete("clientId"); return n; });
  }
  const setStop = (i: number, patch: Partial<OrderInput["stops"][number]>) => {
    setForm(f => ({ ...f, stops: f.stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
    setUnsure(u => { const n = new Set(u); n.delete("stops"); return n; });
  };

  async function runAi() {
    setAiError(null);
    setAiPending(true);
    try {
      const res = await aiDraftOrder({ text: aiText, source: usedVoice ? "Suara" : "Teks" });
      if (!res.success) return setAiError(res.message);
      setForm(res.draft);
      setUnsure(new Set(res.uncertain as Field[]));
      setAiInfo({ explanation: res.explanation, warnings: res.warnings, model: res.model });
    } catch {
      setAiError("Gagal menghubungi AI. Coba lagi, atau isi form secara manual.");
    } finally {
      setAiPending(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    exec(() => (orderId ? updateOrder(orderId, form) : createOrder(form)), id => router.push(`/modules/logistics/orders/${id ?? orderId}`));
  }

  const flag = (f: Field) => (unsure.has(f) ? " ring-2 ring-amber-400 border-amber-400 bg-amber-50" : "");
  const check = (f: Field) => (unsure.has(f) ? <span className="ml-1 normal-case tracking-normal text-amber-700 font-semibold">· cek</span> : null);
  const muat = client?.locations.filter(l => l.kind === "Muat") ?? [];
  const bongkar = client?.locations.filter(l => l.kind === "Bongkar") ?? [];

  return (
    <form onSubmit={submit} className="space-y-6">
      {!orderId && (
        <Card title={<span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-600" aria-hidden /> Order from chat / voice (AI)</span>}>
          <div className="space-y-3">
            <label className={labelCls} htmlFor="ai-text">Tempel chat/email klien, atau klik mikrofon lalu bicara</label>
            <div className="flex items-start gap-2">
              <textarea id="ai-text" rows={3} value={aiText} disabled={aiPending} className={inputCls}
                onChange={e => setAiText(e.target.value)}
                placeholder="mis. Sinar Pangan butuh tronton wingbox Cikarang ke Semarang besok pagi, 14 ton, 3 titik bongkar" />
              <VoiceButton value={aiText} disabled={aiPending} onChange={t => { setAiText(t); setUsedVoice(true); }} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-slate-500 self-center flex items-center gap-1"><MessageSquareText className="w-3.5 h-3.5" aria-hidden /> Contoh:</span>
              {EXAMPLES.map((ex, i) => (
                <button key={i} type="button" onClick={() => { setAiText(ex); setUsedVoice(false); }} disabled={aiPending}
                  className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 max-w-[260px] truncate" title={ex}>
                  {ex}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button type="button" className={btnPrimary} onClick={runAi} disabled={aiPending || !aiText.trim() || !aiConfigured}>
                {aiPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {aiPending ? "AI sedang membaca…" : "Fill order with AI"}
              </button>
              <p className="text-xs text-slate-500">
                {aiConfigured
                  ? "AI hanya mengisi draft (klien, rute, truk, tanggal, muatan, titik bongkar). Harga selalu dari tabel tarif. Isian yang ragu ditandai kuning."
                  : "AI belum dikonfigurasi di server ini — isi form secara manual."}
              </p>
            </div>
            <ErrorNote error={aiError} />
            {aiInfo && (
              <div role="status" className="text-sm bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg px-3 py-2.5 space-y-1">
                <p><b>Draft AI sudah mengisi form — periksa sebelum menyimpan.</b> {aiInfo.explanation}</p>
                {unsure.size > 0 && <p className="text-xs text-amber-800">Ditandai kuning = perlu dicek ({unsure.size} isian).</p>}
                {aiInfo.warnings.map((w, i) => <p key={i} className="text-xs text-amber-800">⚠ {w}</p>)}
                <p className="text-[11px] text-indigo-700/70">Model: {aiInfo.model}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title={orderId ? "Edit charter order" : "Charter order"}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls} htmlFor="o-client">Klien{check("clientId")}</label>
                <select id="o-client" required value={form.clientId} onChange={e => pickClient(e.target.value)} className={inputCls + flag("clientId")}>
                  <option value="" disabled>Pilih klien</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="o-ref">No. referensi klien (PO/DO)</label>
                <input id="o-ref" value={form.clientRef ?? ""} onChange={e => set("clientRef", e.target.value)} className={inputCls} placeholder="opsional" />
              </div>
              <div>
                <label className={labelCls} htmlFor="o-route">Rute (asal pool Cikarang){check("routeId")}</label>
                <select id="o-route" required value={form.routeId} onChange={e => set("routeId", e.target.value, "routeId")} className={inputCls + flag("routeId")}>
                  <option value="" disabled>Pilih rute</option>
                  {table.routes.map(r => <option key={r.id} value={r.id}>{r.code} · {r.origin} → {r.destination} (±{r.distanceKm} km)</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="o-type">Jenis truk{check("truckTypeId")}</label>
                <select id="o-type" required value={form.truckTypeId} onChange={e => {
                  const small = table.truckTypes.find(t => t.id === e.target.value)?.sizeClass === "small";
                  setForm(f => ({ ...f, truckTypeId: e.target.value, escort: small ? false : f.escort }));
                  setUnsure(u => { const n = new Set(u); n.delete("truckTypeId"); return n; });
                }} className={inputCls + flag("truckTypeId")}>
                  <option value="" disabled>Pilih jenis truk</option>
                  {table.truckTypes.map(t => <option key={t.id} value={t.id}>{t.name} — {t.capacityTon} ton / {t.volumeM3} m³</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} htmlFor="o-date">Tanggal muat{check("loadDate")}</label>
                  <input id="o-date" type="date" required value={form.loadDate} onChange={e => set("loadDate", e.target.value, "loadDate")} className={inputCls + flag("loadDate")} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="o-time">Jam{check("loadTime")}</label>
                  <input id="o-time" type="time" value={form.loadTime ?? ""} onChange={e => set("loadTime", e.target.value, "loadTime")} className={inputCls + flag("loadTime")} />
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="o-origin">Lokasi muat{check("originName")}</label>
                <input id="o-origin" required list="o-origin-list" value={form.originName} onChange={e => set("originName", e.target.value, "originName")} className={inputCls + flag("originName")} placeholder="Gudang klien" />
                <datalist id="o-origin-list">{muat.map(l => <option key={l.name} value={l.name}>{l.city}</option>)}</datalist>
              </div>
            </div>
          </Card>

          <Card title={<>Titik bongkar <span className="text-xs font-normal text-slate-500">(titik ke-2 dst. = multi-drop)</span>{check("stops")}</>}
            actions={<button type="button" className={btnSecondary} onClick={() => setForm(f => ({ ...f, stops: [...f.stops, { name: "", city: "" }] }))}><Plus className="w-4 h-4" /> Add drop</button>}>
            <datalist id="o-stop-list">{bongkar.map(l => <option key={l.name} value={l.name}>{l.city}</option>)}</datalist>
            <ol className="space-y-2">
              {form.stops.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-6 text-sm font-semibold text-slate-500 shrink-0">{i + 1}.</span>
                  <input aria-label={`Nama titik bongkar ${i + 1}`} list="o-stop-list" value={s.name} required={i === 0} className={inputCls + flag("stops")}
                    onChange={e => { const loc = bongkar.find(l => l.name === e.target.value); setStop(i, { name: e.target.value, ...(loc ? { city: loc.city } : {}) }); }}
                    placeholder="Nama penerima / gudang" />
                  <input aria-label={`Kota titik bongkar ${i + 1}`} value={s.city ?? ""} onChange={e => setStop(i, { city: e.target.value })} className={inputCls + " max-w-[160px]" + flag("stops")} placeholder="Kota" />
                  <button type="button" aria-label={`Hapus titik ${i + 1}`} disabled={form.stops.length === 1}
                    onClick={() => setForm(f => ({ ...f, stops: f.stops.filter((_, idx) => idx !== i) }))}
                    className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Muatan & layanan tambahan">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className={labelCls} htmlFor="o-cargo">Deskripsi muatan{check("cargoDesc")}</label>
                <input id="o-cargo" required value={form.cargoDesc} onChange={e => set("cargoDesc", e.target.value, "cargoDesc")} className={inputCls + flag("cargoDesc")} placeholder="mis. Mi instan 1.200 karton" />
              </div>
              <div>
                <label className={labelCls} htmlFor="o-weight">Berat (ton){check("cargoWeightTon")}</label>
                <input id="o-weight" type="number" min={0} step="0.1" value={form.cargoWeightTon ?? ""} className={inputCls + flag("cargoWeightTon")}
                  onChange={e => set("cargoWeightTon", e.target.value === "" ? null : Number(e.target.value), "cargoWeightTon")} />
              </div>
              <div>
                <label className={labelCls} htmlFor="o-vol">Volume (m³)</label>
                <input id="o-vol" type="number" min={0} step="0.1" value={form.cargoVolumeM3 ?? ""} className={inputCls}
                  onChange={e => set("cargoVolumeM3", e.target.value === "" ? null : Number(e.target.value))} />
              </div>
              <div>
                <label className={labelCls} htmlFor="o-value">Nilai barang (Rp){check("cargoValue")}</label>
                <input id="o-value" type="number" min={0} step={1000} value={form.cargoValue || ""} className={inputCls + flag("cargoValue")}
                  onChange={e => set("cargoValue", Number(e.target.value) || 0, "cargoValue")} />
              </div>
            </div>
            {overweight > 1 && (
              <p role="alert" className={`mt-3 text-sm rounded-lg px-3 py-2 border flex items-start gap-2 ${overweight > 1.1 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {overweight > 1.1
                  ? `Muatan ${Math.round(overweight * 100)}% dari kapasitas ${type!.name} (${type!.capacityTon} ton) — melebihi 110%, order tidak bisa disimpan. Pilih truk lebih besar.`
                  : `Muatan ${Math.round(overweight * 100)}% dari kapasitas ${type!.name} — nanti butuh override Operations Manager saat dispatch.`}
              </p>
            )}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                ["tkbm", "Jasa bongkar muat (TKBM)"],
                ["escort", type?.sizeClass === "small" ? "Pengawalan (tidak tersedia untuk CDE/CDD)" : "Pengawalan"],
                ["insurance", client?.insuranceRequired ? "Asuransi muatan (wajib sesuai kontrak klien)" : "Asuransi muatan (0,1% nilai barang)"],
                ["returnLoad", "Muatan balik (diskon 20% tarif rute)"],
              ] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-slate-700 p-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked, "options")}
                    disabled={k === "escort" && type?.sizeClass === "small"} className="w-4 h-4 rounded border-slate-300" />
                  {label}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm text-slate-700 p-2 rounded-lg border border-slate-100">
                Menginap/menunggu
                <input type="number" min={0} max={14} value={form.overnightDays} onChange={e => set("overnightDays", Math.max(0, Number(e.target.value) || 0), "options")}
                  className="w-16 px-2 py-1 border border-slate-200 rounded-md text-sm" aria-label="Jumlah hari menginap" /> hari
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 p-2 rounded-lg border border-slate-100">
                Diskon kontrak
                <input type="number" min={0} max={30} step="0.5" value={form.discountPercent} onChange={e => set("discountPercent", Number(e.target.value) || 0)}
                  className="w-16 px-2 py-1 border border-slate-200 rounded-md text-sm" aria-label="Diskon kontrak (%)" /> %
              </label>
            </div>
            <div className="mt-4">
              <label className={labelCls} htmlFor="o-notes">Catatan</label>
              <textarea id="o-notes" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} className={inputCls} />
            </div>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 self-start">
          <Card title="Automatic price">
            <PriceBreakdown price={price} />
          </Card>
          <ErrorNote error={error} />
          <div className="flex gap-2">
            <button type="submit" className={btnPrimary} disabled={pending || !price.ok || overweight > 1.1}>
              {pending && <Loader2 className="w-4 h-4 animate-spin" />} {orderId ? "Save changes" : "Save order (Draft)"}
            </button>
            <Link href={orderId ? `/modules/logistics/orders/${orderId}` : "/modules/logistics/orders"} className={btnSecondary}>Cancel</Link>
          </div>
        </div>
      </div>
    </form>
  );
}
