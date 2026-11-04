import { MessageCircle } from "lucide-react";
import { getLogisticsAccess } from "../server";
import { getFleetSnapshot } from "../tracking";
import { Card } from "../ui";
import FleetTracking from "./FleetTracking";

export default async function FleetTrackingPage() {
  const { access } = await getLogisticsAccess();
  if (!access.canView) return null;
  const snapshot = await getFleetSnapshot();
  return (
    <FleetTracking
      initial={snapshot}
      canSimulate={access.canDispatch}
      chatSlot={
        <Card title={<span className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-sky-600" /> Driver chat</span>}>
          <p className="text-sm text-slate-500">Riwayat pesan bot Telegram ↔ sopir per trip dan tombol &quot;kirim pesan ke sopir&quot; aktif setelah bot Telegram terhubung.</p>
        </Card>
      }
    />
  );
}
