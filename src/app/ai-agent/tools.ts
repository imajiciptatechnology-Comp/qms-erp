import type { AiTool } from "@/lib/ai";
import type { CurrentUser } from "@/app/actions/auth";
import { getDashboardData } from "@/app/dashboard-data";
import {
  AGENT_MODULES, AGENT_MODULE_IDS, AGENT_PAGES, searchModule, findRecord, exportModule, toSummary, type Filter,
} from "./modules";

/** Event yang dikirim ke browser selain teks jawaban. */
export type AgentEvent =
  | { t: "status"; text: string }
  | { t: "text"; text: string }
  | { t: "navigate"; path: string; label: string }
  | { t: "download"; name: string; url: string }
  | { t: "export"; filename: string; rows: Record<string, unknown>[] }
  | { t: "error"; message: string }
  | { t: "done"; model?: string };

export type ToolContext = {
  user: CurrentUser;
  /** Cek izin modul berdasarkan rolesConfig user. */
  canAccess: (perm?: string) => boolean;
  emit: (e: AgentEvent) => void;
};

const moduleEnum = { type: "string", enum: AGENT_MODULE_IDS, description: AGENT_MODULE_IDS.map(id => `${id} = ${AGENT_MODULES[id].label}`).join("; ") };
const filterEnum = { type: "string", enum: ["open", "overdue", "all"], description: "open = belum selesai, overdue = lewat jatuh tempo & belum selesai, all = semua" };

