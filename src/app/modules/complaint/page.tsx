import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { getComplaints, getSurveys } from "./actions";
import ComplaintView from "./ComplaintView";

export default async function ComplaintPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [complaints, surveys, rolesConfig] = await Promise.all([
    getComplaints(), getSurveys(), getRolesConfig(),
  ]);

  return (
    <div className="p-6">
      <ComplaintView complaints={complaints} surveys={surveys} user={user} rolesConfig={rolesConfig} />
    </div>
  );
}
