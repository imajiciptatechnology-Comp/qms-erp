import { GET as getDocument } from "../../../documents/[kind]/[id]/route";

export const runtime = "nodejs";

/** Alamat lama unduh penawaran — diteruskan ke route dokumen generik. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return getDocument(req, { params: Promise.resolve({ kind: "quotation", id }) });
}
