import { getSalesAccess } from "../access";
import { getSalesReport } from "../reportActions";
import ReportView from "./ReportView";

export default async function SalesReportPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  const sp = await searchParams;
  const year = Number(sp.year) || new Date().getFullYear();
  return <ReportView report={await getSalesReport(year)} canEditTargets={access.canApprove} />;
}
