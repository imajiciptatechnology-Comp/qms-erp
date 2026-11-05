import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { getManagementReviews } from "./actions";
import ManagementReviewView from "./ManagementReviewView";

export default async function ManagementReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [reviews, rolesConfig] = await Promise.all([getManagementReviews(), getRolesConfig()]);

  return (
    <div className="p-6">
      <ManagementReviewView reviews={reviews} user={user} rolesConfig={rolesConfig} />
    </div>
  );
}
