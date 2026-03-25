# S.I.N.A — Survival Intelligence & Navigation Assistant

An offline-first personal command platform for Ubuntu/Debian Linux. Bootstrap once from the terminal, then manage everything else from the dashboard.

---

## What S.I.N.A Is

S.I.N.A is an **installable local platform** — not a cloud service, not a live-boot OS, not a toy. It runs on your existing Ubuntu or Debian machine and gives you a unified command center for:

- **Local AI chat** — RAG over your indexed documents, multiple personas, full model management
- **Knowledge library** — PDFs, manuals, guides, web archives, Wikipedia (via Kiwix/ZIM)
- **Offline maps** — Regional tile packs with custom markers and emergency overlays
- **Personal vault** — Notes, checklists, contacts, emergency procedures
- **Download manager** — Tiered content catalog with resume, checksum, and auto-import
- **Import pipeline** — Drop files into a watched folder; auto-indexed and searchable
- **Unified search** — Keyword and semantic search across all content
- **Emergency packs** — Structured survival, medical, power, comms references with readiness scoring
- **System status** — Storage, AI health, module lifecycle, background job log
- **Settings** — Data paths, AI runtime, indexing, LAN exposure — all from the UI

All features work fully offline after initial setup.

---

## Core Product Rule

> **After `bash scripts/bootstrap.sh` completes, the terminal is done.**
>
> Installing AI models, registering maps, configuring content packs, managing downloads, and adjusting settings are all done from inside the S.I.N.A dashboard.

There is no `ollama pull`. No `docker compose --profile ... up -d` in the normal workflow. The dashboard owns the lifecycle of every managed component.

---

## Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Ubuntu 22.04, Debian 12 | Ubuntu 24.04 |
| Arch | x86_64 | x86_64 |
| RAM | 4 GB | 8–16 GB |
| Storage | 20 GB free | 512 GB SSD |
| Node.js | 20.x | 20.x LTS |
| Ollama | auto-installed | managed by dashboard |
| Docker | optional | recommended for tile server |

---

## Quick Install

```bash
git clone https://github.com/sentinel-atlas/s.i.n.a.git
cd s.i.n.a
bash scripts/bootstrap.sh
bash scripts/start.sh
```

Then open: **http://127.0.0.1:3001**

The setup wizard will guide you through the rest.

### Bootstrap options

```bash
# Custom data directory (external SSD, NAS mount, etc.)
bash scripts/bootstrap.sh --data-dir /mnt/ssd/sina-data

# Install Ollama during bootstrap (otherwise install from dashboard)
bash scripts/bootstrap.sh --with-ollama

# Install Docker during bootstrap (required for offline map tile server)
bash scripts/bootstrap.sh --with-docker
```

Bootstrap does exactly these steps, then stops:

1. Verifies OS and architecture
2. Installs or upgrades Node.js 20+
3. Installs required system packages
4. Optionally installs Ollama and/or Docker
5. Creates `.env` from `.env.example`
6. Runs `npm install` and builds backend + frontend
7. Creates the data directory structure under `$SINA_DATA_DIR`
8. Prints the launch URL and handoff message

---

## First Launch Experience

When you open S.I.N.A for the first time, the **Setup Wizard** runs automatically:

1. **Storage** — Confirm data directory, check available disk space
2. **AI Runtime** — Detect Ollama, install it if missing, check available RAM
3. **AI Models** — Browse and install recommended chat + embedding models with one click
4. **Knowledge Packs** — Choose content tiers (Essential / Standard / Comprehensive) for Wikipedia, medical references, survival guides
5. **Maps** — Select regional map packs to download and register
6. **Watched Folders** — Set up auto-import directories
7. **Network** — Configure LAN exposure (local-only by default)
8. **Done** — All modules show readiness status; go to Dashboard

You can skip any step and return to it later from Settings or the relevant module.

---

## Typical Setup Flow (No Terminal After Bootstrap)

```
bootstrap.sh           → Platform initialized
    │
    ▼
Dashboard opens        → Setup wizard detects first run
    │
    ▼
AI Setup               → Install Ollama + pull llama3.2 + nomic-embed-text
    │                    (from inside the dashboard, no terminal)
    ▼
Knowledge Packs        → Download Wikipedia mini (8.5 GB), medical refs, survival guides
    │
    ▼
Maps                   → Download Ontario / Toronto / Canada tile packs
    │
    ▼
Vault                  → Create emergency contacts, procedures, checklists
    │
    ▼
Import                 → Drop in personal documents; auto-indexed and searchable
    │
    ▼
AI Chat                → Chat with full RAG context over all indexed content
```

