import { notFound } from "next/navigation";
import { getSalesAccess } from "../../access";
import { getSalesOrder } from "../../actions";
import { getAgentOptions } from "../../agentActions";
import OrderDetail from "./OrderDetail";

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const [so, agents] = await Promise.all([getSalesOrder(id), getAgentOptions()]);
  if (!so) notFound();
  return <OrderDetail so={so} agents={agents} access={access} />;
}