export const AGENT_TOOLS: AiTool[] = [
  {
    type: "function",
    function: {
      name: "get_overview",
      description: "Ringkasan angka QMS saat ini (NC open/overdue, audit bulan ini, risiko aktif, insiden, maintenance, work order, dll). Pakai untuk pertanyaan umum tentang kondisi QMS.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "search_records",
      description: "Cari/daftar record di satu modul. Kembalikan total dan maksimal 20 record ringkas (ref = nomor record).",
      parameters: {
        type: "object",
        properties: {
          module: moduleEnum,
          query: { type: "string", description: "Kata kunci (nomor, judul, departemen, produk, dll). Kosongkan untuk semua." },
          filter: filterEnum,
          limit: { type: "integer", description: "Jumlah record (1-20), default 10" },
        },
        required: ["module"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_record",
      description: "Detail satu record berdasarkan nomornya (mis. NC-3400, CAL-001, DOC-QA-01) atau kata kunci unik.",
      parameters: { type: "object", properties: { module: moduleEnum, ref: { type: "string" } }, required: ["module", "ref"] },
    },
  },
  {
    type: "function",
    function: {
      name: "open_page",
      description: "Buka halaman/menu ERP di layar user (mis. dashboard, daftar NC, daftar kalibrasi).",
      parameters: { type: "object", properties: { page: { type: "string", enum: Object.keys(AGENT_PAGES) } }, required: ["page"] },
    },
  },
  {
    type: "function",
    function: {
      name: "open_record",
      description: "Buka halaman detail satu record di layar user.",
      parameters: { type: "object", properties: { module: moduleEnum, ref: { type: "string" } }, required: ["module", "ref"] },
    },
  },
  {
    type: "function",
    function: {
      name: "download_file",
      description: "Tampilkan tombol download untuk file milik record: file dokumen (document), sertifikat kalibrasi (calibration), bukti tindakan NC (nc).",
      parameters: {
        type: "object",
        properties: {
          module: { type: "string", enum: ["document", "calibration", "nc"] },
          ref: { type: "string" },
          which: { type: "string", enum: ["latest", "all"], description: "latest = file terbaru saja (default), all = semua file" },
        },
        required: ["module", "ref"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_records",
      description: "Export daftar record satu modul ke file CSV (bisa dibuka di Excel) dan tampilkan tombol download.",
      parameters: { type: "object", properties: { module: moduleEnum, filter: filterEnum, query: { type: "string" } }, required: ["module"] },
    },
  },
];

/** Label status singkat yang ditampilkan di chat saat tool berjalan. */
export function toolStatus(name: string, args: Record<string, any>): string {
  const label = args.module ? AGENT_MODULES[args.module]?.label ?? args.module : "";
  switch (name) {
    case "get_overview": return "Membaca ringkasan QMS…";
    case "search_records": return `Mencari di ${label}…`;
    case "get_record": return `Membuka data ${args.ref ?? ""}…`;
    case "open_page": return `Membuka ${AGENT_PAGES[args.page]?.label ?? "halaman"}…`;
    case "open_record": return `Membuka ${args.ref ?? "record"}…`;
    case "download_file": return `Menyiapkan file ${args.ref ?? ""}…`;
    case "export_records": return `Menyiapkan export ${label}…`;
    default: return "Memproses…";
  }
}

const FILTERS: Filter[] = ["open", "overdue", "all"];

/** Jalankan tool; hasilnya (objek kecil) dikirim balik ke model sebagai JSON. */
export async function runTool(name: string, args: Record<string, any>, ctx: ToolContext): Promise<unknown> {
  const moduleId: string | undefined = args.module;
  const mod = moduleId ? AGENT_MODULES[moduleId] : undefined;
  if (moduleId !== undefined) {
    if (!mod) return { error: `Modul tidak dikenal: ${moduleId}` };
    if (!ctx.canAccess(mod.perm)) return { error: `User tidak punya akses ke modul ${mod.label}.` };
  }
  const filter: Filter = FILTERS.includes(args.filter) ? args.filter : "all";

  switch (name) {
    case "get_overview": {
      const data = await getDashboardData();
      return { kpi: data.kpi, charts: data.charts };
    }

    case "search_records": {
      const { total, rows } = await searchModule(moduleId!, { query: args.query, filter, limit: args.limit });
      return { module: moduleId, filter, total, shown: rows.length, records: rows.map(r => toSummary(moduleId!, r)) };
    }

    case "get_record": {
      const { row, candidates } = await findRecord(moduleId!, String(args.ref ?? ""));
      if (!row) return { found: false, candidates: candidates.map(r => toSummary(moduleId!, r)) };
      return { found: true, record: toSummary(moduleId!, row) };
    }

    case "open_page": {
      const page = AGENT_PAGES[args.page];
      if (!page) return { error: "Halaman tidak dikenal." };
      if (!ctx.canAccess(page.perm)) return { error: `User tidak punya akses ke ${page.label}.` };
      ctx.emit({ t: "navigate", path: page.path, label: page.label });
      return { opened: page.label };
    }

    case "open_record": {
      const { row, candidates } = await findRecord(moduleId!, String(args.ref ?? ""));
      if (!row) return { found: false, candidates: candidates.map(r => toSummary(moduleId!, r)) };
      const ref = String(row[mod!.refField]);
      if (mod!.detailPath) {
        ctx.emit({ t: "navigate", path: mod!.detailPath(row.id), label: ref });
        return { opened: ref };
      }
      // Modul tanpa halaman detail: buka daftarnya saja.
      ctx.emit({ t: "navigate", path: mod!.listPath, label: mod!.label });
      return { opened: mod!.label, note: `Modul ini tidak punya halaman detail; daftar ${mod!.label} dibuka. Cari ${ref} di daftar.` };
    }

    case "download_file": {
      if (!mod!.files) return { error: "Modul ini tidak punya file untuk di-download." };
      const { row, candidates } = await findRecord(moduleId!, String(args.ref ?? ""));
      if (!row) return { found: false, candidates: candidates.map(r => toSummary(moduleId!, r)) };
      const ref = String(row[mod!.refField]);
      if (mod!.isRestricted?.(row)) {
        if (mod!.detailPath) ctx.emit({ t: "navigate", path: mod!.detailPath(row.id), label: ref });
        return { restricted: true, note: "Dokumen terbatas: tidak bisa di-download lewat AI. Halaman dokumen dibuka agar user mengunduh sesuai hak aksesnya." };
      }
      const files = mod!.files(row);
      if (!files.length) return { found: true, files: 0, note: `${ref} tidak punya file terlampir.` };
      const chosen = args.which === "all" ? files : files.slice(0, 1);
      for (const f of chosen) ctx.emit({ t: "download", name: f.name, url: f.url });
      return { found: true, ref, offered: chosen.map(f => f.name) };
    }

    case "export_records": {
      const rows = await exportModule(moduleId!, { query: args.query, filter });
      if (!rows.length) return { exported: 0, note: "Tidak ada data yang cocok." };
      const filename = `${moduleId}${filter !== "all" ? `_${filter}` : ""}`;
      ctx.emit({ t: "export", filename, rows });
      return { exported: rows.length, filename: `${filename}.csv` };
    }

    default:
      return { error: `Tool tidak dikenal: ${name}` };
  }
}
