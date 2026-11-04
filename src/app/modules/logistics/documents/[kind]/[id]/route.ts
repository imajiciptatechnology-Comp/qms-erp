import { renderPdf } from "@/app/modules/sales/documents/pdf";
import { renderDocx } from "@/app/modules/sales/documents/docx";
import { getLogisticsAccess } from "../../../server";
import { LOG_DOC_KINDS, buildLogisticsDocument, type LogDocKind } from "../../builders";

export const runtime = "nodejs";

/** GET /modules/logistics/documents/{jenis}/{id}?format=pdf|docx — dokumen ber-kop Arunika. */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { user, access } = await getLogisticsAccess();
  if (!user || !access.canView) return new Response("Tidak ada akses.", { status: 403 });

  const { kind, id } = await params;
  if (!LOG_DOC_KINDS.includes(kind as LogDocKind)) return new Response("Jenis dokumen tidak dikenal.", { status: 404 });
  const doc = await buildLogisticsDocument(kind as LogDocKind, id);
  if (!doc) return new Response("Dokumen tidak ditemukan.", { status: 404 });

  const format = new URL(req.url).searchParams.get("format") === "docx" ? "docx" : "pdf";
  const body = format === "pdf" ? await renderPdf(doc) : await renderDocx(doc);
  const type = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const name = `${doc.fileName}.${format}`;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${format === "pdf" ? "inline" : "attachment"}; filename="${name.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
