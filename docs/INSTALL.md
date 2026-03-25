# S.I.N.A Install Guide

## Supported Platforms

- Ubuntu 22.04 LTS and newer
- Debian 12 (Bookworm) and newer
- Architecture: x86_64

---

## The Core Rule

> **Terminal work ends after `bash scripts/start.sh`.**
>
> Everything else — AI model installation, knowledge pack downloads, map configuration,
> vault setup, and settings — is done from the **S.I.N.A dashboard**.

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/sentinel-atlas/s.i.n.a.git
cd s.i.n.a
```

---

## Step 2: Run Bootstrap

The bootstrap script initializes the platform. It installs Node.js, builds the project, and creates data directories. It does **not** pull AI models or configure content — the dashboard does that.

```bash
# Basic install (data stored in ~/.sina/data)
bash scripts/bootstrap.sh

# Custom data directory (external SSD, NAS mount, etc.)
bash scripts/bootstrap.sh --data-dir /mnt/ssd/sina-data

# Also install Ollama during bootstrap (optional — can also install from dashboard)
bash scripts/bootstrap.sh --with-ollama

# Also install Docker (required for offline map tile server)
bash scripts/bootstrap.sh --with-docker
```

Bootstrap does exactly these steps:

1. Verify OS and architecture (Ubuntu 22.04+ or Debian 12+, x86_64)
2. Install or upgrade Node.js 20+
3. Install system packages
4. Optionally install Ollama and/or Docker
5. Copy `.env.example` → `.env`
6. Run `npm install`
7. Build backend and frontend
8. Create the full data directory structure

---

## Step 3: Start S.I.N.A

```bash
bash scripts/start.sh
```

Open your browser at: **http://127.0.0.1:3001**

**The Setup Wizard launches automatically on first visit.**

---

## Step 4: Complete Setup in the Dashboard

The Setup Wizard guides you through:

1. **Storage** — Confirm data directory and available disk space
2. **AI Runtime** — Detect Ollama, install it if missing
3. **AI Models** — Install recommended chat and embedding models (no `ollama pull`)
4. **Knowledge Packs** — Choose content tiers for Wikipedia, medical, and survival references
5. **Maps** — Select regional map packs to download
6. **Watched Folders** — Configure auto-import directories
7. **Network** — Set LAN exposure defaults
8. **Complete** — All modules show readiness status

Each step can be skipped and revisited from Settings later.

---

## Configuration (Optional)

If you need to change defaults before first run, edit `.env`:

```bash
SINA_DATA_DIR=/opt/sina/data   # Default: ~/.sina/data
BACKEND_PORT=3001
BIND_ADDRESS=127.0.0.1
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_DEFAULT_MODEL=llama3.2
OLLAMA_EMBED_MODEL=nomic-embed-text
```

All of these settings can also be changed at runtime in **Settings** inside the dashboard.

---

## Running as a Service (Systemd)

To start S.I.N.A automatically on boot:

```bash
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

## Running with Docker (Optional Services)

Docker is used only for optional supporting services. Start them from the **Tools** module or manually:

```bash
# Offline map tile server (serves .mbtiles from data/maps/)
docker compose --profile maps up -d

# ChromaDB vector store (for large-scale semantic search)
docker compose --profile vector up -d
```

These are not required for core functionality.

---

## Updating

```bash
git pull
npm install
npm run build
bash scripts/start.sh
```

Or use the **Updates** section in the dashboard to check for available updates.

---

## Troubleshooting

**Setup wizard doesn't appear**
- It appears automatically on first visit. If it doesn't, go to **Settings → Setup** and click Reset Wizard.

**Backend won't start**
- Check Node.js version: `node --version` (must be v20+)
- Check `.env` exists and `SINA_DATA_DIR` is writable

**AI not available**
- Go to the **AI** module — the readiness banner shows what's missing
- Or check: `curl http://127.0.0.1:11434/api/tags`

**Maps not showing**
- Place `.mbtiles` files in `$SINA_DATA_DIR/maps/`
- Use Maps → Regions → Scan to register them
- Start tile server: `docker compose --profile maps up -d`

**Slow indexing**
- Indexing runs in the background — check the Import log
- Large PDFs take time to parse
- Disable semantic embeddings in Settings → Indexing for faster throughput

**Knowledge packs not loading**
- Check the Library → Knowledge Packs tab
- ZIM files must be in `$SINA_DATA_DIR/kiwix/`
- Use Library → Scan to register discovered files
