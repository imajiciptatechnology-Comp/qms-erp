import { getNCRs } from "./actions";
import NcView from "./NcView";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { getSuppliers } from "@/app/modules/supplier/actions";

export default async function NcManagementPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [ncrs, rolesConfig, suppliers] = await Promise.all([
    getNCRs(), getRolesConfig(), getSuppliers(),
  ]);

  return <NcView ncrs={ncrs} user={user} rolesConfig={rolesConfig} suppliers={suppliers} />;
}
