import { redirect } from "next/navigation";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getContext } from "./actions";
import ContextView from "./ContextView";

export default async function ContextPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [context, rolesConfig] = await Promise.all([getContext(), getRolesConfig()]);
  return (
    <div className="p-6">
      <ContextView context={context} user={user} rolesConfig={rolesConfig} />
    </div>
  );
}
