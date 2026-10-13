import { getDocuments, checkAndNotifyDocumentReviews } from "./actions";
import DocumentControlView from "./DocumentControlView";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function DocumentControlPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let documents = await getDocuments();
  const rolesConfig = await getRolesConfig();

  // Check for documents with upcoming/overdue review dates and send notifications
  await checkAndNotifyDocumentReviews();
  
  const roleData = rolesConfig.find((r: any) => r.name === user.role);
  const canApprove = user.role === "Super Admin" || roleData?.permissions.includes("document_approve");

  // Visibility Filter
  documents = documents.filter(doc => {
    if (canApprove) return true; // Approvers see everything
    if (doc.status === "Published") return true; // Everyone sees Published
    if (doc.uploaderId === user.id) return true; // Uploader sees their own drafts
    return false;
  });

  return <DocumentControlView initialDocuments={documents} user={user} rolesConfig={rolesConfig} />;
}
