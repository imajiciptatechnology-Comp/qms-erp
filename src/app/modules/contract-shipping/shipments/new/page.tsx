import { getSalesAccess } from "@/app/modules/sales/access";
import { getShipmentFormData } from "../../actions";
import ShipmentForm from "../ShipmentForm";

export default async function NewShipmentPage({ searchParams }: { searchParams: Promise<{ so?: string }> }) {
  const { access } = await getSalesAccess();
  if (!access.canShipping) return <p className="text-sm text-slate-500">Role Anda tidak bisa membuat shipment.</p>;
  const { so } = await searchParams;
  const orders = await getShipmentFormData();
  // Order yang dipilih dari halaman lain ditaruh paling atas (jadi pilihan awal form).
  const sorted = so ? [...orders.filter(o => o.id === so), ...orders.filter(o => o.id !== so)] : orders;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Shipment baru</h2>
      <ShipmentForm orders={sorted} />
    </div>
  );
}
