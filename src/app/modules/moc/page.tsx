import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
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
