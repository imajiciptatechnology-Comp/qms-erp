import { getWorkOrder } from "../actions";
import { getCurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { notFound } from "next/navigation";
import PpcDetailClient from "./PpcDetailClient";

export default async function PpcDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const [workOrder, user, rolesConfig] = await Promise.all([
    getWorkOrder(resolvedParams.id),
    getCurrentUser(),
    getRolesConfig()
  ]);

  if (!workOrder) return notFound();

  return <PpcDetailClient workOrder={workOrder} user={user} rolesConfig={rolesConfig} />;
}
