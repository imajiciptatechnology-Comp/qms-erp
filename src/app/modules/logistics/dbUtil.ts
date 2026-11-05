// Utilitas database modul Logistik: kunci antar-request dan kuota atomik.
// Bukan "use server" — hanya dipanggil dari kode server.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAdvisoryLock } from "@/lib/dbLock";
import { today } from "./lib";

export type Tx = Prisma.TransactionClient;

/** Lihat src/lib/dbLock.ts. Semua query di `fn` harus memakai `tx`, bukan `prisma`. */
export const withLock = withAdvisoryLock;

/** Seperti withLock, tapi tidak menunggu: null bila kunci sedang dipegang request lain. */
export async function tryWithLock<T>(key: string, fn: (tx: Tx) => Promise<T>): Promise<T | null> {
  return prisma.$transaction(async tx => {
    const [row] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS locked`;
    if (!row?.locked) return null;
    return fn(tx);
  }, { timeout: 15_000, maxWait: 10_000 });
}

/**
 * Kuota harian (WIB) atomik di KvStore: naikkan hitungan dan kembalikan true bila masih di bawah batas.
 * Menggantikan pola getJson → setJson yang bisa kebobolan saat beberapa request bersamaan.
 */
export async function consumeDailyQuota(name: string, limit: number): Promise<boolean> {
  const key = `${name}:${today()}`;
  const rows = await prisma.$queryRaw<{ value: string }[]>`
    INSERT INTO "KvStore" ("key", "value", "updatedAt") VALUES (${key}, '1', NOW())
    ON CONFLICT ("key") DO UPDATE SET "value" = (COALESCE(NULLIF("KvStore"."value", ''), '0')::int + 1)::text, "updatedAt" = NOW()
    RETURNING "value"`;
  return Number(rows[0]?.value ?? 0) <= limit;
}

/** Klaim jatah "paling sering sekali per `intervalMs`" secara atomik. true = pemanggil ini yang menjalankan. */
export async function claimInterval(key: string, intervalMs: number): Promise<boolean> {
  const now = Date.now();
  const rows = await prisma.$queryRaw<{ value: string }[]>`
    INSERT INTO "KvStore" ("key", "value", "updatedAt") VALUES (${key}, ${String(now)}, NOW())
    ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()
    WHERE COALESCE(NULLIF("KvStore"."value", ''), '0')::bigint < ${BigInt(now - intervalMs)}
    RETURNING "value"`;
  return rows.length > 0;
}
