import {
  getTrainings, getCompetencyRequirements, getCompetencyGap,
  getMandatoryCompliance
} from "./actions";
import TrainingView from "./TrainingView";
import { getCurrentUser, getRolesConfig, getAllUsers } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function TrainingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [trainings, rolesConfig, allUsers, requirements] = await Promise.all([
    getTrainings(), getRolesConfig(), getAllUsers(), getCompetencyRequirements(),
  ]);

  const [gaps, mandatoryCompliance] = await Promise.all([
    getCompetencyGap(),
    getMandatoryCompliance(allUsers),
  ]);

  return (
    <TrainingView
      trainings={trainings}
      user={user}
      rolesConfig={rolesConfig}
      allUsers={allUsers}
      requirements={requirements}
      gaps={gaps}
      mandatoryCompliance={mandatoryCompliance}
    />
  );
}
