/**
 * Model dokumen generik: setiap dokumen Sales (penawaran, invoice, kwitansi, kontrak, sertifikat
 * garansi, BAST, konfirmasi order, surat pengingat) disusun sebagai DocModel, lalu dirender oleh
 * renderer PDF (pdf.tsx) dan Word (docx.ts) yang sama — kop, footer & tanda tangan selalu seragam.
 */

export type Cell = string | { text: string; sub?: string | null; note?: string | null; bold?: boolean };

export type Block =
  | { type: "para"; text: string; align?: "left" | "justify" | "center" }
  | { type: "heading"; text: string }
  | { type: "table"; columns: { label: string; width: number; align?: "left" | "right" | "center" }[]; rows: Cell[][] }
  | { type: "totals"; rows: [string, string][]; total: [string, string] }
  | { type: "words"; text: string }
  | { type: "kv"; title?: string; rows: [string, string][] }
  /** Pasal bernomor: "Pasal 1 — Ruang Lingkup" + isi. */
  | { type: "clauses"; items: { title: string; body: string }[] }
  | { type: "note"; text: string }
  /** Blok tanda tangan di tengah dokumen (mis. perjanjian: sebelum lampiran). */
  | { type: "signatures"; items: Signature[] };

export type Signature = { lead: string; org?: string; name: string; title: string; extra?: string; stamp?: boolean };

export type DocModel = {
  /** Nama file tanpa ekstensi. */
  fileName: string;
  title: string;
  number: string;
  /** Tanda besar miring di PDF (dan baris peringatan di Word). */
  watermark?: "DRAFT" | "LUNAS" | "DIBATALKAN";
  /** Kiri: penerima; kanan: pasangan label-nilai (tanggal, perihal, dst). */
  recipient?: { label: string; name: string; lines: string[] };
  meta?: [string, string][];
  blocks: Block[];
  signatures?: Signature[];
};
