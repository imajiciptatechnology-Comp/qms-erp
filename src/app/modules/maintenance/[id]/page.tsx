import { getMaintenanceRecord } from "../actions";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { notFound } from "next/navigation";
import MaintenanceDetailClient from "./MaintenanceDetailClient";

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const [record, user, rolesConfig] = await Promise.all([
    getMaintenanceRecord(resolvedParams.id),
    getCurrentUser(),
    getRolesConfig()
  ]);

  if (!record) return notFound();

  return <MaintenanceDetailClient record={record} user={user} rolesConfig={rolesConfig} />;
}
