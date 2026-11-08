import { getCurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { canSeeService, canSeeShipping, salesAccess } from "../../../lib";
import { DOC_KINDS, SERVICE_DOCS, SHIPPING_DOCS, buildDocument, type DocKind } from "../../builders";
import { renderPdf } from "../../pdf";
import { renderDocx } from "../../docx";

export const runtime = "nodejs";

/** GET /modules/sales/documents/{jenis}/{id}?format=pdf|docx — unduh dokumen Sales dengan kop surat. */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Tidak ada akses.", { status: 403 });
  const access = salesAccess(user, await getRolesConfig());

  const { kind, id } = await params;
  if (!DOC_KINDS.includes(kind as DocKind)) return new Response("Jenis dokumen tidak dikenal.", { status: 404 });
  // Dokumen modul Contract & Shipping / Training & CS mengikuti akses modulnya; kontrak & BAST juga dibuka dari sana.
  const k = kind as DocKind;
  const allowed = SHIPPING_DOCS.includes(k) ? canSeeShipping(access) || access.canView
    : SERVICE_DOCS.includes(k) ? canSeeService(access) || access.canView
    : k === "contract" ? access.canView || canSeeShipping(access) || canSeeService(access)
    : k === "bast" ? access.canView || canSeeService(access)
    : access.canView;
  if (!allowed) return new Response("Tidak ada akses.", { status: 403 });
  const doc = await buildDocument(kind as DocKind, id);
  if (!doc) return new Response("Dokumen tidak ditemukan.", { status: 404 });

  const format = new URL(req.url).searchParams.get("format") === "docx" ? "docx" : "pdf";
  const body = format === "pdf" ? await renderPdf(doc) : await renderDocx(doc);
  const type = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const name = `${doc.fileName}.${format}`;

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      // PDF dibuka di tab browser, Word langsung diunduh.
      "Content-Disposition": `${format === "pdf" ? "inline" : "attachment"}; filename="${name.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
