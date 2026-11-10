"use client";

import { useState } from "react";
import { X } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { saveCustomer, type CustomerInput } from "../actions";
import { COUNTRIES, CURRENCIES, CUSTOMER_TYPES } from "../lib";
import { ErrorNote, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../ui";

export type CustomerFormValue = CustomerInput & { id?: string };

const OTHER = "__other__";

export type AgentOption = { id: string; name: string; countries: string; commissionPercent: number };

export default function CustomerModal({ value, onClose, agents = [] }: { value: CustomerFormValue | null; onClose: () => void; agents?: AgentOption[] }) {
  const { pending, error, exec } = useAction();
  const v = value ?? ({} as CustomerFormValue);
  const initialCountry = v.country ?? "Indonesia";
  const known = (COUNTRIES as string[]).includes(initialCountry);
  const [countryPick, setCountryPick] = useState(known ? initialCountry : OTHER);
  const [currency, setCurrency] = useState(v.currency ?? "IDR");
  const field = (name: keyof CustomerInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className={labelCls} htmlFor={`cu-${name}`}>{label}</label><input id={`cu-${name}`} name={name} defaultValue={(v[name] as string) ?? ""} className={inputCls} {...props} /></div>
  );

  return (
    <ModalShell isOpen={!!value} onClose={onClose} size="max-w-2xl">
      {value && (
        <form onSubmit={e => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          exec(() => saveCustomer(v.id ?? null, {
            name: f.name, type: f.type, npwp: f.npwp || undefined, address: f.address || undefined, city: f.city || undefined, contactName: f.contactName || undefined,
            contactTitle: f.contactTitle || undefined, contactEmail: f.contactEmail || undefined, contactPhone: f.contactPhone || undefined, paymentTerms: f.paymentTerms || "30 hari", notes: f.notes || undefined,
            signatoryName: f.signatoryName || undefined, signatoryTitle: f.signatoryTitle || undefined,
            country: (countryPick === OTHER ? f.countryOther : countryPick)?.trim() || "Indonesia", currency, agentId: f.agentId || null,
          }), onClose);
        }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 id="modal-title" className="font-bold text-slate-800">{v.id ? "Edit customer" : "New Customer"}</h2>
            <button type="button" onClick={onClose} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto">
            <div className="sm:col-span-2">{field("name", "Nama instansi / perusahaan", { required: true })}</div>
            <div><label className={labelCls} htmlFor="cu-type">Jenis</label><select id="cu-type" name="type" defaultValue={v.type ?? CUSTOMER_TYPES[0]} className={inputCls}>{CUSTOMER_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            {field("npwp", "NPWP")}
            <div className="sm:col-span-2">{field("address", "Alamat")}</div>
            {field("city", "Kota")}
            <div>
              <label className={labelCls} htmlFor="cu-country">Negara</label>
              <select id="cu-country" value={countryPick} className={inputCls} onChange={e => {
                const c = e.target.value;
                setCountryPick(c);
                // Ganti negara → usulkan valuta: Indonesia = IDR, luar negeri = USD (tetap bisa diubah).
                if (c === "Indonesia") setCurrency("IDR");
                else if (currency === "IDR") setCurrency("USD");
              }}>
                <option value="Indonesia">Indonesia</option>
                <optgroup label="Luar negeri (ekspor)">
                  {COUNTRIES.filter(c => c !== "Indonesia").map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                <option value={OTHER}>Lainnya (ketik)…</option>
              </select>
              {countryPick === OTHER && (
                <input name="countryOther" aria-label="Nama negara" required autoFocus defaultValue={known ? "" : initialCountry} placeholder="Nama negara" className={`${inputCls} mt-2`} />
              )}
            </div>
            <div><label className={labelCls} htmlFor="cu-currency">Mata uang penawaran</label><select id="cu-currency" value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className={labelCls} htmlFor="cu-agent">Agen / perwakilan</label><select id="cu-agent" name="agentId" defaultValue={v.agentId ?? ""} className={inputCls}><option value="">— Langsung (tanpa agen) —</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name} · {a.countries} ({a.commissionPercent}%)</option>)}</select></div>
            <p className="sm:col-span-2 text-xs text-slate-500 -mt-2">Negara selain Indonesia = customer ekspor: dokumen berbahasa Inggris dan PPN 0%.</p>
            {field("paymentTerms", "Termin bayar default", { placeholder: "30 hari" })}
            {field("contactName", "Nama kontak")}
            {field("contactTitle", "Jabatan")}
            {field("contactEmail", "Email", { type: "email" })}
            {field("contactPhone", "Telepon")}
            {field("signatoryName", "Penandatangan kontrak")}
            {field("signatoryTitle", "Jabatan penandatangan")}
            <div className="sm:col-span-2">{field("notes", "Catatan")}</div>
            <div className="sm:col-span-2"><ErrorNote error={error} /></div>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={onClose}>Batal</button>
            <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
