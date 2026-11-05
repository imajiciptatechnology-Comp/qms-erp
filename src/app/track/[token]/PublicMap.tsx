"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const FleetMap = dynamic(() => import("@/app/modules/logistics/tracking/FleetMap"), { ssr: false, loading: () => <div className="h-[320px] rounded-lg bg-slate-50 animate-pulse" /> });

/** Peta satu truk untuk klien + refresh otomatis tiap menit. */
export default function PublicMap({ lat, lng, status, plateNo, path }: { lat: number; lng: number; status: string; plateNo: string; path: [number, number][] }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);
  return <FleetMap height={320} units={[{ id: "me", plateNo, status, lat, lng, path, popupHtml: plateNo.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`) }]} fitKey="me" />;
}
