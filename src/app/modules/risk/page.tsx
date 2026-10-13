import { redirect } from "next/navigation";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getRisks } from "./actions";
import { getJson, setJson } from "@/lib/kvStore";
import { getNCRs } from "@/app/modules/nc/actions";
import RiskView from "./RiskView";
export default async function RiskPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [risks, ncrs, rolesConfig, allUsers] = await Promise.all([
    getRisks(), getNCRs(), getRolesConfig(), getJson<any[]>("users", []),
  ]);

  return (
    <div className="p-6">
      <RiskView risks={risks} ncrs={ncrs} user={user} rolesConfig={rolesConfig} allUsers={allUsers} />
    </div>
  );
}
