import { getNCRs } from "../actions";
import { getTrainings } from "@/app/modules/training/actions";
import { getCurrentUser, getRolesConfig, getAllUsers } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import NcDetailClient from "./NcDetailClient";

export default async function NcDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const [allNCRs, allTrainings, rolesConfig, allUsers] = await Promise.all([
    getNCRs(), getTrainings(), getRolesConfig(), getAllUsers()
  ]);

  const targetNCR = allNCRs.find(n => n.id === id);
  if (!targetNCR) redirect("/modules/nc");

  const linkedTrainings = allTrainings.filter(t => t.ncReferenceId === id);

  return (
    <NcDetailClient
      ncr={targetNCR}
      user={user}
      rolesConfig={rolesConfig}
      allUsers={allUsers}
      linkedTrainings={linkedTrainings}
    />
  );
}
