import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { getDb } from '../db';
import { config } from '../config';
import type { MarkerCategory } from '@sina/shared';

const router = Router();

const upload = multer({ dest: config.paths.maps, limits: { fileSize: 5 * 1024 * 1024 * 1024 } }); // 5GB

// ─── Regions ──────────────────────────────────────────────────────────────────

router.get('/regions', (_req, res) => {
  const db = getDb();
  const regions = db.prepare('SELECT * FROM map_regions ORDER BY name').all();
  res.json({ success: true, data: (regions as Record<string, unknown>[]).map(r => ({
    ...r,
    bounds: r.bounds ? JSON.parse(r.bounds as string) : null,
    center: r.center ? JSON.parse(r.center as string) : null,
    installed: Boolean(r.installed),
  })) });
});

router.get('/regions/:id', (req, res) => {
  const db = getDb();
  const region = db.prepare('SELECT * FROM map_regions WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!region) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: {
    ...region,
    bounds: region.bounds ? JSON.parse(region.bounds as string) : null,
    center: region.center ? JSON.parse(region.center as string) : null,
    installed: Boolean(region.installed),
  } });
});

// Register a map region (after placing an mbtiles file manually)
router.post('/regions', (req, res) => {
  const db = getDb();
  const { name, area, file_path, tile_format = 'mbtiles', min_zoom = 0, max_zoom = 14, bounds, center } = req.body as {
    name: string; area: string; file_path: string;
    tile_format?: string; min_zoom?: number; max_zoom?: number;
    bounds?: [number, number, number, number];
    center?: [number, number, number];
  };

  if (!name || !file_path) return res.status(400).json({ success: false, error: 'name and file_path required' });

  const id = uuidv4();
  let sizeBytes = 0;
  try { sizeBytes = fs.statSync(file_path).size; } catch { /* skip */ }

  const installed = fs.existsSync(file_path) ? 1 : 0;

  db.prepare(`
    INSERT INTO map_regions (id, name, area, file_path, size_bytes, installed, tile_format, min_zoom, max_zoom, bounds, center, installed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, name, area, file_path, sizeBytes, installed,
    tile_format, min_zoom, max_zoom,
    bounds ? JSON.stringify(bounds) : null,
    center ? JSON.stringify(center) : null
  );

  res.json({ success: true, data: db.prepare('SELECT * FROM map_regions WHERE id = ?').get(id) });
});

router.delete('/regions/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM map_regions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Scan maps directory for unregistered mbtiles
router.post('/regions/scan', (req, res) => {
  const db = getDb();
  const mapsDir = config.paths.maps;
  if (!fs.existsSync(mapsDir)) return res.json({ success: true, data: { found: 0 } });

  const registered = new Set((db.prepare('SELECT file_path FROM map_regions').all() as { file_path: string }[]).map(r => r.file_path));
  let found = 0;

  const files = fs.readdirSync(mapsDir);
  for (const file of files) {
    if (!file.endsWith('.mbtiles') && !file.endsWith('.pmtiles')) continue;
    const filePath = path.join(mapsDir, file);
    if (registered.has(filePath)) continue;

    const id = uuidv4();
    const name = path.basename(file, path.extname(file)).replace(/[-_]/g, ' ');
    const size = fs.statSync(filePath).size;
    db.prepare(`
      INSERT INTO map_regions (id, name, area, file_path, size_bytes, installed, tile_format, installed_at)
      VALUES (?, ?, 'Unknown', ?, ?, 1, 'mbtiles', datetime('now'))
    `).run(id, name, filePath, size);
    found++;
  }

  res.json({ success: true, data: { found } });
});

// ─── Markers ──────────────────────────────────────────────────────────────────

router.get('/markers', (req, res) => {
  const db = getDb();
  const { category, collection } = req.query as { category?: MarkerCategory; collection?: string };

  let query = 'SELECT * FROM map_markers WHERE 1=1';
  const params: unknown[] = [];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (collection) { query += ' AND collection = ?'; params.push(collection); }
  query += ' ORDER BY name';

  const markers = db.prepare(query).all(...params);
  res.json({ success: true, data: markers });
});

router.post('/markers', (req, res) => {
  const db = getDb();
  const { name, description, lat, lng, category = 'general', color, icon, collection } = req.body as {
    name: string; description?: string; lat: number; lng: number;
    category?: MarkerCategory; color?: string; icon?: string; collection?: string;
  };

  if (!name || lat == null || lng == null) return res.status(400).json({ success: false, error: 'name, lat, lng required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO map_markers (id, name, description, lat, lng, category, color, icon, collection)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description ?? null, lat, lng, category, color ?? null, icon ?? null, collection ?? null);

  res.json({ success: true, data: db.prepare('SELECT * FROM map_markers WHERE id = ?').get(id) });
});

router.put('/markers/:id', (req, res) => {
  const db = getDb();
  const { name, description, lat, lng, category, color, icon, collection } = req.body as Record<string, unknown>;
  const updates: string[] = [];
  const vals: unknown[] = [];
  const fields: Record<string, unknown> = { name, description, lat, lng, category, color, icon, collection };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) { updates.push(`${k} = ?`); vals.push(v); }
  }
  if (!updates.length) return res.status(400).json({ success: false, error: 'No updates' });
  db.prepare(`UPDATE map_markers SET ${updates.join(', ')} WHERE id = ?`).run(...vals, req.params.id);
  res.json({ success: true, data: db.prepare('SELECT * FROM map_markers WHERE id = ?').get(req.params.id) });
});

router.delete('/markers/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM map_markers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Import Markers from GeoJSON ──────────────────────────────────────────────

router.post('/markers/import', async (req, res) => {
  const { geojson, collection } = req.body as { geojson: GeoJSON; collection?: string };
  if (!geojson?.features) return res.status(400).json({ success: false, error: 'GeoJSON with features required' });

  const db = getDb();
  const insertMarker = db.prepare(`
    INSERT OR IGNORE INTO map_markers (id, name, description, lat, lng, category, color, icon, collection)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  const insertAll = db.transaction((features: GeoJSONFeature[]) => {
    for (const feat of features) {
      if (feat.geometry?.type !== 'Point') continue;
      const [lng, lat] = feat.geometry.coordinates;
      const id = uuidv4();
      const name = feat.properties?.name || feat.properties?.title || `Marker ${id.slice(0, 8)}`;
      const desc = feat.properties?.description || feat.properties?.desc || null;
      const category = feat.properties?.category || feat.properties?.type || 'general';
      insertMarker.run(id, name, desc, lat, lng, category, feat.properties?.color ?? null, feat.properties?.icon ?? null, collection ?? null);
      imported++;
    }
  });

  insertAll(geojson.features);
  res.json({ success: true, data: { imported } });
});

interface GeoJSONFeature {
  geometry?: { type: string; coordinates: number[] };
  properties?: Record<string, unknown>;
}
interface GeoJSON {
  features?: GeoJSONFeature[];
}

export default router;
