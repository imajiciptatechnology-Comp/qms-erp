import { getSalesAccess } from "../access";
import { getContracts } from "../actions";
import ContractList from "./ContractList";

export default async function ContractsPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  return <ContractList contracts={await getContracts()} access={access} />;
}
