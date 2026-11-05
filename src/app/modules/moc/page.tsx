import { getCurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { getMocRecords } from "./actions";
import MocView from "./MocView";
import { notFound } from "next/navigation";

export default async function MocPage() {
  const user = await getCurrentUser();
  const rolesConfig = await getRolesConfig();
  const records = await getMocRecords();

  if (!user) return notFound();

  return (
    <MocView 
      records={records} 
      user={user} 
      rolesConfig={rolesConfig} 
    />
  );
}
