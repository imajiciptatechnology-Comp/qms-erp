import { getSalesAccess } from "../../access";
import { getQuotationFormData } from "../../actions";
import QuotationForm from "../QuotationForm";

// Server action draft AI bisa makan waktu ~10–40 detik.
export const maxDuration = 60;

export default async function NewQuotationPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  if (!access.canManage) return <p className="text-sm text-slate-500">Role Anda tidak bisa membuat penawaran.</p>;
  return <QuotationForm {...await getQuotationFormData()} />;
}
