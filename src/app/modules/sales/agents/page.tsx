import { getSalesAccess } from "../access";
import { getAgentsOverview } from "../agentActions";
import AgentsView from "./AgentsView";

export default async function AgentsPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const data = await getAgentsOverview();
  return <AgentsView {...data} canEdit={access.canApprove} canPay={access.canFinance} />;
}
