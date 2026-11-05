// Penyimpanan notifikasi ERP (KvStore "notifications") — HANYA untuk kode server.
// Sengaja bukan "use server": fungsi pembuat notifikasi tidak boleh bisa dipanggil langsung dari browser
// (dulu createNotification/saveNotifications di app/actions/notifications.ts terbuka sebagai server action).
// Setiap perubahan memakai advisory lock supaya penulisan bersamaan tidak saling menimpa.
import { prisma } from "@/lib/prisma";
import { getJson } from "@/lib/kvStore";
import { withAdvisoryLock } from "@/lib/dbLock";

export type Notification = {
  id: string;
  userId?: string;     // notifikasi untuk satu user
  targetRole?: string; // (lama) untuk role tertentu
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
};

const KEY = "notifications";
const MAX_ITEMS = 500;
const LOCK = "kv:notifications";

export async function listNotifications(): Promise<Notification[]> {
  return getJson<Notification[]>(KEY, []);
}

/** Baca–ubah–tulis daftar notifikasi di bawah satu kunci. */
export async function updateNotifications(fn: (list: Notification[]) => Notification[]): Promise<void> {
  await withAdvisoryLock(LOCK, async tx => {
    const row = await tx.kvStore.findUnique({ where: { key: KEY } });
    let list: Notification[] = [];
    try { list = row ? JSON.parse(row.value) : []; } catch { list = []; }
    if (!Array.isArray(list)) list = [];
    const value = JSON.stringify(fn(list).slice(0, MAX_ITEMS));
    await tx.kvStore.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  });
}

let seq = 0;
const newId = () => `${Date.now()}-${process.pid % 1000}-${seq++ % 100000}`;

/** Tambah notifikasi (terbaru di depan). */
export async function addNotifications(items: { userId?: string; message: string; link?: string }[]): Promise<void> {
  if (!items.length) return;
  const at = new Date().toISOString();
  const fresh = items.map(i => ({ id: newId(), userId: i.userId, message: i.message.slice(0, 500), link: i.link, isRead: false, createdAt: at }));
  await updateNotifications(list => [...fresh, ...list]);
}

export async function notifyUser(userId: string, message: string, link?: string) {
  await addNotifications([{ userId, message, link }]);
}

/** Semua user yang punya izin `permission` (Super Admin dan role "all" selalu ikut). Satu kali tulis. */
export async function notifyPermission(permission: string, messages: string | string[], link?: string) {
  const list = Array.isArray(messages) ? messages : [messages];
  const [users, roles] = await Promise.all([
    prisma.user.findMany({ select: { id: true, role: true } }),
    getJson<{ name: string; permissions?: string[] }[]>("roles", []),
  ]);
  const targets = users.filter(u => u.role === "Super Admin" || roles.find(r => r.name === u.role)?.permissions?.some(p => p === permission || p === "all"));
  await addNotifications(list.flatMap(message => targets.map(u => ({ userId: u.id, message, link }))));
}
