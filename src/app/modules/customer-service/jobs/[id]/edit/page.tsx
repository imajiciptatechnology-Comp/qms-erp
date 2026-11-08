import { notFound, redirect } from "next/navigation";
import { getSalesAccess } from "@/app/modules/sales/access";
import { getJob, getJobFormData } from "../../../actions";
import JobForm from "../../JobForm";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  const j = await getJob(id);
  if (!j) notFound();
  if (!access.canService || !["Draft", "Scheduled"].includes(j.status)) redirect(`/modules/customer-service/jobs/${id}`);
  const data = await getJobFormData();
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Ubah {j.jobNo}</h2>
      {j.status === "Scheduled" && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Jadwal ini sudah disetujui. Mengubah tanggal, lokasi, atau trainer mengembalikannya ke Draft dan perlu diajukan ulang.</p>}
      <JobForm
        data={data}
        jobId={j.id}
        initial={{
          customerId: j.customerId, salesOrderId: j.salesOrderId ?? "", type: j.type, mode: j.mode, location: j.location ?? "", startDate: j.startDate ?? "", endDate: j.endDate ?? "",
          technicians: j.technicians ?? "", trainerName: j.trainerName ?? "", topics: j.topics ?? "", notes: j.notes ?? "",
        }}
      />
    </div>
  );
}
