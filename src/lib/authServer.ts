// Helper auth untuk kode server (halaman, route, server action lain) — sengaja BUKAN "use server".
// Fungsi di file "use server" otomatis bisa dipanggil langsung dari browser oleh siapa pun yang login;
// getAllUsers (email/telepon semua user) dan getRolesConfig (peta izin) dulu terbuka seperti itu.
import { cookies } from "next/headers";
import * as jose from "jose";
import { prisma } from "@/lib/prisma";
import { getJson } from "@/lib/kvStore";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
};

// JWT_SECRET wajib diisi lewat environment variable (tanpa nilai default).
export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET belum di-set. Tambahkan JWT_SECRET ke environment.");
  return new TextEncoder().encode(secret);
}

/** User dari cookie login (JWT terverifikasi), atau null. */
export async function readCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, getJwtSecretKey());
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as string,
      department: payload.department as string,
    };
  } catch {
    return null;
  }
}

/** Konfigurasi role → izin (Settings → Roles). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRolesConfig(): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getJson<any[]>("roles", []);
}

/** Semua user (untuk dropdown penanggung jawab dsb. di halaman server). */
export async function getAllUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, department: true, photoUrl: true, phone: true, bio: true },
  });
}
