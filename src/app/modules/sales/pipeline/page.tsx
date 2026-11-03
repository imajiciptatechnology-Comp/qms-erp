import { getSalesAccess } from "../access";
import { getCustomers, getOpportunities } from "../actions";
import PipelineBoard from "./PipelineBoard";

export default async function PipelinePage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const [opportunities, customers] = await Promise.all([getOpportunities(), getCustomers()]);
  return <PipelineBoard opportunities={opportunities} customers={customers.map(c => ({ id: c.id, name: c.name }))} canManage={access.canManage} />;
}
