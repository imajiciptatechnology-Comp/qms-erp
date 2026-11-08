import { notFound } from "next/navigation";
import { getSalesAccess } from "@/app/modules/sales/access";
import { canSeeService } from "@/app/modules/sales/lib";
import { getJob } from "../../actions";
import JobDetail from "./JobDetail";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!canSeeService(access)) return null;
  const job = await getJob(id);
  if (!job) notFound();
  return <JobDetail job={job} canManage={access.canService} canApprove={access.canApprove} />;
}
