import { supabaseAdmin, UPLOADS_BUCKET } from "@/lib/supabase";

/**
 * Upload file ke Supabase Storage (pengganti penulisan ke public/uploads).
 * Mengembalikan public URL yang bisa langsung dipakai sebagai href/src.
 */
export async function uploadToStorage(
  folder: string,
  file: File,
  fileName?: string
): Promise<string> {
  const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
  const name =
    fileName || `${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
  const storagePath = `${folder}/${name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from(UPLOADS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (error) throw new Error(`Upload gagal: ${error.message}`);

  const { data } = supabaseAdmin.storage
    .from(UPLOADS_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Hapus object dari Supabase Storage.
 * Menerima public URL penuh atau storage path relatif.
 */
export async function deleteFromStorage(publicUrlOrPath: string): Promise<void> {
  try {
    let storagePath = publicUrlOrPath;
    const marker = `/${UPLOADS_BUCKET}/`;
    const idx = publicUrlOrPath.indexOf(marker);
    if (idx !== -1) storagePath = publicUrlOrPath.substring(idx + marker.length);
    // Lewati nilai lama yang masih berupa path lokal
    if (storagePath.startsWith("/") || !storagePath.includes("/")) return;
    await supabaseAdmin.storage.from(UPLOADS_BUCKET).remove([storagePath]);
  } catch {
    // best-effort: kegagalan hapus file tidak boleh menggagalkan operasi utama
  }
}

/**
 * Ambil storage path relatif dari public URL (atau kembalikan apa adanya
 * jika input sudah berupa path relatif).
 */
export function storagePathFromUrl(publicUrlOrPath: string): string {
  const marker = `/${UPLOADS_BUCKET}/`;
  const idx = publicUrlOrPath.indexOf(marker);
  if (idx !== -1) return publicUrlOrPath.substring(idx + marker.length);
  return publicUrlOrPath;
}

/**
 * Salin object di dalam bucket yang sama. Mengembalikan public URL tujuan.
 */
export async function copyInStorage(
  sourceUrlOrPath: string,
  destFolder: string,
  destFileName: string
): Promise<string> {
  const srcPath = storagePathFromUrl(sourceUrlOrPath);
  const destPath = `${destFolder}/${destFileName}`;
  const { data: dl, error: dlErr } = await supabaseAdmin.storage
    .from(UPLOADS_BUCKET)
    .download(srcPath);
  if (dlErr || !dl) throw new Error(`Gagal membaca file sumber: ${dlErr?.message}`);
  const buf = Buffer.from(await dl.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from(UPLOADS_BUCKET)
    .upload(destPath, buf, { upsert: true });
  if (error) throw new Error(`Gagal menyalin file: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(UPLOADS_BUCKET).getPublicUrl(destPath);
  return data.publicUrl;
}
