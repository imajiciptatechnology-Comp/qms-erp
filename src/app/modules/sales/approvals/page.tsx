import { getSalesAccess } from "../access";
import { getApprovalQueue } from "../server";
import ApprovalCenter from "./ApprovalCenter";

export default async function ApprovalsPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const items = await getApprovalQueue();
  return <ApprovalCenter items={items} canApprove={access.canApprove} />;
}
