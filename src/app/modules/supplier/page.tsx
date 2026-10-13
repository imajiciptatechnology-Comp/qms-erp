import { redirect } from "next/navigation";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getSuppliers } from "./actions";
import { getNCRs } from "@/app/modules/nc/actions";
import SupplierView from "./SupplierView";

export default async function SupplierPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [suppliers, ncrs, rolesConfig] = await Promise.all([
    getSuppliers(), getNCRs(), getRolesConfig(),
  ]);

  // Compute real ncCount per supplier from actual NC data
  const suppliersWithStats = suppliers.map(s => ({
    ...s,
    ncCount: ncrs.filter(n => n.supplierId === s.id).length,
  }));

  return (
    <div className="p-6">
      <SupplierView suppliers={suppliersWithStats} user={user} rolesConfig={rolesConfig} ncrs={ncrs} />
    </div>
  );
}
