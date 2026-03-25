import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { CREATE_TABLES, SCHEMA_VERSION } from './schema';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return _db;
}

export function initDb(): Database.Database {
  const dbPath = config.paths.dbFile;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('cache_size = -64000'); // 64MB cache

  // Apply schema
  db.exec(CREATE_TABLES);

  // Handle schema versioning
  const existing = db.prepare('SELECT version FROM schema_version ORDER BY rowid DESC LIMIT 1').get() as { version: number } | undefined;
  if (!existing) {
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
  }

  // Seed default settings if not present
  seedDefaultSettings(db);

  _db = db;
  return db;
}

function seedDefaultSettings(db: Database.Database): void {
  const defaults: Record<string, string> = {
    lan_exposed: 'false',
    bind_address: config.server.bindAddress,
    ollama_host: config.ai.ollamaHost,
    default_model: config.ai.defaultModel,
    embed_model: config.ai.embedModel,
    default_persona: 'researcher',
    max_concurrent_downloads: String(config.downloads.maxConcurrent),
    chunk_size: String(config.indexing.chunkSize),
    chunk_overlap: String(config.indexing.chunkOverlap),
    auto_reindex: 'true',
    storage_warn_threshold_pct: '85',
    tile_server_url: config.maps.tileServerUrl,
    theme: 'dark',
    import_watch_dirs: JSON.stringify([config.paths.imports]),
    data_dir: config.paths.dataDir,
  };

  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const insertMany = db.transaction((items: [string, string][]) => {
    for (const [k, v] of items) insert.run(k, v);
  });
  insertMany(Object.entries(defaults));
}

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export { Database };
