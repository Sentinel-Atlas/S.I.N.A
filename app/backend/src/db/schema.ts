// S.I.N.A SQLite Schema
// All DDL is defined here and applied via db/index.ts on startup.

export const SCHEMA_VERSION = 3;

export const CREATE_TABLES = `
-- ─── Schema Version ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Settings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ─── Downloads ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS download_jobs (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  url               TEXT NOT NULL,
  destination       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'queued',
  size_bytes        INTEGER NOT NULL DEFAULT 0,
  downloaded_bytes  INTEGER NOT NULL DEFAULT 0,
  progress          REAL NOT NULL DEFAULT 0,
  speed_bps         REAL NOT NULL DEFAULT 0,
  eta_seconds       REAL NOT NULL DEFAULT 0,
  checksum          TEXT,
  checksum_algo     TEXT,
  checksum_verified INTEGER,
  error             TEXT,
  catalog_item_id   TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Installed Catalog Items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS installed_items (
  id           TEXT PRIMARY KEY,
  catalog_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  type         TEXT NOT NULL,
  version      TEXT,
  install_path TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL DEFAULT 0,
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata     TEXT  -- JSON blob for item-specific data
);

-- ─── Content Items (Library) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_items (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  file_path     TEXT NOT NULL UNIQUE,
  file_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  category      TEXT NOT NULL DEFAULT 'uncategorized',
  tags          TEXT NOT NULL DEFAULT '[]',  -- JSON array
  source        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  error         TEXT,
  imported_at   TEXT NOT NULL DEFAULT (datetime('now')),
  indexed_at    TEXT,
  checksum      TEXT,
  collection_id TEXT,
  chunk_count   INTEGER DEFAULT 0,
  metadata      TEXT   -- JSON blob
);

-- ─── Content FTS ──────────────────────────────────────────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
  content_id UNINDEXED,
  title,
  body,
  category UNINDEXED,
  tokenize = 'porter unicode61'
);

-- ─── Content Chunks (for RAG) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_chunks (
  id           TEXT PRIMARY KEY,
  content_id   TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  text         TEXT NOT NULL,
  embedding    TEXT,   -- JSON array of floats
  token_count  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chunks_content_id ON content_chunks(content_id);

-- ─── Collections ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collections (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'uncategorized',
  color       TEXT,
  icon        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Import Jobs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_jobs (
  id           TEXT PRIMARY KEY,
  file_name    TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  file_type    TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'detected',
  error        TEXT,
  detected_at  TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  content_id   TEXT,
  category     TEXT
);

-- ─── Conversations (AI Chat) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  persona       TEXT NOT NULL DEFAULT 'researcher',
  model         TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  message_count INTEGER NOT NULL DEFAULT 0
);

-- ─── Chat Messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id             TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role           TEXT NOT NULL,
  content        TEXT NOT NULL,
  sources        TEXT,  -- JSON array of SourceReference
  persona        TEXT,
  model          TEXT,
  timestamp      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON chat_messages(conversation_id);

-- ─── Map Regions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS map_regions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  area        TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  installed   INTEGER NOT NULL DEFAULT 0,
  tile_format TEXT NOT NULL DEFAULT 'mbtiles',
  min_zoom    INTEGER NOT NULL DEFAULT 0,
  max_zoom    INTEGER NOT NULL DEFAULT 14,
  bounds      TEXT,   -- JSON [west, south, east, north]
  center      TEXT,   -- JSON [lon, lat, zoom]
  installed_at TEXT
);

-- ─── Map Markers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS map_markers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  color       TEXT,
  icon        TEXT,
  collection  TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Vault Items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_items (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL DEFAULT 'note',
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  tags       TEXT NOT NULL DEFAULT '[]',  -- JSON array
  pinned     INTEGER NOT NULL DEFAULT 0,
  category   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Vault FTS ────────────────────────────────────────────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS vault_fts USING fts5(
  vault_id UNINDEXED,
  title,
  content,
  tokenize = 'porter unicode61'
);
`;
