"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { ErrorNote, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../ui";
import { TOLL_METHODS } from "../lib";
import { saveDriver, saveHelper, saveVehicle } from "./masterActions";

type Opt = { id: string; label: string };

function Shell({ title, editing, children, onSubmit, pending, error, onClose }: { title: string; editing: boolean; children: React.ReactNode; onSubmit: (fd: FormData) => void; pending: boolean; error: string | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title} onKeyDown={e => { if (e.key === "Escape") onClose(); }}>
    <form onSubmit={e => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }} className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl p-5 space-y-4 text-left my-8">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800">{title}</p>
        <button type="button" onClick={onClose} aria-label="Tutup form" className="p-1 rounded text-slate-500 hover:text-slate-800"><X className="w-4 h-4" /></button>
      </div>
      {children}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={pending} className={btnPrimary}>{pending && <Loader2 className="w-4 h-4 animate-spin" />} {editing ? "Save changes" : "Save"}</button>
      </div>
      <ErrorNote error={error} />
    </form>
    </div>
  );
}

const F = ({ label, children, span }: { label: string; children: React.ReactNode; span?: string }) => <label className={`block ${span ?? ""}`}><span className={labelCls}>{label}</span>{children}</label>;

export type VehicleInitial = {
  id: string; plateNo: string; truckTypeId: string; brand: string | null; year: number | null; status: string; odometerKm: number;
  stnkExpiry: string | null; pkbExpiry: string | null; kirExpiry: string | null; insuranceExpiry: string | null; nextServiceDate: string | null; nextServiceKm: number | null;
  tollMethod: string; tollCardNo: string | null; notes: string | null;
};

