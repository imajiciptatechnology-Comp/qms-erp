/**
 * Koneksi bersama untuk seed.cjs & clear.cjs. Membaca .env di folder qms-erp
 * (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_UPLOADS_BUCKET).
 */
const fs = require("fs");
const path = require("path");

const APP_ROOT = path.join(__dirname, "..", "..");
const envFile = path.join(APP_ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { PrismaClient } = require(path.join(APP_ROOT, "node_modules", "@prisma/client"));
const { createClient } = require(path.join(APP_ROOT, "node_modules", "@supabase/supabase-js"));

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const BUCKET = process.env.SUPABASE_UPLOADS_BUCKET || "uploads";

/** Semua data demo memakai awalan ini (nomor record / id) dan folder storage "demo/". */
const PREFIX = "DEMO-";
const STORAGE_DIR = "demo";

module.exports = { prisma, supabase, BUCKET, PREFIX, STORAGE_DIR, APP_ROOT };
