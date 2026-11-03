import { getSalesAccess } from "../access";
import { getQuotations } from "../actions";
import QuotationList from "./QuotationList";

export default async function QuotationsPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  return <QuotationList quotations={await getQuotations()} canManage={access.canManage} />;
}
