import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import type { VaultItemType } from '@sina/shared';

const router = Router();

function parseItem(row: Record<string, unknown>) {
  return { ...row, tags: JSON.parse(row.tags as string || '[]'), pinned: Boolean(row.pinned) };
}

// ─── List ─────────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const db = getDb();
  const { type, category, pinned, page = '1', per_page = '50' } = req.query as Record<string, string>;

  let query = 'SELECT * FROM vault_items WHERE 1=1';
  const params: unknown[] = [];

  if (type) { query += ' AND type = ?'; params.push(type); }
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (pinned === 'true') { query += ' AND pinned = 1'; }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM (${query})`).get(...params) as { c: number }).c;
  const pageNum = parseInt(page, 10);
  const perPage = parseInt(per_page, 10);
  query += ' ORDER BY pinned DESC, updated_at DESC LIMIT ? OFFSET ?';
  params.push(perPage, (pageNum - 1) * perPage);

  const items = (db.prepare(query).all(...params) as Record<string, unknown>[]).map(parseItem);
  res.json({ success: true, data: { items, total, page: pageNum, per_page: perPage, has_more: pageNum * perPage < total } });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const item = db.prepare('SELECT * FROM vault_items WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!item) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: parseItem(item) });
});

// ─── Create ───────────────────────────────────────────────────────────────────

router.post('/', (req, res) => {
  const db = getDb();
  const { type = 'note', title, content = '', tags = [], pinned = false, category } = req.body as {
    type?: VaultItemType; title: string; content?: string;
    tags?: string[]; pinned?: boolean; category?: string;
  };
  if (!title) return res.status(400).json({ success: false, error: 'title required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO vault_items (id, type, title, content, tags, pinned, category)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, title, content, JSON.stringify(tags), pinned ? 1 : 0, category ?? null);

  // Update FTS
  db.prepare('INSERT INTO vault_fts (vault_id, title, content) VALUES (?, ?, ?)').run(id, title, content);

  const item = db.prepare('SELECT * FROM vault_items WHERE id = ?').get(id) as Record<string, unknown>;
  res.json({ success: true, data: parseItem(item) });
});

// ─── Update ───────────────────────────────────────────────────────────────────

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM vault_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

  const { title, content, tags, pinned, category } = req.body as {
    title?: string; content?: string; tags?: string[]; pinned?: boolean; category?: string;
  };

  const updates: string[] = ["updated_at = datetime('now')"];
  const vals: unknown[] = [];
  if (title !== undefined) { updates.push('title = ?'); vals.push(title); }
  if (content !== undefined) { updates.push('content = ?'); vals.push(content); }
  if (tags !== undefined) { updates.push('tags = ?'); vals.push(JSON.stringify(tags)); }
  if (pinned !== undefined) { updates.push('pinned = ?'); vals.push(pinned ? 1 : 0); }
  if (category !== undefined) { updates.push('category = ?'); vals.push(category); }

  db.prepare(`UPDATE vault_items SET ${updates.join(', ')} WHERE id = ?`).run(...vals, req.params.id);

  // Update FTS
  const updated = db.prepare('SELECT * FROM vault_items WHERE id = ?').get(req.params.id) as Record<string, string>;
  db.prepare('DELETE FROM vault_fts WHERE vault_id = ?').run(req.params.id);
  db.prepare('INSERT INTO vault_fts (vault_id, title, content) VALUES (?, ?, ?)').run(req.params.id, updated.title, updated.content);

  res.json({ success: true, data: parseItem(updated as Record<string, unknown>) });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM vault_fts WHERE vault_id = ?').run(req.params.id);
  db.prepare('DELETE FROM vault_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
