"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { setJson } from "@/lib/kvStore";
import { uploadToStorage } from "@/lib/uploadFile";
import { getJwtSecretKey, getRolesConfig, readCurrentUser, type CurrentUser } from "@/lib/authServer";
import * as jose from 'jose';
import bcrypt from 'bcryptjs';

// File ini "use server": SETIAP export bisa dipanggil langsung dari browser.
// Helper baca data (getRolesConfig, getAllUsers) ada di "@/lib/authServer" dan tidak diekspor dari sini.
export type { CurrentUser } from "@/lib/authServer";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { success: false, message: "Email atau password salah!" };

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return { success: false, message: "Email atau password salah!" };

  const alg = 'HS256';
  const token = await new jose.SignJWT({ id: user.id, email: user.email, role: user.role, name: user.name, department: user.department })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecretKey());

  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, { httpOnly: true, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 24 * 60 * 60 });

  return { success: true };
}

async function saveRolesConfig(roles: any[]) {
  await setJson("roles", roles);
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_token");
}

/** Identitas user yang sedang login (hanya data miliknya sendiri — aman sebagai server action). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return readCurrentUser();
}

export async function updateProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "Not logged in" };

  const userId = user.id as string;
  let photoUrl = undefined;

  // Handle Photo Upload
  const photoFile = formData.get("photo") as File | null;
  const clearPhoto = formData.get("clearPhoto") === "true";

  if (clearPhoto) {
    photoUrl = null;
  } else if (photoFile && photoFile.size > 0) {
    // Ekstensi dari tipe yang divalidasi, bukan dari nama file kiriman browser (mencegah path aneh di bucket).
    const PHOTO_EXT: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
    const ext = PHOTO_EXT[photoFile.type];
    if (!ext) return { success: false, message: "Foto harus JPG, PNG, WebP, atau GIF." };
    if (photoFile.size > 4 * 1024 * 1024) return { success: false, message: "Foto maksimal 4 MB." };
    const fileName = `profile_${userId}_${Date.now()}${ext}`;
    photoUrl = await uploadToStorage("profiles", photoFile, fileName);
  }

  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const bio = formData.get("bio") as string;

  const dataToUpdate: any = {};
  if (name) dataToUpdate.name = name;
  if (phone) dataToUpdate.phone = phone;
  if (bio) dataToUpdate.bio = bio;
  if (photoUrl !== undefined) dataToUpdate.photoUrl = photoUrl;

  await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate
  });

  revalidatePath("/settings/profile");
  revalidatePath("/", "layout"); 
  
  return { success: true, message: "Profile updated!" };
}

export async function changeUserRole(targetUserId: string, newRole: string) {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "Super Admin") {
    return { success: false, message: "Hanya Super Admin yang bisa ubah role!" };
  }
  if (typeof targetUserId !== "string" || typeof newRole !== "string" || !newRole.trim() || newRole.length > 60) {
    return { success: false, message: "Role tidak valid." };
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole }
  });
  
  revalidatePath("/settings/roles");
  return { success: true, message: "Role berhasil diubah!" };
}

export async function updateRolePermissions(roleName: string, moduleIds: string[]) {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "Super Admin") {
    return { success: false, message: "Hanya Super Admin yang bisa ubah permission!" };
  }

  if (roleName === "Super Admin") {
    return { success: false, message: "Permissions Super Admin tidak bisa diubah." };
  }
  if (typeof roleName !== "string" || !roleName.trim() || !Array.isArray(moduleIds) || moduleIds.some(m => typeof m !== "string" || m.length > 80)) {
    return { success: false, message: "Data permission tidak valid." };
  }

  const roles = await getRolesConfig();
  const roleIndex = roles.findIndex((r: any) => r.name === roleName);
  
  if (roleIndex === -1) {
    roles.push({ name: roleName, permissions: moduleIds });
  } else {
    roles[roleIndex].permissions = moduleIds;
  }

  await saveRolesConfig(roles);
  
  revalidatePath("/", "layout");
  
  return { success: true, message: "Permissions berhasil disimpan!" };
}
