"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, ScanLine, X } from "lucide-react";
import { compressImage } from "@/components/ScanDocumentButton";
import { ErrorNote, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../ui";
import { SERVICE_INTERVAL, addDays, normPlate } from "../lib";
import { saveDriverDocument, saveServiceRecord, saveVehicleDocument, scanFleetDoc, setDocumentStatus } from "./actions";
import type { FleetScanFields, ScanDocType } from "../ai/scanFleetDoc";

type TypeOpt = { value: string; label: string; hint: string };

const aiMark = "ring-2 ring-blue-300 bg-blue-50";

function dataUrlToFile(dataUrl: string, name: string) {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name.replace(/\.[^.]+$/, "") + ".jpg", { type: mime });
}

/** Halaman pertama PDF → JPEG (untuk scan AI). PDF aslinya tetap yang disimpan. */
async function pdfFirstPageToJpeg(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(2.5, 1600 / Math.max(base.width, base.height)) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  await doc.destroy();
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** File + tombol scan AI. Foto dikecilkan di browser sebelum diunggah/di-scan; PDF di-scan dari halaman pertama. */
function useFilePick() {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  async function pick(f: File | undefined) {
    setFileError(null);
    setDataUrl(null);
    setFile(null);
    if (!f) return;
    if (f.type.startsWith("image/")) {
      try {
        const url = await compressImage(f);
        setDataUrl(url);
        setFile(dataUrlToFile(url, f.name));
      } catch {
        setFileError("Gagal membaca foto. Coba file lain.");
      }
    } else if (f.type === "application/pdf") {
      if (f.size > 4 * 1024 * 1024) { setFileError("PDF maks. 4 MB."); return; }
      setFile(f);
      try {
        setDataUrl(await pdfFirstPageToJpeg(f));
      } catch {
        setFileError("PDF tersimpan, tapi halaman pertamanya tidak bisa dibaca untuk scan AI. Isi manual atau pakai foto.");
      }
    } else setFileError("Pilih foto (JPG/PNG) atau PDF. Foto HEIC dari iPhone: ubah ke JPG dulu.");
  }
  return { file, dataUrl, fileError, pick };
}

type ScanState = { loading: boolean; error: string | null; note: string | null; warn: string[]; filled: Set<string> };
const emptyScan: ScanState = { loading: false, error: null, note: null, warn: [], filled: new Set() };

function ScanPanel({ scan, onScan, canScan, onClear }: { scan: ScanState; onScan: () => void; canScan: boolean; onClear: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onScan} disabled={!canScan || scan.loading} className={btnSecondary}>
          {scan.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4 text-blue-600" />}
          {scan.loading ? "Membaca dokumen…" : "Scan with AI"}
        </button>
        <span className="text-xs text-slate-500">{scan.loading ? "AI gratis biasanya butuh 10–40 detik — jangan tutup form." : canScan ? "Field yang terbaca ditandai biru." : "Pilih foto/PDF dokumen dulu, lalu tekan Scan."}</span>
      </div>
      {scan.error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">{scan.error}</p>}
      {scan.note && (
        <div role="status" className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-2 space-y-1">
          <p className="flex gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-blue-600 shrink-0" />{scan.note}</p>
          {scan.warn.map(w => <p key={w} className="flex gap-1.5 text-amber-800"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-600 shrink-0" />{w}</p>)}
          <button type="button" onClick={onClear} className="text-slate-500 hover:text-slate-800 underline">Tutup</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// Dokumen truk / sopir
// ---------------------------------------------------------

type DocFields = { docType: string; docNo: string; holderName: string; simClass: string; issuer: string; validFrom: string; validUntil: string; amount: string; paidDate: string; notes: string; status: string };

export function AddDocumentForm({ kind, ownerId, plateNo, ownerName, types, canChooseStatus, label = "Add document" }: {
  kind: "vehicle" | "driver"; ownerId: string; plateNo?: string; ownerName?: string; types: TypeOpt[]; canChooseStatus: boolean; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const blank: DocFields = { docType: types[0]?.value ?? "", docNo: "", holderName: "", simClass: "", issuer: "", validFrom: "", validUntil: "", amount: "", paidDate: "", notes: "", status: "Verified" };
  const [f, setF] = useState<DocFields>(blank);
  const [aiJson, setAiJson] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState>(emptyScan);
  const { file, dataUrl, fileError, pick } = useFilePick();
  const fileRef = useRef<HTMLInputElement>(null);
  const { pending, error, exec } = useAction();
  const set = (k: keyof DocFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF(prev => ({ ...prev, [k]: e.target.value }));
    setScan(s => { if (!s.filled.has(k)) return s; const filled = new Set(s.filled); filled.delete(k); return { ...s, filled }; });
  };
  const mark = (k: string) => (scan.filled.has(k) ? aiMark : "");
  const t = f.docType;
  const spec = types.find(x => x.value === t);

  async function runScan() {
    if (!dataUrl) return;
    setScan({ ...emptyScan, loading: true });
    const res = await scanFleetDoc(t as ScanDocType, dataUrl);
    if (!res.ok) { setScan({ ...emptyScan, error: res.error }); return; }
    const { detectedType, detectedLabel, fields } = res.result;
    const map: Partial<Record<keyof DocFields, string | undefined>> = {
      docNo: fields.docNo, holderName: fields.holderName, simClass: fields.simClass, issuer: fields.issuer, validFrom: fields.validFrom,
      validUntil: fields.validUntil, amount: fields.amount != null ? String(Math.round(fields.amount)) : undefined, paidDate: fields.paidDate,
    };
    // Hanya field yang tampil di form untuk jenis dokumen ini yang diisi & dihitung.
    const docType = types.some(x => x.value === detectedType) ? detectedType : t;
    const visible = kind === "vehicle"
      ? ["docNo", "holderName", "validFrom", "validUntil", ...(docType === "PKB" || docType === "INSURANCE" ? ["amount"] : []), ...(docType === "PKB" ? ["paidDate"] : [])]
      : ["docNo", "validFrom", "validUntil", docType === "SIM" ? "simClass" : "issuer"];
    const filled = new Set<string>();
    const next = { ...f };
    for (const [k, v] of Object.entries(map)) if (v && visible.includes(k)) { (next as Record<string, string>)[k] = v; filled.add(k); }
    if (kind === "driver" && fields.holderName) next.holderName = fields.holderName; // disimpan untuk jejak, tidak ditampilkan
    const warn: string[] = [];
    if (detectedType !== t) {
      const alt = types.find(x => x.value === detectedType);
      if (alt) { next.docType = detectedType; warn.push(`Terbaca sebagai ${alt.label}, jenis dokumen diganti otomatis.`); }
      else warn.push(`Terbaca sebagai "${detectedLabel}", bukan ${spec?.label}. Periksa lagi.`);
    }
    if (kind === "vehicle" && plateNo && fields.plateNo && normPlate(fields.plateNo) !== normPlate(plateNo)) warn.push(`Nopol di dokumen ${fields.plateNo} berbeda dengan truk ini (${plateNo}).`);
    if (kind === "driver" && ownerName && fields.holderName && !fields.holderName.toLowerCase().includes(ownerName.split(" ")[0].toLowerCase())) warn.push(`Nama di dokumen "${fields.holderName}" tidak cocok dengan ${ownerName}.`);
    if (!fields.validUntil) warn.push("Tanggal berlaku s/d tidak terbaca — isi manual.");
    setF(next);
    setAiJson(JSON.stringify({ model: res.result.model, detectedType, fields }));
    setScan({ ...emptyScan, filled, warn, note: `${filled.size} field diisi dari dokumen (biru). Periksa sebelum menyimpan.` });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set(kind === "vehicle" ? "vehicleId" : "driverId", ownerId);
    for (const [k, v] of Object.entries(f)) fd.set(k, v);
    if (file) fd.set("file", file);
    if (aiJson) { fd.set("aiJson", aiJson); fd.set("source", "Scan AI"); }
    exec(() => (kind === "vehicle" ? saveVehicleDocument(fd) : saveDriverDocument(fd)), () => {
      setOpen(false); setF(blank); setAiJson(null); setScan(emptyScan); pick(undefined); if (fileRef.current) fileRef.current.value = "";
    });
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className={btnPrimary}><Plus className="w-4 h-4" /> {label}</button>;

  const showAmount = t === "PKB" || t === "INSURANCE";
  return (
    <form onSubmit={submit} className="w-full rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800">{label}</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Tutup form" className="p-1 rounded text-slate-500 hover:text-slate-800"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className={labelCls}>Jenis dokumen</span>
          <select value={t} onChange={set("docType")} className={inputCls}>{types.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
          {spec && <span className="text-[11px] text-slate-500">{spec.hint}</span>}
        </label>
        <label className="block md:col-span-2">
          <span className={labelCls}>File (foto / PDF)</span>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={e => { setScan(emptyScan); pick(e.target.files?.[0]); }} className="block w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-slate-200 file:bg-white file:text-sm" />
          {fileError && <span className="text-xs text-red-700">{fileError}</span>}
        </label>
      </div>
      <ScanPanel scan={scan} onScan={runScan} canScan={!!dataUrl} onClear={() => setScan(s => ({ ...s, note: null, warn: [] }))} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block"><span className={labelCls}>Nomor dokumen</span><input value={f.docNo} onChange={set("docNo")} className={`${inputCls} ${mark("docNo")}`} /></label>
        {kind === "vehicle" ? (
          <label className="block"><span className={labelCls}>{t === "INSURANCE" ? "Perusahaan asuransi" : "Nama pemilik"}</span><input value={f.holderName} onChange={set("holderName")} className={`${inputCls} ${mark("holderName")}`} /></label>
        ) : t === "SIM" ? (
          <label className="block"><span className={labelCls}>Golongan SIM</span>
            <select value={f.simClass} onChange={set("simClass")} className={`${inputCls} ${mark("simClass")}`}><option value="">— pilih —</option><option>B1 Umum</option><option>B2 Umum</option></select>
          </label>
        ) : (
          <label className="block"><span className={labelCls}>Lembaga penerbit</span><input value={f.issuer} onChange={set("issuer")} className={`${inputCls} ${mark("issuer")}`} /></label>
        )}
        <div />
        <label className="block"><span className={labelCls}>Berlaku dari</span><input type="date" value={f.validFrom} onChange={set("validFrom")} className={`${inputCls} ${mark("validFrom")}`} /></label>
        <label className="block"><span className={labelCls}>{t === "PKB" ? "Jatuh tempo pajak berikutnya" : "Berlaku s/d"}</span><input type="date" value={f.validUntil} onChange={set("validUntil")} className={`${inputCls} ${mark("validUntil")}`} /></label>
        {showAmount ? (
          <label className="block"><span className={labelCls}>{t === "PKB" ? "Nominal pajak (Rp)" : "Premi (Rp)"}</span><input inputMode="numeric" value={f.amount} onChange={set("amount")} className={`${inputCls} ${mark("amount")}`} /></label>
        ) : <div />}
        {t === "PKB" && <label className="block"><span className={labelCls}>Tanggal bayar</span><input type="date" value={f.paidDate} onChange={set("paidDate")} className={`${inputCls} ${mark("paidDate")}`} /></label>}
        <label className={`block ${t === "PKB" ? "md:col-span-2" : "md:col-span-3"}`}><span className={labelCls}>Catatan</span><input value={f.notes} onChange={set("notes")} placeholder="mis. proses perpanjangan di Samsat" className={inputCls} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3 justify-end">
        {canChooseStatus && (
          <label className="text-sm text-slate-700 flex items-center gap-2">Simpan sebagai
            <select value={f.status} onChange={set("status")} className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white">
              <option value="Verified">Verified (dipakai untuk kelayakan)</option>
              <option value="Draft">Draft (perlu dicek)</option>
            </select>
          </label>
        )}
        <button type="submit" disabled={pending} className={btnPrimary}>{pending && <Loader2 className="w-4 h-4 animate-spin" />} Save document</button>
      </div>
      <ErrorNote error={error} />
    </form>
  );
}

// ---------------------------------------------------------
// Riwayat servis
// ---------------------------------------------------------

export function AddServiceForm({ vehicleId, odometerKm }: { vehicleId: string; odometerKm: number }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const blank = { serviceDate: today, odometerKm: String(Math.round(odometerKm)), workshop: "", kind: "Berkala", items: "", cost: "", nextServiceDate: "", nextServiceKm: "", notes: "" };
  const [f, setF] = useState(blank);
  const [scan, setScan] = useState<ScanState>(emptyScan);
  const { file, dataUrl, fileError, pick } = useFilePick();
  const { pending, error, exec } = useAction();
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }));
  const mark = (k: string) => (scan.filled.has(k) ? aiMark : "");
  const km = Number(f.odometerKm) || 0;
  const autoDate = f.serviceDate ? addDays(f.serviceDate, SERVICE_INTERVAL.days) : "";
  const autoKm = km ? km + SERVICE_INTERVAL.km : 0;

  async function runScan() {
    if (!dataUrl) return;
    setScan({ ...emptyScan, loading: true });
    const res = await scanFleetDoc("SERVICE", dataUrl);
    if (!res.ok) { setScan({ ...emptyScan, error: res.error }); return; }
    const x: FleetScanFields = res.result.fields;
    const map: Record<string, string | undefined> = {
      serviceDate: x.serviceDate, odometerKm: x.odometerKm ? String(Math.round(x.odometerKm)) : undefined, workshop: x.workshop ?? x.issuer,
      items: x.items, cost: x.cost ? String(Math.round(x.cost)) : undefined,
    };
    const filled = new Set<string>();
    const next = { ...f };
    for (const [k, v] of Object.entries(map)) if (v) { (next as Record<string, string>)[k] = v; filled.add(k); }
    const warn = res.result.detectedType !== "SERVICE" ? [`Terbaca sebagai "${res.result.detectedLabel}", bukan nota servis.`] : [];
    setF(next);
    setScan({ ...emptyScan, filled, warn, note: `${filled.size} field diisi dari nota (biru). Periksa sebelum menyimpan.` });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("vehicleId", vehicleId);
    for (const [k, v] of Object.entries(f)) fd.set(k, v);
    if (file) fd.set("file", file);
    exec(() => saveServiceRecord(fd), () => { setOpen(false); setF(blank); setScan(emptyScan); pick(undefined); });
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className={btnPrimary}><Plus className="w-4 h-4" /> Add service record</button>;
  return (
    <form onSubmit={submit} className="w-full rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800">Add service record</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Tutup form" className="p-1 rounded text-slate-500 hover:text-slate-800"><X className="w-4 h-4" /></button>
      </div>
      <label className="block">
        <span className={labelCls}>Foto nota / work order (opsional)</span>
        <input type="file" accept="image/*,application/pdf" onChange={e => { setScan(emptyScan); pick(e.target.files?.[0]); }} className="block w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-slate-200 file:bg-white file:text-sm" />
        {fileError && <span className="text-xs text-red-700">{fileError}</span>}
      </label>
      <ScanPanel scan={scan} onScan={runScan} canScan={!!dataUrl} onClear={() => setScan(s => ({ ...s, note: null, warn: [] }))} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="block"><span className={labelCls}>Tanggal servis</span><input type="date" required max={today} value={f.serviceDate} onChange={set("serviceDate")} className={`${inputCls} ${mark("serviceDate")}`} /></label>
        <label className="block"><span className={labelCls}>Odometer (km)</span><input inputMode="numeric" required value={f.odometerKm} onChange={set("odometerKm")} className={`${inputCls} ${mark("odometerKm")}`} /></label>
        <label className="block"><span className={labelCls}>Jenis</span>
          <select value={f.kind} onChange={set("kind")} className={inputCls}><option value="Berkala">Berkala (servis rutin)</option><option value="Perbaikan">Perbaikan</option></select>
        </label>
        <label className="block"><span className={labelCls}>Biaya (Rp)</span><input inputMode="numeric" value={f.cost} onChange={set("cost")} className={`${inputCls} ${mark("cost")}`} /></label>
        <label className="block md:col-span-2"><span className={labelCls}>Bengkel</span><input required value={f.workshop} onChange={set("workshop")} className={`${inputCls} ${mark("workshop")}`} /></label>
        <label className="block md:col-span-2"><span className={labelCls}>Pekerjaan / sparepart</span><input required value={f.items} onChange={set("items")} placeholder="Ganti oli mesin, filter oli, cek rem" className={`${inputCls} ${mark("items")}`} /></label>
        {f.kind === "Berkala" && (
          <>
            <label className="block"><span className={labelCls}>Servis berikutnya (tanggal)</span><input type="date" value={f.nextServiceDate} onChange={set("nextServiceDate")} placeholder={autoDate} className={inputCls} />
              <span className="text-[11px] text-slate-500">Kosong = otomatis {autoDate || "—"} (+{SERVICE_INTERVAL.days} hari)</span></label>
            <label className="block"><span className={labelCls}>Servis berikutnya (km)</span><input inputMode="numeric" value={f.nextServiceKm} onChange={set("nextServiceKm")} className={inputCls} />
              <span className="text-[11px] text-slate-500">Kosong = otomatis {autoKm ? autoKm.toLocaleString("id-ID") : "—"} km (+{SERVICE_INTERVAL.km.toLocaleString("id-ID")})</span></label>
          </>
        )}
        <label className={`block ${f.kind === "Berkala" ? "md:col-span-2" : "md:col-span-4"}`}><span className={labelCls}>Catatan</span><input value={f.notes} onChange={set("notes")} className={inputCls} /></label>
      </div>
      <div className="flex justify-end"><button type="submit" disabled={pending} className={btnPrimary}>{pending && <Loader2 className="w-4 h-4 animate-spin" />} Save service record</button></div>
      <ErrorNote error={error} />
    </form>
  );
}

// ---------------------------------------------------------
// Verifikasi draft
// ---------------------------------------------------------

export function VerifyDocButtons({ kind, id, validUntil, needsSimClass, simClass }: { kind: "vehicle" | "driver"; id: string; validUntil: string | null; needsSimClass?: boolean; simClass?: string | null }) {
  const [date, setDate] = useState(validUntil ?? "");
  const [cls, setCls] = useState(simClass ?? "");
  const { pending, error, exec } = useAction();
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {!validUntil && <input type="date" aria-label="Berlaku s/d" value={date} onChange={e => setDate(e.target.value)} className="px-2 py-1 border border-slate-200 rounded text-xs" />}
        {needsSimClass && !simClass && (
          <select aria-label="Golongan SIM" value={cls} onChange={e => setCls(e.target.value)} className="px-2 py-1 border border-slate-200 rounded text-xs bg-white"><option value="">Golongan…</option><option>B1 Umum</option><option>B2 Umum</option></select>
        )}
        <button type="button" disabled={pending} onClick={() => exec(() => setDocumentStatus(kind, id, "Verified", { validUntil: date || undefined, simClass: cls || undefined }))} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60">Verify</button>
        <button type="button" disabled={pending} onClick={() => exec(() => setDocumentStatus(kind, id, "Rejected"))} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Reject</button>
      </div>
      <ErrorNote error={error} />
    </div>
  );
}
