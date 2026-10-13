import { getTrainingById } from "../actions";
import TrainingDetailClient from "./TrainingDetailClient";
import { getCurrentUser, getRolesConfig, getAllUsers } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const training = await getTrainingById(id);
  if (!training) redirect("/modules/training");

  const rolesConfig = await getRolesConfig();
  const allUsers = await getAllUsers();

  return <TrainingDetailClient training={training} user={user} rolesConfig={rolesConfig} allUsers={allUsers} />;
}
