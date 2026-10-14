"use client";

import { useRef, useState } from "react";
import { Plus, Edit, Scale, Activity, FileText, CheckCircle, AlertTriangle, FileBadge, Calendar, Search, Printer } from "lucide-react";
import ScanDocumentButton, { highlightAiFields } from "@/components/ScanDocumentButton";
import { addCalibrationRecord, updateEquipment, EquipmentItem, CalibrationRecord, uploadCalibrationCertificate, raiseNCRFromEquipment, addPMRecord } from "../actions";
import { getCalibrationStatus } from "../utils";

function AddRecordModal({ equipment, onClose }: { equipment: EquipmentItem; onClose: () => void }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    certificateNo: "",
    calibratedBy: "",
    result: "Pass" as CalibrationRecord["result"],
    nextDueDate: "",
    remarks: "",
    masterEquipmentUsed: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const addFrequency = (dateStr: string) => {
    const nextDate = new Date(dateStr);
    nextDate.setMonth(nextDate.getMonth() + equipment.frequencyMonths);
    return nextDate.toISOString().split("T")[0];
  };

  // Auto calculate next due date based on frequency
  const handleDateChange = (dateStr: string) => {
    setForm(prev => ({ ...prev, date: dateStr, nextDueDate: addFrequency(dateStr) }));
  };

  // Isi form dari hasil scan sertifikat; gambar scan sekaligus dilampirkan.
  const applyScan = (fields: Record<string, string>, scanned: File) => {
    setForm(prev => {
      const next = { ...prev, ...fields } as typeof prev;
      if (fields.date && !fields.nextDueDate) next.nextDueDate = addFrequency(fields.date);
      return next;
    });
    if (!file) setFile(scanned);
    // Tunggu render (field masterEquipmentUsed bisa baru muncul) lalu tandai.
    requestAnimationFrame(() => highlightAiFields(formRef.current, Object.keys(fields)));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { masterEquipmentUsed, ...rest } = form;
    const submitData = {
      ...rest,
      masterEquipmentUsed: form.calibratedBy.toLowerCase().includes("internal") ? masterEquipmentUsed : undefined
    };
    
    // Add Calibration Record first
    // Note: addCalibrationRecord generates an id, but since we don't return it, we can't easily attach the file immediately.
    // Wait, let's fix `actions.ts` or just let `addCalibrationRecord` return the newly created record ID.
    // Assuming we modified it or we can just fetch it? Actually, I'll pass a fixed ID or let the server action handle it.
    // Let's modify the client to just pass form, and we'll fix the return if needed. Actually, I didn't change addCalibrationRecord to return ID.
    // I will add a new endpoint or just pass the file to a combined action later.
    // Wait, let's just do an API route? No, Server Actions support FormData!
    
    // Let's create a FormData payload and use a new server action or update addCalibrationRecord.
    // Since I can't easily change it now, I'll just use the old action and let it be. Wait, I exported `uploadCalibrationCertificate`. I need the `recordId`.
    // I should probably update `addCalibrationRecord` to return `recordId`. I'll do that in another tool call.
    const res = await addCalibrationRecord(equipment.id, submitData);
    if (res?.data?.id && file) {
      const formData = new FormData();
      formData.append("file", file);
      await uploadCalibrationCertificate(equipment.id, res.data.id, formData);
    }
    
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-teal-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-600" /> Record Calibration
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-teal-100 rounded-full text-teal-600">
            <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <ScanDocumentButton formType="calibration" sampleUrl="/samples/contoh-sertifikat-kalibrasi.png" onExtracted={applyScan} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Calibration Date *</label>
              <input required type="date" name="date" value={form.date} onChange={e => handleDateChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Next Due Date *</label>
              <input required type="date" name="nextDueDate" value={form.nextDueDate} onChange={e => setForm({...form, nextDueDate: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Certificate Number</label>
              <input required name="certificateNo" value={form.certificateNo} onChange={e => setForm({...form, certificateNo: e.target.value})}
                placeholder="e.g. CERT-2025-001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Calibrated By (Internal/External)</label>
              <input required name="calibratedBy" value={form.calibratedBy} onChange={e => setForm({...form, calibratedBy: e.target.value})}
                placeholder="e.g. PT KAN, Internal Lab"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
            </div>
            {form.calibratedBy.toLowerCase().includes("internal") && (
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 block mb-1">Master Equipment Used (for Traceability) *</label>
                <input required name="masterEquipmentUsed" value={form.masterEquipmentUsed} onChange={e => setForm({...form, masterEquipmentUsed: e.target.value})}
                  placeholder="e.g. Master Caliper CAL-001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
              </div>
            )}
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Upload Certificate (PDF/Image)</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white" />
              {file && <p className="text-xs text-slate-500 mt-1">Lampiran: <span className="font-medium text-slate-700">{file.name}</span></p>}
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Result</label>
              <select required name="result" value={form.result} onChange={e => setForm({...form, result: e.target.value as CalibrationRecord["result"]})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                <option value="Pass">Pass / Accepted</option>
                <option value="Adjusted">Pass after Adjustment</option>
                <option value="Fail">Fail / Rejected</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Remarks</label>
              <textarea rows={2} name="remarks" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Activity className="w-4 h-4" /> {saving ? "Saving..." : "Record Calibration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EquipmentDetailClient({ equipment, user, rolesConfig }: { equipment: EquipmentItem, user: any, rolesConfig: any[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [eqForm, setEqForm] = useState(equipment);
  const [savingEq, setSavingEq] = useState(false);

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("calibration") || user?.department === "Quality Assurance";

  const calStatus = getCalibrationStatus(equipment.nextCalibrationDate, equipment.status);

  async function handleUpdateEquipment() {
    setSavingEq(true);
    await updateEquipment(equipment.id, eqForm);
    setSavingEq(false);
    setEditMode(false);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-label, #print-label * {
            visibility: visible;
          }
          #print-label {
            position: absolute;
            left: 0;
            top: 0;
            width: 8cm;
            padding: 0;
            margin: 0;
          }
          @page {
            size: 8cm 5cm;
            margin: 0;
          }
        }
      `}} />

      {/* Printable Label */}
      <div id="print-label" className="hidden print:block p-4 border-2 border-black w-[8cm] h-[5cm] bg-white text-black font-sans box-border">
        <div className="text-center font-bold text-lg border-b-2 border-black pb-1 mb-2">CALIBRATION LABEL</div>
        <table className="w-full text-sm text-left">
          <tbody>
            <tr><td className="font-semibold w-1/3 py-0.5">Eq. No</td><td>: {equipment.equipmentNo}</td></tr>
            <tr><td className="font-semibold py-0.5">Cal. Date</td><td>: {equipment.lastCalibrationDate || "-"}</td></tr>
            <tr><td className="font-semibold py-0.5">Due Date</td><td>: {equipment.nextCalibrationDate || "-"}</td></tr>
            <tr><td className="font-semibold py-0.5">PIC</td><td>: {equipment.picName || "-"}</td></tr>
            <tr><td className="font-semibold py-0.5">Status</td><td className="font-bold uppercase">: {equipment.status}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Scale className="w-4 h-4 text-teal-600" /> Equipment Specs
            </h3>
            {canManage && !editMode && (
              <button onClick={() => setEditMode(true)} className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors">
                <Edit className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="p-5 space-y-4">
            {editMode ? (
              <div className="space-y-3">
                <div><label className="text-xs text-slate-500 font-semibold mb-1 block">Name</label>
                <input value={eqForm.name} onChange={e => setEqForm({...eqForm, name: e.target.value})} className="w-full px-2 py-1 text-sm border rounded" /></div>
                
                <div><label className="text-xs text-slate-500 font-semibold mb-1 block">Location</label>
                <input value={eqForm.location} onChange={e => setEqForm({...eqForm, location: e.target.value})} className="w-full px-2 py-1 text-sm border rounded" /></div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-slate-500 font-semibold mb-1 block">Range</label>
                  <input value={eqForm.range || ""} onChange={e => setEqForm({...eqForm, range: e.target.value})} className="w-full px-2 py-1 text-sm border rounded" /></div>
                  <div><label className="text-xs text-slate-500 font-semibold mb-1 block">Tolerance</label>
                  <input value={eqForm.tolerance || ""} onChange={e => setEqForm({...eqForm, tolerance: e.target.value})} className="w-full px-2 py-1 text-sm border rounded" /></div>
                </div>

                <div><label className="text-xs text-slate-500 font-semibold mb-1 block">Frequency (Months)</label>
                <input type="number" value={eqForm.frequencyMonths} onChange={e => setEqForm({...eqForm, frequencyMonths: +e.target.value})} className="w-full px-2 py-1 text-sm border rounded" /></div>

                <div><label className="text-xs text-slate-500 font-semibold mb-1 block">Status</label>
                <select value={eqForm.status} onChange={e => setEqForm({...eqForm, status: e.target.value as any})} className="w-full px-2 py-1 text-sm border rounded">
                  <option value="Active">Active</option>
                  <option value="Out of Service">Out of Service</option>
                  <option value="Lost">Lost</option>
                  <option value="Damaged">Damaged</option>
                </select></div>

                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditMode(false)} className="px-3 py-1.5 text-xs font-semibold border rounded hover:bg-slate-50">Cancel</button>
                  <button onClick={handleUpdateEquipment} disabled={savingEq} className="px-3 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded hover:bg-teal-700">Save</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-slate-500 font-semibold uppercase">Category</p><p className="font-medium text-slate-800">{equipment.category}</p></div>
                <div><p className="text-xs text-slate-500 font-semibold uppercase">Location</p><p className="font-medium text-slate-800">{equipment.location}</p></div>
                <div><p className="text-xs text-slate-500 font-semibold uppercase">Range</p><p className="font-medium text-slate-800">{equipment.range || "-"}</p></div>
                <div><p className="text-xs text-slate-500 font-semibold uppercase">Tolerance</p><p className="font-medium text-slate-800">{equipment.tolerance || "-"}</p></div>
                <div><p className="text-xs text-slate-500 font-semibold uppercase">Resolution</p><p className="font-medium text-slate-800">{equipment.resolution || "-"}</p></div>
                <div><p className="text-xs text-slate-500 font-semibold uppercase">Frequency</p><p className="font-medium text-slate-800">{equipment.frequencyMonths} Months</p></div>
                <div><p className="text-xs text-slate-500 font-semibold uppercase">PIC</p><p className="font-medium text-slate-800">{equipment.picName || "-"}</p></div>
                <div><p className="text-xs text-slate-500 font-semibold uppercase">Status</p>
                  <p className={`font-semibold ${equipment.status === 'Active' ? 'text-emerald-600' : 'text-red-600'}`}>{equipment.status}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" /> Current Calibration
          </h3>
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border ${calStatus === 'Overdue' ? 'bg-red-50 border-red-200' : calStatus === 'Warning' ? 'bg-amber-50 border-amber-200' : calStatus === 'Valid' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3 mb-2">
                {calStatus === 'Overdue' ? <AlertTriangle className="w-6 h-6 text-red-600" /> :
                 calStatus === 'Warning' ? <AlertTriangle className="w-6 h-6 text-amber-600" /> :
                 calStatus === 'Valid' ? <CheckCircle className="w-6 h-6 text-emerald-600" /> :
                 <Search className="w-6 h-6 text-slate-400" />}
                <p className={`text-lg font-bold ${calStatus === 'Overdue' ? 'text-red-800' : calStatus === 'Warning' ? 'text-amber-800' : calStatus === 'Valid' ? 'text-emerald-800' : 'text-slate-600'}`}>
                  {calStatus === 'Overdue' ? 'Overdue Calibration' : calStatus === 'Warning' ? 'Calibration Due Soon' : calStatus === 'Valid' ? 'Calibration Valid' : 'No Calibration'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Last Calibrated</p>
                  <p className="font-medium text-slate-800">{equipment.lastCalibrationDate || "No record"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Next Due</p>
                  <p className="font-medium text-slate-800">{equipment.nextCalibrationDate || "N/A"}</p>
                </div>
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <button onClick={() => setIsAddOpen(true)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Record
                </button>
                <button onClick={() => window.print()} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-sm font-medium transition-colors" title="Print Label">
                  <Printer className="w-4 h-4" /> Print Label
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 print:hidden">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <FileBadge className="w-5 h-5 text-teal-600" /> Calibration History
            </h3>
          </div>
          <div className="p-0">
            {equipment.history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-white text-slate-500 border-b border-slate-200 text-xs uppercase">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Date</th>
                      <th className="px-6 py-3 font-semibold">Certificate</th>
                      <th className="px-6 py-3 font-semibold">Calibrated By</th>
                      <th className="px-6 py-3 font-semibold">Result</th>
                      <th className="px-6 py-3 font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {equipment.history.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" /> {rec.date}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-blue-600 block">{rec.certificateNo}</span>
                          {rec.attachmentUrl && (
                            <a href={rec.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-teal-600 hover:underline flex items-center gap-1 mt-1">
                              <FileText className="w-3 h-3" /> View Cert
                            </a>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {rec.calibratedBy}
                          {rec.masterEquipmentUsed && <div className="text-[10px] text-slate-500 mt-0.5">Master: {rec.masterEquipmentUsed}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2 items-start">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              rec.result === "Pass" ? "bg-emerald-100 text-emerald-700" :
                              rec.result === "Adjusted" ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            }`}>{rec.result}</span>
                            {(rec.result === "Fail" || rec.result === "Adjusted") && canManage && (
                              <button onClick={() => raiseNCRFromEquipment(equipment.id, rec.id).then(r => alert(r.message))}
                                className="text-[10px] bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded font-semibold transition-colors">
                                Issue NCR
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs max-w-xs truncate" title={rec.remarks}>{rec.remarks || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-medium text-slate-600">No calibration records found</p>
                <p className="text-sm">Click "Add Calibration Record" to log history.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preventive Maintenance Section */}
      {equipment.category === "Production" && (
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" /> Preventive Maintenance Logs
              </h3>
              {canManage && (
                <button onClick={() => {
                  const status = prompt("Enter PM Status (Completed / Issues Found):", "Completed");
                  if (status && (status === "Completed" || status === "Issues Found")) {
                    const notes = prompt("Any notes?");
                    addPMRecord(equipment.id, {
                      date: new Date().toISOString().split("T")[0],
                      conductedBy: user?.name || "User",
                      status: status as any,
                      notes: notes || ""
                    });
                  }
                }} className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                  + Log PM
                </button>
              )}
            </div>
            <div className="p-5">
              {equipment.pmChecklist && equipment.pmChecklist.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Checklist Items (Every {equipment.pmFrequencyDays} days):</p>
                  <div className="flex flex-wrap gap-2">
                    {equipment.pmChecklist.map((item, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-md">{item}</span>
                    ))}
                  </div>
                </div>
              )}
              {equipment.pmHistory && equipment.pmHistory.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Date</th>
                        <th className="px-6 py-3 font-semibold">Conducted By</th>
                        <th className="px-6 py-3 font-semibold">Status</th>
                        <th className="px-6 py-3 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {equipment.pmHistory.map(pm => (
                        <tr key={pm.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-800 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" /> {pm.date}
                            </div>
                          </td>
                          <td className="px-6 py-4">{pm.conductedBy}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              pm.status === "Completed" ? "bg-emerald-100 text-emerald-700" :
                              "bg-red-100 text-red-700"
                            }`}>{pm.status}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs max-w-xs truncate" title={pm.notes}>{pm.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-slate-500 py-6">
                  <p className="font-medium text-slate-600">No PM records found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isAddOpen && <AddRecordModal equipment={equipment} onClose={() => setIsAddOpen(false)} />}
    </div>
    </>
  );
}
