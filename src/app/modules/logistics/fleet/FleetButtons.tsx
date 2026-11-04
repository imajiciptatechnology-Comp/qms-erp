"use client";

import { CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { ErrorNote, btnSecondary, useAction } from "../ui";
import { closeServiceRecord, recordOfficeP2H } from "./actions";

export function CloseServiceButton({ id }: { id: string }) {
  const { pending, error, exec } = useAction();
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={pending} onClick={() => exec(() => closeServiceRecord(id))} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60">
        {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Mark done
      </button>
      <ErrorNote error={error} />
    </span>
  );
}

export function OfficeP2HButton({ vehicleId }: { vehicleId: string }) {
  const { pending, error, exec } = useAction();
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={pending} onClick={() => exec(() => recordOfficeP2H(vehicleId))} className={btnSecondary}>
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />} Record P2H OK (after repair)
      </button>
      <ErrorNote error={error} />
    </span>
  );
}
