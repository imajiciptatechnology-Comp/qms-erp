import { getInspection } from "../actions";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { notFound } from "next/navigation";
import InspectionDetailClient from "./InspectionDetailClient";

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const [inspection, user, rolesConfig] = await Promise.all([
    getInspection(resolvedParams.id),
    getCurrentUser(),
    getRolesConfig()
  ]);

  if (!inspection) return notFound();

  return <InspectionDetailClient inspection={inspection} user={user} rolesConfig={rolesConfig} />;
}
