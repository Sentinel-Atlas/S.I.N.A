# S.I.N.A — Personal Offline Command Center

A polished, offline-first personal command platform for Ubuntu/Debian Linux. Install once from GitHub, then use curated downloads and import flows to build a complete offline knowledge, AI, and map environment.

---

## What It Is

S.I.N.A is an **installable local application** — not an OS, not a cloud service, not a toy. It runs on your existing Ubuntu or Debian system and provides a unified command-center dashboard for:

- **Local AI chat** with RAG over your imported documents
- **Knowledge library** — PDFs, manuals, guides, web archives, Wikipedia
- **Offline maps** — Toronto, Ontario, Canada with custom markers
- **Personal vault** — notes, checklists, contacts, emergency guides
- **Download manager** — curated offline content catalog with resume and checksum support
- **Import pipeline** — drag-and-drop or watched folders auto-import and index files
- **Unified search** — keyword and semantic search across all content
- **Emergency packs** — structured survival, medical, power, comms references
- **System status** — storage, AI health, download queue, background jobs
- **Settings** — configure data paths, AI, indexing, network exposure

All features work fully offline after first setup.

---

## Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Ubuntu 22.04, Debian 12 | Ubuntu 24.04 |
| Arch | x86_64 | x86_64 |
| RAM | 4 GB | 8–16 GB |
| Storage | 20 GB | 512 GB SSD |
| Node.js | 20.x | 20.x LTS |
| Ollama | optional | required for AI |
| Docker | optional | recommended |

---

## Quick Install

```bash
# Clone the repository
git clone https://github.com/sentinel-atlas/s.i.n.a.git
cd s.i.n.a

# Bootstrap (installs Node.js, builds project, creates data directories)
bash scripts/bootstrap.sh

# Start
bash scripts/start.sh
```

Then open: **http://127.0.0.1:3001**

For AI features, install Ollama and pull a model:
```bash
# Install Ollama (or use --with-ollama flag in bootstrap)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull recommended models
ollama pull llama3.2
ollama pull nomic-embed-text
```

---

## Project Structure

```
/
├── app/
│   ├── frontend/        Next.js + React dashboard
│   ├── backend/         Node.js + Express API + orchestrator
│   └── shared/          TypeScript types shared between frontend/backend
├── registry/            Install catalog, model, map, and tool registries
├── scripts/             bootstrap.sh, start.sh, dev.sh, health-check.sh
├── docs/                Architecture, install guide, data layout
├── docker-compose.yml   Optional: Ollama, ChromaDB, TileServer
└── data/                Runtime data (gitignored, created on install)
```

---

## Development

```bash
# Install dependencies
npm install

# Start in dev mode (hot reload, frontend + backend)
bash scripts/dev.sh
# OR
npm run dev
```

Frontend runs on `:3000`, backend on `:3001`. The frontend proxies `/api/*` to the backend.

---

## Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | System overview, quick actions, storage, download status |
| **AI** | Local chat with RAG, personas, model management |
| **Library** | Knowledge base, collections, document indexing |
| **Maps** | Offline tile maps, custom markers, GeoJSON import |
| **Vault** | Notes, checklists, contacts, emergency guides |
| **Tools** | Utility launchers and tool management |
| **Downloads** | Install catalog, resumable downloads, checksum verification |
| **Import** | Drag-and-drop file ingestion, watched folders |
| **Search** | Unified keyword and semantic search |
| **Emergency** | Survival pack index and quick-access |
| **Status** | System health, resource monitoring, job logs |
| **Settings** | Data paths, AI config, network, indexing |

---

## Optional Supporting Services

```bash
# Start Ollama container (if not using native install)
docker compose --profile ai up -d

# Start offline map tile server
docker compose --profile maps up -d

# Start ChromaDB vector store (for large-scale semantic search)
docker compose --profile vector up -d
```

---

## Configuration

Copy `.env.example` to `.env` and adjust:

```bash
SINA_DATA_DIR=/opt/sina/data    # Where to store all data
BACKEND_PORT=3001               # API server port
BIND_ADDRESS=127.0.0.1          # Local-only by default
OLLAMA_HOST=http://127.0.0.1:11434
```

All settings can also be changed at runtime in the Settings module.

---

## Documentation

- [Install Guide](docs/INSTALL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data Layout](docs/DATA_LAYOUT.md)

---

## License

Personal use. See LICENSE.
