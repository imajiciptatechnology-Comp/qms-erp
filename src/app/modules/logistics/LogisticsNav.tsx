"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/modules/logistics", label: "Overview" },
  { href: "/modules/logistics/orders", label: "Charter Orders" },
  { href: "/modules/logistics/rates", label: "Rates & Routes" },
  { href: "/modules/logistics/fleet", label: "Fleet & Crew" },
  { href: "/modules/logistics/fleet/expiring", label: "Expiring Docs" },
  { href: "/modules/logistics/clients", label: "Clients" },
];

export default function LogisticsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Logistics sections" className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {TABS.map(t => {
          // Tab dengan awalan path terpanjang yang cocok yang aktif (Fleet vs Expiring Docs).
          const match = TABS.filter(x => x.href === "/modules/logistics" ? pathname === x.href : pathname.startsWith(x.href)).sort((a, b) => b.href.length - a.href.length)[0];
          const active = match?.href === t.href;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${active ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
