import { canSeeShipping } from "@/app/modules/sales/lib";
import { notFound } from "next/navigation";
import { getSalesAccess } from "@/app/modules/sales/access";
import { getContract } from "@/app/modules/sales/actions";
import ContractDetail from "./ContractDetail";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!canSeeShipping(access)) return null;
  const c = await getContract(id);
  if (!c) notFound();
  return <ContractDetail c={c} access={access} />;
}
