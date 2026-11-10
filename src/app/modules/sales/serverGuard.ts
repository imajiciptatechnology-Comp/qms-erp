// Cek akses & pembungkus hasil untuk server action modul Sales (dipakai file-file *Actions.ts).
// Sengaja bukan file "use server": fungsi di sini tidak boleh bisa dipanggil langsung dari browser.
import { revalidatePath } from "next/cache";
import { getCurrentUser, type CurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { salesAccess, type SalesAccess } from "./lib";

export type Result = { success: true; id?: string } | { success: false; message: string };

/** Login wajib + salah satu hak akses yang disebut (Super Admin selalu lolos). */
export async function guardAny(...need: (keyof SalesAccess)[]): Promise<CurrentUser & { access: SalesAccess }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Silakan login terlebih dahulu.");
  const access = salesAccess(user, await getRolesConfig());
  if (need.length && !need.some(k => access[k])) throw new Error("Anda tidak punya akses untuk aksi ini.");
  return { ...user, access };
}

export async function run(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const id = await fn();
    revalidatePath("/modules", "layout");
    return { success: true, id: id || undefined };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Terjadi kesalahan." };
  }
}
