import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getMaintenanceRecords } from "./actions";
import MaintenanceView from "./MaintenanceView";
import { notFound } from "next/navigation";

export default async function MaintenancePage() {
  const user = await getCurrentUser();
  const rolesConfig = await getRolesConfig();
  const records = await getMaintenanceRecords();

  if (!user) return notFound();

  return (
    <MaintenanceView 
      records={records} 
      user={user} 
      rolesConfig={rolesConfig} 
    />
  );
}
