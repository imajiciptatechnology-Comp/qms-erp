import { notFound } from "next/navigation";
import { getSalesAccess } from "../../access";
import { getCustomer } from "../../actions";
import CustomerDetail from "./CustomerDetail";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const c = await getCustomer(id);
  if (!c) notFound();
  return <CustomerDetail c={c} canManage={access.canManage} />;
}
