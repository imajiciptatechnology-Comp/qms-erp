import { getSalesAccess } from "../access";
import { getCustomers } from "../actions";
import CustomerList from "./CustomerList";

export default async function CustomersPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  return <CustomerList customers={await getCustomers()} canManage={access.canManage} />;
}
