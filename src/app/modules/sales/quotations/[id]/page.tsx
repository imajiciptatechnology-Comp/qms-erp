import { notFound } from "next/navigation";
import { getSalesAccess } from "../../access";
import { getQuotation } from "../../actions";
import QuotationDetail from "./QuotationDetail";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const q = await getQuotation(id);
  if (!q) notFound();
  return <QuotationDetail q={q} access={access} />;
}
