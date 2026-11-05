// Advisory lock Postgres untuk baca–ubah–tulis yang tidak boleh balapan antar request (serverless).
// Bukan "use server": hanya untuk kode server.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Tx = Prisma.TransactionClient;

/**
 * Jalankan `fn` di dalam transaksi yang memegang advisory lock `key` (dilepas otomatis saat commit/rollback).
 * Semua query di `fn` harus memakai `tx`, bukan `prisma`, supaya tidak menunggu koneksi lain.
 */
export async function withAdvisoryLock<T>(key: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${key}))) AS l`;
    return fn(tx);
  }, { timeout: 15_000, maxWait: 10_000 });
}
