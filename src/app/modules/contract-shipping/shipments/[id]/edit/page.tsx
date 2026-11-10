import { notFound, redirect } from "next/navigation";
import { getSalesAccess } from "@/app/modules/sales/access";
import { orderPaidStatus, type CratePackage } from "@/app/modules/sales/lib";
import { getShipment } from "../../../actions";
import ShipmentForm from "../../ShipmentForm";

export default async function EditShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { access } = await getSalesAccess();
  const s = await getShipment(id);
  if (!s) notFound();
  if (!access.canShipping || !["Draft", "Ready"].includes(s.status)) redirect(`/modules/contract-shipping/shipments/${id}`);
  const so = s.salesOrder;
  const order = {
    id: so.id, soNo: so.soNo, customerPoNo: so.customerPoNo, customer: s.customer.name, deliveryAddress: so.deliveryAddress ?? "",
    productionStatus: so.productionStatus, payment: orderPaidStatus(so), currency: so.currency, items: so.items.map(i => ({ description: i.description, qty: i.qty, unit: i.unit })),
  };
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Ubah {s.shipmentNo}</h2>
      <ShipmentForm
        orders={[order]}
        shipmentId={s.id}
        initial={{
          salesOrderId: so.id, scope: s.scope, incoterm: s.incoterm ?? "", mode: s.mode, forwarder: s.forwarder ?? "", origin: s.origin, destination: s.destination,
          etd: s.etd ?? "", eta: s.eta ?? "", awbNo: s.awbNo ?? "", vessel: s.vessel ?? "", containerNo: s.containerNo ?? "", notes: s.notes ?? "",
          packages: JSON.parse(s.packagesJson) as CratePackage[],
        }}
      />
    </div>
  );
}
