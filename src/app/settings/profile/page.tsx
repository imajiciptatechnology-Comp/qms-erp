import { getCurrentUser } from "../../actions/auth";
import ProfileClient from "./ProfileClient";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id as string } });
  if (!user) {
    redirect("/login");
  }

  return <ProfileClient user={user} />;
}
