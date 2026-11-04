import { isAiConfigured } from "@/lib/ai";
import { getLogisticsAccess, getOrderFormData } from "../../server";
import OrderForm from "../OrderForm";

// Draft AI bisa makan waktu ~10–40 detik (Gemini free tier).
export const maxDuration = 60;

export default async function NewOrderPage() {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  if (!access.canOrder) return <p className="text-sm text-slate-500">Role Anda tidak bisa membuat order charter (hanya Admin Order / Operations Manager).</p>;
  return <OrderForm {...await getOrderFormData()} aiConfigured={isAiConfigured()} />;
}
