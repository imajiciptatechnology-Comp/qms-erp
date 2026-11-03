import { notFound } from "next/navigation";
import { getSalesAccess } from "../../access";
import { getSalesOrder } from "../../actions";
import OrderDetail from "./OrderDetail";

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const so = await getSalesOrder(id);
  if (!so) notFound();
  return <OrderDetail so={so} access={access} />;
}
