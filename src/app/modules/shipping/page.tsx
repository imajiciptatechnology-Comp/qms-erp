import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getShipments } from "./actions";
import { getWorkOrders } from "@/app/modules/ppc/actions";
import ShippingView from "./ShippingView";
import { notFound } from "next/navigation";

export default async function ShippingPage() {
  const user = await getCurrentUser();
  const rolesConfig = await getRolesConfig();
  const shipments = await getShipments();
  const wos = await getWorkOrders();
  const completedWos = wos.filter(w => w.status === "Completed");

  if (!user) return notFound();

  return (
    <ShippingView 
      shipments={shipments} 
      user={user} 
      rolesConfig={rolesConfig} 
      completedWos={completedWos}
    />
  );
}
