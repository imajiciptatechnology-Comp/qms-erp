"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { btnPrimary, btnSecondary, inputCls, useAction, ErrorNote } from "../ui";
import { F, Shell } from "../fleet/MasterForms";
import { deleteLocation, saveClient, saveLocation } from "./actions";

export type ClientInitial = {
  id: string; code: string; name: string; industry: string | null; address: string | null; city: string | null;
  contactName: string | null; contactPhone: string | null; contactEmail: string | null; paymentTerms: string; contractDiscountPercent: number;
  insuranceRequired: boolean; tollPassThrough: boolean; orderPattern: string | null; aliases: string | null; notes: string | null;
};

export function ClientForm({ initial }: { initial?: ClientInitial }) {
  const [open, setOpen] = useState(false);
  const { pending, error, exec } = useAction();
  const c = initial;
  if (!open) return c
    ? <button type="button" onClick={() => setOpen(true)} aria-label={`Edit ${c.name}`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"><Pencil className="w-3.5 h-3.5" /> Edit</button>
    : <button type="button" onClick={() => setOpen(true)} className={btnPrimary}><Plus className="w-4 h-4" /> Add client</button>;
  return (
    <Shell title={c ? `Edit ${c.name}` : "Add client"} editing={!!c} pending={pending} error={error} onClose={() => setOpen(false)}
      onSubmit={fd => { if (c) fd.set("id", c.id); exec(() => saveClient(fd), () => setOpen(false)); }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <F label="Kode"><input name="code" required maxLength={6} defaultValue={c?.code} placeholder="SPL" className={`${inputCls} uppercase`} /></F>
        <F label="Nama perusahaan" span="md:col-span-2"><input name="name" required defaultValue={c?.name} placeholder="PT …" className={inputCls} /></F>
        <F label="Industri"><input name="industry" defaultValue={c?.industry ?? ""} className={inputCls} /></F>
        <F label="Alamat" span="md:col-span-3"><input name="address" defaultValue={c?.address ?? ""} className={inputCls} /></F>
        <F label="Kota"><input name="city" defaultValue={c?.city ?? ""} className={inputCls} /></F>
        <F label="Nama kontak"><input name="contactName" defaultValue={c?.contactName ?? ""} className={inputCls} /></F>
        <F label="HP kontak"><input name="contactPhone" defaultValue={c?.contactPhone ?? ""} className={inputCls} /></F>
        <F label="Email kontak" span="md:col-span-2"><input name="contactEmail" type="email" defaultValue={c?.contactEmail ?? ""} className={inputCls} /></F>
        <F label="Termin bayar"><input name="paymentTerms" defaultValue={c?.paymentTerms ?? "30 hari"} className={inputCls} /></F>
        <F label="Diskon kontrak (%)"><input name="contractDiscountPercent" inputMode="decimal" defaultValue={c?.contractDiscountPercent ?? 0} className={inputCls} /></F>
        <F label="Pola order" span="md:col-span-2"><input name="orderPattern" defaultValue={c?.orderPattern ?? ""} placeholder="Rutin Cikarang → Semarang, multi-drop" className={inputCls} /></F>
        <F label="Nama panggilan (untuk AI, pisah koma)" span="md:col-span-2"><input name="aliases" defaultValue={c?.aliases ?? ""} placeholder="Sinar Pangan, SPL" className={inputCls} /></F>
        <F label="Catatan" span="md:col-span-2"><input name="notes" defaultValue={c?.notes ?? ""} className={inputCls} /></F>
      </div>
      <div className="flex flex-wrap gap-5 text-sm text-slate-700">
        <label className="flex items-center gap-2"><input type="checkbox" name="insuranceRequired" defaultChecked={c?.insuranceRequired} /> Wajib asuransi muatan</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="tollPassThrough" defaultChecked={c?.tollPassThrough} /> Tol ditagihkan ke klien (metode D)</label>
      </div>
      <p className="text-xs text-slate-500">Diskon kontrak otomatis dipakai saat membuat order. &quot;Nama panggilan&quot; membantu AI mengenali klien dari chat/suara.</p>
    </Shell>
  );
}

export type LocationInitial = { id: string; name: string; kind: string; address: string | null; city: string; lat: number | null; lng: number | null };

export function LocationForm({ clientId, initial }: { clientId: string; initial?: LocationInitial }) {
  const [open, setOpen] = useState(false);
  const { pending, error, exec } = useAction();
  const del = useAction();
  const l = initial;
  if (!open) return l ? (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={() => setOpen(true)} aria-label={`Edit ${l.name}`} className="p-1 rounded text-slate-400 hover:text-blue-700"><Pencil className="w-3.5 h-3.5" /></button>
      <button type="button" disabled={del.pending} onClick={() => { if (confirm(`Hapus lokasi ${l.name}?`)) del.exec(() => deleteLocation(l.id)); }} aria-label={`Hapus ${l.name}`} className="p-1 rounded text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
      <ErrorNote error={del.error} />
    </span>
  ) : <button type="button" onClick={() => setOpen(true)} className={btnSecondary}><MapPin className="w-4 h-4" /> Add location</button>;
  return (
    <Shell title={l ? `Edit ${l.name}` : "Add load / unload location"} editing={!!l} pending={pending} error={error} onClose={() => setOpen(false)}
      onSubmit={fd => { fd.set("clientId", clientId); if (l) fd.set("id", l.id); exec(() => saveLocation(fd), () => setOpen(false)); }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <F label="Nama lokasi" span="md:col-span-2"><input name="name" required defaultValue={l?.name} placeholder="Gudang … / Distributor …" className={inputCls} /></F>
        <F label="Jenis"><select name="kind" defaultValue={l?.kind ?? "Muat"} className={inputCls}><option>Muat</option><option>Bongkar</option></select></F>
        <F label="Kota"><input name="city" required defaultValue={l?.city} className={inputCls} /></F>
        <F label="Alamat" span="md:col-span-2"><input name="address" defaultValue={l?.address ?? ""} className={inputCls} /></F>
        <F label="Latitude"><input name="lat" inputMode="decimal" defaultValue={l?.lat ?? ""} placeholder="-6.2950" className={inputCls} /></F>
        <F label="Longitude"><input name="lng" inputMode="decimal" defaultValue={l?.lng ?? ""} placeholder="107.1380" className={inputCls} /></F>
      </div>
      <p className="text-xs text-slate-500">Koordinat opsional: di Google Maps klik kanan lokasi → salin angka koordinat. Dipakai untuk titik di peta Fleet Tracking. Nama lokasi muncul sebagai pilihan saat membuat order.</p>
    </Shell>
  );
}
