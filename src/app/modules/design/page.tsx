import { getCurrentUser, getRolesConfig, getAllUsers } from "@/app/actions/auth";
import { getDesignProjects } from "./actions";
import DesignView from "./DesignView";

export default async function DesignPage() {
  const user = await getCurrentUser();
  const rolesConfig = await getRolesConfig();
  const projects = await getDesignProjects();
  const allUsers = await getAllUsers();

  return (
    <DesignView 
      projects={projects} 
      user={user} 
      rolesConfig={rolesConfig} 
      allUsers={allUsers}
    />
  );
}
