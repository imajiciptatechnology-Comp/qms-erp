import { getMocRecord } from "../actions";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { notFound } from "next/navigation";
import MocDetailClient from "./MocDetailClient";

export default async function MocDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const [record, user, rolesConfig] = await Promise.all([
    getMocRecord(resolvedParams.id),
    getCurrentUser(),
    getRolesConfig()
  ]);

  if (!record) return notFound();

  return <MocDetailClient record={record} user={user} rolesConfig={rolesConfig} />;
}
