import { getSalesAccess } from "../access";
import { getGuaranteeFormData, getGuarantees } from "../tenderActions";
import GuaranteeList from "./GuaranteeList";

export default async function GuaranteesPage({ searchParams }: { searchParams: Promise<{ new?: string; customer?: string; opportunity?: string; so?: string }> }) {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const sp = await searchParams;
  const [guarantees, formData] = await Promise.all([getGuarantees(), getGuaranteeFormData()]);
  return (
    <GuaranteeList
      guarantees={guarantees} {...formData} canEdit={access.canManage || access.canFinance}
      openNew={sp.new ? { customerId: sp.customer, opportunityId: sp.opportunity, salesOrderId: sp.so } : null}
    />
  );
}
