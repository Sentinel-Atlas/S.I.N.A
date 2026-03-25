import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { getDb } from '../db';
import { indexContentItem } from '../services/indexer';
import { config } from '../config';
import type { ContentCategory, ContentStatus } from '@sina/shared';

const router = Router();

const upload = multer({
  dest: config.paths.imports,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// ─── Collections ──────────────────────────────────────────────────────────────

router.get('/collections', (_req, res) => {
  const db = getDb();
  const cols = db.prepare(`
    SELECT c.*, COUNT(ci.id) as item_count
    FROM collections c
    LEFT JOIN content_items ci ON ci.collection_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all();
  res.json({ success: true, data: cols });
});

router.post('/collections', (req, res) => {
  const db = getDb();
  const { name, description, category, color, icon } = req.body as {
    name: string; description?: string; category?: ContentCategory; color?: string; icon?: string;
  };
  if (!name) return res.status(400).json({ success: false, error: 'name required' });
  const id = uuidv4();
  db.prepare('INSERT INTO collections (id, name, description, category, color, icon) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, name, description ?? null, category ?? 'uncategorized', color ?? null, icon ?? null
  );
  res.json({ success: true, data: db.prepare('SELECT * FROM collections WHERE id = ?').get(id) });
});

router.delete('/collections/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE content_items SET collection_id = NULL WHERE collection_id = ?').run(req.params.id);
  db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Content Items ────────────────────────────────────────────────────────────

router.get('/items', (req, res) => {
  const db = getDb();
  const { category, status, collection_id, page = '1', per_page = '50' } = req.query as Record<string, string>;

  let query = 'SELECT * FROM content_items WHERE 1=1';
  const params: unknown[] = [];

  if (category) { query += ' AND category = ?'; params.push(category); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (collection_id) { query += ' AND collection_id = ?'; params.push(collection_id); }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM content_items WHERE 1=1${
    category ? ' AND category = ?' : ''}${status ? ' AND status = ?' : ''}${
    collection_id ? ' AND collection_id = ?' : ''}`).get(...params) as { c: number }).c;

  const pageNum = parseInt(page, 10);
  const perPage = parseInt(per_page, 10);
  query += ' ORDER BY imported_at DESC LIMIT ? OFFSET ?';
  params.push(perPage, (pageNum - 1) * perPage);

  const items = db.prepare(query).all(...params);
  res.json({
    success: true,
    data: {
      items: (items as Record<string, unknown>[]).map(i => ({ ...i, tags: JSON.parse(i.tags as string || '[]') })),
      total,
      page: pageNum,
      per_page: perPage,
      has_more: pageNum * perPage < total,
    },
  });
});

router.get('/items/:id', (req, res) => {
  const db = getDb();
  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(req.params.id) as Record<string, string> | undefined;
  if (!item) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: { ...item, tags: JSON.parse(item.tags || '[]') } });
});

router.patch('/items/:id', (req, res) => {
  const db = getDb();
  const { category, tags, collection_id, title } = req.body as {
    category?: ContentCategory; tags?: string[]; collection_id?: string; title?: string;
  };
  const updates: string[] = [];
  const vals: unknown[] = [];
  if (category) { updates.push('category = ?'); vals.push(category); }
  if (tags) { updates.push('tags = ?'); vals.push(JSON.stringify(tags)); }
  if (collection_id !== undefined) { updates.push('collection_id = ?'); vals.push(collection_id || null); }
  if (title) { updates.push('title = ?'); vals.push(title); }
  if (!updates.length) return res.status(400).json({ success: false, error: 'No updates provided' });
  db.prepare(`UPDATE content_items SET ${updates.join(', ')} WHERE id = ?`).run(...vals, req.params.id);
  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(req.params.id) as Record<string, string>;
  res.json({ success: true, data: { ...item, tags: JSON.parse(item.tags || '[]') } });
});

router.delete('/items/:id', (req, res) => {
  const db = getDb();
  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(req.params.id) as Record<string, string> | undefined;
  if (!item) return res.status(404).json({ success: false, error: 'Not found' });

  // Remove FTS and chunks
  db.prepare('DELETE FROM content_fts WHERE content_id = ?').run(req.params.id);
  db.prepare('DELETE FROM content_chunks WHERE content_id = ?').run(req.params.id);
  db.prepare('DELETE FROM content_items WHERE id = ?').run(req.params.id);

  res.json({ success: true });
});

// ─── Upload / Import ──────────────────────────────────────────────────────────

router.post('/upload', upload.array('files'), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) return res.status(400).json({ success: false, error: 'No files uploaded' });

  const db = getDb();
  const results: { name: string; id: string; status: string }[] = [];

  for (const file of files) {
    const id = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const destDir = path.join(config.paths.processed, 'uncategorized');
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, `${id}_${file.originalname}`);
    fs.renameSync(file.path, destPath);

    db.prepare(`
      INSERT INTO content_items (id, title, file_path, file_type, size_bytes, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(id, file.originalname, destPath, ext, file.size);

    results.push({ name: file.originalname, id, status: 'pending' });

    // Trigger indexing in background
    indexContentItem(id).catch((err: Error) => {
      db.prepare("UPDATE content_items SET status = 'failed', error = ? WHERE id = ?").run(err.message, id);
    });
  }

  res.json({ success: true, data: results });
});

// ─── Reindex ──────────────────────────────────────────────────────────────────

router.post('/items/:id/reindex', async (req, res) => {
  try {
    await indexContentItem(req.params.id);
    res.json({ success: true, data: getDb().prepare('SELECT * FROM content_items WHERE id = ?').get(req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post('/reindex', async (_req, res) => {
  const { reindexAll } = await import('../services/indexer');
  reindexAll().then(result => {
    console.log('[Library] Reindex complete:', result);
  }).catch(console.error);
  res.json({ success: true, message: 'Reindex started in background' });
});

export default router;
