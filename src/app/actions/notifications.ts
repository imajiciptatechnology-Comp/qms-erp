"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { getCurrentUser, getAllUsers, getRolesConfig } from "./auth";

const NOTIFICATIONS_FILE = path.join(process.cwd(), ".data", "notifications.json");

export type Notification = {
  id: string;
  userId?: string;     // If targeted to a specific user
  targetRole?: string; // If targeted to anyone with a specific role/permission
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
};

export async function getNotifications() {
  if (!fs.existsSync(NOTIFICATIONS_FILE)) return [];
  return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, "utf-8")) as Notification[];
}

export async function saveNotifications(notifs: Notification[]) {
  fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifs, null, 2));
}

export async function createNotification(data: Omit<Notification, "id" | "isRead" | "createdAt">) {
  const notifs = await getNotifications();
  const newNotif: Notification = {
    ...data,
    id: Date.now().toString(),
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  notifs.unshift(newNotif); // Add to beginning
  saveNotifications(notifs);
  revalidatePath("/");
}

/**
 * Create a notification targeted to a specific user by ID.
 */
export async function createNotificationForUser(userId: string, message: string, link?: string) {
  await createNotification({ userId, message, link });
}

/**
 * Create notifications for all users who have a specific permission.
 * This is more targeted than broadcasting to "All".
 */
export async function createNotificationForPermission(permission: string, message: string, link?: string) {
  const allUsers = await getAllUsers();
  const rolesConfig = await getRolesConfig();

  for (const u of allUsers) {
    // Super Admin always gets everything
    if (u.role === "Super Admin") {
      await createNotification({ userId: u.id, message, link });
      continue;
    }
    // Check if the user's role has the required permission
    const roleData = rolesConfig.find((r: any) => r.name === u.role);
    if (roleData?.permissions?.includes(permission)) {
      await createNotification({ userId: u.id, message, link });
    }
  }
}

export async function markNotificationAsRead(id: string) {
  const notifs = await getNotifications();
  const index = notifs.findIndex(n => n.id === id);
  if (index !== -1) {
    notifs[index].isRead = true;
    saveNotifications(notifs);
    revalidatePath("/");
  }
}

export async function getMyNotifications() {
  const user = await getCurrentUser();
  if (!user) return [];
  
  const notifs = await getNotifications();
  
  return notifs.filter(n => {
    // Direct user-targeted notification
    if (n.userId && n.userId === user.id) return true;
    // Super Admin sees ALL notifications (legacy & new)
    if (user.role === "Super Admin" && !n.userId) return true;
    return false;
  }).slice(0, 20); // return top 20
}

export async function deleteNotification(id: string) {
  const notifs = await getNotifications();
  const updated = notifs.filter(n => n.id !== id);
  saveNotifications(updated);
  revalidatePath("/");
}

export async function clearAllNotifications() {
  const user = await getCurrentUser();
  if (!user) return;
  
  const notifs = await getNotifications();
  // Only remove notifications that belong to this user
  const updated = notifs.filter(n => {
    if (n.userId === user.id) return false; // Remove mine
    if (user.role === "Super Admin" && !n.userId) return false; // Super Admin clears legacy ones too
    return true; // Keep everything else
  });
  
  saveNotifications(updated);
  revalidatePath("/");
}
