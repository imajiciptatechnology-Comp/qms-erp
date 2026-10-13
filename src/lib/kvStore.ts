import { prisma } from "@/lib/prisma";

/**
 * Pengganti penyimpanan file JSON lokal (.data/*.json).
 * Nilai disimpan di tabel KvStore (Postgres/Supabase) agar tetap
 * persisten saat aplikasi jalan serverless (Vercel).
 */

export async function getJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.kvStore.findUnique({ where: { key } });
    if (!row) return fallback;
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setJson(key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  await prisma.kvStore.upsert({
    where: { key },
    update: { value: serialized },
    create: { key, value: serialized },
  });
}
