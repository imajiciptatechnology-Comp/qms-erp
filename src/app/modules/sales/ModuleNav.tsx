"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Tab navigasi modul Labtech (Sales & Marketing, Contract & Shipping, Training & CS). Tab pertama = halaman utama modul. */
export default function ModuleNav({ label, tabs }: { label: string; tabs: { href: string; label: string; badge?: number }[] }) {
  const pathname = usePathname();
  const root = tabs[0]?.href;
  return (
    <nav aria-label={label} className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map(t => {
          const active = t.href === root ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${active ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {t.label}
              {!!t.badge && <span className="min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center" aria-label={`${t.badge} menunggu`}>{t.badge}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
