import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getWorkOrders } from "./actions";
import PpcView from "./PpcView";
import { notFound } from "next/navigation";

export default async function PpcPage() {
  const user = await getCurrentUser();
  const rolesConfig = await getRolesConfig();
  const workOrders = await getWorkOrders();

  if (!user) return notFound();

  return (
    <PpcView 
      workOrders={workOrders} 
      user={user} 
      rolesConfig={rolesConfig} 
    />
  );
}
