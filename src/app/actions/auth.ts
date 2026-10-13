"use server";

import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import * as jose from 'jose';
import bcrypt from 'bcryptjs';

const ROLES_FILE = path.join(process.cwd(), ".data", "roles.json");
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-for-qms-erp');

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
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, { httpOnly: true, path: "/" });

  return { success: true };
}

export async function getRolesConfig() {
  if (!fs.existsSync(ROLES_FILE)) return [];
  return JSON.parse(fs.readFileSync(ROLES_FILE, "utf-8"));
}

function saveRolesConfig(roles: any[]) {
  fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2));
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_token");
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) return null;

  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as string,
      department: payload.department as string,
    };
  } catch (err) {
    return null;
  }
}

export async function getAllUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, department: true, photoUrl: true, phone: true, bio: true }
  });
  return users;
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
    const buffer = Buffer.from(await photoFile.arrayBuffer());
    const ext = path.extname(photoFile.name);
    const fileName = `profile_${userId}_${Date.now()}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "profiles");
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    photoUrl = `/uploads/profiles/${fileName}`;
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

  const roles = await getRolesConfig();
  const roleIndex = roles.findIndex((r: any) => r.name === roleName);
  
  if (roleIndex === -1) {
    roles.push({ name: roleName, permissions: moduleIds });
  } else {
    roles[roleIndex].permissions = moduleIds;
  }

  saveRolesConfig(roles);
  
  revalidatePath("/", "layout");
  
  return { success: true, message: "Permissions berhasil disimpan!" };
}
