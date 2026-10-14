"use client";

import { useRef, useState } from "react";
import { ScanLine, Loader2, Sparkles, X, AlertTriangle } from "lucide-react";
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

/** Tandai sementara field yang diisi AI (hilang saat user mengedit field itu). */
export function highlightAiFields(form: HTMLFormElement | null, names: string[]) {
  if (!form) return;
  for (const name of names) {
    const el = form.elements.namedItem(name);
    if (!(el instanceof HTMLElement)) continue;
    el.classList.add("ring-2", "ring-violet-400", "bg-violet-50");
    el.addEventListener("input", () => el.classList.remove("ring-2", "ring-violet-400", "bg-violet-50"), { once: true });
  }
}

export default function ScanDocumentButton({
  formType,
  sampleUrl,
  onExtracted,
}: {
  formType: ScanFormType;
  sampleUrl?: string;
  onExtracted: (fields: Record<string, string>, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ filled: number; missing: string[] } | null>(null);
  // Hasil scan dari dokumen yang jenisnya tidak cocok: tunggu keputusan user.
  const [pending, setPending] = useState<{ fields: Record<string, string>; missing: string[]; file: File; expected: string; detected: string } | null>(null);

  const apply = (fields: Record<string, string>, missing: string[], file: File) => {
    onExtracted(fields, file);
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
      if (res.mismatch) {
        setPending({ fields: res.fields, missing: res.missing, file, ...res.mismatch });
        return;
      }
      apply(res.fields, res.missing, file);
    } catch {
      setError("Gagal membaca gambar. Coba foto/scan lain.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-violet-600 shrink-0" />
          <p className="text-sm text-violet-900">
            <span className="font-semibold">Isi otomatis dari scan</span>
            <span className="text-violet-700"> · upload foto/scan dokumen</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sampleUrl && (
            <a href={sampleUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900">
              Contoh form
            </a>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
            {loading ? "Membaca dokumen…" : "Scan Dokumen"}
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
              className="px-2.5 py-1 rounded-md border border-amber-300 bg-white text-amber-900 font-semibold hover:bg-amber-100">
              Batalkan
            </button>
            <button type="button" onClick={() => apply(pending.fields, pending.missing, pending.file)}
              className="px-2.5 py-1 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700">
              Tetap isi
            </button>
          </div>
        </div>
      )}

      {summary && (
        <div className="text-xs text-violet-800 bg-white/70 border border-violet-200 rounded-lg px-2.5 py-1.5 flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p><b>{summary.filled} field</b> diisi oleh AI. Periksa kembali sebelum menyimpan.</p>
            {summary.missing.length > 0 && (
              <p className="text-amber-800">Tidak ditemukan di dokumen, isi manual: <b>{summary.missing.join(", ")}</b></p>
            )}
          </div>
          <button type="button" onClick={() => setSummary(null)} aria-label="Dismiss" className="text-violet-500 hover:text-violet-800 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">{error}</p>}
    </div>
  );
}
