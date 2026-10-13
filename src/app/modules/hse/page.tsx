import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getIncidents, getPatrols } from "./actions";
import HSEView from "./HSEView";
import { notFound } from "next/navigation";

export default async function HSEPage() {
  const user = await getCurrentUser();
  const rolesConfig = await getRolesConfig();
  
  const [incidents, patrols] = await Promise.all([
    getIncidents(),
    getPatrols()
  ]);

  if (!user) return notFound();

  return (
    <HSEView 
      incidents={incidents} 
      patrols={patrols}
      user={user} 
      rolesConfig={rolesConfig} 
    />
  );
}
