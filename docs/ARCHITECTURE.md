# S.I.N.A Architecture

## Overview

S.I.N.A is a local-first application with a classic client-server architecture — all running on the user's own machine, never touching a cloud service.

```
Browser (localhost:3001)
       │
       ▼
┌──────────────────────────────┐
│    Next.js Frontend          │  React, Tailwind, TypeScript
│    (served by backend        │  App Router, client components
│     in production)           │  Leaflet for maps
└──────────────┬───────────────┘
               │ HTTP / SSE
               ▼
┌──────────────────────────────┐
│    Express Backend           │  Node.js, TypeScript
│    /api/*                    │  REST + Server-Sent Events
│                              │
│  ┌────────────────────────┐  │
│  │  Module Routes         │  │
│  │  dashboard / ai /      │  │
│  │  library / maps /      │  │
│  │  vault / search /      │  │
│  │  downloads / system /  │  │
│  │  kiwix / updates /     │  │
│  │  setup                 │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │  Services              │  │
│  │  downloadManager       │  │
│  │  fileWatcher (chokidar)│  │
│  │  indexer               │  │
│  │  searchService         │  │
│  │  ollamaAdapter         │  │
│  │  storageMonitor        │  │
│  │  documentParser        │  │
│  │  kiwixManager          │  │
│  │  updateManager         │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │  SQLite (better-sqlite3│  │
│  │  WAL mode, FTS5)       │  │
│  └────────────────────────┘  │
└──────────────┬───────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌─────────┐         ┌──────────┐
│ Ollama  │         │Filesystem│
│ :11434  │         │$SINA_DATA│
│ (native │         │/models   │
│  or     │         │/maps     │
│  docker)│         │/knowledge│
└─────────┘         │/vault    │
                    │/imports  │
                    │/kiwix    │
                    └──────────┘
        │
        ▼
  ┌───────────┐
  │ kiwix-    │
  │ serve     │
  │ :8888     │
  │ (optional)│
  └───────────┘
```

---

## Key Design Decisions

### Why Node.js backend?

- Language consistency with Next.js frontend
- Excellent native filesystem and process APIs
- `better-sqlite3` is the best SQLite binding for Node — synchronous, fast, zero-bloat
- Easier to maintain as a single-developer project

### Why SQLite?

- Zero-config, zero dependencies, single file
- WAL mode gives good concurrent read performance
- FTS5 provides full-text search without a separate search engine
- JSON columns store embeddings and metadata without schema rigidity
- Easy to backup and migrate

### Why not PostgreSQL / Redis?

- S.I.N.A must install and run without external databases
- SQLite handles the expected data volumes (10s of thousands of documents) efficiently
- Complexity budget: every added service makes offline deployment harder

### Why Ollama?

- Best user experience for local LLMs on Linux
- Single binary, broad model support, OpenAI-compatible API
- Handles model download, memory management, GPU acceleration
- S.I.N.A uses an adapter layer (`ollamaAdapter.ts`) so future runtime support is possible
- **AI models are installed from the S.I.N.A dashboard** — no `ollama pull` in the normal workflow

### Why Kiwix/ZIM for the knowledge library?

- ZIM is the leading format for large-scale offline reference content
- Wikipedia, medical references, survival guides, Stack Overflow — all available as ZIM files
- Tiered catalog (Essential/Standard/Comprehensive) lets users choose storage vs coverage tradeoff
- S.I.N.A manages ZIM files via `kiwixManager.ts` and serves them via `kiwix-serve` when available
- Content discovery and installation happens from the dashboard Library module

### Why Leaflet for maps?

- Mature, well-maintained, zero cloud dependency
- Works offline with local tile sources
- Easy integration with React via react-leaflet
- Compatible with MBTiles via a local tile server

### Why not Docker for everything?

- The spec explicitly requires native install as the primary path
- Docker is available as opt-in for supporting services (tile server, ChromaDB)
- Native install is simpler, faster, and more portable

### Dashboard-first design philosophy

After `bash scripts/bootstrap.sh && bash scripts/start.sh`, the terminal is done. The dashboard owns:

- AI model installation (via Ollama adapter — no `ollama pull`)
- Knowledge pack download and ZIM file registration
- Map tile registration and tile server management
- Module lifecycle (install → configure → running → degraded → repair)
- Update detection and management
- LAN exposure controls

---

## Data Flow

### Document Import + Indexing

```
User drops file
     │
     ▼
FileWatcher detects change
     │
     ▼
ImportJob created (status: detecting)
     │
     ▼
File type check
  ├─ Unsupported → ImportJob.status = 'unsupported'
  └─ Supported  →
        │
        ▼
     File copied to processed/
        │
        ▼
     ContentItem created (status: pending)
        │
        ▼
     documentParser.parseDocument()
     (PDF, DOCX, HTML, MD, TXT, CSV)
        │
        ▼
     chunkText() → array of text chunks
        │
        ▼
     content_fts INSERT (FTS5 index)
        │
        ▼
     content_chunks INSERT
     + optional embedding via Ollama
        │
        ▼
     ContentItem.status = 'indexed'
```

