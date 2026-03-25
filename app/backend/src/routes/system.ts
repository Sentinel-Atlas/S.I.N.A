import { Router } from 'express';
import os from 'os';
import { getDb, getAllSettings, setSetting } from '../db';
import { getStorageState } from '../services/storageMonitor';
import { checkOllamaAvailable, listModels } from '../services/ollamaAdapter';
import { startWatchers, stopWatchers, getWatchedDirs } from '../services/fileWatcher';
import { config } from '../config';
import type { AppSettings } from '@sina/shared';

const router = Router();

// ─── Status ───────────────────────────────────────────────────────────────────

router.get('/status', async (_req, res) => {
  const settings = getAllSettings();
  const storage = getStorageState();
  const ollamaUp = await checkOllamaAvailable().catch(() => false);

  res.json({
    success: true,
    data: {
      version: '0.1.0',
      uptime: process.uptime(),
      node_version: process.version,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpu_count: os.cpus().length,
      mem_total: os.totalmem(),
      mem_free: os.freemem(),
      storage,
      ai: {
        ollama_available: ollamaUp,
        ollama_host: settings.ollama_host || config.ai.ollamaHost,
        models: ollamaUp ? await listModels().catch(() => []) : [],
      },
      network: {
        lan_exposed: settings.lan_exposed === 'true',
        bind_address: settings.bind_address || config.server.bindAddress,
      },
      watch_dirs: getWatchedDirs(),
    },
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

router.get('/settings', (_req, res) => {
  const raw = getAllSettings();
  const settings: Partial<AppSettings> = {
    data_dir: raw.data_dir || config.paths.dataDir,
    import_watch_dirs: raw.import_watch_dirs ? JSON.parse(raw.import_watch_dirs) : [config.paths.imports],
    ollama_host: raw.ollama_host || config.ai.ollamaHost,
    default_model: raw.default_model || config.ai.defaultModel,
    embed_model: raw.embed_model || config.ai.embedModel,
    default_persona: (raw.default_persona || 'researcher') as AppSettings['default_persona'],
    lan_exposed: raw.lan_exposed === 'true',
    bind_address: raw.bind_address || config.server.bindAddress,
    max_concurrent_downloads: parseInt(raw.max_concurrent_downloads || '2', 10),
    chunk_size: parseInt(raw.chunk_size || '512', 10),
    chunk_overlap: parseInt(raw.chunk_overlap || '64', 10),
    auto_reindex: raw.auto_reindex !== 'false',
    storage_warn_threshold_pct: parseInt(raw.storage_warn_threshold_pct || '85', 10),
    tile_server_url: raw.tile_server_url || config.maps.tileServerUrl,
    theme: 'dark',
  };
  res.json({ success: true, data: settings });
});

router.patch('/settings', (req, res) => {
  const updates = req.body as Partial<AppSettings>;
  const allowed: (keyof AppSettings)[] = [
    'ollama_host', 'default_model', 'embed_model', 'default_persona',
    'lan_exposed', 'max_concurrent_downloads', 'chunk_size', 'chunk_overlap',
    'auto_reindex', 'storage_warn_threshold_pct', 'tile_server_url',
    'import_watch_dirs',
  ];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      const val = updates[key];
      setSetting(key, Array.isArray(val) ? JSON.stringify(val) : String(val));
    }
  }

  // Restart watchers if watch dirs changed
  if (updates.import_watch_dirs) {
    stopWatchers();
    startWatchers();
  }

  res.json({ success: true, message: 'Settings updated' });
});

// ─── Logs ─────────────────────────────────────────────────────────────────────

router.get('/jobs', (_req, res) => {
  const db = getDb();
  const importJobs = db.prepare('SELECT * FROM import_jobs ORDER BY detected_at DESC LIMIT 100').all();
  res.json({ success: true, data: importJobs });
});

export default router;
