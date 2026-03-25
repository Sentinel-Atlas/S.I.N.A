import { Router } from 'express';
import { getDb, getAllSettings } from '../db';
import { getStorageState } from '../services/storageMonitor';
import { checkOllamaAvailable, listModels } from '../services/ollamaAdapter';
import { config } from '../config';
import type { SystemHealth } from '@sina/shared';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    const db = getDb();
    const settings = getAllSettings();
    const storage = getStorageState();
    const ollamaUp = await checkOllamaAvailable();

    let models: string[] = [];
    if (ollamaUp) {
      try { models = (await listModels()).map(m => m.id); } catch { /* skip */ }
    }

    const contentCount = (db.prepare("SELECT COUNT(*) as c FROM content_items WHERE status = 'indexed'").get() as { c: number }).c;
    const pendingDownloads = (db.prepare("SELECT COUNT(*) as c FROM download_jobs WHERE status IN ('downloading','queued')").get() as { c: number }).c;
    const pendingImports = (db.prepare("SELECT COUNT(*) as c FROM import_jobs WHERE status NOT IN ('done','failed','unsupported')").get() as { c: number }).c;

    const health: SystemHealth = {
      status: ollamaUp ? 'healthy' : 'degraded',
      modules: {
        database: 'ready',
        ai: ollamaUp ? 'ready' : 'offline',
        downloads: 'ready',
        indexing: pendingImports > 0 ? 'installing' : 'ready',
        maps: 'ready',
        vault: 'ready',
        search: contentCount > 0 ? 'ready' : 'degraded',
      },
      network: {
        lan_exposed: settings.lan_exposed === 'true',
        bind_address: settings.bind_address || config.server.bindAddress,
        online: true,
      },
      storage,
      ai: {
        runtime: 'ollama',
        runtime_available: ollamaUp,
        models: ollamaUp ? await listModels().catch(() => []) : [],
        active_model: settings.default_model || null,
        embed_model: settings.embed_model || null,
      },
      uptime: process.uptime(),
      version: '0.1.0',
    };

    res.json({ success: true, data: health });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.get('/stats', (_req, res) => {
  try {
    const db = getDb();
    const stats = {
      content: {
        total: (db.prepare("SELECT COUNT(*) as c FROM content_items").get() as { c: number }).c,
        indexed: (db.prepare("SELECT COUNT(*) as c FROM content_items WHERE status = 'indexed'").get() as { c: number }).c,
        failed: (db.prepare("SELECT COUNT(*) as c FROM content_items WHERE status = 'failed'").get() as { c: number }).c,
        pending: (db.prepare("SELECT COUNT(*) as c FROM content_items WHERE status IN ('pending','parsing','indexing')").get() as { c: number }).c,
      },
      downloads: {
        active: (db.prepare("SELECT COUNT(*) as c FROM download_jobs WHERE status = 'downloading'").get() as { c: number }).c,
        queued: (db.prepare("SELECT COUNT(*) as c FROM download_jobs WHERE status = 'queued'").get() as { c: number }).c,
        completed: (db.prepare("SELECT COUNT(*) as c FROM download_jobs WHERE status = 'completed'").get() as { c: number }).c,
        failed: (db.prepare("SELECT COUNT(*) as c FROM download_jobs WHERE status = 'failed'").get() as { c: number }).c,
      },
      vault: {
        total: (db.prepare("SELECT COUNT(*) as c FROM vault_items").get() as { c: number }).c,
        pinned: (db.prepare("SELECT COUNT(*) as c FROM vault_items WHERE pinned = 1").get() as { c: number }).c,
      },
      conversations: {
        total: (db.prepare("SELECT COUNT(*) as c FROM conversations").get() as { c: number }).c,
      },
      maps: {
        regions: (db.prepare("SELECT COUNT(*) as c FROM map_regions WHERE installed = 1").get() as { c: number }).c,
        markers: (db.prepare("SELECT COUNT(*) as c FROM map_markers").get() as { c: number }).c,
      },
    };
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

export default router;
