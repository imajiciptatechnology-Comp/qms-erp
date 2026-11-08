import { canSeeShipping } from "@/app/modules/sales/lib";
import { getSalesAccess } from "@/app/modules/sales/access";
import { getContractFormData } from "@/app/modules/sales/actions";
import ContractForm from "../ContractForm";

// Draft kontrak dengan AI bisa makan waktu ~10–40 detik.
export const maxDuration = 60;

export default async function NewContractPage() {
  const { access } = await getSalesAccess();
  if (!canSeeShipping(access)) return null;
  if (!access.canShipping) return <p className="text-sm text-slate-500">Role Anda tidak bisa membuat kontrak.</p>;
  return <ContractForm {...await getContractFormData()} />;
}
