import { getSalesAccess } from "../access";
import { getContracts, getCustomers } from "../actions";
import ContractList from "./ContractList";

export default async function ContractsPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const [contracts, customers] = await Promise.all([getContracts(), getCustomers()]);
  return <ContractList contracts={contracts} customers={customers.map(c => ({ id: c.id, name: c.name }))} access={access} />;
}
