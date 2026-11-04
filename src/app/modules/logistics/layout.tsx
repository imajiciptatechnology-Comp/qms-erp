import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLogisticsAccess } from "./server";
import LogisticsNav from "./LogisticsNav";

export default async function LogisticsLayout({ children }: { children: React.ReactNode }) {
  const { user, access } = await getLogisticsAccess();
  if (!user) redirect("/login");
  // Sopir hanya punya halaman sopir di HP.
  if (access.isDriver) redirect("/driver");

  if (!access.canView) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">Tidak ada akses</h1>
        <p className="text-sm text-slate-500 mt-1">Role Anda ({user.role}) belum diberi akses ke modul Logistik. Hubungi Super Admin.</p>
      </div>
    );
  }

  const company = await prisma.companyProfile.findUnique({ where: { key: "logistics" }, select: { name: true, tagline: true } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Logistik — Truck Charter</h1>
        <p className="text-slate-500 text-sm">{company ? `${company.name} · ${company.tagline}` : "Profil perusahaan belum diisi"} · role: {user.role}</p>
      </div>
      <LogisticsNav />
      {children}
    </div>
  );
}
