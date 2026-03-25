import { getDb } from '../db';
import { generateEmbedding, cosineSimilarity } from './ollamaAdapter';
import type { SearchResult, SearchScope, ContentCategory, SourceReference } from '@sina/shared';

export interface SearchOptions {
  q: string;
  scope?: SearchScope;
  category?: ContentCategory;
  limit?: number;
  semantic?: boolean;
}

export async function search(opts: SearchOptions): Promise<SearchResult[]> {
  const { q, scope = 'all', category, limit = 20, semantic = false } = opts;
  if (!q.trim()) return [];

  const results: SearchResult[] = [];

  if (scope === 'all' || scope === 'library') {
    results.push(...(await searchContent(q, category, Math.ceil(limit / 2), semantic)));
  }

  if (scope === 'all' || scope === 'vault') {
    results.push(...searchVault(q, Math.ceil(limit / 2)));
  }

  // Sort by score descending and deduplicate by id
  const seen = new Set<string>();
  return results
    .sort((a, b) => b.score - a.score)
    .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
    .slice(0, limit);
}

async function searchContent(q: string, category: ContentCategory | undefined, limit: number, semantic: boolean): Promise<SearchResult[]> {
  const db = getDb();
  const results: SearchResult[] = [];

  // FTS keyword search
  try {
    const ftsRows = db.prepare(`
      SELECT ci.id, ci.title, ci.category, ci.tags,
             snippet(content_fts, 2, '<mark>', '</mark>', '...', 32) as excerpt,
             bm25(content_fts) as score
      FROM content_fts
      JOIN content_items ci ON ci.id = content_fts.content_id
      WHERE content_fts MATCH ?
      ${category ? 'AND ci.category = ?' : ''}
      ORDER BY score
      LIMIT ?
    `).all(...[`"${q.replace(/"/g, '')}"`, ...(category ? [category] : []), limit]) as Array<{
      id: string; title: string; category: string; tags: string; excerpt: string; score: number;
    }>;

    for (const row of ftsRows) {
      results.push({
        id: row.id,
        title: row.title,
        excerpt: row.excerpt,
        source_type: 'content',
        category: row.category,
        score: Math.abs(row.score),
        tags: JSON.parse(row.tags || '[]'),
      });
    }
  } catch {
    // FTS query may fail on special characters — fall back gracefully
  }

  // Semantic search (if enabled and embeddings available)
  if (semantic) {
    try {
      const queryVec = await generateEmbedding(q);
      const chunks = db.prepare(`
        SELECT cc.id, cc.text, cc.embedding, ci.id as content_id, ci.title, ci.category, ci.tags
        FROM content_chunks cc
        JOIN content_items ci ON ci.id = cc.content_id
        WHERE cc.embedding IS NOT NULL
        ${category ? 'AND ci.category = ?' : ''}
        LIMIT 1000
      `).all(...(category ? [category] : [])) as Array<{
        id: string; text: string; embedding: string;
        content_id: string; title: string; category: string; tags: string;
      }>;

      const scored = chunks
        .map(c => ({ ...c, sim: cosineSimilarity(queryVec, JSON.parse(c.embedding)) }))
        .filter(c => c.sim > 0.6)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, limit);

      for (const c of scored) {
        if (!results.find(r => r.id === c.content_id)) {
          results.push({
            id: c.content_id,
            title: c.title,
            excerpt: c.text.slice(0, 200) + '...',
            source_type: 'content',
            category: c.category,
            score: c.sim * 100,
            tags: JSON.parse(c.tags || '[]'),
          });
        }
      }
    } catch {
      // Semantic search unavailable — continue with FTS results only
    }
  }

  return results;
}

function searchVault(q: string, limit: number): SearchResult[] {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT vi.id, vi.title, vi.type, vi.tags,
             snippet(vault_fts, 2, '<mark>', '</mark>', '...', 32) as excerpt,
             bm25(vault_fts) as score
      FROM vault_fts
      JOIN vault_items vi ON vi.id = vault_fts.vault_id
      WHERE vault_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `).all(`"${q.replace(/"/g, '')}"`, limit) as Array<{
      id: string; title: string; type: string; tags: string; excerpt: string; score: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      excerpt: row.excerpt,
      source_type: 'vault' as const,
      score: Math.abs(row.score),
      tags: JSON.parse(row.tags || '[]'),
    }));
  } catch {
    return [];
  }
}

export async function getContextChunks(query: string, limit = 5): Promise<SourceReference[]> {
  const db = getDb();

  // First try semantic search if embeddings exist
  try {
    const queryVec = await generateEmbedding(query);
    const chunks = db.prepare(`
      SELECT cc.id, cc.text, cc.embedding, ci.id as content_id, ci.title, ci.category
      FROM content_chunks cc
      JOIN content_items ci ON ci.id = cc.content_id
      WHERE cc.embedding IS NOT NULL
      LIMIT 500
    `).all() as Array<{
      id: string; text: string; embedding: string;
      content_id: string; title: string; category: string;
    }>;

    const scored = chunks
      .map(c => ({ ...c, sim: cosineSimilarity(queryVec, JSON.parse(c.embedding)) }))
      .filter(c => c.sim > 0.5)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, limit);

    if (scored.length > 0) {
      return scored.map(c => ({
        doc_id: c.content_id,
        title: c.title,
        excerpt: c.text.slice(0, 300),
        score: c.sim,
        category: c.category,
      }));
    }
  } catch { /* fall through to FTS */ }

  // FTS fallback
  try {
    const rows = db.prepare(`
      SELECT ci.id, ci.title, ci.category,
             snippet(content_fts, 2, '', '', '...', 48) as excerpt,
             bm25(content_fts) as score
      FROM content_fts
      JOIN content_items ci ON ci.id = content_fts.content_id
      WHERE content_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `).all(`"${query.replace(/"/g, '')}"`, limit) as Array<{
      id: string; title: string; category: string; excerpt: string; score: number;
    }>;

    return rows.map(r => ({
      doc_id: r.id,
      title: r.title,
      excerpt: r.excerpt,
      score: Math.abs(r.score),
      category: r.category,
    }));
  } catch {
    return [];
  }
}
