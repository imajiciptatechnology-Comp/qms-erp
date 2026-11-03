"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/modules/sales", label: "Overview" },
  { href: "/modules/sales/pipeline", label: "Pipeline" },
  { href: "/modules/sales/quotations", label: "Quotations" },
  { href: "/modules/sales/orders", label: "Sales Orders" },
  { href: "/modules/sales/invoices", label: "Invoices" },
  { href: "/modules/sales/contracts", label: "Contracts" },
  { href: "/modules/sales/customers", label: "Customers" },
  { href: "/modules/sales/products", label: "Products" },
];

export default function SalesNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sales sections" className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {TABS.map(t => {
          const active = t.href === "/modules/sales" ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${active ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
