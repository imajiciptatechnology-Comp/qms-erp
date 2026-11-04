import { notFound } from "next/navigation";
import { getLogisticsAccess, getOrderFormData, getOrderInput } from "../../../server";
import OrderForm from "../../OrderForm";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  if (!access.canOrder) return <p className="text-sm text-slate-500">Role Anda tidak bisa mengedit order charter.</p>;
  const { id } = await params;
  const initial = await getOrderInput(id);
  if (!initial) notFound();
  return <OrderForm {...await getOrderFormData()} initial={initial} orderId={id} aiConfigured={false} />;
}
