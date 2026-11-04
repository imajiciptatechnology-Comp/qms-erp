"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle2, Loader2, ShieldAlert, Sparkles, Truck } from "lucide-react";
import { Card, ErrorNote, btnPrimary, btnSecondary } from "../ui";
import type { Condition } from "../dispatchRules";
import { aiExplainDispatch, assignTrip } from "./actions";

export type Candidate = { id: string; label: string; sub: string; state: "ready" | "attention" | "unfit"; conditions: Condition[]; warnings: string[]; busy: boolean; preferredDriverId?: string | null };

const STATE = {
  ready: { label: "Siap", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  attention: { label: "Perhatian", cls: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  unfit: { label: "Tidak layak", cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};
const LEVEL = { none: "tidak bisa override", fleet: "override Fleet", ops: "override Ops", director: "override Direktur" } as const;

function CondList({ items, warnings }: { items: Condition[]; warnings?: string[] }) {
  if (!items.length && !warnings?.length) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {items.map(c => (
        <li key={c.key} className={`text-xs flex gap-1 ${c.level === "none" ? "text-red-700" : "text-amber-800"}`}>
          {c.level === "none" ? <Ban className="w-3 h-3 mt-0.5 shrink-0" /> : <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />}
          <span>#{c.code} {c.text} <span className="opacity-70">· {LEVEL[c.level]}</span></span>
        </li>
      ))}
      {warnings?.map(w => <li key={w} className="text-xs flex gap-1 text-slate-600"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />{w}</li>)}
    </ul>
  );
}

function Picker({ title, items, value, onChange, allowNone, readyFirst }: { title: string; items: Candidate[]; value: string; onChange: (id: string) => void; allowNone?: string; readyFirst?: boolean }) {
  const isReady = (c: Candidate) => !c.busy && c.state === "ready";
  const readyCount = items.filter(isReady).length;
  const [showAll, setShowAll] = useState(!readyFirst || readyCount === 0);
  const shown = showAll ? items : items.filter(c => isReady(c) || c.id === value);
  const counts = { ready: readyCount, attention: items.filter(c => !c.busy && c.state === "attention").length, unfit: items.filter(c => !c.busy && c.state === "unfit").length, busy: items.filter(c => c.busy).length };
  return (
    <Card title={title} actions={readyFirst ? (
      <button type="button" onClick={() => setShowAll(v => !v)} className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap">
        {showAll ? `Ready only (${readyCount})` : `Show all (${items.length})`}
      </button>
    ) : null}>
      {readyFirst && (
        <p className="text-xs text-slate-500 mb-2">
          <span className="text-emerald-700 font-semibold">{counts.ready} siap pakai</span> · {counts.attention} perlu override · {counts.unfit} tidak layak{counts.busy ? ` · ${counts.busy} sedang trip` : ""}
          {readyCount === 0 && " — tidak ada yang siap; pilih yang bisa di-override."}
        </p>
      )}
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto -mr-2 pr-2" role="radiogroup" aria-label={title}>
        {allowNone && (
          <label className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer ${value === "" ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
            <input type="radio" checked={value === ""} onChange={() => onChange("")} className="mt-1" /> <span className="text-sm text-slate-600">{allowNone}</span>
          </label>
        )}
        {shown.map(c => {
          const disabled = c.busy || c.state === "unfit";
          return (
            <label key={c.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${disabled ? "opacity-60 cursor-not-allowed border-slate-100" : "cursor-pointer"} ${value === c.id ? "border-blue-300 bg-blue-50" : !disabled ? "border-slate-200 hover:bg-slate-50" : ""}`}>
              <input type="radio" disabled={disabled} checked={value === c.id} onChange={() => onChange(c.id)} className="mt-1" />
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{c.label} <span className="text-xs font-normal text-slate-500">{c.sub}</span></span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${c.busy ? "bg-slate-100 text-slate-500 border-slate-200" : STATE[c.state].cls}`}>{c.busy ? "Sedang trip" : STATE[c.state].label}</span>
                </span>
                <CondList items={c.conditions} warnings={c.warnings} />
              </span>
            </label>
          );
        })}
      </div>
    </Card>
  );
}

export default function DispatchBoard({ order, trucks, drivers, helpers, canDispatch }: {
  order: { id: string; orderNo: string; client: string; route: string; truckType: string; requiresHelper: boolean; capacityTon: number; cargo: string; load: string; stops: string[] };
  trucks: Candidate[]; drivers: Candidate[]; helpers: Candidate[]; canDispatch: boolean;
}) {
  const router = useRouter();
  const ok = (c: Candidate) => !c.busy && c.state !== "unfit";
  const [truck, setTruck] = useState(trucks.find(ok)?.id ?? "");
  const [driver, setDriver] = useState(drivers.find(ok)?.id ?? "");
  const preferred = (dId: string) => helpers.find(h => !h.busy && h.preferredDriverId === dId)?.id ?? helpers.find(h => !h.busy)?.id ?? "";
  const [helper, setHelper] = useState(order.requiresHelper ? preferred(drivers.find(ok)?.id ?? "") : "");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const t = trucks.find(x => x.id === truck);
  const d = drivers.find(x => x.id === driver);
  const conds = useMemo(() => {
    const list = [...(t?.conditions ?? []), ...(d?.conditions ?? [])];
    if (order.requiresHelper && !helper) list.push({ key: "3b:helper", code: "3b", level: "ops", subject: "crew", text: `${order.truckType} wajib kenek` });
    return list;
  }, [t, d, helper, order]);
  const hard = conds.filter(c => c.level === "none");
  const soft = conds.filter(c => c.level !== "none");
  const warnings = d?.warnings ?? [];

  return (
    <div className="space-y-6">
      <Card title={<span className="flex items-center gap-2"><Truck className="w-4 h-4 text-blue-600" /> {order.orderNo} · {order.client}</span>}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div><dt className="text-xs text-slate-500">Rute</dt><dd>{order.route}</dd></div>
          <div><dt className="text-xs text-slate-500">Jenis truk</dt><dd>{order.truckType} ({order.capacityTon} ton){order.requiresHelper ? " · wajib kenek" : ""}</dd></div>
          <div><dt className="text-xs text-slate-500">Muat</dt><dd>{order.load}</dd></div>
          <div><dt className="text-xs text-slate-500">Muatan</dt><dd>{order.cargo}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Bongkar</dt><dd>{order.stops.join(" → ")}</dd></div>
        </dl>
      </Card>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        <Picker title={`Trucks — ${order.truckType}`} items={trucks} value={truck} onChange={setTruck} readyFirst />
        <Picker title="Drivers" readyFirst items={drivers} value={driver} onChange={id => { setDriver(id); setAck(false); if (order.requiresHelper) setHelper(preferred(id)); }} />
        <Picker title="Helper (kenek)" items={helpers} value={helper} onChange={setHelper} allowNone={order.requiresHelper ? "Tanpa kenek (butuh override Ops)" : "Tanpa kenek"} />
      </div>

      <Card title="Dispatch check (3.5)">
        <div className="space-y-3">
          {!t || !d ? <p className="text-sm text-slate-500">Pilih truk dan sopir.</p> : conds.length === 0 ? (
            <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Semua syarat terpenuhi — Surat Jalan langsung terbit setelah assign.</p>
          ) : (
            <>
              <CondList items={conds} />
              {hard.length > 0 && <p className="text-sm text-red-700">Kombinasi ini <b>tidak bisa</b> di-assign (kondisi keselamatan/hukum).</p>}
              {!hard.length && <p className="text-sm text-amber-800">Trip dibuat, tapi Surat Jalan baru terbit setelah {soft.length} kondisi di-override oleh role yang berwenang (alasan + tindakan pengendalian{soft.some(c => c.needsEvidence) ? " + bukti" : ""}).</p>}
            </>
          )}
          {warnings.length > 0 && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="mt-1" />
              <span><b>Peringatan jam kerja sopir</b> (tidak memblokir): {warnings.join("; ")}. Saya sudah membaca peringatan ini — tercatat di riwayat trip.</span>
            </label>
          )}
          <div className="flex flex-wrap gap-2 justify-end">
            <button type="button" className={btnSecondary} disabled={busy || !t || !d} onClick={() => start(async () => {
              const r = await aiExplainDispatch({ order: `${order.orderNo} ${order.route} ${order.truckType} ${order.cargo}`, truck: `${t!.label} ${t!.sub}`, truckIssues: t!.conditions.map(c => c.text), driver: `${d!.label} ${d!.sub}`, driverIssues: d!.conditions.map(c => c.text), dutyWarnings: warnings, alternatives: [...trucks.filter(x => ok(x) && x.id !== truck).map(x => `truk ${x.label} (${x.state})`), ...drivers.filter(x => ok(x) && x.id !== driver).slice(0, 4).map(x => `sopir ${x.label} (${x.state}${x.warnings.length ? ", ada peringatan" : ""})`)] });
              if (r.ok) setAi(r.text); else setError(r.error);
            })}><Sparkles className="w-4 h-4 text-indigo-600" /> AI explain</button>
            {canDispatch && (
              <button type="button" className={btnPrimary} disabled={busy || !t || !d || hard.length > 0 || (warnings.length > 0 && !ack)}
                onClick={() => start(async () => { setError(null); const r = await assignTrip({ orderId: order.id, vehicleId: truck, driverId: driver, helperId: helper || null, dutyAck: ack }); if (r.success) router.push(`/modules/logistics/trips/${r.id}`); else setError(r.message); })}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} Assign & create trip
              </button>
            )}
          </div>
          {!canDispatch && <p className="text-xs text-slate-500">Hanya Dispatcher / Operations Manager yang bisa assign.</p>}
          {ai && <p className="text-sm text-slate-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 whitespace-pre-wrap">{ai}</p>}
          <ErrorNote error={error} />
        </div>
      </Card>
    </div>
  );
}
