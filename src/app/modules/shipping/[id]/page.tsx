import { getShipment } from "../actions";
import { getCurrentUser } from "@/app/actions/auth";
import { getRolesConfig } from "@/lib/authServer";
import { notFound } from "next/navigation";
import ShipmentDetailClient from "./ShipmentDetailClient";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const [shipment, user, rolesConfig] = await Promise.all([
    getShipment(resolvedParams.id),
    getCurrentUser(),
    getRolesConfig()
  ]);

  if (!shipment) return notFound();

  return <ShipmentDetailClient shipment={shipment} user={user} rolesConfig={rolesConfig} />;
}
