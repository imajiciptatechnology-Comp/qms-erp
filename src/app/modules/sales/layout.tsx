import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { salesAccess } from "./lib";
import SalesNav from "./SalesNav";
import { countPendingApprovals } from "./server";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const access = salesAccess(user, await getRolesConfig());

  if (!access.canView) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">Tidak ada akses</h1>
        <p className="text-sm text-slate-500 mt-1">Role Anda ({user.role}) belum diberi akses ke modul Sales & Marketing. Hubungi Super Admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Sales & Marketing</h1>
        <p className="text-slate-500 text-sm">Tender & penawaran → PO → invoice & pembayaran · semua persetujuan di Dashboard Persetujuan (ISO 9001 Cl. 8.2)</p>
      </div>
      <SalesNav pendingApprovals={access.canApprove ? await countPendingApprovals() : 0} />
      {children}
    </div>
  );
}
