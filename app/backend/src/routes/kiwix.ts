// S.I.N.A — /api/kiwix
// Kiwix/ZIM library management endpoints

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  listZimFiles,
  getZimFile,
  registerZimFile,
  removeZimFile,
  syncZimDirectory,
  getKiwixStatus,
  startKiwixServe,
  stopKiwixServe,
} from '../services/kiwixManager';
import { config } from '../config';

const router = Router();

// ─── Status ───────────────────────────────────────────────────────────────────

// GET /api/kiwix/status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await getKiwixStatus();
    res.json({ success: true, data: status });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to get Kiwix status' });
  }
});

// ─── ZIM Library ──────────────────────────────────────────────────────────────

// GET /api/kiwix/library
router.get('/library', (_req: Request, res: Response) => {
  try {
    const files = listZimFiles();
    res.json({ success: true, data: files });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to list ZIM files' });
  }
});

// GET /api/kiwix/library/:id
router.get('/library/:id', (req: Request, res: Response) => {
  try {
    const file = getZimFile(req.params.id);
    if (!file) {
      res.status(404).json({ success: false, error: 'ZIM file not found' });
      return;
    }
    res.json({ success: true, data: file });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to get ZIM file' });
  }
});

// POST /api/kiwix/library/register
// Register an existing ZIM file by path (e.g. after manual copy to kiwix dir)
router.post('/library/register', async (req: Request, res: Response) => {
  try {
    const { file_path, title, description, language, category, version, article_count, tags } = req.body;

    if (!file_path) {
      res.status(400).json({ success: false, error: 'file_path is required' });
      return;
    }

    if (!fs.existsSync(file_path)) {
      res.status(400).json({ success: false, error: `File not found: ${file_path}` });
      return;
    }

    if (!file_path.endsWith('.zim')) {
      res.status(400).json({ success: false, error: 'File must be a .zim file' });
      return;
    }

    const record = await registerZimFile(file_path, { title, description, language, category, version, article_count, tags });
    res.json({ success: true, data: record, message: 'ZIM file registered successfully' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to register ZIM file' });
  }
});

// DELETE /api/kiwix/library/:id
router.delete('/library/:id', (req: Request, res: Response) => {
  try {
    const deleteFile = req.query.delete_file === 'true';
    const result = removeZimFile(req.params.id, deleteFile);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json({ success: true, message: deleteFile ? 'ZIM file removed and deleted' : 'ZIM file unregistered' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to remove ZIM file' });
  }
});

// POST /api/kiwix/library/scan
// Scan kiwix data directory for new ZIM files and sync db
router.post('/library/scan', async (_req: Request, res: Response) => {
  try {
    const result = await syncZimDirectory();
    res.json({
      success: true,
      data: result,
      message: `Scan complete: ${result.added} added, ${result.removed} removed`,
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Scan failed' });
  }
});

// ─── Registry ─────────────────────────────────────────────────────────────────

// GET /api/kiwix/registry/categories
// Returns the tiered Kiwix content catalog
router.get('/registry/categories', (_req: Request, res: Response) => {
  try {
    const catalogPath = config.registry.kiwixCategoriesPath;
    if (!fs.existsSync(catalogPath)) {
      res.status(404).json({ success: false, error: 'Kiwix category registry not found' });
      return;
    }
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    res.json({ success: true, data: catalog });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to load registry' });
  }
});

// GET /api/kiwix/registry/wikipedia
// Returns the Wikipedia tier registry
router.get('/registry/wikipedia', (_req: Request, res: Response) => {
  try {
    const wikiPath = config.registry.wikipediaPath;
    if (!fs.existsSync(wikiPath)) {
      res.status(404).json({ success: false, error: 'Wikipedia registry not found' });
      return;
    }
    const registry = JSON.parse(fs.readFileSync(wikiPath, 'utf-8'));
    res.json({ success: true, data: registry });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to load registry' });
  }
});

// ─── Kiwix-serve Process ──────────────────────────────────────────────────────

// POST /api/kiwix/serve/start
router.post('/serve/start', async (_req: Request, res: Response) => {
  try {
    const result = await startKiwixServe();
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, message: 'Kiwix serve started' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to start kiwix-serve' });
  }
});

// POST /api/kiwix/serve/stop
router.post('/serve/stop', (_req: Request, res: Response) => {
  try {
    stopKiwixServe();
    res.json({ success: true, message: 'Kiwix serve stopped' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to stop kiwix-serve' });
  }
});

export default router;
