import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getEquipments } from "./actions";
import CalibrationView from "./CalibrationView";

export default async function CalibrationPage() {
  const user = await getCurrentUser();
  const rolesConfig = await getRolesConfig();
  const equipments = await getEquipments();

  return (
    <CalibrationView 
      equipments={equipments} 
      user={user} 
      rolesConfig={rolesConfig} 
    />
  );
}
