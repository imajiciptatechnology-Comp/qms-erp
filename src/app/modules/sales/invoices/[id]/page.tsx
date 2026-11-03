import { notFound } from "next/navigation";
import { getSalesAccess } from "../../access";
import { getInvoice } from "../../actions";
import InvoiceDetail from "./InvoiceDetail";

// Penyusunan surat pengingat dengan AI bisa makan waktu ~10–40 detik.
export const maxDuration = 60;

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const inv = await getInvoice(id);
  if (!inv) notFound();
  return <InvoiceDetail inv={inv} access={access} />;
}
