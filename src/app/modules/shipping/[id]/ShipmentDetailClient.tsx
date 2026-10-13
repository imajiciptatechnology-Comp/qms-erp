"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle, Truck, MapPin, Building2, Clock, ShieldAlert, Trash2, Plus, Box, ShieldCheck } from "lucide-react";
import type { ShipmentRecord, ShipmentItem } from "../actions";
import { updateShipmentStatus, addShipmentItem, deleteShipmentItem } from "../actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ShipmentDetailClient({ shipment, user, rolesConfig }: { shipment: ShipmentRecord, user: any, rolesConfig: any[] }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  
  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("shipping_manage") || user?.role === "Production Head";
  
  const STATUS_COLORS: Record<string, string> = {
    "Pending": "bg-slate-100 text-slate-700 border-slate-200",
    "In Transit": "bg-blue-100 text-blue-700 border-blue-200",
    "Delivered": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Cancelled": "bg-red-100 text-red-700 border-red-200"
  };

  const handleUpdateStatus = async (status: ShipmentRecord["status"], requireProof: boolean = false) => {
    let proof = shipment.proofOfDelivery;
    if (requireProof) {
      const val = prompt("Please enter Proof of Delivery (e.g., Received by Mr. X, signed):", proof || "");
      if (val === null) return; // User cancelled
      if (val.trim() === "") {
        alert("Proof of delivery is required to mark as Delivered.");
        return;
      }
      proof = val;
    } else if (!confirm(`Change shipment status to ${status}?`)) {
      return;
    }

    setIsSaving(true);
    await updateShipmentStatus(shipment.id, status, proof);
    setIsSaving(false);
    router.refresh();
  };

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    await addShipmentItem(shipment.id, {
      productName: formData.get("productName") as string,
      quantity: parseInt(formData.get("quantity") as string, 10),
      lotNumber: formData.get("lotNumber") as string,
    });
    setIsAddingItem(false);
    setIsSaving(false);
    router.refresh();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Remove this item from shipment?")) return;
    setIsSaving(true);
    await deleteShipmentItem(shipment.id, itemId);
    setIsSaving(false);
    router.refresh();
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Breadcrumb & Header */}
      <div>
        <Link href="/modules/shipping" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Shipping
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              Delivery Order
              <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {shipment.id}
              </span>
              <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[shipment.status]}`}>
                {shipment.status}
              </span>
            </h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Shipping Date: <span className="font-medium text-slate-700">{shipment.shippingDate}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* General Info Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Delivery Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Customer Name</p>
                  <p className="text-base font-medium text-slate-800">{shipment.customerName}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Destination Address</p>
                  <p className="text-sm text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap">{shipment.destination}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Logistics / Driver</p>
                  <p className="text-base font-medium text-slate-800">{shipment.logisticsProvider}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Vehicle Number</p>
                  <p className="text-sm font-bold text-slate-800 px-3 py-1.5 bg-slate-100 rounded border border-slate-200 w-fit uppercase tracking-widest">{shipment.vehicleNumber}</p>
                </div>
              </div>
            </div>
            {shipment.remarks && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Remarks</p>
                <p className="text-sm text-slate-700">{shipment.remarks}</p>
              </div>
            )}
          </div>

          {/* Items Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Box className="w-4 h-4 text-blue-600" /> Shipped Items</h2>
              {canManage && shipment.status === "Pending" && (
                <button
                  onClick={() => setIsAddingItem(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-white text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Product Name</th>
                    <th className="px-6 py-3 font-semibold">Lot / Batch No.</th>
                    <th className="px-6 py-3 font-semibold text-center">Qty</th>
                    {canManage && shipment.status === "Pending" && <th className="px-6 py-3 font-semibold text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shipment.items.length > 0 ? shipment.items.map(i => (
                    <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {i.productName}
                        {i.workOrderId && <span className="ml-2 text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100">Ref: {i.workOrderId}</span>}
                      </td>
                      <td className="px-6 py-4">{i.lotNumber}</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-700">{i.quantity}</td>
                      {canManage && shipment.status === "Pending" && (
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleDeleteItem(i.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                        <p className="text-sm">No items added to this delivery order.</p>
                      </td>
                    </tr>
                  )}
                  
                  {isAddingItem && (
                    <tr className="bg-blue-50/30">
                      <td colSpan={4} className="p-4">
                        <form onSubmit={handleAddItem} className="grid grid-cols-4 gap-3 items-end">
                          <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Product Name</label>
                            <input required name="productName" className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Lot / Batch No.</label>
                            <input required name="lotNumber" className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Qty</label>
                            <input required name="quantity" type="number" min="1" className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div className="col-span-3 md:col-span-1 flex gap-2">
                            <button type="submit" disabled={isSaving} className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700 transition-colors">Save</button>
                            <button type="button" onClick={() => setIsAddingItem(false)} className="w-full px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-1 space-y-6">
          {/* Status Update Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Status Management</h2>
            
            {canManage ? (
              <div className="space-y-3">
                {shipment.status === "Pending" && (
                  <button
                    onClick={() => handleUpdateStatus("In Transit")}
                    disabled={isSaving || shipment.items.length === 0}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Truck className="w-4 h-4" /> Dispatch (In Transit)
                  </button>
                )}
                
                {shipment.status === "In Transit" && (
                  <button
                    onClick={() => handleUpdateStatus("Delivered", true)}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Mark as Delivered
                  </button>
                )}

                {(shipment.status === "Pending" || shipment.status === "In Transit") && (
                  <button
                    onClick={() => handleUpdateStatus("Cancelled")}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-200 mt-4"
                  >
                    Cancel Shipment
                  </button>
                )}

                {shipment.status === "Delivered" && (
                  <div className="bg-emerald-50 text-emerald-800 p-4 rounded-lg text-sm border border-emerald-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-emerald-700">
                      <ShieldCheck className="w-5 h-5" /> Delivery Successful
                    </div>
                    <p className="text-emerald-600">The items have been delivered to the customer.</p>
                    {shipment.proofOfDelivery && (
                      <div className="mt-3 pt-3 border-t border-emerald-200/50">
                        <p className="text-xs uppercase tracking-wider font-semibold text-emerald-600 mb-1">Proof of Delivery (POD)</p>
                        <p className="font-medium bg-white/50 p-2 rounded">{shipment.proofOfDelivery}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">You don't have permission to update shipment status.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
