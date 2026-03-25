import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import { getDb, getSetting } from '../db';
import { isSupportedFileType } from './documentParser';
import { indexContentItem } from './indexer';
import { config } from '../config';
import type { ContentCategory, ImportStatus } from '@sina/shared';

let watchers: chokidar.FSWatcher[] = [];

export function startWatchers(): void {
  stopWatchers();

  const watchDirsRaw = getSetting('import_watch_dirs');
  const watchDirs: string[] = watchDirsRaw
    ? JSON.parse(watchDirsRaw)
    : [config.paths.imports];

  for (const dir of watchDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const watcher = chokidar.watch(dir, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
      ignored: /(^|[/\\])\../, // ignore dotfiles
    });

    watcher.on('add', (filePath) => handleNewFile(filePath));
    watchers.push(watcher);
    console.log(`[FileWatcher] Watching: ${dir}`);
  }
}

export function stopWatchers(): void {
  for (const w of watchers) w.close();
  watchers = [];
}

function detectCategory(filePath: string): ContentCategory {
  const lower = filePath.toLowerCase();
  if (lower.includes('medical') || lower.includes('health')) return 'medical';
  if (lower.includes('survival') || lower.includes('emergency')) return 'survival';
  if (lower.includes('repair') || lower.includes('maintenance')) return 'repair';
  if (lower.includes('wikipedia') || lower.includes('wiki')) return 'wikipedia';
  if (lower.includes('radio') || lower.includes('comms') || lower.includes('ham')) return 'radio-comms';
  if (lower.includes('power') || lower.includes('solar') || lower.includes('grid')) return 'power-offgrid';
  if (lower.includes('food') || lower.includes('water') || lower.includes('garden')) return 'food-water';
  if (lower.includes('technical') || lower.includes('tech')) return 'technical';
  if (lower.includes('personal') || lower.includes('private')) return 'personal';
  return 'uncategorized';
}

async function handleNewFile(filePath: string): Promise<void> {
  const db = getDb();

  // Skip if already registered
  const existing = db.prepare('SELECT id FROM content_items WHERE file_path = ?').get(filePath);
  const existingImport = db.prepare('SELECT id FROM import_jobs WHERE file_path = ?').get(filePath);
  if (existing || existingImport) return;

  const fileName = path.basename(filePath);
  const stat = fs.statSync(filePath);
  const mimeType = mime.lookup(filePath) || 'application/octet-stream';
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const supported = isSupportedFileType(filePath);

  console.log(`[FileWatcher] Detected: ${fileName} (${supported ? 'supported' : 'unsupported'})`);

  // Record import job
  const importId = uuidv4();
  const status: ImportStatus = supported ? 'importing' : 'unsupported';

  db.prepare(`
    INSERT INTO import_jobs (id, file_name, file_path, file_type, size_bytes, status, detected_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(importId, fileName, filePath, ext, stat.size, status);

  if (!supported) return;

  // Create content item and trigger indexing
  try {
    const contentId = uuidv4();
    const category = detectCategory(filePath);
    const destPath = path.join(config.paths.processed, category, fileName);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    // Copy to processed directory
    fs.copyFileSync(filePath, destPath);

    db.prepare(`
      INSERT INTO content_items (id, title, file_path, file_type, size_bytes, category, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(contentId, fileName, destPath, ext, stat.size, category);

    db.prepare(`
      UPDATE import_jobs SET status = 'queued', content_id = ? WHERE id = ?
    `).run(contentId, importId);

    // Index asynchronously
    indexContentItem(contentId, { generateEmbeddings: false })
      .then(() => {
        db.prepare("UPDATE import_jobs SET status = 'done', completed_at = datetime('now') WHERE id = ?").run(importId);
      })
      .catch((err: Error) => {
        db.prepare("UPDATE import_jobs SET status = 'failed', error = ? WHERE id = ?").run(err.message, importId);
      });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare("UPDATE import_jobs SET status = 'failed', error = ? WHERE id = ?").run(msg, importId);
  }
}

export function getWatchedDirs(): string[] {
  const raw = getSetting('import_watch_dirs');
  return raw ? JSON.parse(raw) : [config.paths.imports];
}
