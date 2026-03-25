# S.I.N.A Install Guide

## Supported Platforms

- Ubuntu 22.04 LTS and newer
- Debian 12 (Bookworm) and newer
- Architecture: x86_64

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/sentinel-atlas/s.i.n.a.git
cd s.i.n.a
```

---

## Step 2: Run Bootstrap

The bootstrap script installs Node.js, builds the project, and creates data directories.

```bash
# Basic install (data stored in ~/.sina/data)
bash scripts/bootstrap.sh

# Custom data directory (external SSD, etc.)
bash scripts/bootstrap.sh --data-dir /mnt/ssd/sina-data

# Also install Ollama
bash scripts/bootstrap.sh --with-ollama

# Also install Docker
bash scripts/bootstrap.sh --with-docker
```

The bootstrap will:
1. Check OS and architecture
2. Install or upgrade Node.js 20+
3. Install system packages
4. Install Ollama (if --with-ollama)
5. Copy `.env.example` → `.env`
6. Run `npm install`
7. Build backend and frontend
8. Create data directory structure

---

## Step 3: Configure (Optional)

Edit `.env` to customize paths and ports:

```bash
SINA_DATA_DIR=/opt/sina/data   # Default: ~/.sina/data
BACKEND_PORT=3001
BIND_ADDRESS=127.0.0.1
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_DEFAULT_MODEL=llama3.2
OLLAMA_EMBED_MODEL=nomic-embed-text
```

---

## Step 4: Install AI Models

```bash
# If Ollama is not yet running:
ollama serve &

# Chat model (pick one based on available RAM)
ollama pull llama3.2        # 3B — 4GB RAM needed
ollama pull llama3.2:1b     # 1B — 2GB RAM needed
ollama pull mistral:7b      # 7B — 8GB RAM needed

# Embedding model (required for semantic search / RAG)
ollama pull nomic-embed-text
```

---

## Step 5: Start S.I.N.A

```bash
bash scripts/start.sh
```

Open your browser at: **http://127.0.0.1:3001**

---

## Step 6: First Use

1. The Dashboard shows system status and module overview
2. Go to **Downloads** to install content packs
3. Go to **Import** to drop in your own documents
4. Go to **AI** to start chatting — select a persona and model
5. Go to **Maps** to register your offline map files
6. Go to **Vault** to create notes and emergency guides

---

## Running as a Service (Systemd)

Create `/etc/systemd/system/sina.service`:

```ini
[Unit]
Description=S.I.N.A Command Center
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/path/to/s.i.n.a
EnvironmentFile=/path/to/s.i.n.a/.env
ExecStart=/usr/bin/node app/backend/dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable sina
sudo systemctl start sina
```

---

## Running with Docker Support

For optional services (offline maps, ChromaDB vector store):

```bash
# Maps (serves .mbtiles files from data/maps/)
docker compose --profile maps up -d

# Vector search (ChromaDB — for large knowledge bases)
docker compose --profile vector up -d

# All optional services
docker compose --profile ai --profile maps --profile vector up -d
```

---

## Updating

```bash
git pull
npm install
npm run build
bash scripts/start.sh
```

---

## Troubleshooting

**Backend won't start**
- Check `data/.gitkeep` directory exists
- Check `.env` has correct `SINA_DATA_DIR`
- Check Node.js is v20+: `node --version`

**AI not available**
- Check Ollama is running: `curl http://127.0.0.1:11434/api/tags`
- Pull a model: `ollama pull llama3.2`

**Maps not showing**
- Place `.mbtiles` files in `$SINA_DATA_DIR/maps/`
- Use the Maps → Regions → Scan button to register them
- Start the tile server: `docker compose --profile maps up -d`

**Slow indexing**
- Indexing is background — check the Import log
- Large PDFs may take time to parse
- Disable semantic embeddings in Settings for faster indexing
