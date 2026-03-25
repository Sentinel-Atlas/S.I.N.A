# S.I.N.A Data Layout

## Default Location

```
$HOME/.sina/data/
```

Override via:
- `SINA_DATA_DIR` environment variable in `.env`
- `--data-dir` flag in `scripts/bootstrap.sh`

---

## Directory Structure

```
$SINA_DATA_DIR/
│
├── config/                   App configuration overrides
├── db/
│   └── sina.db               SQLite database (all metadata, indexes, vault)
├── logs/                     Application logs
├── cache/                    Temporary files, thumbnail cache
│
├── downloads/                In-progress and completed downloads
│   ├── <uuid>/               Download staging area
│   └── ...
│
├── imports/                  Watched folder — drop files here to auto-import
│
├── processed/                Parsed + indexed files (organized by category)
│   ├── medical/
│   ├── survival/
│   ├── repair/
│   ├── wikipedia/
│   ├── technical/
│   ├── web-archives/
│   ├── personal/
│   └── uncategorized/
│
├── indexes/                  Vector index files (if using external vector DB)
│
├── models/                   Downloaded AI models (if not using Ollama native)
│   └── (Ollama manages its own ~/.ollama/ directory by default)
│
├── maps/                     Offline map tiles
│   ├── toronto.mbtiles       → Register via Maps → Scan
│   ├── ontario.mbtiles
│   ├── canada-overview.mbtiles
│   └── *.pmtiles             (PMTiles format also supported)
│
├── knowledge/                Organized knowledge base
│   ├── medical/
│   ├── survival/
│   ├── repair/
│   ├── wikipedia/
│   ├── technical/
│   ├── web-archives/
│   └── personal/
│
├── vault/                    Personal vault exports / backups
│
├── tools/                    Installed tool binaries and assets
│
└── backups/                  Database and config backups
```

---

## Database (sina.db)

All metadata lives in SQLite. The file is a single portable database.

**Key tables:**

| Table | Purpose |
|-------|---------|
| `content_items` | Registry of all imported/indexed documents |
| `content_fts` | Full-text search index (FTS5 virtual table) |
| `content_chunks` | Text chunks for RAG, with optional embeddings |
| `collections` | User-created document collections |
| `download_jobs` | Download queue and history |
| `installed_items` | Registry of catalog-installed content |
| `import_jobs` | File watcher import log |
| `conversations` | AI chat conversation records |
| `chat_messages` | Individual chat messages |
| `map_regions` | Registered offline map tile sets |
| `map_markers` | Custom map markers and emergency points |
| `vault_items` | Notes, checklists, contacts, guides |
| `vault_fts` | Full-text search index for vault |
| `settings` | Key-value app settings |

---

## Maps: Acquiring MBTiles Files

S.I.N.A uses `.mbtiles` files for offline maps. These must be obtained separately due to size and licensing.

### Option 1: Geofabrik + Tilemaker

```bash
# Download Ontario OSM data
wget https://download.geofabrik.de/north-america/canada/ontario-latest.osm.pbf

# Convert to MBTiles using tilemaker
# Install tilemaker: https://github.com/systemed/tilemaker
tilemaker --input ontario-latest.osm.pbf --output ontario.mbtiles

# Place in data/maps/
mv ontario.mbtiles $SINA_DATA_DIR/maps/ontario.mbtiles

# Start tile server
docker compose --profile maps up -d

# Register in S.I.N.A: Maps → Regions → Scan
```

### Option 2: OpenMapTiles Cloud (paid, one-time)

Download pre-built MBTiles from https://data.maptiler.com/

### Option 3: BBBike

Download regional extracts: https://extract.bbbike.org/

---

## Storage Planning (512 GB SSD)

| Content | Estimate |
|---------|---------|
| S.I.N.A application | ~500 MB |
| Ollama + llama3.2 (3B) | ~2 GB |
| nomic-embed-text | ~300 MB |
| Wikipedia (mini, text only) | ~9 GB |
| Toronto map tiles | ~800 MB |
| Ontario map tiles | ~5 GB |
| Canada overview tiles | ~2 GB |
| Personal documents | variable |
| **Total baseline** | **~20 GB** |
| **Remaining for content** | **~490 GB** |

---

## Backup

The only file you need to back up for a full restore is:

```
$SINA_DATA_DIR/db/sina.db
```

This contains all metadata, settings, vault items, conversations, and indexes.
Actual document files in `processed/` and `knowledge/` should also be backed up if you want full document restoration.

```bash
# Simple backup
cp $SINA_DATA_DIR/db/sina.db ~/sina-backup-$(date +%Y%m%d).db
```
