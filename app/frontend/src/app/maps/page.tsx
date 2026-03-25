'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Map, Plus, RefreshCw, MapPin, Download, Upload,
  Layers, Trash2, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapRegion, MapMarker, MarkerCategory } from '@sina/shared';

// Lazy-load Leaflet to avoid SSR issues
const LeafletMap = dynamic(() => import('@/components/maps/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-bg-surface">
      <div className="text-text-muted text-sm">Loading map…</div>
    </div>
  ),
});

const MARKER_CATEGORY_COLORS: Record<MarkerCategory, string> = {
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

type Tab = 'map' | 'regions' | 'markers';

export default function MapsPage() {
  const [tab, setTab] = useState<Tab>('map');
  const [regions, setRegions] = useState<MapRegion[]>([]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showAddMarker, setShowAddMarker] = useState(false);
  const [newMarker, setNewMarker] = useState({ name: '', lat: '', lng: '', category: 'general', description: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api.maps.regions(), api.maps.markers()]).then(([r, m]) => {
      setRegions(r);
      setMarkers(m);
    }).catch(console.error);
  }, []);

  const scanRegions = async () => {
    const result = await api.maps.scanRegions();
    if (result.found > 0) {
      const r = await api.maps.regions();
      setRegions(r);
    }
    alert(`Scan complete. Found ${result.found} new map file(s).`);
  };

  const addMarker = async () => {
    await api.maps.addMarker({
      ...newMarker,
      lat: parseFloat(newMarker.lat),
      lng: parseFloat(newMarker.lng),
    });
    const m = await api.maps.markers();
    setMarkers(m);
    setShowAddMarker(false);
    setNewMarker({ name: '', lat: '', lng: '', category: 'general', description: '' });
  };

  const importGeoJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const geojson = JSON.parse(text);
    const result = await api.maps.importGeoJSON(geojson);
    const m = await api.maps.markers();
    setMarkers(m);
    alert(`Imported ${result.imported} markers`);
    e.target.value = '';
  };

  const deleteMarker = async (id: string) => {
    await api.maps.deleteMarker(id);
    setMarkers(prev => prev.filter(m => m.id !== id));
  };

  const installedRegions = regions.filter(r => r.installed);
  const filteredMarkers = categoryFilter ? markers.filter(m => m.category === categoryFilter) : markers;

  return (
    <div className="flex flex-col h-screen animate-fade-in" style={{ height: 'calc(100vh - var(--statusbar-height))' }}>

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Map className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold">Maps</h1>
          <p className="text-xs text-text-muted">{installedRegions.length} region{installedRegions.length !== 1 ? 's' : ''} · {markers.length} marker{markers.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1 bg-bg-surface border border-border rounded-lg p-1">
            {([['map', 'Map View'], ['regions', 'Regions'], ['markers', 'Markers']] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('px-3 py-1 rounded text-xs font-medium transition-colors',
                  tab === t ? 'bg-bg-raised text-text-primary' : 'text-text-muted hover:text-text-primary')}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map view */}
      {tab === 'map' && (
        <div className="flex flex-1 min-h-0">
          {/* Marker panel */}
          <div className="w-60 border-r border-border bg-bg-surface flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Markers</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" icon={<Upload className="w-3 h-3" />}
                  onClick={() => fileInputRef.current?.click()} />
                <Button size="sm" variant="ghost" icon={<Plus className="w-3 h-3" />}
                  onClick={() => setShowAddMarker(true)} />
              </div>
              <input ref={fileInputRef} type="file" accept=".geojson,.json" className="hidden" onChange={importGeoJSON} />
            </div>

            <div className="p-2 border-b border-border">
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input-base text-xs py-1 h-7">
                <option value="">All categories</option>
                {Object.keys(MARKER_CATEGORY_COLORS).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {filteredMarkers.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-muted">No markers</div>
              ) : (
                filteredMarkers.map(m => (
                  <div key={m.id} className="group flex items-start gap-2 p-2 rounded hover:bg-bg-overlay">
                    <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: MARKER_CATEGORY_COLORS[m.category as MarkerCategory] || '#94A3B8' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-text-primary truncate">{m.name}</div>
                      <div className="text-2xs text-text-muted capitalize">{m.category}</div>
                    </div>
                    <button onClick={() => deleteMarker(m.id)}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-status-error transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            <LeafletMap markers={markers} tileServerUrl={''} />
          </div>
        </div>
      )}

      {/* Regions management */}
      {tab === 'regions' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={scanRegions}>
              Scan Maps Directory
            </Button>
            <p className="text-xs text-text-muted">Scan for unregistered .mbtiles files in the maps data directory</p>
          </div>

          {regions.length === 0 ? (
            <EmptyState
              icon={<Map className="w-5 h-5" />}
              title="No map regions"
              description="Download map tiles from the catalog or place .mbtiles files in the maps directory and scan."
              action={<Button size="sm" variant="primary" icon={<Download className="w-3.5 h-3.5" />} onClick={() => window.location.href = '/downloads'}>Browse Map Downloads</Button>}
            />
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {regions.map(region => (
                <div key={region.id} className="card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{region.name}</div>
                      <div className="text-xs text-text-muted">{region.area}</div>
                    </div>
                    <Badge variant={region.installed ? 'green' : 'default'}>
                      {region.installed ? 'Installed' : 'Not Found'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-text-muted">
                    <div className="flex justify-between">
                      <span>Format</span>
                      <span className="font-mono">{region.tile_format}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Zoom</span>
                      <span className="font-mono">{region.min_zoom}–{region.max_zoom}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Size</span>
                      <span className="font-mono">{formatBytes(region.size_bytes)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Markers management */}
      {tab === 'markers' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowAddMarker(true)}>
              Add Marker
            </Button>
            <Button size="sm" variant="secondary" icon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => fileInputRef.current?.click()}>
              Import GeoJSON
            </Button>
          </div>

          {markers.length === 0 ? (
            <EmptyState icon={<MapPin className="w-5 h-5" />} title="No markers" description="Add custom markers or import a GeoJSON file." />
          ) : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Category</th><th>Coordinates</th><th>Collection</th><th></th></tr></thead>
              <tbody>
                {markers.map(m => (
                  <tr key={m.id}>
                    <td className="text-text-primary font-medium">{m.name}</td>
                    <td>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MARKER_CATEGORY_COLORS[m.category as MarkerCategory] }} />
                        <span className="capitalize text-xs">{m.category}</span>
                      </span>
                    </td>
                    <td className="font-mono text-xs">{m.lat.toFixed(5)}, {m.lng.toFixed(5)}</td>
                    <td className="text-xs">{m.collection || '—'}</td>
                    <td>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="w-3 h-3" />} onClick={() => deleteMarker(m.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add marker modal */}
      {showAddMarker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-5 space-y-4 animate-fade-in">
            <h3 className="text-sm font-semibold">Add Marker</h3>
            {[
              { label: 'Name', key: 'name', type: 'text', placeholder: 'Marker name' },
              { label: 'Latitude', key: 'lat', type: 'number', placeholder: '43.6532' },
              { label: 'Longitude', key: 'lng', type: 'number', placeholder: '-79.3832' },
              { label: 'Description', key: 'description', type: 'text', placeholder: 'Optional' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="text-2xs text-text-muted uppercase tracking-wider block mb-1">{label}</label>
                <input type={type} placeholder={placeholder} value={newMarker[key as keyof typeof newMarker]}
                  onChange={e => setNewMarker(prev => ({ ...prev, [key]: e.target.value }))}
                  className="input-base" />
              </div>
            ))}
            <div>
              <label className="text-2xs text-text-muted uppercase tracking-wider block mb-1">Category</label>
              <select value={newMarker.category} onChange={e => setNewMarker(prev => ({ ...prev, category: e.target.value }))} className="input-base">
                {Object.keys(MARKER_CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowAddMarker(false)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={addMarker} disabled={!newMarker.name || !newMarker.lat || !newMarker.lng}>
                Add Marker
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
