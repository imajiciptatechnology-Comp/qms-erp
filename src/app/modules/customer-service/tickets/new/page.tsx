import { getSalesAccess } from "@/app/modules/sales/access";
import { getTicketFormData } from "../../actions";
import TicketForm from "./TicketForm";

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ customer?: string; unit?: string }> }) {
  const { access } = await getSalesAccess();
  if (!access.canService) return <p className="text-sm text-slate-500">Role Anda tidak bisa membuat tiket.</p>;
  const [data, sp] = await Promise.all([getTicketFormData(), searchParams]);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Tiket baru</h2>
      <TicketForm data={data} customerId={sp.customer} unitKey={sp.unit} />
    </div>
  );
}
