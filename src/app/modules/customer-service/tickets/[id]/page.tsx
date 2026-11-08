import { notFound } from "next/navigation";
import { getSalesAccess } from "@/app/modules/sales/access";
import { canSeeService } from "@/app/modules/sales/lib";
import { getTicket } from "../../actions";
import TicketDetail from "./TicketDetail";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!canSeeService(access)) return null;
  const t = await getTicket(id);
  if (!t) notFound();
  return <TicketDetail t={t} canManage={access.canService} />;
}
