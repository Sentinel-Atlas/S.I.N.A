import { v4 as uuidv4 } from 'uuid';
import { getDb, getSetting } from '../db';
import { parseDocument, chunkText, isSupportedFileType } from './documentParser';
import { generateEmbedding } from './ollamaAdapter';
import { config } from '../config';
import type { ContentItem, ContentStatus } from '@sina/shared';

export interface IndexOptions {
  generateEmbeddings?: boolean;
}

export async function indexContentItem(contentId: string, opts: IndexOptions = {}): Promise<void> {
  const db = getDb();
  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(contentId) as Record<string, unknown> | undefined;
  if (!item) throw new Error(`Content item ${contentId} not found`);

  setStatus(contentId, 'parsing');

  try {
    const parsed = await parseDocument(item.file_path as string);

    // Update title if it was just the filename
    if (parsed.title && parsed.title !== path.basename(item.file_path as string, path.extname(item.file_path as string))) {
      db.prepare('UPDATE content_items SET title = ? WHERE id = ?').run(parsed.title, contentId);
    }

    setStatus(contentId, 'indexing');

    // Clear existing FTS and chunks
    db.prepare('DELETE FROM content_fts WHERE content_id = ?').run(contentId);
    db.prepare('DELETE FROM content_chunks WHERE content_id = ?').run(contentId);

    const chunkSize = parseInt(getSetting('chunk_size') || String(config.indexing.chunkSize), 10);
    const chunkOverlap = parseInt(getSetting('chunk_overlap') || String(config.indexing.chunkOverlap), 10);
    const chunks = chunkText(parsed.text, chunkSize, chunkOverlap);

    // Insert FTS record
    db.prepare('INSERT INTO content_fts (content_id, title, body, category) VALUES (?, ?, ?, ?)').run(
      contentId, parsed.title, parsed.text.slice(0, 100_000), item.category
    );

    // Insert chunks
    const insertChunk = db.prepare(`
      INSERT INTO content_chunks (id, content_id, chunk_index, text, embedding, token_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertAllChunks = db.transaction(async (chunkList: string[]) => {
      for (let i = 0; i < chunkList.length; i++) {
        const text = chunkList[i];
        let embedding: string | null = null;

        if (opts.generateEmbeddings) {
          try {
            const vec = await generateEmbedding(text);
            embedding = JSON.stringify(vec);
          } catch {
            // embeddings are best-effort; indexing continues without them
          }
        }

        insertChunk.run(uuidv4(), contentId, i, text, embedding, text.split(/\s+/).length);
      }
    });

    await insertAllChunks(chunks);

    db.prepare(`
      UPDATE content_items
      SET status = 'indexed', indexed_at = datetime('now'), chunk_count = ?
      WHERE id = ?
    `).run(chunks.length, contentId);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(contentId, 'failed', msg);
    throw err;
  }
}

function setStatus(id: string, status: ContentStatus, error?: string): void {
  const db = getDb();
  if (error) {
    db.prepare("UPDATE content_items SET status = ?, error = ? WHERE id = ?").run(status, error, id);
  } else {
    db.prepare("UPDATE content_items SET status = ?, error = NULL WHERE id = ?").run(status, id);
  }
}

export async function reindexAll(opts: IndexOptions = {}): Promise<{ success: number; failed: number }> {
  const db = getDb();
  const items = db.prepare("SELECT id FROM content_items WHERE status != 'pending'").all() as { id: string }[];
  let success = 0, failed = 0;

  for (const { id } of items) {
    try {
      await indexContentItem(id, opts);
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

export async function reindexFailed(opts: IndexOptions = {}): Promise<void> {
  const db = getDb();
  const items = db.prepare("SELECT id FROM content_items WHERE status = 'failed'").all() as { id: string }[];
  for (const { id } of items) {
    try { await indexContentItem(id, opts); } catch { /* continue */ }
  }
}

// need to import path
import path from 'path';
