"use client";

import { useEffect } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-5">
        <AlertOctagon className="w-8 h-8 text-red-600" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">
        Something went wrong
      </h1>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        The page failed to load. Please try again — if the problem continues, contact your system administrator.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm shadow-blue-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <RotateCcw className="w-4 h-4" /> Try again
      </button>
    </div>
  );
}
