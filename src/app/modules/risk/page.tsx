import { redirect } from "next/navigation";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getRisks } from "./actions";
import { getNCRs } from "@/app/modules/nc/actions";
import RiskView from "./RiskView";
import fs from "fs";
import path from "path";

async function getAllUsers() {
  const file = path.join(process.cwd(), ".data", "users.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export default async function RiskPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [risks, ncrs, rolesConfig, allUsers] = await Promise.all([
    getRisks(), getNCRs(), getRolesConfig(), getAllUsers(),
  ]);

  return (
    <div className="p-6">
      <RiskView risks={risks} ncrs={ncrs} user={user} rolesConfig={rolesConfig} allUsers={allUsers} />
    </div>
  );
}
