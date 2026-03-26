'use client';

import { useEffect, useRef } from 'react';
import type { MapMarker } from '@sina/shared';

interface LeafletMapProps {
  markers: MapMarker[];
  tileServerUrl?: string;
  center?: [number, number];
  zoom?: number;
}

// Default center: Toronto
const DEFAULT_CENTER: [number, number] = [43.6532, -79.3832];
const DEFAULT_ZOOM = 10;

const MARKER_COLORS: Record<string, string> = {
  emergency: '#EF4444',
  medical:   '#F59E0B',
  shelter:   '#3B82F6',
  water:     '#06B6D4',
  food:      '#22C55E',
  power:     '#EAB308',
  comms:     '#8B5CF6',
  hazard:    '#F97316',
  personal:  '#6B7280',
  general:   '#94A3B8',
};

export default function LeafletMap({ markers, tileServerUrl, center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      // Guard after async: React 18 Strict Mode may have already cleaned up
      if (cancelled || !containerRef.current) return;

      // Load Leaflet CSS by injecting a <link> tag (dynamic CSS import is not type-safe)
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
      });

      // If tile server is available, use it; otherwise use OpenStreetMap (online fallback)
      const tileUrl = tileServerUrl
        ? `${tileServerUrl}/styles/basic-preview/{z}/{x}/{y}.png`
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      const attr = tileServerUrl
        ? '© Local Tile Server'
        : '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>';

      L.tileLayer(tileUrl, {
        attribution: attr,
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
        markersRef.current = [];
      }
    };
  }, []);

  // Update markers when they change
  useEffect(() => {
    if (!mapRef.current) return;
    (async () => {
      const L = await import('leaflet');
      const map = mapRef.current as L.Map;

      // Remove old markers
      for (const m of markersRef.current) {
        (m as L.Marker).remove();
      }
      markersRef.current = [];

      // Add new markers
      for (const marker of markers) {
        const color = MARKER_COLORS[marker.category] || '#94A3B8';
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:12px; height:12px; border-radius:50%;
            background:${color}; border:2px solid white;
            box-shadow:0 1px 4px rgba(0,0,0,0.5);
          "></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        const m = L.marker([marker.lat, marker.lng], { icon })
          .bindPopup(`<strong>${marker.name}</strong>${marker.description ? `<br/><small>${marker.description}</small>` : ''}`)
          .addTo(map);
        markersRef.current.push(m);
      }
    })();
  }, [markers]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: '#0D1321' }}
    />
  );
}
