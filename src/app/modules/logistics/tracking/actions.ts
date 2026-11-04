"use server";

import { AiError, aiComplete, isAiConfigured } from "@/lib/ai";
import { getJson, setJson } from "@/lib/kvStore";
import { getLogisticsAccess } from "../server";
import { today } from "../lib";
import { getFleetSnapshot, resetSimulation, startSimulation, type FleetSnapshot } from "../tracking";

async function guard(check: (a: Awaited<ReturnType<typeof getLogisticsAccess>>["access"]) => boolean) {
  const { user, access } = await getLogisticsAccess();
  if (!user) throw new Error("Silakan login terlebih dahulu.");
  if (!check(access)) throw new Error("Role Anda tidak punya akses untuk aksi ini.");
  return user;
}

/** Dipanggil dashboard tiap ±30 detik (polling biasa). Sekaligus menggerakkan trip simulasi. */
export async function fetchFleetSnapshot(): Promise<{ ok: true; snapshot: FleetSnapshot } | { ok: false; error: string }> {
  try {
    await guard(a => a.canView);
    return { ok: true, snapshot: await getFleetSnapshot() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal memuat data armada." };
  }
}

const SPEEDS = [1, 10, 30, 60];

export async function runSimulation(speed: number) {
  try {
    const user = await guard(a => a.canDispatch);
    const s = SPEEDS.includes(speed) ? speed : 30;
    const n = await startSimulation(user.name, s);
    if (!n) return { ok: false as const, error: "Tidak ada truk/sopir yang layak untuk simulasi." };
    return { ok: true as const, created: n, snapshot: await getFleetSnapshot() };
  } catch (err) {
    console.error("[tracking] simulation", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "Gagal menjalankan simulasi." };
  }
}

export async function stopSimulation() {
  try {
    await guard(a => a.canDispatch);
    const n = await resetSimulation();
    return { ok: true as const, removed: n, snapshot: await getFleetSnapshot() };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Gagal menghentikan simulasi." };
  }
}

const DAILY_LIMIT = 30;
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "-");

/** "Ringkas kondisi armada sekarang": AI merangkum unit berisiko dan menyusun draft pesan ke klien. Angka & peringatan dari kode. */
export async function aiFleetSummary(): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  try {
    const user = await guard(a => a.canView);
    if (!isAiConfigured()) return { ok: false, error: "AI belum dikonfigurasi." };
    const key = `ai_fleet_summary:${user.id}:${today()}`;
    const used = await getJson<number>(key, 0);
    if (used >= DAILY_LIMIT) return { ok: false, error: `Batas ${DAILY_LIMIT} ringkasan per hari sudah tercapai.` };
    const snap = await getFleetSnapshot();
    const data = {
      jam: time(snap.at),
      unitJalan: snap.units.map(u => ({
        nopol: u.plateNo, jenis: u.truckType, sopir: u.driverName, klien: u.clientName, rute: u.routeLabel, status: u.statusLabel,
        titikBongkar: `${u.stopsDone}/${u.stopsTotal}`, etaBongkarPertama: time(u.etaFirstStop), janjiKeKlien: time(u.promisedArrival),
        peringatan: u.alerts.map(a => a.text),
      })),
      unitTidakJalan: snap.idle.map(i => ({ nopol: i.plateNo, kondisi: { ready: "siap di pool", attention: "perlu perhatian", repair: "perbaikan", unfit: "tidak layak" }[i.state], alasan: i.reasons })),
    };
    const { text, model } = await aiComplete([
      { role: "system", content: "Anda asisten dispatcher perusahaan truk charter PT Arunika Trans Nusantara. Jawab dalam bahasa Indonesia yang ringkas. Gunakan hanya data yang diberikan; jangan mengarang angka, jam, atau nama." },
      { role: "user", content: `Data armada saat ini (JSON):\n${JSON.stringify(data)}\n\nTulis:\n1. Ringkasan kondisi armada (maks. 4 kalimat).\n2. Daftar unit berisiko telat/bermasalah: nopol, masalah, saran tindakan dispatcher (1 baris per unit).\n3. Draft pesan WhatsApp singkat dan sopan untuk tiap klien yang kirimannya berisiko telat (sebut nopol & perkiraan jam dari data). Kalau tidak ada, tulis "Tidak ada pesan ke klien yang perlu dikirim."\nFormat teks biasa dengan judul bagian, tanpa markdown tabel.` },
    ], { maxTokens: 1200, temperature: 0.3, reasoningEffort: "low" });
    await setJson(key, used + 1);
    return { ok: true, text, model };
  } catch (err) {
    return { ok: false, error: err instanceof AiError || err instanceof Error ? err.message : "Gagal menyusun ringkasan." };
  }
}
