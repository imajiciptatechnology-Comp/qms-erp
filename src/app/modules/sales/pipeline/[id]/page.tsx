import { notFound } from "next/navigation";
import { getSalesAccess } from "../../access";
import { getTender } from "../../tenderActions";
import TenderDetail from "./TenderDetail";

export default async function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const o = await getTender(id);
  if (!o) notFound();
  return <TenderDetail o={o} canManage={access.canManage} canGuarantee={access.canManage || access.canFinance} />;
}
