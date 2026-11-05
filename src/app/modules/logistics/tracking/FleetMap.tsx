"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { TRIP_STATUSES } from "../trackingLib";

export type MapUnit = {
  id: string; plateNo: string; status: string; lat: number | null; lng: number | null; path: [number, number][];
  /** HTML popup — WAJIB sudah di-escape oleh pemanggil (lihat esc() di FleetTracking). */
  stale?: boolean; alert?: boolean; popupHtml: string;
};

const POOL: [number, number] = [-6.3008, 107.153];

const textNode = (s: string) => { const el = document.createElement("span"); el.textContent = s; return el; };

/** Peta Leaflet + OpenStreetMap (gratis, wajib atribusi). Titik = posisi terakhir, warna = status, garis putus = rencana rute. */
export default function FleetMap({ units, selectedId, onSelect, height = 460, fitKey }: {
  units: MapUnit[]; selectedId?: string | null; onSelect?: (id: string) => void; height?: number; fitKey?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const fitted = useRef<string | null>(null);
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const leaflet = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      L.current = leaflet;
      const m = leaflet.map(el.current, { zoomControl: true, attributionControl: true }).setView([-6.75, 109.2], 7);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      leaflet.circleMarker(POOL, { radius: 6, color: "#0B2545", weight: 2, fillColor: "#F28C28", fillOpacity: 1 }).bindTooltip("Pool Arunika Cikarang").addTo(m);
      layer.current = leaflet.layerGroup().addTo(m);
      map.current = m;
      // Ukuran kontainer bisa berubah (sidebar, resize jendela): beri tahu Leaflet supaya zoom/fit benar.
      ro = new ResizeObserver(() => { m.invalidateSize(); fitted.current = null; drawRef.current(); });
      ro.observe(el.current);
      drawRef.current();
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  function draw() {
    const leaflet = L.current;
    const m = map.current;
    if (!leaflet || !m || !layer.current) return;
    layer.current.clearLayers();
    const pts: [number, number][] = [];
    for (const u of units) {
      const color = TRIP_STATUSES[u.status]?.color ?? "#64748b";
      const sel = u.id === selectedId;
      if (u.path.length > 1) leaflet.polyline(u.path, { color, weight: sel ? 4 : 2, opacity: sel ? 0.8 : 0.35, dashArray: "6 6" }).addTo(layer.current);
      if (u.lat == null || u.lng == null) continue;
      pts.push([u.lat, u.lng]);
      const mk = leaflet.circleMarker([u.lat, u.lng], {
        radius: sel ? 12 : 9, color: u.alert ? "#dc2626" : "#ffffff", weight: u.alert ? 3 : 2,
        fillColor: u.stale ? "#94a3b8" : color, fillOpacity: 0.95,
      // Tooltip Leaflet memakai innerHTML untuk string: nopol dipasang sebagai teks, bukan HTML.
      }).bindTooltip(textNode(u.plateNo), { permanent: true, direction: "right", offset: [10, 0], className: "fleet-map-label" }).bindPopup(u.popupHtml);
      mk.on("click", () => onSelect?.(u.id));
      mk.addTo(layer.current);
      if (sel) mk.openPopup();
    }
    const key = fitKey ?? units.map(u => u.id).join(",");
    if (pts.length && fitted.current !== key) {
      fitted.current = key;
      m.fitBounds(leaflet.latLngBounds([...pts, POOL]).pad(0.15), { maxZoom: 11 });
    }
  }

  useEffect(() => {
    drawRef.current = draw;
    draw();
  });

  return (
    <>
      <style>{`.fleet-map-label{background:rgba(255,255,255,.9);border:1px solid #cbd5e1;border-radius:6px;padding:1px 5px;font-size:11px;font-weight:600;color:#0f172a;box-shadow:none}.fleet-map-label:before{display:none}`}</style>
      <div ref={el} style={{ height }} className="w-full rounded-lg border border-slate-200 z-0" role="region" aria-label="Peta armada" />
    </>
  );
}
