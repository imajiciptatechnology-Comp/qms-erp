"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import VoiceButton from "@/components/VoiceButton";
import { aiDraftQuotation, createQuotation, updateQuotation, type QuotationInput } from "../actions";
import { DEFAULT_TEXT, DISCOUNT_APPROVAL_LIMIT, TAX_PERCENT, addDays, computeTotals, lineTotal, needsApproval, rupiah, today, type LineInput } from "../lib";
import { Card, ErrorNote, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../ui";

type Customer = { id: string; name: string; contactName: string | null; paymentTerms: string; type: string };
type Product = { id: string; sku: string; name: string; brand: string; model: string | null; unit: string; price: number; specs: string | null; category: string; availability: string };
type Opp = { id: string; opportunityNo: string; title: string; customerId: string };

const emptyLine = (): LineInput => ({ productId: null, description: "", specs: "", qty: 1, unit: "Unit", unitPrice: 0, discountPercent: 0 });

export default function QuotationForm({ customers, products, opportunities, initial, quotationId }: {
  customers: Customer[]; products: Product[]; opportunities: Opp[]; initial?: QuotationInput; quotationId?: string;
}) {
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const [form, setForm] = useState<QuotationInput>(initial ?? {
    customerId: "", opportunityId: null, date: today(), validUntil: addDays(today(), 30), subject: "", attention: "",
    introText: DEFAULT_TEXT.intro(""), closingText: DEFAULT_TEXT.closing, discountPercent: 0,
    paymentTerms: DEFAULT_TEXT.payment, deliveryTerms: DEFAULT_TEXT.delivery, warrantyTerms: DEFAULT_TEXT.warranty, notes: "", items: [emptyLine()],
  });
  const [aiRequest, setAiRequest] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<{ explanation: string; references: string[]; unmatched: string[] } | null>(null);
  const set = <K extends keyof QuotationInput>(k: K, v: QuotationInput[K]) => setForm(f => ({ ...f, [k]: v }));
  const setLine = (i: number, patch: Partial<LineInput>) => setForm(f => ({ ...f, items: f.items.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));

  const totals = useMemo(() => computeTotals(form.items.filter(l => l.description), form.discountPercent), [form.items, form.discountPercent]);
  const approval = needsApproval(form.discountPercent, form.items);
  const custOpps = opportunities.filter(o => o.customerId === form.customerId);

  function pickCustomer(id: string) {
    const c = customers.find(x => x.id === id);
    setForm(f => ({ ...f, customerId: id, opportunityId: null, attention: c?.contactName ?? f.attention }));
  }
  function pickProduct(i: number, id: string) {
    const p = products.find(x => x.id === id);
    if (!p) return setLine(i, { productId: null });
    setLine(i, { productId: p.id, description: p.model ? `${p.name} — ${p.brand} ${p.model}` : `${p.name} — ${p.brand}`, specs: p.specs ?? "", unit: p.unit, unitPrice: p.price });
  }

  async function runAi() {
    setAiError(null);
    setAiPending(true);
    try {
      const res = await aiDraftQuotation({ customerId: form.customerId, request: aiRequest, opportunityId: form.opportunityId });
      if (!res.success) return setAiError(res.message);
      setForm(res.draft);
      setAiInfo({ explanation: res.explanation, references: res.references, unmatched: res.unmatched });
    } catch {
      setAiError("Gagal menghubungi AI. Coba lagi.");
    } finally {
      setAiPending(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const aiNote = aiInfo ? `referensi: ${aiInfo.references.join(", ") || "-"}` : undefined;
    exec(() => quotationId ? updateQuotation(quotationId, form) : createQuotation(form, aiNote), id => router.push(`/modules/sales/quotations/${id ?? quotationId}`));
  }

  const categories = [...new Set(products.map(p => p.category))];

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card title={quotationId ? "Edit penawaran (Draft)" : "Penawaran baru"}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-2">
            <label className={labelCls} htmlFor="q-cust">Customer</label>
            <select id="q-cust" required value={form.customerId} onChange={e => pickCustomer(e.target.value)} className={inputCls}>
              <option value="" disabled>Pilih customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
            </select>
          </div>
          <div className="xl:col-span-2">
            <label className={labelCls} htmlFor="q-opp">Opportunity (opsional)</label>
            <select id="q-opp" value={form.opportunityId ?? ""} onChange={e => set("opportunityId", e.target.value || null)} className={inputCls} disabled={!form.customerId}>
              <option value="">— Tidak terkait —</option>
              {custOpps.map(o => <option key={o.id} value={o.id}>{o.opportunityNo} · {o.title}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="q-subj">Perihal</label>
            <input id="q-subj" required value={form.subject} onChange={e => set("subject", e.target.value)} className={inputCls} placeholder="Penawaran Harga Spektrofotometer UV-Vis" />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="q-att">Kepada Yth. (UP)</label>
            <input id="q-att" value={form.attention ?? ""} onChange={e => set("attention", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="q-date">Tanggal</label>
            <input id="q-date" type="date" required value={form.date} onChange={e => set("date", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="q-valid">Berlaku sampai</label>
            <input id="q-valid" type="date" required min={form.date} value={form.validUntil} onChange={e => set("validUntil", e.target.value)} className={inputCls} />
          </div>
        </div>
      </Card>

      {!quotationId && (
        <Card title={<span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-600" aria-hidden /> Isi otomatis dengan AI</span>}>
          <div className="space-y-3">
            <label className={labelCls} htmlFor="ai-req">Kebutuhan customer</label>
            <div className="flex items-start gap-2">
              <textarea
                id="ai-req" rows={3} value={aiRequest} onChange={e => setAiRequest(e.target.value)} className={inputCls} disabled={aiPending}
                placeholder="Ketik atau klik mikrofon lalu ucapkan, mis. 2 unit spektrofotometer UV-Vis untuk lab QC + 1 neraca analitik, minta diskon 5%"
              />
              <VoiceButton value={aiRequest} onChange={setAiRequest} disabled={aiPending} />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button type="button" className={btnPrimary} onClick={runAi} disabled={aiPending || !form.customerId || !aiRequest.trim()}>
                {aiPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {aiPending ? "AI sedang menyusun draft…" : "Buat draft dengan AI"}
              </button>
              <p className="text-xs text-slate-500">
                {form.customerId ? "AI memilih produk dari katalog dan meniru gaya penawaran sebelumnya. Harga selalu dari master produk. Semua isian bisa diedit sebelum disimpan." : "Pilih customer dulu."}
              </p>
            </div>
            <ErrorNote error={aiError} />
            {aiInfo && (
              <div role="status" className="text-sm bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg px-3 py-2.5 space-y-1">
                <p><b>Draft AI sudah mengisi form di bawah — periksa sebelum menyimpan.</b> {aiInfo.explanation}</p>
                {aiInfo.references.length > 0 && <p className="text-xs">Acuan: {aiInfo.references.join(", ")}</p>}
                {aiInfo.unmatched.length > 0 && <p className="text-xs text-amber-800">Tidak ada di katalog (tambahkan manual bila perlu): {aiInfo.unmatched.join("; ")}</p>}
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title="Item penawaran" actions={<button type="button" className={btnSecondary} onClick={() => set("items", [...form.items, emptyLine()])}><Plus className="w-4 h-4" /> Tambah item</button>}>
        <div className="space-y-4">
          {form.items.map((l, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-xs font-bold text-slate-400 mt-2.5 w-5">{i + 1}.</span>
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls} htmlFor={`p-${i}`}>Produk dari master</label>
                    <select id={`p-${i}`} value={l.productId ?? ""} onChange={e => pickProduct(i, e.target.value)} className={inputCls}>
                      <option value="">— Item bebas / ketik manual —</option>
                      {categories.map(cat => (
                        <optgroup key={cat} label={cat}>
                          {products.filter(p => p.category === cat).map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name} ({rupiah(p.price)}{p.availability === "Indent" ? ", indent" : ""})</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`d-${i}`}>Deskripsi</label>
                    <input id={`d-${i}`} value={l.description} onChange={e => setLine(i, { description: e.target.value })} className={inputCls} required={i === 0} />
                  </div>
                  <div className="lg:col-span-2">
                    <label className={labelCls} htmlFor={`s-${i}`}>Spesifikasi</label>
                    <textarea id={`s-${i}`} rows={2} value={l.specs ?? ""} onChange={e => setLine(i, { specs: e.target.value })} className={inputCls} />
                  </div>
                </div>
                {form.items.length > 1 && (
                  <button type="button" onClick={() => set("items", form.items.filter((_, idx) => idx !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-md mt-6" aria-label={`Hapus item ${i + 1}`}><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pl-8">
                <div><label className={labelCls} htmlFor={`qty-${i}`}>Qty</label><input id={`qty-${i}`} type="number" min={0.01} step="any" value={l.qty} onChange={e => setLine(i, { qty: Number(e.target.value) })} className={inputCls} /></div>
                <div><label className={labelCls} htmlFor={`u-${i}`}>Satuan</label><input id={`u-${i}`} value={l.unit} onChange={e => setLine(i, { unit: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls} htmlFor={`pr-${i}`}>Harga satuan</label><input id={`pr-${i}`} type="number" min={0} step={1000} value={l.unitPrice} onChange={e => setLine(i, { unitPrice: Number(e.target.value) })} className={inputCls} /></div>
                <div><label className={labelCls} htmlFor={`dc-${i}`}>Diskon %</label><input id={`dc-${i}`} type="number" min={0} max={100} step={0.5} value={l.discountPercent ?? 0} onChange={e => setLine(i, { discountPercent: Number(e.target.value) })} className={inputCls} /></div>
                <div><span className={labelCls}>Jumlah</span><p className="py-2 text-sm font-semibold text-slate-800 tabular-nums">{rupiah(lineTotal(l))}</p></div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col md:flex-row md:justify-end gap-6">
          <dl className="w-full md:w-96 text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums text-slate-800">{rupiah(totals.subtotal)}</dd></div>
            <div className="flex justify-between items-center gap-3">
              <dt className="text-slate-500 flex items-center gap-2"><label htmlFor="q-disc">Diskon tambahan %</label>
                <input id="q-disc" type="number" min={0} max={100} step={0.5} value={form.discountPercent} onChange={e => set("discountPercent", Number(e.target.value))} className="w-20 px-2 py-1 border border-slate-200 rounded-md text-sm text-slate-900" />
              </dt>
              <dd className="tabular-nums text-slate-800">− {rupiah(totals.discountAmount)}</dd>
            </div>
            <div className="flex justify-between"><dt className="text-slate-500">PPN {TAX_PERCENT}%</dt><dd className="tabular-nums text-slate-800">{rupiah(totals.taxAmount)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><dt className="text-slate-800">Total</dt><dd className="tabular-nums text-slate-900">{rupiah(totals.total)}</dd></div>
          </dl>
        </div>
        {approval && (
          <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden /> Ada diskon di atas {DISCOUNT_APPROVAL_LIMIT}% — saat diajukan, penawaran ini butuh persetujuan Sales Manager.
          </p>
        )}
      </Card>

      <Card title="Teks surat & syarat">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div><label className={labelCls} htmlFor="q-intro">Paragraf pembuka</label><textarea id="q-intro" rows={6} value={form.introText ?? ""} onChange={e => set("introText", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="q-close">Paragraf penutup</label><textarea id="q-close" rows={6} value={form.closingText ?? ""} onChange={e => set("closingText", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="q-pay">Syarat pembayaran</label><textarea id="q-pay" rows={2} value={form.paymentTerms ?? ""} onChange={e => set("paymentTerms", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="q-del">Pengiriman</label><textarea id="q-del" rows={2} value={form.deliveryTerms ?? ""} onChange={e => set("deliveryTerms", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="q-war">Garansi</label><textarea id="q-war" rows={2} value={form.warrantyTerms ?? ""} onChange={e => set("warrantyTerms", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="q-notes">Catatan internal (tidak dicetak)</label><textarea id="q-notes" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} className={inputCls} /></div>
        </div>
      </Card>

      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <Link href={quotationId ? `/modules/sales/quotations/${quotationId}` : "/modules/sales/quotations"} className={btnSecondary}>Batal</Link>
        <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Simpan sebagai Draft"}</button>
      </div>
    </form>
  );
}
