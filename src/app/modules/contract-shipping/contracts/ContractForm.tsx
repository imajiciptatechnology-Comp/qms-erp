"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calculator, Loader2, Lock, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import VoiceButton from "@/components/VoiceButton";
import { aiDraftContract, createContract, getInstalledBase, updateContract, type ContractInput, type ContractItem } from "@/app/modules/sales/actions";
import { buildClauses, defaultScope, type Clause } from "@/app/modules/sales/documents/contractTemplates";
import { CONTRACT_TYPES, addDays, rupiah, today } from "@/app/modules/sales/lib";
import { Card, ErrorNote, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "@/app/modules/sales/ui";

type Customer = { id: string; name: string; type: string; paymentTerms: string; contactName: string | null; contactTitle: string | null; signatoryName: string | null; signatoryTitle: string | null };

const VISITS: Record<string, number | null> = { AMC: 2, Kalibrasi: 1, Service: null, Garansi: null };

export default function ContractForm({ customers, servicePrices, initial, contractId }: {
  customers: Customer[]; servicePrices: { sku: string; name: string; price: number }[]; initial?: ContractInput; contractId?: string;
}) {
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const [form, setForm] = useState<ContractInput>(initial ?? {
    customerId: "", type: "AMC", title: "", startDate: today(), endDate: addDays(today(), 364), value: 0, visitsPerYear: 2,
    coveredItems: [], scope: "", responseTime: "", paymentTerms: "", billingSchedule: "Upfront", sparePartDiscount: 15,
    signatoryName: "", signatoryTitle: "", clauses: [], picName: "", notes: "",
  });
  const set = <K extends keyof ContractInput>(k: K, v: ContractInput[K]) => setForm(f => ({ ...f, [k]: v }));
  const [loadedBase, setLoadedBase] = useState<{ customerId: string; rows: ContractItem[] }>({ customerId: "", rows: [] });
  const [aiRequest, setAiRequest] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<{ explanation: string; references: string[] } | null>(null);
  const customer = customers.find(c => c.id === form.customerId);
  const isWarranty = form.type === "Garansi";

  // Alat terpasang customer untuk dipilih (state hanya di-set setelah data datang).
  useEffect(() => {
    if (!form.customerId) return;
    let alive = true;
    const id = form.customerId;
    getInstalledBase(id).then(rows => { if (alive) setLoadedBase({ customerId: id, rows }); });
    return () => { alive = false; };
  }, [form.customerId]);
  const base = loadedBase.customerId === form.customerId ? loadedBase.rows : [];
  const baseLoading = !!form.customerId && loadedBase.customerId !== form.customerId;

  const key = (it: ContractItem) => `${it.product}|${it.serialNumber}`;
  const selected = new Set(form.coveredItems.map(key));
  const toggleItem = (it: ContractItem) => set("coveredItems", selected.has(key(it)) ? form.coveredItems.filter(x => key(x) !== key(it)) : [...form.coveredItems, it]);
  const extraItems = form.coveredItems.filter(it => !base.some(b => key(b) === key(it)));

  function pickCustomer(id: string) {
    const c = customers.find(x => x.id === id);
    setForm(f => ({
      ...f, customerId: id, coveredItems: [],
      signatoryName: c?.signatoryName || c?.contactName || "", signatoryTitle: c?.signatoryTitle || c?.contactTitle || "",
      title: f.title || (c ? `Kontrak ${f.type} ${c.name}` : ""),
    }));
  }
  function pickType(type: string) {
    setForm(f => ({ ...f, type, visitsPerYear: VISITS[type] ?? null, sparePartDiscount: type === "AMC" ? 15 : null, clauses: [] }));
  }

  const priceOf = (suffix: string) => servicePrices.find(p => p.sku.endsWith(suffix))?.price ?? 0;
  const suggestedValue = form.type === "AMC" ? priceOf("SRV-002") * form.coveredItems.length
    : form.type === "Kalibrasi" ? priceOf("SRV-001") * form.coveredItems.length * (form.visitsPerYear || 1) : 0;

  const clauseParams = () => ({
    type: form.type, startDate: form.startDate, endDate: form.endDate, visitsPerYear: form.visitsPerYear, responseTime: form.responseTime,
    value: form.value, paymentTerms: form.paymentTerms, billingSchedule: form.billingSchedule, sparePartDiscount: form.sparePartDiscount,
    scope: form.scope, itemCount: form.coveredItems.length,
  });
  const setClause = (i: number, patch: Partial<Clause>) => set("clauses", (form.clauses ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  async function runAi() {
    setAiError(null);
    setAiPending(true);
    try {
      const res = await aiDraftContract({ customerId: form.customerId, type: form.type, request: aiRequest });
      if (!res.success) return setAiError(res.message);
      setForm(res.draft);
      setAiInfo({ explanation: res.explanation, references: res.references });
    } catch {
      setAiError("Gagal menghubungi AI. Coba lagi.");
    } finally {
      setAiPending(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const aiNote = aiInfo ? `acuan: ${aiInfo.references.join(", ") || "pasal baku"}` : undefined;
    exec(() => (contractId ? updateContract(contractId, form) : createContract(form, aiNote)), id => router.push(`/modules/contract-shipping/contracts/${id ?? contractId}`));
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card title={contractId ? "Edit kontrak (Draft)" : "Kontrak baru"}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-2">
            <label className={labelCls} htmlFor="c-cust">Customer</label>
            <select id="c-cust" required value={form.customerId} onChange={e => pickCustomer(e.target.value)} className={inputCls}>
              <option value="" disabled>Pilih customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="c-type">Jenis</label>
            <select id="c-type" value={form.type} onChange={e => pickType(e.target.value)} className={inputCls} disabled={!!contractId}>{CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
          </div>
          <div>
            <label className={labelCls} htmlFor="c-bill">Jadwal tagih</label>
            <select id="c-bill" value={form.billingSchedule} onChange={e => set("billingSchedule", e.target.value)} className={inputCls} disabled={isWarranty}>
              <option value="Upfront">100% di awal periode</option><option value="Quarterly">Per triwulan (4× 25%)</option>
            </select>
          </div>
          <div className="md:col-span-2"><label className={labelCls} htmlFor="c-title">Judul</label><input id="c-title" required value={form.title} onChange={e => set("title", e.target.value)} className={inputCls} placeholder="mis. Kontrak Perawatan Tahunan Lab Mikrobiologi" /></div>
          <div><label className={labelCls} htmlFor="c-start">Mulai</label><input id="c-start" type="date" required value={form.startDate} onChange={e => set("startDate", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="c-end">Berakhir</label><input id="c-end" type="date" required min={form.startDate} value={form.endDate} onChange={e => set("endDate", e.target.value)} className={inputCls} /></div>
        </div>
      </Card>

      {!contractId && !isWarranty && (
        <Card title={<span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-600" aria-hidden /> Isi otomatis dengan AI</span>}>
          <div className="space-y-3">
            <label className={labelCls} htmlFor="c-ai">Kebutuhan kontrak</label>
            <div className="flex items-start gap-2">
              <textarea id="c-ai" rows={3} value={aiRequest} onChange={e => setAiRequest(e.target.value)} className={inputCls} disabled={aiPending}
                placeholder="Ketik atau ucapkan, mis. AMC 1 tahun untuk semua alat lab mikrobiologi, 2x kunjungan, respon 2x24 jam, tagih per triwulan" />
              <VoiceButton value={aiRequest} onChange={setAiRequest} disabled={aiPending} />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button type="button" className={btnPrimary} onClick={runAi} disabled={aiPending || !form.customerId || !aiRequest.trim()}>
                {aiPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {aiPending ? "AI sedang menyusun draft…" : "Buat draft dengan AI"}
              </button>
              <p className="text-xs text-slate-500">{form.customerId ? "AI memilih alat dari installed base customer, menghitung nilai dari harga master, dan menyesuaikan pasal (pasal hukum 🔒 tidak diubah)." : "Pilih customer dulu."}</p>
            </div>
            <ErrorNote error={aiError} />
            {aiInfo && (
              <div role="status" className="text-sm bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg px-3 py-2.5 space-y-1">
                <p><b>Draft AI sudah mengisi form di bawah — periksa sebelum menyimpan.</b> {aiInfo.explanation}</p>
                {aiInfo.references.length > 0 && <p className="text-xs">Acuan: {aiInfo.references.join(", ")}</p>}
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title={`Alat yang dicakup (${form.coveredItems.length})`} actions={
        <button type="button" className={btnSecondary} onClick={() => set("coveredItems", [...form.coveredItems, { product: "", serialNumber: "", location: "" }])}><Plus className="w-4 h-4" /> Alat lain</button>
      }>
        {!form.customerId ? <p className="text-sm text-slate-500">Pilih customer untuk melihat alat yang terpasang.</p> : baseLoading ? <p className="text-sm text-slate-500">Memuat alat terpasang…</p> : (
          <div className="space-y-3">
            {base.length === 0 && <p className="text-sm text-slate-500">Belum ada alat terpasang tercatat untuk customer ini. Tambahkan manual.</p>}
            {base.length > 0 && (
              <ul className="grid sm:grid-cols-2 gap-2">
                {base.map(it => (
                  <li key={key(it)}>
                    <label className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${selected.has(key(it)) ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={selected.has(key(it))} onChange={() => toggleItem(it)} className="mt-0.5" />
                      <span><span className="font-medium text-slate-800">{it.product}</span><span className="block text-xs text-slate-500">S/N {it.serialNumber}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {extraItems.map(it => {
              const idx = form.coveredItems.indexOf(it);
              const patch = (p: Partial<ContractItem>) => set("coveredItems", form.coveredItems.map((x, i) => (i === idx ? { ...x, ...p } : x)));
              return (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-5"><label className={labelCls} htmlFor={`ci-p-${idx}`}>Alat</label><input id={`ci-p-${idx}`} value={it.product} onChange={e => patch({ product: e.target.value })} className={inputCls} /></div>
                  <div className="sm:col-span-3"><label className={labelCls} htmlFor={`ci-s-${idx}`}>No. seri</label><input id={`ci-s-${idx}`} value={it.serialNumber} onChange={e => patch({ serialNumber: e.target.value })} className={inputCls} /></div>
                  <div className="sm:col-span-3"><label className={labelCls} htmlFor={`ci-l-${idx}`}>Lokasi</label><input id={`ci-l-${idx}`} value={it.location ?? ""} onChange={e => patch({ location: e.target.value })} className={inputCls} /></div>
                  <button type="button" onClick={() => set("coveredItems", form.coveredItems.filter((_, i) => i !== idx))} className="p-2 text-red-500 hover:bg-red-50 rounded-md justify-self-start" aria-label="Hapus alat"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Ketentuan">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-2">
            <label className={labelCls} htmlFor="c-val">Nilai kontrak (Rp, belum PPN)</label>
            <div className="flex gap-2">
              <input id="c-val" type="number" min={0} step={1000} value={form.value} onChange={e => set("value", Number(e.target.value))} className={inputCls} disabled={isWarranty} />
              {!isWarranty && suggestedValue > 0 && (
                <button type="button" className={btnSecondary} onClick={() => set("value", suggestedValue)} title="Harga master × jumlah alat"><Calculator className="w-4 h-4" /> {rupiah(suggestedValue)}</button>
              )}
            </div>
          </div>
          <div><label className={labelCls} htmlFor="c-visits">Kunjungan / tahun</label><input id="c-visits" type="number" min={0} max={12} value={form.visitsPerYear ?? ""} onChange={e => set("visitsPerYear", e.target.value ? Number(e.target.value) : null)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="c-disc">Diskon suku cadang %</label><input id="c-disc" type="number" min={0} max={50} value={form.sparePartDiscount ?? ""} onChange={e => set("sparePartDiscount", e.target.value ? Number(e.target.value) : null)} className={inputCls} disabled={isWarranty} /></div>
          <div><label className={labelCls} htmlFor="c-resp">Waktu respon</label><input id="c-resp" value={form.responseTime ?? ""} onChange={e => set("responseTime", e.target.value)} className={inputCls} placeholder="Kosongkan: 2x24 jam hari kerja" /></div>
          <div className="md:col-span-1 xl:col-span-3"><label className={labelCls} htmlFor="c-pay">Syarat pembayaran</label><input id="c-pay" value={form.paymentTerms ?? ""} onChange={e => set("paymentTerms", e.target.value)} className={inputCls} placeholder={`Kosongkan: 30 hari setelah invoice diterima${customer ? ` (termin customer: ${customer.paymentTerms})` : ""}`} disabled={isWarranty} /></div>
          <div className="md:col-span-2"><label className={labelCls} htmlFor="c-sign">Penandatangan customer</label><input id="c-sign" value={form.signatoryName ?? ""} onChange={e => set("signatoryName", e.target.value)} className={inputCls} placeholder="Nama pejabat yang menandatangani" /></div>
          <div className="md:col-span-2"><label className={labelCls} htmlFor="c-signt">Jabatan penandatangan</label><input id="c-signt" value={form.signatoryTitle ?? ""} onChange={e => set("signatoryTitle", e.target.value)} className={inputCls} /></div>
          {!isWarranty && (
            <div className="md:col-span-2 xl:col-span-4"><label className={labelCls} htmlFor="c-scope">Ruang lingkup</label>
              <textarea id="c-scope" rows={3} value={form.scope ?? ""} onChange={e => set("scope", e.target.value)} className={inputCls} placeholder={`Kosongkan untuk memakai ruang lingkup baku: ${defaultScope(form.type)}`} />
            </div>
          )}
          <div className="md:col-span-1 xl:col-span-2"><label className={labelCls} htmlFor="c-pic">PIC / teknisi</label><input id="c-pic" value={form.picName ?? ""} onChange={e => set("picName", e.target.value)} className={inputCls} /></div>
          <div className="md:col-span-1 xl:col-span-2"><label className={labelCls} htmlFor="c-notes">Catatan internal</label><input id="c-notes" value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} className={inputCls} /></div>
        </div>
      </Card>

      {!isWarranty && (
        <Card title="Pasal perjanjian" actions={
          <button type="button" className={btnSecondary} onClick={() => set("clauses", buildClauses(clauseParams()))}><RotateCcw className="w-4 h-4" /> {form.clauses?.length ? "Susun ulang dari pasal baku" : "Tampilkan & edit pasal"}</button>
        }>
          {!form.clauses?.length ? (
            <p className="text-sm text-slate-500">Pasal baku (versi contoh — direview legal) akan disusun otomatis saat disimpan, menyesuaikan nilai, periode, jadwal & alat di atas. Klik tombol di kanan untuk melihat dan mengubahnya.</p>
          ) : (
            <ol className="space-y-4">
              {form.clauses.map((c, i) => (
                <li key={c.key + i} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 w-16 shrink-0">Pasal {i + 1}</span>
                    <input aria-label={`Judul pasal ${i + 1}`} value={c.title} onChange={e => setClause(i, { title: e.target.value })} className={`${inputCls} font-semibold`} />
                    {c.locked && <span title="Pasal hukum baku: tidak diubah oleh AI" className="text-amber-700 shrink-0"><Lock className="w-4 h-4" aria-label="Pasal hukum baku" /></span>}
                  </div>
                  <textarea aria-label={`Isi pasal ${i + 1}`} rows={Math.min(8, Math.max(3, Math.ceil(c.body.length / 110)))} value={c.body} onChange={e => setClause(i, { body: e.target.value })} className={`${inputCls} mt-2`} />
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <Link href={contractId ? `/modules/contract-shipping/contracts/${contractId}` : "/modules/contract-shipping/contracts"} className={btnSecondary}>Batal</Link>
        <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : isWarranty ? "Simpan garansi" : "Simpan sebagai Draft"}</button>
      </div>
    </form>
  );
}
