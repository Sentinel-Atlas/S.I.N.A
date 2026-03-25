// S.I.N.A Kiwix/ZIM Manager
// Manages offline Kiwix library files (ZIM format) for Wikipedia and other reference packs.
// ZIM files are discovered by scanning the kiwix/ data directory, registered in SQLite,
// and served through the Kiwix-serve process (if available) or proxied via tile server.

import fs from 'fs';
import path from 'path';
import { execSync, spawn, ChildProcess } from 'child_process';
import crypto from 'crypto';
import { config } from '../config';
import { getDb } from '../db';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZimFileRecord {
  id: string;
  name: string;
  title: string;
  description: string | null;
  language: string;
  category: string;
  size_bytes: number;
  file_path: string;
  installed: boolean;
  installed_at: string | null;
  version: string | null;
  article_count: number | null;
  tags: string[];
}

export interface KiwixStatus {
  kiwix_serve_available: boolean;
  kiwix_serve_running: boolean;
  kiwix_serve_port: number;
  kiwix_serve_url: string;
  zim_count: number;
  total_size_bytes: number;
}

// ─── Kiwix-serve process management ──────────────────────────────────────────

const KIWIX_PORT = parseInt(process.env.KIWIX_PORT || '8888', 10);
let kiwixProcess: ChildProcess | null = null;

