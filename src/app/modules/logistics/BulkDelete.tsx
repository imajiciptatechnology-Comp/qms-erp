"use client";

// Hapus massal dari daftar (Super Admin). Tabel server dibungkus <form id={formId}> berisi checkbox name="ids";
// checkbox data-select-all di header memilih semua baris.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteP2Hs, deleteTrips } from "./dispatch/actions";

export default function BulkDelete({ formId, kind }: { formId: string; kind: "trip" | "p2h" }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const boxes = () => [...form.querySelectorAll<HTMLInputElement>('input[name="ids"]')];
    const sync = () => setCount(boxes().filter(b => b.checked).length);
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.dataset.selectAll !== undefined) boxes().forEach(b => { b.checked = t.checked; });
      sync();
    };
    form.addEventListener("change", onChange);
    sync();
    return () => form.removeEventListener("change", onChange);
  }, [formId]);

  const run = () => start(async () => {
    const form = document.getElementById(formId) as HTMLFormElement;
    const ids = [...form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked')].map(b => b.value);
    const what = kind === "trip" ? "trip" : "catatan P2H";
    if (!window.confirm(`Hapus permanen ${ids.length} ${what}? Tindakan ini tidak bisa dibatalkan.`)) return;
    const r = await (kind === "trip" ? deleteTrips(ids, reason) : deleteP2Hs(ids, reason));
    if (!r.success) { setMsg({ ok: false, text: r.message }); return; }
    setMsg({ ok: !r.id?.includes("gagal"), text: r.id ?? "Selesai." });
    setReason("");
    form.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach(b => { b.checked = false; });
    setCount(0);
    router.refresh();
  });

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3" role="region" aria-label="Hapus massal">
      <span className="text-xs text-slate-500">{count ? `${count} dipilih` : "Centang baris untuk menghapus (Super Admin)"}</span>
      {count > 0 && (
        <>
          <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="Alasan penghapusan (wajib)" aria-label="Alasan penghapusan"
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm min-w-[220px]" />
          <button type="button" disabled={busy || reason.trim().length < 5} onClick={run}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete selected
          </button>
        </>
      )}
      {msg && <span role="status" className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
    </div>
  );
}
