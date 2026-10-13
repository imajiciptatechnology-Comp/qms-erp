import { getDocuments } from "../actions";
import { getCurrentUser, getRolesConfig, getAllUsers } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import DocumentDetailClient from "./DocumentDetailClient";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const allDocuments = await getDocuments();
  const rolesConfig = await getRolesConfig();
  const allUsers = await getAllUsers();

  // Find the target document
  const targetDoc = allDocuments.find(d => d.id === id);
  if (!targetDoc) redirect("/modules/document");

  // Get the "family" of this document (all revisions)
  const familyId = targetDoc.parentId || targetDoc.id;
  const revisionFamily = allDocuments
    .filter(d => d.id === familyId || d.parentId === familyId)
    .sort((a, b) => b.revision - a.revision); // Latest first

  // Get the latest revision as the "main" doc to display
  const latestDoc = revisionFamily[0];

  // Dokumen lain untuk related linking (exclude keluarga sendiri)
  const otherDocs = allDocuments.filter(d => {
    const dFamilyId = d.parentId || d.id;
    return dFamilyId !== familyId && !d.parentId; // hanya satu entry per keluarga (Rev 0)
  });

  return (
    <DocumentDetailClient
      document={latestDoc}
      revisions={revisionFamily}
      user={user}
      rolesConfig={rolesConfig}
      allDocs={otherDocs}
      allUsers={allUsers}
    />
  );
}
