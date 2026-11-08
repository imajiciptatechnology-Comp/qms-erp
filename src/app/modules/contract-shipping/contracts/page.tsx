import { canSeeShipping } from "@/app/modules/sales/lib";
import { getSalesAccess } from "@/app/modules/sales/access";
import { getContracts } from "@/app/modules/sales/actions";
import ContractList from "./ContractList";

export default async function ContractsPage() {
  const { access } = await getSalesAccess();
  if (!canSeeShipping(access)) return null;
  return <ContractList contracts={await getContracts()} access={access} />;
}
