"use client";

import ModuleNav from "./ModuleNav";

export default function SalesNav({ pendingApprovals = 0 }: { pendingApprovals?: number }) {
  return (
    <ModuleNav
      label="Sales sections"
      tabs={[
        { href: "/modules/sales", label: "Overview" },
        { href: "/modules/sales/approvals", label: "Approvals", badge: pendingApprovals },
        { href: "/modules/sales/pipeline", label: "Pipeline & Tender" },
        { href: "/modules/sales/quotations", label: "Quotations" },
        { href: "/modules/sales/orders", label: "Sales Orders" },
        { href: "/modules/sales/invoices", label: "Invoices & Payments" },
        { href: "/modules/sales/guarantees", label: "Jaminan" },
        { href: "/modules/sales/agents", label: "Agen & Komisi" },
        { href: "/modules/sales/reports", label: "Laporan" },
        { href: "/modules/sales/customers", label: "Customers" },
        { href: "/modules/sales/products", label: "Products" },
      ]}
    />
  );
}