export function VehicleForm({ types, initial }: { types: Opt[]; initial?: VehicleInitial }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const v = initial;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={v ? btnSecondary : btnPrimary}>{v ? <><Pencil className="w-4 h-4" /> Edit truck</> : <><Plus className="w-4 h-4" /> Add truck</>}</button>;
  return (
    <Shell title={v ? `Edit ${v.plateNo}` : "Add truck"} editing={!!v} pending={pending} error={error} onClose={() => setOpen(false)}
      onSubmit={fd => { if (v) fd.set("id", v.id); exec(() => saveVehicle(fd), id => { setOpen(false); if (!v && id) router.push(`/modules/logistics/fleet/vehicles/${id}`); }); }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <F label="Nomor polisi"><input name="plateNo" required defaultValue={v?.plateNo} placeholder="B 9101 FXA" className={inputCls} /></F>
        <F label="Jenis truk"><select name="truckTypeId" required defaultValue={v?.truckTypeId ?? ""} className={inputCls}><option value="" disabled>— pilih —</option>{types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></F>
        <F label="Merek / model"><input name="brand" defaultValue={v?.brand ?? ""} placeholder="Hino Ranger" className={inputCls} /></F>
        <F label="Tahun"><input name="year" inputMode="numeric" defaultValue={v?.year ?? ""} className={inputCls} /></F>
        <F label="Odometer (km)"><input name="odometerKm" inputMode="numeric" defaultValue={v?.odometerKm ?? ""} className={inputCls} /></F>
        <F label="Status"><select name="status" defaultValue={v?.status ?? "Ready"} className={inputCls}><option>Ready</option><option>In Repair</option><option>Inactive</option></select></F>
        <F label="Metode tol"><select name="tollMethod" defaultValue={v?.tollMethod ?? "A"} className={inputCls}>{["A", "B", "C"].map(k => <option key={k} value={k}>{k} — {TOLL_METHODS[k]}</option>)}</select></F>
        <F label="No. kartu e-toll"><input name="tollCardNo" defaultValue={v?.tollCardNo ?? ""} className={inputCls} /></F>
      </div>
      <p className="text-xs text-slate-500">Masa berlaku (boleh dikosongkan lalu diisi lewat upload dokumen di tab Documents — truk tanpa data STNK/pajak/KIR ditandai perlu dilengkapi saat dispatch).</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <F label="STNK berlaku s/d"><input type="date" name="stnkExpiry" defaultValue={v?.stnkExpiry ?? ""} className={inputCls} /></F>
        <F label="Pajak (PKB) jatuh tempo"><input type="date" name="pkbExpiry" defaultValue={v?.pkbExpiry ?? ""} className={inputCls} /></F>
        <F label="KIR berlaku s/d"><input type="date" name="kirExpiry" defaultValue={v?.kirExpiry ?? ""} className={inputCls} /></F>
        <F label="Asuransi berlaku s/d"><input type="date" name="insuranceExpiry" defaultValue={v?.insuranceExpiry ?? ""} className={inputCls} /></F>
        <F label="Servis berikutnya (tanggal)"><input type="date" name="nextServiceDate" defaultValue={v?.nextServiceDate ?? ""} className={inputCls} /></F>
        <F label="Servis berikutnya (km)"><input name="nextServiceKm" inputMode="numeric" defaultValue={v?.nextServiceKm ?? ""} className={inputCls} /></F>
        <F label="Catatan" span="md:col-span-2"><input name="notes" defaultValue={v?.notes ?? ""} className={inputCls} /></F>
      </div>
    </Shell>
  );
}

export type DriverInitial = {
  id: string; name: string; phone: string | null; simClass: string; simNo: string | null; simExpiry: string; experienceYears: number;
  defensiveTraining: boolean; trailerCertified: boolean; status: string; notes: string | null;
};

export function DriverForm({ initial }: { initial?: DriverInitial }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const d = initial;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={d ? btnSecondary : btnPrimary}>{d ? <><Pencil className="w-4 h-4" /> Edit driver</> : <><Plus className="w-4 h-4" /> Add driver</>}</button>;
  return (
    <Shell title={d ? `Edit ${d.name}` : "Add driver"} editing={!!d} pending={pending} error={error} onClose={() => setOpen(false)}
      onSubmit={fd => { if (d) fd.set("id", d.id); exec(() => saveDriver(fd), id => { setOpen(false); if (!d && id) router.push(`/modules/logistics/fleet/drivers/${id}`); }); }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <F label="Nama" span="md:col-span-2"><input name="name" required defaultValue={d?.name} className={inputCls} /></F>
        <F label="No. HP"><input name="phone" defaultValue={d?.phone ?? ""} placeholder="0813-…" className={inputCls} /></F>
        <F label="Status"><select name="status" defaultValue={d?.status ?? "Active"} className={inputCls}><option>Active</option><option>Inactive</option></select></F>
        <F label="Golongan SIM"><select name="simClass" required defaultValue={d?.simClass ?? "B1 Umum"} className={inputCls}><option>B1 Umum</option><option>B2 Umum</option></select></F>
        <F label="No. SIM"><input name="simNo" defaultValue={d?.simNo ?? ""} className={inputCls} /></F>
        <F label="SIM berlaku s/d"><input type="date" name="simExpiry" required defaultValue={d?.simExpiry ?? ""} className={inputCls} /></F>
        <F label="Pengalaman (tahun)"><input name="experienceYears" inputMode="decimal" defaultValue={d?.experienceYears ?? ""} className={inputCls} /></F>
      </div>
      <div className="flex flex-wrap gap-5 text-sm text-slate-700">
        <label className="flex items-center gap-2"><input type="checkbox" name="defensiveTraining" defaultChecked={d?.defensiveTraining} /> Training defensive driving</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="trailerCertified" defaultChecked={d?.trailerCertified} /> Sertifikat trailer/kontainer</label>
      </div>
      <F label="Catatan"><input name="notes" defaultValue={d?.notes ?? ""} className={inputCls} /></F>
      <p className="text-xs text-slate-500">Jenis truk yang boleh dibawa dihitung otomatis (CDE/CDD: B1 · Fuso: ≥1 th · Tronton: defensive driving + ≥2 th · Trailer: B2 + defensive driving + sertifikat trailer). Hubungkan Telegram dari halaman sopir setelah disimpan.</p>
    </Shell>
  );
}

export type HelperInitial = { id: string; name: string; phone: string | null; idCardNo: string | null; preferredDriverId: string | null; status: string; notes: string | null };

export function HelperForm({ drivers, initial, compact }: { drivers: Opt[]; initial?: HelperInitial; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { pending, error, exec } = useAction();
  const h = initial;
  if (!open) return h
    ? <button type="button" onClick={() => setOpen(true)} aria-label={`Edit ${h.name}`} className="p-1.5 rounded text-slate-500 hover:text-blue-700 hover:bg-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
    : <button type="button" onClick={() => setOpen(true)} className={compact ? btnSecondary : btnPrimary}><Plus className="w-4 h-4" /> Add helper</button>;
  return (
    <Shell title={h ? `Edit ${h.name}` : "Add helper (kenek)"} editing={!!h} pending={pending} error={error} onClose={() => setOpen(false)}
      onSubmit={fd => { if (h) fd.set("id", h.id); exec(() => saveHelper(fd), () => setOpen(false)); }}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <F label="Nama"><input name="name" required defaultValue={h?.name} className={inputCls} /></F>
        <F label="No. HP"><input name="phone" defaultValue={h?.phone ?? ""} className={inputCls} /></F>
        <F label="No. KTP (16 digit)"><input name="idCardNo" inputMode="numeric" maxLength={16} defaultValue={h?.idCardNo ?? ""} className={inputCls} /></F>
        <F label="Pasangan sopir langganan"><select name="preferredDriverId" defaultValue={h?.preferredDriverId ?? ""} className={inputCls}><option value="">— tidak ada —</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></F>
        <F label="Status"><select name="status" defaultValue={h?.status ?? "Active"} className={inputCls}><option>Active</option><option>Inactive</option></select></F>
        <F label="Catatan"><input name="notes" defaultValue={h?.notes ?? ""} className={inputCls} /></F>
      </div>
    </Shell>
  );
}
