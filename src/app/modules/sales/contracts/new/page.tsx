import { getSalesAccess } from "../../access";
import { getContractFormData } from "../../actions";
import ContractForm from "../ContractForm";

// Draft kontrak dengan AI bisa makan waktu ~10–40 detik.
export const maxDuration = 60;

export default async function NewContractPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  if (!access.canManage) return <p className="text-sm text-slate-500">Role Anda tidak bisa membuat kontrak.</p>;
  return <ContractForm {...await getContractFormData()} />;
}
