import { getCurrentUser } from "../../actions/auth";
import ProfileClient from "./ProfileClient";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    redirect("/login");
  }

  // Jangan kirim passwordHash ke client component.
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id as string },
    select: { id: true, name: true, email: true, role: true, department: true, photoUrl: true, phone: true, bio: true },
  });
  if (!user) {
    redirect("/login");
  }

  return <ProfileClient user={user} />;
}
