import { notFound } from "next/navigation";
import { getCurrentUser, getRolesConfig } from "@/app/actions/auth";
import { getEquipment } from "../actions";
import EquipmentDetailClient from "./EquipmentDetailClient";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const rolesConfig = await getRolesConfig();
  const eq = await getEquipment(id);

  if (!eq) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/modules/calibration" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{eq.equipmentNo} - {eq.name}</h1>
          <p className="text-slate-500 text-sm">Calibration Details & History</p>
        </div>
      </div>

      <EquipmentDetailClient equipment={eq} user={user} rolesConfig={rolesConfig} />
    </div>
  );
}
