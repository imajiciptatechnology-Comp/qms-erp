import Link from "next/link";
import { redirect } from "next/navigation";
import { IdCard, Send, Truck } from "lucide-react";
import { getBotUsername, isTelegramConfigured } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "@/app/modules/logistics/server";
import { driverFlags } from "@/app/modules/logistics/lib";

/** Halaman sopir: profil & kualifikasi. Tugas sehari-hari lewat bot Telegram (rancangan 10.3). */
export default async function DriverHome({ searchParams }: { searchParams: Promise<{ driver?: string }> }) {
  const { user, access } = await getLogisticsAccess();
  if (!user) redirect("/login");
  // "Driver App" diganti Fleet Tracking (rancangan 10.2): orang kantor diarahkan ke dashboard pantau armada.
  const { driver: pickParam } = await searchParams;
  if (!access.isDriver && !pickParam) redirect("/modules/logistics/tracking");
  const allowed = access.isDriver || access.isSuperAdmin || access.canView;
  if (!allowed) {
    return <p className="text-sm text-slate-500">Halaman ini khusus sopir.</p>;
  }

  // Sopir melihat dirinya sendiri; admin (testing) boleh memilih sopir lewat ?driver=
  const { driver: pick } = await searchParams;
  const drivers = access.isDriver ? [] : await prisma.driver.findMany({ orderBy: { code: "asc" }, select: { id: true, name: true, code: true } });
  const driver = access.isDriver
    ? await prisma.driver.findUnique({ where: { userEmail: user.email }, include: { qualifications: { include: { truckType: true } } } })
    : await prisma.driver.findFirst({ where: pick ? { id: pick } : { userEmail: { not: null } }, include: { qualifications: { include: { truckType: true } } } });

  const botUsername = isTelegramConfigured() ? await getBotUsername().catch(() => null) : null;
  return (
    <div className="max-w-md mx-auto space-y-4">
      {!access.isDriver && (
        <div className="text-xs bg-slate-100 border border-slate-200 rounded-lg p-3 space-y-2">
          <p>Mode pratinjau ({user.role}). Pilih sopir:</p>
          <div className="flex flex-wrap gap-1">
            {drivers.map(d => <Link key={d.id} href={`/driver?driver=${d.id}`} className={`px-2 py-1 rounded border ${driver?.id === d.id ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200"}`}>{d.name}</Link>)}
          </div>
        </div>
      )}

      {!driver ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <p className="font-semibold text-slate-800">Akun Anda belum terhubung ke data sopir.</p>
          <p className="text-sm text-slate-500 mt-1">Hubungi Fleet Manager.</p>
        </div>
      ) : (
        <>
          <div className="bg-[#0B2545] text-white rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-orange-300 font-semibold">PT Arunika Trans Nusantara</p>
            <p className="text-xl font-bold mt-1">Halo, {driver.name.split(" ")[0]} 👋</p>
            <p className="text-sm text-white/70">{driver.code} · {driver.phone}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <p className="font-semibold text-slate-800 flex items-center gap-2"><IdCard className="w-4 h-4 text-slate-500" /> SIM & kualifikasi</p>
            <p className="text-sm">{driver.simClass} · berlaku s/d <b>{driver.simExpiry}</b></p>
            {driverFlags(driver).map(f => <p key={f.text} className={`text-sm rounded-lg px-3 py-2 ${f.level === "red" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>⚠ {f.text} — segera perpanjang.</p>)}
            <div className="flex flex-wrap gap-1.5">
              {driver.qualifications.filter(q => q.basis !== "manual-revoke").map(q => (
                <span key={q.id} className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1"><Truck className="w-3 h-3" /> {q.truckType.name}</span>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
            <p className="font-semibold text-slate-800 flex items-center gap-2"><Send className="w-4 h-4 text-sky-600" /> Tugas, P2H & status trip lewat Telegram</p>
            <p className="text-sm text-slate-600">Sopir tidak perlu login ke ERP. Semua tugas (lihat trip, P2H dengan suara, tombol status, lokasi live, foto muatan/nota/surat jalan) dijalankan lewat bot Telegram perusahaan.</p>
            <p className="text-sm text-slate-600">{botUsername ? <>Buka <a className="text-blue-700 underline" href={`https://t.me/${botUsername}`}>@{botUsername}</a>. Belum terhubung? Minta link undangan ke Fleet Manager.</> : "Bot Telegram belum aktif. Hubungi Fleet Manager."}</p>
          </div>
        </>
      )}
    </div>
  );
}
