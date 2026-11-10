"use client";

import { useState } from "react";
import { AlertTriangle, Landmark, Pencil } from "lucide-react";
import { saveLetterOfCredit } from "../../actions";
import { lcState, money } from "../../lib";
import { Card, ErrorNote, InfoRow, btnPrimary, btnSecondary, inputCls, labelCls, useAction } from "../../ui";

type LC = {
  id: string; currency: string; total: number; paymentScheduleJson: string;
  lcNo: string | null; lcIssuingBank: string | null; lcIssueDate: string | null; lcExpiryDate: string | null; lcLatestShipment: string | null; lcAmount: number | null; lcNotes: string | null;
};

const days = (n: number | null) => (n === null ? "" : n < 0 ? ` · lewat ${-n} hari` : ` · ${n} hari lagi`);

/** Data Letter of Credit pada Sales Order: nomor, bank penerbit, tanggal kedaluwarsa & batas pengiriman. */
export default function LetterOfCreditCard({ so, canEdit }: { so: LC; canEdit: boolean }) {
  const { pending, error, exec } = useAction();
  const [editing, setEditing] = useState(false);
  const usesLc = /L\/C/i.test(so.paymentScheduleJson);
  const state = lcState(so);

  // Tidak pakai L/C & belum ada data: cukup tombol kecil untuk mencatat bila belakangan pakai L/C.
  if (!so.lcNo && !usesLc && !editing) {
    return canEdit ? (
      <button type="button" className={`${btnSecondary} w-full justify-center`} onClick={() => setEditing(true)}><Landmark className="w-4 h-4" /> Catat L/C</button>
    ) : null;
  }

  if (editing) {
    return (
      <Card title="Letter of Credit">
        <form className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3" onSubmit={e => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          exec(() => saveLetterOfCredit(so.id, {
            lcNo: f.lcNo, lcIssuingBank: f.lcIssuingBank, lcIssueDate: f.lcIssueDate, lcExpiryDate: f.lcExpiryDate, lcLatestShipment: f.lcLatestShipment,
            lcAmount: f.lcAmount ? Number(f.lcAmount) : null, lcNotes: f.lcNotes,
          }), () => setEditing(false));
        }}>
          <div><label className={labelCls} htmlFor="lc-no">No. L/C</label><input id="lc-no" name="lcNo" defaultValue={so.lcNo ?? ""} className={inputCls} placeholder="Kosongkan untuk menghapus" /></div>
          <div><label className={labelCls} htmlFor="lc-bank">Bank penerbit (issuing bank)</label><input id="lc-bank" name="lcIssuingBank" defaultValue={so.lcIssuingBank ?? ""} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="lc-issue">Tanggal terbit</label><input id="lc-issue" name="lcIssueDate" type="date" defaultValue={so.lcIssueDate ?? ""} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="lc-ship">Batas pengiriman (latest shipment)</label><input id="lc-ship" name="lcLatestShipment" type="date" defaultValue={so.lcLatestShipment ?? ""} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="lc-exp">Kedaluwarsa (expiry)</label><input id="lc-exp" name="lcExpiryDate" type="date" defaultValue={so.lcExpiryDate ?? ""} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="lc-amt">Nilai L/C ({so.currency})</label><input id="lc-amt" name="lcAmount" type="number" min={0} step="any" defaultValue={so.lcAmount ?? so.total} className={inputCls} /></div>
          <div className="sm:col-span-2 xl:col-span-1"><label className={labelCls} htmlFor="lc-notes">Catatan (dokumen yang diminta, toleransi, dll.)</label><textarea id="lc-notes" name="lcNotes" rows={2} defaultValue={so.lcNotes ?? ""} className={inputCls} /></div>
          <div className="sm:col-span-2 xl:col-span-1"><ErrorNote error={error} /></div>
          <div className="sm:col-span-2 xl:col-span-1 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setEditing(false)}>Batal</button>
            <button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card title="Letter of Credit" actions={canEdit ? <button type="button" onClick={() => setEditing(true)} className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md" aria-label="Edit data L/C"><Pencil className="w-4 h-4" /></button> : undefined}>
      {!so.lcNo ? (
        <p className="text-sm text-amber-800 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden /> Termin memakai L/C, tetapi data L/C belum dicatat.</p>
      ) : (
        <dl className="space-y-3">
          {state && state.level !== "ok" && (
            <p role="alert" className={`text-sm rounded-lg px-3 py-2 flex items-start gap-2 ${state.level === "expired" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
              {state.level === "expired" ? "L/C sudah lewat batas pengiriman / kedaluwarsa — minta amendment ke buyer sebelum kirim." : "Batas pengiriman / kedaluwarsa L/C kurang dari 14 hari."}
            </p>
          )}
          <InfoRow label="No. L/C">{so.lcNo}</InfoRow>
          <InfoRow label="Bank penerbit">{so.lcIssuingBank}</InfoRow>
          <InfoRow label="Nilai">{so.lcAmount != null ? money(so.lcAmount, so.currency) : null}</InfoRow>
          <InfoRow label="Terbit">{so.lcIssueDate}</InfoRow>
          <InfoRow label="Batas pengiriman">{so.lcLatestShipment ? `${so.lcLatestShipment}${days(state?.shipDays ?? null)}` : null}</InfoRow>
          <InfoRow label="Kedaluwarsa">{so.lcExpiryDate ? `${so.lcExpiryDate}${days(state?.expiryDays ?? null)}` : null}</InfoRow>
          {so.lcNotes && <InfoRow label="Catatan">{so.lcNotes}</InfoRow>}
        </dl>
      )}
    </Card>
  );
}
