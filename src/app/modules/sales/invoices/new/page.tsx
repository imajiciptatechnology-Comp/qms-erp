import { getSalesAccess } from "../../access";
import { getInvoiceFormData } from "../../actions";
import NewInvoiceForm from "./NewInvoiceForm";

export default async function NewInvoicePage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  if (!access.canFinance) return <p className="text-sm text-slate-500">Hanya role Finance yang bisa menerbitkan invoice.</p>;
  return <NewInvoiceForm {...await getInvoiceFormData()} />;
}
