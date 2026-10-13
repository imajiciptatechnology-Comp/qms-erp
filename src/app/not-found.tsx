import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-5">
        <Compass className="w-8 h-8 text-blue-600" />
      </div>
      <p className="text-sm font-semibold text-blue-600 tracking-wide mb-1">404</p>
      <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">
        This page doesn&apos;t exist
      </h1>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        The module or record you&apos;re looking for may have been moved, renamed, or the link is incorrect.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm shadow-blue-900/10"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>
    </div>
  );
}
