import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import {
  createDownloadJob, getDownloadJob, listDownloadJobs,
  updateDownloadJob, startDownload, pauseDownload, cancelDownload,
  downloadEvents,
} from '../services/downloadManager';
import type { DownloadStatus } from '@sina/shared';

const router = Router();

// ─── List / Get ───────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const { status } = req.query as { status?: DownloadStatus };
  res.json({ success: true, data: listDownloadJobs(status) });
});

router.get('/:id', (req, res) => {
  const job = getDownloadJob(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: job });
});

// ─── Create & Control ────────────────────────────────────────────────────────

router.post('/', (req, res) => {
  const { name, url, destination, checksum, checksum_algo, catalog_item_id, autostart = true } = req.body as {
    name: string; url: string; destination?: string;
    checksum?: string; checksum_algo?: string; catalog_item_id?: string;
    autostart?: boolean;
  };

  if (!name || !url) return res.status(400).json({ success: false, error: 'name and url required' });

  const job = createDownloadJob({ name, url, destination, checksum, checksum_algo, catalog_item_id });

  if (autostart) {
    startDownload(job.id).catch(console.error);
  }

  res.json({ success: true, data: job });
});

router.post('/:id/start', async (req, res) => {
  try {
    await startDownload(req.params.id);
    res.json({ success: true, data: getDownloadJob(req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post('/:id/pause', (req, res) => {
  pauseDownload(req.params.id);
  res.json({ success: true, data: getDownloadJob(req.params.id) });
});

router.post('/:id/resume', async (req, res) => {
  try {
    await startDownload(req.params.id);
    res.json({ success: true, data: getDownloadJob(req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post('/:id/cancel', (req, res) => {
  cancelDownload(req.params.id);
  res.json({ success: true, data: getDownloadJob(req.params.id) });
});

router.delete('/:id', async (req, res) => {
  const job = getDownloadJob(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Not found' });
  cancelDownload(req.params.id);
  const db = (await import('../db')).getDb();
  db.prepare('DELETE FROM download_jobs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── SSE Progress Feed ────────────────────────────────────────────────────────

router.get('/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onUpdate = (job: unknown) => send('update', job);
  const onCreated = (job: unknown) => send('created', job);

  downloadEvents.on('updated', onUpdate);
  downloadEvents.on('created', onCreated);

  req.on('close', () => {
    downloadEvents.off('updated', onUpdate);
    downloadEvents.off('created', onCreated);
  });
});

// ─── Catalog ─────────────────────────────────────────────────────────────────

router.get('/catalog/items', (_req, res) => {
  try {
    const catalogPath = path.resolve(process.cwd(), '../../registry/catalog.json');
    if (!fs.existsSync(catalogPath)) {
      return res.json({ success: true, data: [] });
    }
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    const db = require('../db').getDb();
    const installed = db.prepare('SELECT catalog_id FROM installed_items').all() as { catalog_id: string }[];
    const installedIds = new Set(installed.map(i => i.catalog_id));

    const items = (catalog.items || []).map((item: Record<string, unknown>) => ({
      ...item,
      installed: installedIds.has(item.id as string),
    }));

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

export default router;
