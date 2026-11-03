import { notFound, redirect } from "next/navigation";
import { getSalesAccess } from "../../../access";
import { getContract, getContractFormData } from "../../../actions";
import type { Clause } from "../../../documents/contractTemplates";
import ContractForm from "../../ContractForm";

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const [c, formData] = await Promise.all([getContract(id), getContractFormData()]);
  if (!c) notFound();
  if (c.status !== "Draft" || !access.canManage) redirect(`/modules/sales/contracts/${id}`);
  return (
    <ContractForm
      {...formData}
      contractId={c.id}
      initial={{
        customerId: c.customerId, salesOrderId: c.salesOrderId, type: c.type, title: c.title, startDate: c.startDate, endDate: c.endDate,
        value: c.value, visitsPerYear: c.visitsPerYear, coveredItems: JSON.parse(c.coveredItemsJson || "[]"), picName: c.picName ?? "", notes: c.notes ?? "",
        scope: c.scope ?? "", responseTime: c.responseTime ?? "", paymentTerms: c.paymentTerms ?? "", billingSchedule: c.billingSchedule,
        sparePartDiscount: c.sparePartDiscount, signatoryName: c.signatoryName ?? "", signatoryTitle: c.signatoryTitle ?? "",
        clauses: JSON.parse(c.clausesJson || "[]") as Clause[],
      }}
    />
  );
}
