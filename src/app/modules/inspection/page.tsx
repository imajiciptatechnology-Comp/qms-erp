import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getInspections } from "./actions";
import InspectionView from "./InspectionView";
import { notFound } from "next/navigation";

export default async function InspectionPage() {
  const user = await getCurrentUser();
  const rolesConfig = await getRolesConfig();
  const inspections = await getInspections();

  if (!user) return notFound();

  return (
    <InspectionView 
      inspections={inspections} 
      user={user} 
      rolesConfig={rolesConfig} 
    />
  );
}
