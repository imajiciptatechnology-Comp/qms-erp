/**
 * Jalankan file DDL di prisma/sql/ lewat Prisma Client (prisma db push menggantung di session pooler Supabase).
 * File harus idempotent (IF NOT EXISTS). Pernyataan dipisah per ";" di akhir baris.
 *
 *   node scripts/apply-sql.cjs prisma/sql/2026-11-10-export-currency.sql
 */
const fs = require("fs");
const { prisma } = require("./demo-data/common.cjs");

(async () => {
  const file = process.argv[2];
  if (!file) throw new Error("Sebutkan file SQL.");
  const statements = fs.readFileSync(file, "utf8")
    .split(/;\s*$/m)
    .map(s => s.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim())
    .filter(Boolean);
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
    console.log("OK ", sql.split("\n")[0].slice(0, 100));
  }
  await prisma.$disconnect();
})().catch(async e => { console.error(e); process.exit(1); });
