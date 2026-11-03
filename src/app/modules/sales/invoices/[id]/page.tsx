import { notFound } from "next/navigation";
import { getSalesAccess } from "../../access";
import { getInvoice } from "../../actions";
import InvoiceDetail from "./InvoiceDetail";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const inv = await getInvoice(id);
  if (!inv) notFound();
  return <InvoiceDetail inv={inv} access={access} />;
}
