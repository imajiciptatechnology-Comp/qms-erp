interface TableFooterProps {
  filtered: number;
  total: number;
  label?: string;
}

export default function TableFooter({ filtered, total, label = "records" }: TableFooterProps) {
  return (
    <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-sm text-slate-500">
      Showing <span className="font-semibold text-slate-700">{filtered}</span> of {total} {label}
    </div>
  );
}
