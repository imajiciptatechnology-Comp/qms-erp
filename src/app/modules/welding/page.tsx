import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getWelders, getWPS } from "./actions";
import WeldingView from "./WeldingView";
import { notFound } from "next/navigation";

export default async function WeldingPage() {
  const user = await getCurrentUser();
  const rolesConfig = await getRolesConfig();
  
  const [welders, wpsList] = await Promise.all([
    getWelders(),
    getWPS()
  ]);

  if (!user) return notFound();

  return (
    <WeldingView 
      welders={welders} 
      wpsList={wpsList}
      user={user} 
      rolesConfig={rolesConfig} 
    />
  );
}
