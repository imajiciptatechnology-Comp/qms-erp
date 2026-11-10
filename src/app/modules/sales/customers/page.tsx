import { getSalesAccess } from "../access";
import { getCustomers } from "../actions";
import { getAgentOptions } from "../agentActions";
import CustomerList from "./CustomerList";

export default async function CustomersPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const [customers, agents] = await Promise.all([getCustomers(), getAgentOptions()]);
  return <CustomerList customers={customers} agents={agents} canManage={access.canManage} />;
}