export function isKiwixServeAvailable(): boolean {
  try {
    execSync('kiwix-serve --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function isKiwixServeRunning(): boolean {
  return kiwixProcess !== null && !kiwixProcess.killed;
}

export async function startKiwixServe(): Promise<{ success: boolean; error?: string }> {
  if (isKiwixServeRunning()) {
    return { success: true };
  }
  if (!isKiwixServeAvailable()) {
    return { success: false, error: 'kiwix-serve is not installed. Install it via the Tools module.' };
  }

  const zimDir = config.paths.kiwix;
  const zimFiles = scanZimFiles();

  if (zimFiles.length === 0) {
    return { success: false, error: 'No ZIM files found. Download content packs from the Library module.' };
  }

  try {
    const args = ['--port', String(KIWIX_PORT), '--library', ...zimFiles.map(f => f.file_path)];
    kiwixProcess = spawn('kiwix-serve', args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    kiwixProcess.on('exit', () => {
      kiwixProcess = null;
    });

    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (!isKiwixServeRunning()) {
      return { success: false, error: 'kiwix-serve exited immediately. Check ZIM files.' };
    }

    return { success: true };
  } catch (err: unknown) {
    kiwixProcess = null;
    return { success: false, error: err instanceof Error ? err.message : 'Failed to start kiwix-serve' };
  }
}

export function stopKiwixServe(): void {
  if (kiwixProcess && !kiwixProcess.killed) {
    kiwixProcess.kill('SIGTERM');
    kiwixProcess = null;
  }
}

export function getKiwixServeUrl(): string {
  return `http://127.0.0.1:${KIWIX_PORT}`;
}

// ─── ZIM file scanning ────────────────────────────────────────────────────────

export function scanZimFiles(): Array<{ file_path: string; name: string; size_bytes: number }> {
  const zimDir = config.paths.kiwix;
  if (!fs.existsSync(zimDir)) return [];

  const results: Array<{ file_path: string; name: string; size_bytes: number }> = [];

  function scan(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.zim')) {
        const stat = fs.statSync(fullPath);
        results.push({
          file_path: fullPath,
          name: entry.name,
          size_bytes: stat.size,
        });
      }
    }
  }

  scan(zimDir);
  return results;
}

// ─── Database operations ──────────────────────────────────────────────────────

export function listZimFiles(): ZimFileRecord[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, name, title, description, language, category,
           size_bytes, file_path, installed, installed_at,
           version, article_count, tags
    FROM kiwix_items
    ORDER BY category, title
  `).all() as Array<Record<string, unknown>>;

  return rows.map(row => ({
    ...row,
    installed: Boolean(row.installed),
    tags: JSON.parse(row.tags as string || '[]'),
  })) as ZimFileRecord[];
}

export function getZimFile(id: string): ZimFileRecord | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, name, title, description, language, category,
           size_bytes, file_path, installed, installed_at,
           version, article_count, tags
    FROM kiwix_items WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!row) return null;
  return {
    ...row,
    installed: Boolean(row.installed),
    tags: JSON.parse(row.tags as string || '[]'),
  } as ZimFileRecord;
}

export async function registerZimFile(filePath: string, metadata: {
  title?: string;
  description?: string;
  language?: string;
  category?: string;
  version?: string;
  article_count?: number;
  tags?: string[];
}): Promise<ZimFileRecord> {
  const db = getDb();
  const stat = fs.statSync(filePath);
  const name = path.basename(filePath);
  const id = crypto.randomUUID();

  const record: ZimFileRecord = {
    id,
    name,
    title: metadata.title || name.replace('.zim', '').replace(/_/g, ' '),
    description: metadata.description || null,
    language: metadata.language || 'en',
    category: metadata.category || inferCategory(name),
    size_bytes: stat.size,
    file_path: filePath,
    installed: true,
    installed_at: new Date().toISOString(),
    version: metadata.version || null,
    article_count: metadata.article_count || null,
    tags: metadata.tags || [],
  };

  db.prepare(`
    INSERT INTO kiwix_items
      (id, name, title, description, language, category, size_bytes,
       file_path, installed, installed_at, version, article_count, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      size_bytes = excluded.size_bytes,
      installed = 1,
      installed_at = excluded.installed_at
  `).run(
    record.id, record.name, record.title, record.description,
    record.language, record.category, record.size_bytes,
    record.file_path, record.version, record.article_count,
    JSON.stringify(record.tags)
  );

  return record;
}

export function removeZimFile(id: string, deleteFile = false): { success: boolean; error?: string } {
  const db = getDb();
  const record = getZimFile(id);
  if (!record) return { success: false, error: 'ZIM file not found' };

  if (deleteFile && fs.existsSync(record.file_path)) {
    try {
      fs.unlinkSync(record.file_path);
    } catch (err: unknown) {
      return { success: false, error: `Failed to delete file: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  db.prepare('DELETE FROM kiwix_items WHERE id = ?').run(id);

  // Restart kiwix-serve if it was running
  if (isKiwixServeRunning()) {
    stopKiwixServe();
    startKiwixServe().catch(() => {/* best-effort */});
  }

  return { success: true };
}

export async function syncZimDirectory(): Promise<{ added: number; removed: number }> {
  const db = getDb();
  const scanned = scanZimFiles();
  const existing = listZimFiles();

  const scannedPaths = new Set(scanned.map(f => f.file_path));
  const existingPaths = new Set(existing.map(f => f.file_path));

  let added = 0;
  let removed = 0;

  // Register newly discovered ZIM files
  for (const found of scanned) {
    if (!existingPaths.has(found.file_path)) {
      await registerZimFile(found.file_path, {});
      added++;
    }
  }

  // Mark removed files as not installed
  for (const known of existing) {
    if (known.installed && !scannedPaths.has(known.file_path)) {
      db.prepare(`UPDATE kiwix_items SET installed = 0 WHERE id = ?`).run(known.id);
      removed++;
    }
  }

  return { added, removed };
}

export async function getKiwixStatus(): Promise<KiwixStatus> {
  const installed = listZimFiles().filter(f => f.installed);
  const totalSize = installed.reduce((sum, f) => sum + f.size_bytes, 0);

  return {
    kiwix_serve_available: isKiwixServeAvailable(),
    kiwix_serve_running: isKiwixServeRunning(),
    kiwix_serve_port: KIWIX_PORT,
    kiwix_serve_url: getKiwixServeUrl(),
    zim_count: installed.length,
    total_size_bytes: totalSize,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('med') || lower.includes('health') || lower.includes('wikimed')) return 'medicine';
  if (lower.includes('survival') || lower.includes('emergency') || lower.includes('prep')) return 'survival';
  if (lower.includes('wikibooks')) return 'education';
  if (lower.includes('wikivoyage')) return 'travel';
  if (lower.includes('wikipedia')) return 'reference';
  if (lower.includes('ifixit') || lower.includes('repair')) return 'diy-repair';
  if (lower.includes('wikihow') || lower.includes('howto')) return 'howto';
  if (lower.includes('stackoverflow') || lower.includes('stackexchange')) return 'technical';
  if (lower.includes('wiktionary')) return 'language';
  return 'general';
}
