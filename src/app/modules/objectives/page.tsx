import { redirect } from "next/navigation";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getObjectives } from "./actions";
import ObjectivesView from "./ObjectivesView";

export default async function ObjectivesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [objectives, rolesConfig] = await Promise.all([getObjectives(), getRolesConfig()]);

  return (
    <div className="p-6">
      <ObjectivesView objectives={objectives} user={user} rolesConfig={rolesConfig} />
    </div>
  );
}
