import { getIncident } from "../../actions";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { notFound } from "next/navigation";
import IncidentDetailClient from "./IncidentDetailClient";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const [incident, user, rolesConfig] = await Promise.all([
    getIncident(resolvedParams.id),
    getCurrentUser(),
    getRolesConfig()
  ]);

  if (!incident) return notFound();

  return <IncidentDetailClient incident={incident} user={user} rolesConfig={rolesConfig} />;
}
