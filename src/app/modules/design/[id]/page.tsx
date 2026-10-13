import { getDesignProject } from "../actions";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getDocuments } from "@/app/modules/document/actions";
import { notFound } from "next/navigation";
import DesignDetailClient from "./DesignDetailClient";

export default async function DesignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const [project, user, rolesConfig, documents] = await Promise.all([
    getDesignProject(resolvedParams.id),
    getCurrentUser(),
    getRolesConfig(),
    getDocuments()
  ]);

  if (!project) return notFound();

  return <DesignDetailClient project={project} user={user} rolesConfig={rolesConfig} documents={documents} />;
}
