import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { config } from '../config';
import type { DownloadJob, DownloadStatus } from '@sina/shared';

export const downloadEvents = new EventEmitter();
downloadEvents.setMaxListeners(50);

const activeDownloads = new Map<string, AbortController>();

function dbRowToJob(row: Record<string, unknown>): DownloadJob {
  return {
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    destination: row.destination as string,
    status: row.status as DownloadStatus,
    size_bytes: row.size_bytes as number,
    downloaded_bytes: row.downloaded_bytes as number,
    progress: row.progress as number,
    speed_bps: row.speed_bps as number,
    eta_seconds: row.eta_seconds as number,
    checksum: row.checksum as string | undefined,
    checksum_algo: row.checksum_algo as 'sha256' | 'md5' | undefined,
    checksum_verified: row.checksum_verified != null ? Boolean(row.checksum_verified) : undefined,
    error: row.error as string | undefined,
    catalog_item_id: row.catalog_item_id as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function createDownloadJob(params: {
  name: string;
  url: string;
  destination?: string;
  checksum?: string;
  checksum_algo?: string;
  catalog_item_id?: string;
}): DownloadJob {
  const db = getDb();
  const id = uuidv4();
  const dest = params.destination || path.join(config.paths.downloads, id);

  db.prepare(`
    INSERT INTO download_jobs (id, name, url, destination, checksum, checksum_algo, catalog_item_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, params.name, params.url, dest, params.checksum ?? null, params.checksum_algo ?? null, params.catalog_item_id ?? null);

  const job = getDownloadJob(id)!;
  downloadEvents.emit('created', job);
  return job;
}

export function getDownloadJob(id: string): DownloadJob | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM download_jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? dbRowToJob(row) : null;
}

export function listDownloadJobs(status?: DownloadStatus): DownloadJob[] {
  const db = getDb();
  const rows = status
    ? db.prepare('SELECT * FROM download_jobs WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.prepare('SELECT * FROM download_jobs ORDER BY created_at DESC').all();
  return (rows as Record<string, unknown>[]).map(dbRowToJob);
}

export function updateDownloadJob(id: string, updates: Partial<DownloadJob>): void {
  const db = getDb();
  const fields = Object.keys(updates).filter(k => k !== 'id');
  if (!fields.length) return;
  const set = fields.map(f => `${f} = ?`).join(', ');
  const vals = fields.map(f => {
    const v = (updates as Record<string, unknown>)[f];
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v ?? null;
  });
  db.prepare(`UPDATE download_jobs SET ${set}, updated_at = datetime('now') WHERE id = ?`).run(...vals, id);
  const job = getDownloadJob(id);
  if (job) downloadEvents.emit('updated', job);
}

export async function startDownload(id: string): Promise<void> {
  const job = getDownloadJob(id);
  if (!job) throw new Error(`Download job ${id} not found`);
  if (job.status === 'downloading') return;

  // Check active download limit
  const activeCount = Array.from(activeDownloads.keys()).length;
  if (activeCount >= config.downloads.maxConcurrent) {
    updateDownloadJob(id, { status: 'queued' });
    return;
  }

  const controller = new AbortController();
  activeDownloads.set(id, controller);
  updateDownloadJob(id, { status: 'downloading', error: undefined });

  try {
    if (job.url.startsWith('ollama://')) {
      await _executeOllamaInstall(job);
    } else if (!job.url) {
      throw new Error('No download URL configured — this item requires manual installation.');
    } else {
      await _executeDownload(job, controller.signal);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateDownloadJob(id, { status: 'failed', error: msg });
  } finally {
    activeDownloads.delete(id);
    _processQueue();
  }
}

async function _executeOllamaInstall(job: DownloadJob): Promise<void> {
  // Parse: ollama://llama3.2:3b → "llama3.2:3b"
  const modelName = job.url.replace('ollama://', '');

  const { pullModel, checkOllamaAvailable } = await import('./ollamaAdapter');

  const available = await checkOllamaAvailable();
  if (!available) {
    throw new Error('Ollama is not running. Start Ollama first, then retry.');
  }

  await pullModel(modelName, (pct: number, status: string) => {
    updateDownloadJob(job.id, {
      progress: pct,
      downloaded_bytes: Math.round((pct / 100) * (job.size_bytes || 0)),
    });
    const updatedJob = getDownloadJob(job.id);
    if (updatedJob) downloadEvents.emit('updated', { ...updatedJob, _ollama_status: status });
  });

  updateDownloadJob(job.id, { status: 'completed', progress: 100 });

  // Register in installed_items so the catalog shows "Installed"
  const db = getDb();
  const installedId = uuidv4();
  db.prepare(`
    INSERT OR REPLACE INTO installed_items (id, catalog_id, name, category, type, install_path, size_bytes)
    VALUES (?, ?, ?, 'ai-models', 'ollama-model', ?, ?)
  `).run(installedId, job.catalog_item_id ?? modelName, modelName, modelName, job.size_bytes || 0);
}

async function _executeDownload(job: DownloadJob, signal: AbortSignal): Promise<void> {
  const dest = job.destination;
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // Resume support: check existing file size
  let resumeFrom = 0;
  if (fs.existsSync(dest)) {
    resumeFrom = fs.statSync(dest).size;
  }

  const headers: Record<string, string> = {};
  if (resumeFrom > 0) headers['Range'] = `bytes=${resumeFrom}-`;

  const res = await fetch(job.url, { headers, signal });
  if (!res.ok && res.status !== 206) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
  const totalSize = resumeFrom + contentLength;
  updateDownloadJob(job.id, { size_bytes: totalSize });

  const writer = fs.createWriteStream(dest, { flags: resumeFrom > 0 ? 'a' : 'w' });
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  let downloaded = resumeFrom;
  let lastUpdate = Date.now();
  let lastBytes = resumeFrom;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writer.write(value);
      downloaded += value.length;

      const now = Date.now();
      if (now - lastUpdate > 500) {
        const elapsed = (now - lastUpdate) / 1000;
        const bytesInInterval = downloaded - lastBytes;
        const speed = bytesInInterval / elapsed;
        const remaining = totalSize - downloaded;
        const eta = speed > 0 ? remaining / speed : 0;
        const progress = totalSize > 0 ? (downloaded / totalSize) * 100 : 0;
        updateDownloadJob(job.id, { downloaded_bytes: downloaded, progress, speed_bps: speed, eta_seconds: eta });
        lastUpdate = now;
        lastBytes = downloaded;
      }
    }
  } finally {
    writer.end();
    await new Promise<void>(r => writer.once('finish', () => r()));
  }

  // Verify checksum
  if (job.checksum && job.checksum_algo) {
    updateDownloadJob(job.id, { status: 'verifying' });
    const verified = await verifyChecksum(dest, job.checksum, job.checksum_algo as 'sha256' | 'md5');
    if (!verified) throw new Error('Checksum verification failed');
    updateDownloadJob(job.id, { checksum_verified: true });
  }

  updateDownloadJob(job.id, { status: 'completed', progress: 100, downloaded_bytes: downloaded });
}

async function verifyChecksum(filePath: string, expected: string, algo: 'sha256' | 'md5'): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algo);
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex') === expected.toLowerCase()));
    stream.on('error', reject);
  });
}

export function pauseDownload(id: string): void {
  const controller = activeDownloads.get(id);
  if (controller) {
    controller.abort();
    activeDownloads.delete(id);
    updateDownloadJob(id, { status: 'paused' });
  }
}

export function cancelDownload(id: string): void {
  pauseDownload(id);
  updateDownloadJob(id, { status: 'cancelled' });
  const job = getDownloadJob(id);
  if (job?.destination && fs.existsSync(job.destination)) {
    fs.unlinkSync(job.destination);
  }
}

function _processQueue(): void {
  const db = getDb();
  const queued = db.prepare("SELECT id FROM download_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1").get() as { id: string } | undefined;
  if (queued && activeDownloads.size < config.downloads.maxConcurrent) {
    startDownload(queued.id).catch(console.error);
  }
}
