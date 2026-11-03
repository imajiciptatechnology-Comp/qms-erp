import { getSalesAccess } from "../access";
import { getInvoices } from "../actions";
import InvoiceList from "./InvoiceList";

export default async function InvoicesPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  return <InvoiceList invoices={await getInvoices()} />;
}
