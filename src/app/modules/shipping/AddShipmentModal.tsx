"use client";

import { useState } from "react";
import { X, Loader2, Package } from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import { addShipment, addShipmentItem } from "./actions";
import { useRouter } from "next/navigation";

export default function AddShipmentModal({ isOpen, onClose, completedWos = [] }: { isOpen: boolean, onClose: () => void, completedWos?: any[] }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  // State for items
  const [dataSource, setDataSource] = useState<"Manual" | "PPC">("Manual");
  const [selectedWoId, setSelectedWoId] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      customerName: formData.get("customerName") as string,
      destination: formData.get("destination") as string,
      shippingDate: formData.get("shippingDate") as string,
      logisticsProvider: formData.get("logisticsProvider") as string,
      vehicleNumber: formData.get("vehicleNumber") as string,
      remarks: formData.get("remarks") as string,
    };

    // 1. Add Shipment
    const res = await addShipment(data);
    
    // 2. Add Items
    if (res.success && res.id) {
      if (dataSource === "PPC" && selectedWoId) {
        const wo = completedWos.find(w => w.id === selectedWoId);
        if (wo) {
          await addShipmentItem(res.id, {
            productName: wo.productName,
            quantity: wo.actualQuantity || wo.targetQuantity,
            lotNumber: `LOT-${wo.id}`,
            workOrderId: wo.id
          });
        }
      } else if (dataSource === "Manual") {
        const pName = formData.get("productName") as string;
        if (pName) {
          await addShipmentItem(res.id, {
            productName: pName,
            quantity: parseInt(formData.get("quantity") as string, 10) || 1,
            lotNumber: formData.get("lotNumber") as string || "N/A"
          });
        }
      }
      
      router.push(`/modules/shipping/${res.id}`);
      onClose();
    } else {
      setError("Failed to create Delivery Order");
    }
    
    setIsSubmitting(false);
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="max-w-2xl">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
        <div>
          <h2 id="modal-title" className="font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-slate-600" /> New Delivery Order
          </h2>
          <p className="text-xs text-slate-500">Create a schedule to ship products to the customer</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {/* Customer & Destination Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Customer Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
                <input
                  required
                  name="customerName"
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="e.g., PT. Maju Bersama"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Destination Address <span className="text-red-500">*</span></label>
                <textarea
                  required
                  name="destination"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                  placeholder="Full delivery address..."
                />
              </div>
            </div>
          </div>

          {/* Logistics Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Logistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shipping Date <span className="text-red-500">*</span></label>
                <input
                  required
                  name="shippingDate"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Logistics Provider / Driver <span className="text-red-500">*</span></label>
                <input
                  required
                  name="logisticsProvider"
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="e.g., JNE Cargo or John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Plate Number <span className="text-red-500">*</span></label>
                <input
                  required
                  name="vehicleNumber"
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="e.g., B 1234 XYZ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <input
                  name="remarks"
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="Any delivery notes..."
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">Shipped Items</h3>
            
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="radio" 
                  name="itemSource" 
                  checked={dataSource === "Manual"} 
                  onChange={() => setDataSource("Manual")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Manual Entry
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="radio" 
                  name="itemSource" 
                  checked={dataSource === "PPC"} 
                  onChange={() => setDataSource("PPC")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Pull from Completed Work Order
              </label>
            </div>

            {dataSource === "PPC" ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Work Order <span className="text-red-500">*</span></label>
                <select
                  value={selectedWoId}
                  onChange={e => setSelectedWoId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                  required={dataSource === "PPC"}
                >
                  <option value="">-- Choose Completed WO --</option>
                  {completedWos.map(wo => (
                    <option key={wo.id} value={wo.id}>
                      {wo.id} - {wo.productName} (Qty: {wo.actualQuantity || wo.targetQuantity})
                    </option>
                  ))}
                </select>
                {completedWos.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">No completed work orders available.</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Product Name</label>
                  <input
                    name="productName"
                    type="text"
                    required={dataSource === "Manual"}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Lot No.</label>
                  <input
                    name="lotNumber"
                    type="text"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    required={dataSource === "Manual"}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500 italic mt-2">You can add more items later in the delivery details page.</p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Delivery Order"}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
