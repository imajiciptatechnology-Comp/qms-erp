import { notFound } from "next/navigation";
import { getSalesAccess } from "../../access";
import { getCustomer } from "../../actions";
import { getAgentOptions } from "../../agentActions";
import CustomerDetail from "./CustomerDetail";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const [c, agents] = await Promise.all([getCustomer(id), getAgentOptions()]);
  if (!c) notFound();
  return <CustomerDetail c={c} agents={agents} canManage={access.canManage} />;
}
