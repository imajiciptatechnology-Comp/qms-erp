import { getSalesAccess } from "@/app/modules/sales/access";
import { getJobFormData } from "../../actions";
import JobForm from "../JobForm";

export default async function NewJobPage() {
  const { access } = await getSalesAccess();
  if (!access.canService) return <p className="text-sm text-slate-500">Role Anda tidak bisa membuat job.</p>;
  const data = await getJobFormData();
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Job instalasi / training baru</h2>
      <JobForm data={data} />
    </div>
  );
}
