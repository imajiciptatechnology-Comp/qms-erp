import { notFound } from "next/navigation";
import { getSalesAccess } from "@/app/modules/sales/access";
import { canSeeShipping } from "@/app/modules/sales/lib";
import { getShipment } from "../../actions";
import ShipmentDetail from "./ShipmentDetail";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  if (!canSeeShipping(access)) return null;
  const s = await getShipment(id);
  if (!s) notFound();
  return <ShipmentDetail s={s} canManage={access.canShipping} canApprove={access.canApprove} />;
}
