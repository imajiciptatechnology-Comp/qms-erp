import { notFound, redirect } from "next/navigation";
import { getSalesAccess } from "../../../access";
import { getQuotation, getQuotationFormData } from "../../../actions";
import QuotationForm from "../../QuotationForm";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const [q, formData] = await Promise.all([getQuotation(id), getQuotationFormData()]);
  if (!q) notFound();
  if (q.status !== "Draft" || !access.canManage) redirect(`/modules/sales/quotations/${id}`);

  // Opportunity yang sudah terkait tetap muncul walau tahapnya sudah lewat.
  const opportunities = q.opportunity && !formData.opportunities.some(o => o.id === q.opportunity!.id)
    ? [...formData.opportunities, { id: q.opportunity.id, opportunityNo: q.opportunity.opportunityNo, title: q.opportunity.title, customerId: q.opportunity.customerId }]
    : formData.opportunities;

  return (
    <QuotationForm
      {...formData}
      opportunities={opportunities}
      quotationId={q.id}
      initial={{
        customerId: q.customerId, opportunityId: q.opportunityId, date: q.date, validUntil: q.validUntil, subject: q.subject, attention: q.attention ?? "",
        introText: q.introText ?? "", closingText: q.closingText ?? "", discountPercent: q.discountPercent, paymentTerms: q.paymentTerms ?? "",
        deliveryTerms: q.deliveryTerms ?? "", warrantyTerms: q.warrantyTerms ?? "", notes: q.notes ?? "",
        items: q.items.map(i => ({ productId: i.productId, description: i.description, specs: i.specs ?? "", qty: i.qty, unit: i.unit, unitPrice: i.unitPrice, discountPercent: i.discountPercent })),
      }}
    />
  );
}
