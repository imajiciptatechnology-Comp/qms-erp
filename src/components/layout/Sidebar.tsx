"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  GraduationCap,
  TriangleAlert,
  ShieldAlert,
  Building2,
  PhoneCall,
  FileText,
  PenTool,
  Search,
  Scale,
  Factory,
  Truck,
  Wrench,
  Flame,
  HardHat,
  RefreshCw,
  LayoutDashboard,
  Lock,
  Target,
  ClipboardList,
  Globe,
  X
} from "lucide-react";

export const MODULES = [
  { id: "dashboard", name: "Dashboard", path: "/", icon: LayoutDashboard },
  { id: "context", name: "Context & Interested Parties", path: "/modules/context", icon: Globe },
  { id: "document", name: "Document Control", path: "/modules/document", icon: FileText },
  { id: "audit", name: "Audit Management", path: "/modules/audit", icon: ClipboardCheck },
  { id: "nc", name: "NC Management", path: "/modules/nc", icon: ShieldAlert },
  { id: "training", name: "Training Management", path: "/modules/training", icon: GraduationCap },
  { id: "risk", name: "Risk Management", path: "/modules/risk", icon: TriangleAlert },
  { id: "objectives", name: "Quality Objectives", path: "/modules/objectives", icon: Target },
  { id: "management-review", name: "Management Review", path: "/modules/management-review", icon: ClipboardList },
  { id: "supplier", name: "Supplier Quality", path: "/modules/supplier", icon: Building2 },
  { id: "complaint", name: "Customer Complaint", path: "/modules/complaint", icon: PhoneCall },
  { id: "design", name: "Design", path: "/modules/design", icon: PenTool },
  { id: "inspection", name: "Inspection", path: "/modules/inspection", icon: Search },
  { id: "calibration", name: "Calibration", path: "/modules/calibration", icon: Scale },
  { id: "ppc", name: "Production Planning", path: "/modules/ppc", icon: Factory },
  { id: "shipping", name: "Shipping", path: "/modules/shipping", icon: Truck },
  { id: "maintenance", name: "Maintenance", path: "/modules/maintenance", icon: Wrench },
  { id: "welding", name: "Welding Management", path: "/modules/welding", icon: Flame },
  { id: "hse", name: "HSE", path: "/modules/hse", icon: HardHat },
  { id: "moc", name: "Management of Change", path: "/modules/moc", icon: RefreshCw },
];

export default function Sidebar({ user, rolesConfig = [], isOpen = false, onClose }: {
  user: any;
  rolesConfig?: any[];
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  const hasAccess = (modId: string) => {
    if (!user) return false;
    const roleConfig = rolesConfig.find(r => r.name === user.role);
    if (!roleConfig) return false;
    if (roleConfig.permissions.includes("all")) return true;
    return roleConfig.permissions.includes(modId);
  };

  return (
    <aside
      className={`
        w-64 bg-slate-900 text-slate-300 h-screen flex flex-col
        fixed left-0 top-0 z-40 overflow-y-auto custom-scrollbar
        transition-transform duration-300 ease-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
      `}
    >
      <div className="p-4 flex items-center justify-between font-bold text-white text-xl sticky top-0 bg-slate-900 z-10 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-sm">QMS</span>
          </div>
          ERP System
        </div>
        {/* Close button — only shown on mobile */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
          Modules
        </div>
        {MODULES.map((mod) => {
          const isActive = pathname === mod.path;
          const accessible = hasAccess(mod.id);

          if (!accessible) {
            return (
              <div
                key={mod.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 opacity-50 cursor-not-allowed"
                title="You don't have permission"
              >
                <Lock className="w-4 h-4" />
                <span className="text-sm font-medium">{mod.name}</span>
              </div>
            );
          }

          return (
            <Link
              key={mod.id}
              href={mod.path}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                ${isActive ? "bg-blue-600 text-white shadow-sm shadow-blue-950/30" : "hover:bg-slate-800 hover:text-white"}`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-blue-300" />
              )}
              <mod.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-blue-400"}`} />
              <span className="text-sm font-medium truncate">{mod.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
