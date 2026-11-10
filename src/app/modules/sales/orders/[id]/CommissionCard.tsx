"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { setOrderCommission } from "../../agentActions";
import { COMMISSION_LABEL, commissionAmount, commissionState, money } from "../../lib";
import { Card, ErrorNote, InfoRow, StatusBadge, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../../ui";
import type { AgentOption } from "../../customers/CustomerModal";

type SO = {
  id: string; status: string; subtotal: number; currency: string; agentId: string | null; commissionPercent: number | null;
  commissionPaidAt: string | null; commissionPaidRef: string | null; agent: { id: string; name: string } | null;
};

/** Komisi agen pada Sales Order: tampil bila ada agen; Sales Manager bisa memasang / mengubah sebelum dibayar. */
export default function CommissionCard({ so, fullyPaid, agents, canEdit }: { so: SO; fullyPaid: boolean; agents: AgentOption[]; canEdit: boolean }) {
  const { pending, error, exec } = useAction();
  const [editing, setEditing] = useState(false);
  const [agentId, setAgentId] = useState(so.agentId ?? "");
  const state = commissionState({ ...so, fullyPaid });
  const editable = canEdit && !so.commissionPaidAt && so.status !== "Cancelled";

  if (!so.agentId && !editing) {
    return editable ? <button type="button" className={`${btnSecondary} w-full justify-center`} onClick={() => setEditing(true)}>Pasang komisi agen</button> : null;
  }

  return (
    <Card title="Komisi agen" actions={editable && !editing ? <button type="button" onClick={() => setEditing(true)} className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md" aria-label="Ubah komisi agen"><Pencil className="w-4 h-4" /></button> : undefined}>
      {editing ? (
        <form className="space-y-3" onSubmit={e => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          exec(() => setOrderCommission(so.id, f.agentId || null, f.agentId ? Number(f.pct) : null), () => setEditing(false));
        }}>
          <div><label className={labelCls} htmlFor="c-agent">Agen</label>
            <select id="c-agent" name="agentId" value={agentId} onChange={e => setAgentId(e.target.value)} className={inputCls}>
              <option value="">— Tanpa agen —</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name} · {a.countries}</option>)}
            </select>
          </div>
          {agentId && (
            <div><label className={labelCls} htmlFor="c-pct">Komisi (% dari DPP)</label>
              <input key={agentId} id="c-pct" name="pct" type="number" min={0} max={30} step={0.5} required defaultValue={agentId === so.agentId ? so.commissionPercent ?? "" : agents.find(a => a.id === agentId)?.commissionPercent ?? 5} className={inputCls} />
            </div>
          )}
          <ErrorNote error={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setEditing(false)}>Batal</button>
            <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </form>
      ) : (
        <dl className="space-y-3">
          <InfoRow label="Agen">{so.agent ? <Link href="/modules/sales/agents" className="text-blue-700 hover:underline">{so.agent.name}</Link> : null}</InfoRow>
          <InfoRow label="Komisi">{`${money(commissionAmount(so), so.currency)} (${so.commissionPercent ?? 0}% dari DPP)`}</InfoRow>
          <InfoRow label="Status">
            <span className="flex items-center gap-2">{state && <StatusBadge status={state} />} {state === "Paid" ? `${so.commissionPaidAt} · ${so.commissionPaidRef}` : state ? COMMISSION_LABEL[state] : ""}</span>
          </InfoRow>
        </dl>
      )}
    </Card>
  );
}
