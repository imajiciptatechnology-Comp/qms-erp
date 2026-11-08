import { redirect } from "next/navigation";
import { getSalesAccess } from "@/app/modules/sales/access";
import { canSeeService } from "@/app/modules/sales/lib";
import ModuleNav from "@/app/modules/sales/ModuleNav";

export default async function CustomerServiceLayout({ children }: { children: React.ReactNode }) {
  const { user, access } = await getSalesAccess();
  if (!user) redirect("/login");

  if (!canSeeService(access)) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">Tidak ada akses</h1>
        <p className="text-sm text-slate-500 mt-1">Role Anda ({user.role}) belum diberi akses ke modul Training & Customer Service. Hubungi Super Admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Training & Customer Service</h1>
        <p className="text-slate-500 text-sm">Instalasi, commissioning & training guru/instruktur sampai BAST · tiket layanan & garansi unit terpasang</p>
      </div>
      <ModuleNav
        label="Training & Customer Service sections"
        tabs={[
          { href: "/modules/customer-service", label: "Overview" },
          { href: "/modules/customer-service/jobs", label: "Installation & Training" },
          { href: "/modules/customer-service/tickets", label: "Service Tickets" },
          { href: "/modules/customer-service/installed-base", label: "Installed Base & Warranty" },
        ]}
      />
      {children}
    </div>
  );
}