### AI Chat + RAG

```
User sends message
     │
     ▼
POST /api/ai/chat
     │
     ├─ Save user message to DB
     │
     ├─ getContextChunks(message)
     │     ├─ Try: Ollama embeddings → cosine similarity search
     │     └─ Fallback: SQLite FTS5 keyword search
     │
     ├─ Build system prompt (persona + context chunks)
     │
     ├─ chatStream(model, messages, systemPrompt)
     │     └─ Ollama /api/chat streaming
     │
     ├─ Stream tokens to client via SSE
     │
     └─ Save assistant message to DB
```

### Download Flow

```
User clicks Install (catalog item)
     │
     ▼
POST /api/downloads
     │
     ▼
DownloadJob created (status: queued)
     │
     ▼
startDownload()
  ├─ Check active download count vs limit
  ├─ Resume support: check existing file size → Range header
  ├─ fetch() with streaming body reader
  ├─ Write chunks to file
  ├─ Emit progress events (via EventEmitter)
  │     └─ SSE /api/downloads/events/stream → UI
  ├─ Checksum verification (sha256/md5)
  └─ DownloadJob.status = 'completed'
```

### Kiwix / ZIM Library Flow

```
User selects knowledge pack in Library
     │
     ▼
POST /api/downloads (catalog item type: kiwix-zim)
     │
     ▼
DownloadJob → file saved to $SINA_DATA/kiwix/
     │
     ▼
POST /api/kiwix/library/scan
     │
     ▼
kiwixManager.registerZimFile()
     │
     ▼
kiwix_items INSERT in SQLite
     │
     ▼
POST /api/kiwix/serve/start (if kiwix-serve available)
     │
     ▼
kiwix-serve process starts on :8888
     │
     ▼
ZIM files served at http://127.0.0.1:8888
```

### Setup Wizard Flow

```
First visit to dashboard
     │
     ▼
GET /api/setup/state → not completed
     │
     ▼
Redirect to /setup
     │
     ▼
GET /api/setup/probe → system state snapshot
(RAM, Ollama status, installed models, ZIM count)
     │
     ▼
Multi-step wizard:
  storage → ai-runtime → ai-models →
  knowledge-packs → maps → watched-folders →
  network → complete
     │
     ▼
Each step: PATCH /api/setup/state (step_id, status)
     │
     ▼
complete: redirect to /
```

---

## Module Boundaries

Each backend route file owns its own data access and is thin by design:

| Route | Responsibility |
|-------|----------------|
| `/api/dashboard` | Aggregate health + stats for home page |
| `/api/ai` | Ollama adapter, conversation CRUD, streaming chat, model pull |
| `/api/downloads` | Job queue, catalog, SSE progress feed |
| `/api/library` | Content items, collections, upload, reindex trigger |
| `/api/maps` | Regions, markers, GeoJSON import |
| `/api/vault` | CRUD for personal vault items + FTS sync |
| `/api/search` | Delegates to searchService (FTS + optional semantic) |
| `/api/system` | Settings, status, import job log |
| `/api/kiwix` | ZIM library CRUD, kiwix-serve lifecycle, tiered registry |
| `/api/updates` | Multi-component update check (models, ZIMs, registries) |
| `/api/setup` | Setup wizard state, system probe, step progression |

Services (`src/services/`) handle stateful, long-running, or complex logic:

| Service | Role |
|---------|------|
| `downloadManager` | Active downloads, resume, checksum, queue management |
| `fileWatcher` | chokidar watchers, auto-import detection |
| `indexer` | Parse → chunk → FTS + embeddings pipeline |
| `searchService` | FTS5 query + optional semantic similarity |
| `ollamaAdapter` | All Ollama HTTP calls (chat, embed, models, pull with SSE) |
| `documentParser` | PDF/DOCX/HTML/MD/TXT/CSV parsing |
| `storageMonitor` | Disk usage stats per data directory |
| `kiwixManager` | ZIM file scan/register, kiwix-serve process lifecycle |
| `updateManager` | Multi-component staleness and update detection |

---

## Extensibility

### Adding a new file parser
Add a case to `documentParser.ts` `parseDocument()` and update `isSupportedFileType()`.

### Adding a new AI runtime
Implement the same interface as `ollamaAdapter.ts` (checkAvailable, listModels, chatStream, generateEmbedding, pullModel) and swap it in via config or adapter factory.

### Adding a new map format
The `MapRegion` table has a `tile_format` field. Extend the Leaflet tile layer logic in `LeafletMap.tsx` to handle PMTiles or XYZ directories.

### Adding a new vault item type
Add the type to the `VaultItemType` union in `shared/src/index.ts` and update the frontend type icons/handling.

### Adding a new knowledge pack category
Add an entry to `registry/kiwix-categories.json` with `id`, `name`, `description`, and `tiers` array. The Library module reads this registry to populate the content selection UI.

### Adding a new setup wizard step
Add a step to `DEFAULT_STEPS` in `routes/setup.ts` and add a corresponding `StepComponent` in `app/setup/page.tsx`.
