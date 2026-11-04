import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, IdCard, MapPin, Truck, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "@/app/modules/logistics/server";
import { driverFlags } from "@/app/modules/logistics/lib";

/** Halaman sopir (dibuka dari HP). Tahap 1: profil & kualifikasi; tugas/P2H/ePOD menyusul di Tahap 4. */
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

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="font-semibold text-slate-800">Tugas hari ini</p>
            <p className="text-sm text-slate-500 mt-1">Belum ada trip yang di-assign ke Anda.</p>
            <ul className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
              <li className="border border-dashed border-slate-200 rounded-xl p-3"><ClipboardCheck className="w-5 h-5 mx-auto mb-1" />P2H</li>
              <li className="border border-dashed border-slate-200 rounded-xl p-3"><MapPin className="w-5 h-5 mx-auto mb-1" />Status trip</li>
              <li className="border border-dashed border-slate-200 rounded-xl p-3"><Wallet className="w-5 h-5 mx-auto mb-1" />Uang jalan</li>
            </ul>
            <p className="text-[11px] text-slate-400 mt-3">P2H dengan suara, status trip, foto muatan, ePOD, dan saldo uang jalan tersedia di tahap berikutnya.</p>
          </div>
        </>
      )}
    </div>
  );
}
