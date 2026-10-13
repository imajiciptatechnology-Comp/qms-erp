import { getAudits } from "./actions";
import AuditView from "./AuditView";
import { getCurrentUser, getRolesConfig, getAllUsers } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const audits = await getAudits();
  const rolesConfig = await getRolesConfig();
  const users = await getAllUsers();
  
  return <AuditView audits={audits} user={user} rolesConfig={rolesConfig} allUsers={users} />;
}
