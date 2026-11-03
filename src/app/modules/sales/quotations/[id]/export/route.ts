import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { salesAccess } from "../../../lib";
import { loadQuotationDoc } from "../../../documents/quotationDoc";
import { renderQuotationPdf } from "../../../documents/quotationPdf";
import { renderQuotationDocx } from "../../../documents/quotationDocx";

export const runtime = "nodejs";

/** GET ?format=pdf|docx — unduh penawaran dengan kop surat. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !salesAccess(user, await getRolesConfig()).canView) return new Response("Tidak ada akses.", { status: 403 });

  const { id } = await params;
  const doc = await loadQuotationDoc(id);
  if (!doc) return new Response("Penawaran tidak ditemukan.", { status: 404 });

  const format = new URL(req.url).searchParams.get("format") === "docx" ? "docx" : "pdf";
  const body = format === "pdf" ? await renderQuotationPdf(doc) : await renderQuotationDocx(doc);
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
