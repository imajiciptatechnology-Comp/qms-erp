"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";

/**
 * Tombol mikrofon untuk mengisi kolom teks dengan suara (Bahasa Indonesia).
 * 1. Web Speech API bawaan browser (Chrome/Edge): gratis, teks muncul langsung saat bicara.
 * 2. Cadangan (Firefox/Safari, atau Web Speech gagal): rekam audio → WAV 16 kHz → /api/ai/transcribe.
 */

type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const MAX_SECONDS = 60;

function getRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => SpeechRecognitionLike) | null;
}

/** Ubah rekaman (webm/ogg/mp4) menjadi WAV mono 16 kHz — format yang diterima model AI. */
async function toWav16k(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  await ctx.close();
  const rate = 16000;
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const pcm = (await offline.startRendering()).getChannelData(0);

  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const text = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + pcm.length * 2, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, pcm.length * 2, true);
  pcm.forEach((v, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  return new Blob([view], { type: "audio/wav" });
}

const join = (base: string, add: string) => (add ? (base && !/\s$/.test(base) ? `${base} ${add}` : base + add) : base);

export default function VoiceButton({ value, onChange, disabled, className = "" }: {
  /** Isi kolom saat ini — hasil suara ditambahkan di belakangnya. */
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "listening" | "transcribing">("idle");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Web Speech gagal (mis. tanpa akses server Google) → pakai rekaman + AI untuk sesi ini.
  const useFallback = useRef(false);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 7000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => () => {
    recRef.current?.abort();
    mediaRef.current?.stream.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function startWebSpeech(Recognition: new () => SpeechRecognitionLike) {
    const base = value;
    let finalText = "";
    const rec = new Recognition();
    rec.lang = "id-ID";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText = join(finalText, r[0].transcript.trim());
        else interim = join(interim, r[0].transcript.trim());
      }
      onChange(join(base, join(finalText, interim)));
    };
    rec.onerror = e => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Izin mikrofon ditolak. Aktifkan di pengaturan browser.");
      else if (e.error === "network") { useFallback.current = true; setError("Pengenalan suara browser tidak tersedia. Klik mikrofon lagi untuk memakai rekaman + AI."); }
      else if (e.error !== "no-speech" && e.error !== "aborted") setError("Suara tidak terdengar jelas. Coba lagi.");
    };
    rec.onend = () => { recRef.current = null; setState("idle"); };
    recRef.current = rec;
    rec.start();
    setState("listening");
    timerRef.current = setTimeout(() => rec.stop(), MAX_SECONDS * 1000);
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      mediaRef.current = null;
      setState("transcribing");
      try {
        const wav = await toWav16k(new Blob(chunks, { type: rec.mimeType }));
        const form = new FormData();
        form.append("audio", wav, "voice.wav");
        const res = await fetch("/api/ai/transcribe", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Gagal mengubah suara menjadi teks.");
        if (data.text) onChange(join(value, data.text));
        else setError("Tidak ada suara yang terdengar.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengubah suara menjadi teks.");
      } finally {
        setState("idle");
      }
    };
    mediaRef.current = rec;
    rec.start();
    setState("listening");
    timerRef.current = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_SECONDS * 1000);
  }

  async function toggle() {
    setError(null);
    if (state === "listening") {
      if (timerRef.current) clearTimeout(timerRef.current);
      recRef.current?.stop();
      if (mediaRef.current?.state === "recording") mediaRef.current.stop();
      return;
    }
    const Recognition = getRecognition();
    try {
      if (Recognition && !useFallback.current) startWebSpeech(Recognition);
      else if (typeof MediaRecorder !== "undefined" && navigator.mediaDevices) await startRecording();
      else setError("Browser ini tidak mendukung input suara.");
    } catch {
      setError("Mikrofon tidak bisa dipakai. Periksa izin mikrofon di browser.");
      setState("idle");
    }
  }

  const listening = state === "listening";
  const label = listening ? "Berhenti merekam" : state === "transcribing" ? "Mengubah suara menjadi teks" : "Isi dengan suara";
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || state === "transcribing"}
        aria-label={label}
        aria-pressed={listening}
        title={listening ? "Klik untuk berhenti" : "Bicara dalam Bahasa Indonesia"}
        className={`shrink-0 p-2.5 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed ${
          listening ? "bg-red-600 border-red-600 text-white animate-pulse" : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-800"
        } ${className}`}
      >
        {state === "transcribing" ? <Loader2 className="w-4 h-4 animate-spin" /> : listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      <span role="status" aria-live="polite" className="sr-only">{listening ? "Sedang mendengarkan" : state === "transcribing" ? "Mengubah suara menjadi teks" : ""}</span>
      {error && (
        <span role="alert" className="absolute bottom-full right-0 mb-2 w-64 text-xs bg-white border border-red-200 text-red-700 rounded-lg px-3 py-2 shadow-md z-10">
          {error}
        </span>
      )}
    </span>
  );
}
