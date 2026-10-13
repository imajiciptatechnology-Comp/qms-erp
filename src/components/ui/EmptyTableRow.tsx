import { type ReactNode } from "react";

interface EmptyTableRowProps {
  colSpan: number;
  icon: ReactNode;
  title: string;
  subtitle?: string;
}

export default function EmptyTableRow({ colSpan, icon, title, subtitle }: EmptyTableRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center text-slate-500">
        <div className="mx-auto mb-3 w-fit">{icon}</div>
        <p className="font-medium text-slate-600">{title}</p>
        {subtitle && <p className="text-sm mt-0.5">{subtitle}</p>}
      </td>
    </tr>
  );
}
