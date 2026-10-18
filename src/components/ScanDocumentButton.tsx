"use client";

import { useRef, useState } from "react";
import { ScanLine, Loader2, X, AlertTriangle, CheckCircle2, FileImage } from "lucide-react";
import { scanDocument, type ScanFormType } from "@/app/actions/ai-scan";

const MAX_SIDE = 1600;

/** Kecilkan gambar di browser (maks 1600px, JPEG) agar cepat & di bawah batas upload. */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pemrosesan gambar.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

const MARKS = {
  ai: ["ring-2", "ring-blue-300", "bg-blue-50"],
  missing: ["ring-2", "ring-amber-400", "bg-amber-50"],
};

/**
 * Tandai field hasil scan: biru = diisi dari scan, kuning = tidak ditemukan & harus
 * diisi manual. Tanda hilang saat user mengubah field itu.
 */
export function highlightScanFields(form: HTMLFormElement | null, filled: string[], missing: string[] = []) {
  if (!form) return;
  const all = [...MARKS.ai, ...MARKS.missing];
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLElement) el.classList.remove(...all);
  }
  const mark = (names: string[], classes: string[]) => {
    for (const name of names) {
      const el = form.elements.namedItem(name);
      if (!(el instanceof HTMLElement)) continue;
      el.classList.add(...classes);
      const clear = () => el.classList.remove(...all);
      el.addEventListener("input", clear, { once: true });
      el.addEventListener("change", clear, { once: true });
    }
  };
  mark(filled, MARKS.ai);
  mark(missing, MARKS.missing);
}

export default function ScanDocumentButton({
  formType,
  sampleUrl,
  onExtracted,
}: {
  formType: ScanFormType;
  sampleUrl?: string;
  /** `missingFields`: nama field yang harus dikosongkan & ditandai kuning. */
  onExtracted: (fields: Record<string, string>, file: File, missingFields: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ filled: number; missing: string[] } | null>(null);
  type Extracted = { fields: Record<string, string>; missing: string[]; missingFields: string[]; file: File };
  // Hasil scan dari dokumen yang jenisnya tidak cocok: tunggu keputusan user.
  const [pending, setPending] = useState<(Extracted & { expected: string; detected: string }) | null>(null);

  const apply = ({ fields, missing, missingFields, file }: Extracted) => {
    onExtracted(fields, file, missingFields);
    setSummary({ filled: Object.keys(fields).length, missing });
    setPending(null);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSummary(null);
    setPending(null);
    if (!file.type.startsWith("image/")) {
      setError("Pilih file gambar (JPG/PNG) hasil scan atau foto dokumen.");
      return;
    }
    setLoading(true);
    try {
      const dataUrl = await compressImage(file);
      const res = await scanDocument(formType, dataUrl);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const extracted = { fields: res.fields, missing: res.missing, missingFields: res.missingFields, file };
      if (res.mismatch) {
        setPending({ ...extracted, ...res.mismatch });
        return;
      }
      apply(extracted);
    } catch {
      setError("Gagal membaca gambar. Coba foto/scan lain.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileImage className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-800">Punya dokumen kertas?</span>{" "}
            Scan untuk mengisi form otomatis.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sampleUrl && (
            <a href={sampleUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-blue-700">
              Contoh dokumen
            </a>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700 disabled:opacity-60 disabled:cursor-wait transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4 text-blue-600" />}
            {loading ? "Membaca dokumen…" : "Scan dokumen"}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />

      {pending && (
        <div role="alert" className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 space-y-2">
          <p className="flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
            <span>
              Dokumen ini terbaca sebagai <b>{pending.detected}</b>, bukan {pending.expected}.
              AI hanya menemukan {Object.keys(pending.fields).length} field yang mungkin cocok. Tetap isi ke form?
            </span>
          </p>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setPending(null)}
              className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              Batalkan
            </button>
            <button type="button" onClick={() => apply(pending)}
              className="px-2.5 py-1 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1">
              Tetap isi
            </button>
          </div>
        </div>
      )}

      {summary && (
        <div role="status" className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-2 flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
              <span><b>{summary.filled} field</b> diisi dari dokumen (ditandai biru). Periksa kembali sebelum menyimpan.</span>
            </p>
            {summary.missing.length > 0 && (
              <p className="flex items-start gap-1.5 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                <span>Tidak ditemukan di dokumen, isi manual (ditandai kuning): <b>{summary.missing.join(", ")}</b></span>
              </p>
            )}
          </div>
          <button type="button" onClick={() => setSummary(null)} aria-label="Tutup pesan" className="p-0.5 rounded text-slate-400 hover:text-slate-700 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">{error}</p>}
    </div>
  );
}
