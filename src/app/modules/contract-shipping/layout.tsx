import { redirect } from "next/navigation";
import { getSalesAccess } from "@/app/modules/sales/access";
import { canSeeShipping } from "@/app/modules/sales/lib";
import ModuleNav from "@/app/modules/sales/ModuleNav";

export default async function ContractShippingLayout({ children }: { children: React.ReactNode }) {
  const { user, access } = await getSalesAccess();
  if (!user) redirect("/login");

  if (!canSeeShipping(access)) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">Tidak ada akses</h1>
        <p className="text-sm text-slate-500 mt-1">Role Anda ({user.role}) belum diberi akses ke modul Contract & Shipping. Hubungi Super Admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Contract & Shipping</h1>
        <p className="text-slate-500 text-sm">Kontrak → produksi → pelunasan → pengiriman domestik / ekspor (pengiriman hanya setelah order lunas)</p>
      </div>
      <ModuleNav
        label="Contract & Shipping sections"
        tabs={[
          { href: "/modules/contract-shipping", label: "Overview" },
          { href: "/modules/contract-shipping/contracts", label: "Contracts" },
          { href: "/modules/contract-shipping/production", label: "Production Status" },
          { href: "/modules/contract-shipping/shipments", label: "Shipments" },
        ]}
      />
      {children}
    </div>
  );
}
