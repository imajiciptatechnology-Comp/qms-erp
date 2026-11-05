import { getCurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { salesAccess } from "./lib";

/** Untuk page: layout sudah menampilkan pesan "tidak ada akses", page cukup tidak memuat data. */
export async function getSalesAccess() {
  const user = await getCurrentUser();
  return { user, access: salesAccess(user, user ? await getRolesConfig() : []) };
}
