"use server";

// Server action notifikasi untuk Topbar: hanya baca/ubah notifikasi milik user yang login.
// Membuat notifikasi dilakukan dari kode server lewat "@/lib/notificationStore" (bukan server action),
// supaya browser tidak bisa menyuntik atau menimpa notifikasi user lain.
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./auth";
import { listNotifications, updateNotifications, type Notification } from "@/lib/notificationStore";

export type { Notification } from "@/lib/notificationStore";

type Me = { id: string; role: string };

/** Notifikasi yang boleh dilihat/diubah user ini (Super Admin juga notifikasi lama tanpa userId). */
const isMine = (n: Notification, me: Me) => (n.userId ? n.userId === me.id : me.role === "Super Admin");

export async function getMyNotifications() {
  const user = await getCurrentUser();
  if (!user) return [];
  const notifs = await listNotifications();
  return notifs.filter(n => isMine(n, user)).slice(0, 20);
}

export async function markNotificationAsRead(id: string) {
  const user = await getCurrentUser();
  if (!user || typeof id !== "string") return;
  await updateNotifications(list => list.map(n => (n.id === id && isMine(n, user) ? { ...n, isRead: true } : n)));
  revalidatePath("/");
}

export async function deleteNotification(id: string) {
  const user = await getCurrentUser();
  if (!user || typeof id !== "string") return;
  await updateNotifications(list => list.filter(n => !(n.id === id && isMine(n, user))));
  revalidatePath("/");
}

export async function clearAllNotifications() {
  const user = await getCurrentUser();
  if (!user) return;
  await updateNotifications(list => list.filter(n => !isMine(n, user)));
  revalidatePath("/");
}
