import { getSalesAccess } from "@/app/modules/sales/access";
import { canSeeShipping } from "@/app/modules/sales/lib";
import { getProductionOrders } from "../actions";
import ProductionBoard from "./ProductionBoard";

export default async function ProductionPage() {
  const { access } = await getSalesAccess();
  if (!canSeeShipping(access)) return null;
  const orders = await getProductionOrders();
  return <ProductionBoard orders={orders} canManage={access.canShipping} />;
}
