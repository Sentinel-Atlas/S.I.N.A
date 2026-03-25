# S.I.N.A — Survival Intelligence & Navigation Assistant

An offline-first personal command platform that is **Linux-first** and now supports **Windows through WSL2 Ubuntu**. Bootstrap once from the terminal, then manage normal setup and operations from the dashboard.

---

## Supported Platforms

### Supported now
- **Linux native (primary):** Ubuntu 22.04+ and Debian 12+
- **Windows (supported path):** Windows 10/11 with **WSL2 + Ubuntu** (run S.I.N.A inside WSL)

### Not yet fully supported
- **Native Windows without WSL2** (future/experimental path)
- **macOS**

S.I.N.A remains Linux-first in architecture and runtime assumptions. Windows support is intentionally added through the safer WSL2 path first.

---

## Core Product Rule

> **After `bash scripts/bootstrap.sh` completes, terminal work should be minimal.**
>
> Install AI models, maps, knowledge packs, and manage runtime/settings from the dashboard.

S.I.N.A is not a cloud service, not an operating system, and not cloud-dependent for core functionality.

---

## Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Ubuntu 22.04 / Debian 12 | Ubuntu 24.04 |
| Windows Path | WSL2 + Ubuntu | WSL2 + Ubuntu 24.04 |
| Arch | x86_64 | x86_64 |
| RAM | 4 GB | 8–16 GB |
| Storage | 20 GB free | 512 GB SSD |
| Node.js | 20.x | 20.x LTS |

---

## Quick Install (Linux Native)

```bash
git clone https://github.com/sentinel-atlas/s.i.n.a.git
cd s.i.n.a
bash scripts/bootstrap.sh
bash scripts/start.sh
```

Open: **http://127.0.0.1:3001**

---

## Quick Install (Windows via WSL2 Ubuntu)

1. Install WSL2 and Ubuntu (see full guide in [`docs/INSTALL.md`](docs/INSTALL.md)).
2. Open Ubuntu terminal in WSL2.
3. Clone and run S.I.N.A inside WSL2:

```bash
git clone https://github.com/sentinel-atlas/s.i.n.a.git
cd s.i.n.a
bash scripts/bootstrap.sh
bash scripts/start.sh
```

4. Open **http://127.0.0.1:3001** in your Windows browser.

> For performance, keep repo + data in WSL Linux filesystem (e.g. `~/s.i.n.a`, `~/.sina/data`) instead of `/mnt/c/...`.

---

## Bootstrap Options

```bash
# Custom data directory
bash scripts/bootstrap.sh --data-dir /mnt/ssd/sina-data

# Optional runtime installs
bash scripts/bootstrap.sh --with-ollama
bash scripts/bootstrap.sh --with-docker
```

Bootstrap performs only platform initialization:
1. Verifies runtime environment (Linux native or WSL2 Linux)
2. Installs/upgrades Node.js 20+
3. Installs system packages
4. Optionally installs Ollama and/or Docker
5. Creates `.env` from `.env.example`
6. Installs dependencies + builds backend/frontend
7. Creates `$SINA_DATA_DIR` directory layout

Then dashboard-first setup takes over.

---

## Dashboard-First Journey (Linux + WSL2)

1. Clone repo
2. Run bootstrap once
3. Start S.I.N.A
4. Open dashboard
5. Complete setup wizard and manage everything from the UI

No terminal-heavy model setup or manual map registration is required for normal operation.

---

## Networking

- Default bind: `127.0.0.1` (local-only)
- Optional LAN exposure can be enabled in **Settings → Network**
- In WSL2 mode, `scripts/start.sh` prints Windows-host browser guidance

---

## Service Notes

Systemd service setup is available for Linux-native deployments. For WSL2, interactive/session-based startup is recommended unless you have a custom WSL service strategy.

---

## Advanced / Recovery Commands

```bash
bash scripts/health-check.sh
bash scripts/dev.sh
git pull && npm install && npm run build
```

Optional services:

```bash
docker compose --profile maps up -d
docker compose --profile vector up -d
```

---

## Native Windows (Future Path)

`scripts/bootstrap.ps1` and `scripts/start.ps1` are placeholders only and currently point users to the supported WSL2 workflow. They do **not** indicate full native Windows support.

---

## Data Philosophy

All data stays local in `$SINA_DATA_DIR` (default `~/.sina/data`). Main metadata store:

```text
$SINA_DATA_DIR/db/sina.db
```

No cloud account requirement, no forced telemetry, and offline operation after initial asset download.

See [docs/DATA_LAYOUT.md](docs/DATA_LAYOUT.md).
