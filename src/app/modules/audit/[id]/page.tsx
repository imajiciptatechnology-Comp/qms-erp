import { getAuditById } from "../actions";
import { getNCRs } from "@/app/modules/nc/actions";
import AuditDetailClient from "./AuditDetailClient";
import { getCurrentUser, getRolesConfig, getAllUsers } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const [audit, allNCRs, rolesConfig, allUsers] = await Promise.all([
    getAuditById(id), getNCRs(), getRolesConfig(), getAllUsers()
  ]);
  if (!audit) redirect("/modules/audit");

  const auditNCRs = allNCRs.filter(nc => nc.auditId === id);

  return <AuditDetailClient audit={audit} ncrs={auditNCRs} user={user} rolesConfig={rolesConfig} allUsers={allUsers} />;
}
