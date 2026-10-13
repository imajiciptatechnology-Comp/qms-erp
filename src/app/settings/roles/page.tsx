import { getAllUsers, getCurrentUser, getRolesConfig } from "../../actions/auth";
import RolesClient from "./RolesClient";
import { redirect } from "next/navigation";

export default async function RolesPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  
  if (currentUser.role !== "Super Admin") {
    return <div className="p-8 text-center text-red-500 text-lg font-bold">Access Denied: Only Super Admin can view this page.</div>;
  }

  const users = await getAllUsers();
  const rolesConfig = await getRolesConfig();

  return <RolesClient users={users} currentUser={currentUser} initialRolesConfig={rolesConfig} />;
}
