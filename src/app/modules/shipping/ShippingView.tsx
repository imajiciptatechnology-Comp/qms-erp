"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Filter, Truck, CheckCircle, Clock, Trash2, ChevronRight, Package, MapPin, Building2 } from "lucide-react";
import type { ShipmentRecord } from "./actions";
import TableFooter from "@/components/ui/TableFooter";
import EmptyTableRow from "@/components/ui/EmptyTableRow";
import { deleteShipment } from "./actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddShipmentModal from "./AddShipmentModal";

const STATUS_COLORS: Record<string, string> = {
  "Pending": "bg-slate-100 text-slate-700 border-slate-200",
  "In Transit": "bg-blue-100 text-blue-700 border-blue-200",
  "Delivered": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Cancelled": "bg-red-100 text-red-700 border-red-200"
};

export default function ShippingView({ shipments, user, rolesConfig, completedWos = [] }: { shipments: ShipmentRecord[], user: any, rolesConfig: any[], completedWos?: any[] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const roleData = rolesConfig?.find(r => r.name === user?.role);
  const canManage = user?.role === "Super Admin" || roleData?.permissions.includes("shipping_manage") || user?.role === "Production Head";

  const filtered = useMemo(() => shipments.filter(s => {
    const matchSearch = s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "All" || s.status === filterStatus;
    return matchSearch && matchStatus;
  }), [shipments, searchTerm, filterStatus]);

  const totalCount = shipments.length;
  const inTransitCount = useMemo(() => shipments.filter(s => s.status === "In Transit").length, [shipments]);
  const deliveredCount = useMemo(() => shipments.filter(s => s.status === "Delivered").length, [shipments]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this Delivery Order? This cannot be undone.")) return;
    await deleteShipment(id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Shipping & Delivery</h1>
          <p className="text-slate-500 text-sm">Product Preservation & Release (ISO 9001 Cl. 8.5.4 & 8.6)</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Create Delivery Order
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-semibold uppercase">Total Shipments</p>
            <p className="text-2xl font-bold text-slate-800">{totalCount}</p>
          </div>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-semibold uppercase">In Transit</p>
            <p className="text-2xl font-bold text-slate-800">{inTransitCount}</p>
          </div>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-semibold uppercase">Delivered</p>
            <p className="text-2xl font-bold text-slate-800">{deliveredCount}</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by DO number, customer, destination..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white text-sm transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"}`}
          >
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-slate-100 flex gap-4">
            <div className="w-48">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                <option value="All">All Status</option>
                {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">DO Number</th>
                <th className="px-6 py-4 font-semibold">Customer & Destination</th>
                <th className="px-6 py-4 font-semibold">Logistics</th>
                <th className="px-6 py-4 font-semibold">Shipping Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/modules/shipping/${s.id}`)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-bold text-slate-700">{s.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" /> {s.customerName}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> <span className="truncate max-w-[200px]">{s.destination}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="flex items-center gap-1.5 font-medium text-slate-700">
                          <Truck className="w-3.5 h-3.5 text-slate-400" /> {s.logisticsProvider}
                        </span>
                        <span className="text-xs text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 w-fit">
                          {s.vehicleNumber}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" /> {s.shippingDate}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[s.status]}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/modules/shipping/${s.id}`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="View Detail"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                        {canManage && s.status === "Pending" && (
                          <button
                            onClick={e => handleDelete(e, s.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete DO"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                <EmptyTableRow colSpan={6} icon={<Truck className="w-12 h-12 text-slate-200" />} title="No Delivery Orders found" subtitle="Create a new DO to schedule a shipment." />
              )}
            </tbody>
          </table>
        </div>
        <TableFooter filtered={filtered.length} total={shipments.length} />
      </div>

      <AddShipmentModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} completedWos={completedWos} />
    </div>
  );
}