---

## Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | System health, module readiness, quick actions, storage, download status |
| **AI** | Local chat with RAG, personas, model management, install recommendations |
| **Library** | Knowledge base, collections, Kiwix/ZIM packs, document indexing |
| **Maps** | Offline tile maps, region pack manager, custom markers, emergency overlays |
| **Vault** | Notes, checklists, contacts, emergency guides |
| **Tools** | Managed utility integrations with installation and health checks |
| **Downloads** | Tiered install catalog, resumable downloads, checksum verification |
| **Import** | Drag-and-drop file ingestion, watched folder auto-import |
| **Search** | Unified keyword and semantic search across all content |
| **Emergency** | Survival pack index with readiness scoring and quick-access mode |
| **Status** | System health, resource monitoring, module lifecycle, job logs |
| **Settings** | Data paths, AI config, LAN exposure controls, indexing options |

---

## Data Philosophy

All data lives in `$SINA_DATA_DIR` (default: `~/.sina/data`). The entire database is a single SQLite file:

```
$SINA_DATA_DIR/db/sina.db
```

This file contains all metadata, settings, vault items, conversations, AI embeddings, and import logs. Back it up and you can restore everything. No cloud sync. No accounts. No telemetry.

See [Data Layout](docs/DATA_LAYOUT.md) for the full directory structure.

---

## Offline-First

S.I.N.A is designed to operate with no internet connection after initial content download:

- AI inference runs locally via Ollama (no external API calls)
- Map tiles served from local `.mbtiles` / `.pmtiles` files
- Knowledge packs stored as local ZIM files (Kiwix-compatible)
- All search is local (SQLite FTS5 + cosine similarity on local embeddings)
- Settings changes, vault edits, and imports never leave the machine

---

## Networking

By default S.I.N.A binds to `127.0.0.1` — only accessible from the local machine.

To expose on your LAN (e.g. to access from a phone or tablet on the same network):

1. Go to **Settings → Network**
2. Toggle **LAN Exposure**
3. S.I.N.A will display your device IP and the access URL
4. One-click revert returns to localhost-only

The `.env` `BIND_ADDRESS` variable controls this. The dashboard manages it — no manual editing required.

---

## Running as a Service

To start S.I.N.A automatically on boot:

```bash
# Create systemd service
sudo tee /etc/systemd/system/sina.service > /dev/null <<EOF
[Unit]
Description=S.I.N.A Command Center
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
EnvironmentFile=$(pwd)/.env
ExecStart=/usr/bin/node app/backend/dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable sina
sudo systemctl start sina
```

---

## Advanced / Manual Operations

These are **not required** for normal use. They're here for recovery, debugging, or advanced deployments.

```bash
# Manually check service health
bash scripts/health-check.sh

# Start in development mode (hot reload)
bash scripts/dev.sh

# Rebuild after pulling updates
git pull && npm install && npm run build

# Start optional map tile server (if not using dashboard)
docker compose --profile maps up -d

# Start ChromaDB vector store (for large-scale semantic search)
docker compose --profile vector up -d

# Manually pull an AI model (if Ollama dashboard install fails)
ollama pull llama3.2

# SQLite backup
cp $SINA_DATA_DIR/db/sina.db ~/sina-backup-$(date +%Y%m%d).db
```

---

## Project Structure

```
/
├── app/
│   ├── frontend/        Next.js + React dashboard
│   ├── backend/         Node.js + Express API + services
│   └── shared/          TypeScript types shared across frontend/backend
├── registry/            Tiered content catalog, model registry, map registry
├── scripts/             bootstrap.sh, start.sh, dev.sh, health-check.sh
├── docs/                Architecture, install guide, data layout
├── docker-compose.yml   Optional: tile server, ChromaDB vector store
└── data/                Runtime data (gitignored, created by bootstrap)
```

---

## Documentation

- [Install Guide](docs/INSTALL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data Layout](docs/DATA_LAYOUT.md)

---

## License

Personal use. See LICENSE.
