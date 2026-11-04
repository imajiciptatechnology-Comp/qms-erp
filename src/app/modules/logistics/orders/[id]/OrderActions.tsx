"use client";

import { CheckCircle2, Undo2, XCircle } from "lucide-react";
import { setOrderStatus } from "../../actions";
import { ErrorNote, btnDanger, btnPrimary, btnSecondary, useAction } from "../../ui";

export default function OrderActions({ id, status }: { id: string; status: string }) {
  const { pending, error, exec } = useAction();
  const cancel = () => {
    const reason = window.prompt("Alasan pembatalan order:");
    if (reason) exec(() => setOrderStatus(id, "Cancelled", reason));
  };
  return (
    <>
      {status === "Draft" && <button className={btnPrimary} disabled={pending} onClick={() => exec(() => setOrderStatus(id, "Confirmed"))}><CheckCircle2 className="w-4 h-4" /> Confirm order</button>}
      {status === "Confirmed" && <button className={btnSecondary} disabled={pending} onClick={() => exec(() => setOrderStatus(id, "Draft"))}><Undo2 className="w-4 h-4" /> Back to draft</button>}
      {["Draft", "Confirmed"].includes(status) && <button className={btnDanger} disabled={pending} onClick={cancel}><XCircle className="w-4 h-4" /> Cancel</button>}
      {error && <div className="w-full"><ErrorNote error={error} /></div>}
    </>
  );
}
