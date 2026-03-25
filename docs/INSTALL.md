# S.I.N.A Install Guide

This guide documents installation in the supported order:
1. Linux native (primary)
2. Windows via WSL2 Ubuntu (supported)
3. Native Windows (future/experimental)

S.I.N.A remains **offline-first** and **dashboard-first** after bootstrap.

---

## Platform Support Matrix

### Supported now
- Ubuntu 22.04+ (native)
- Debian 12+ (native)
- Windows 10/11 **via WSL2 + Ubuntu**

### Not yet fully supported
- Native Windows without WSL2
- macOS

---

## Core Rule

> Run bootstrap + start once from terminal, then complete setup in the dashboard.

Normal users should not need terminal-heavy post-install commands for models/maps/content.

---

## A) Linux Native Install (Primary)

### 1) Clone

```bash
git clone https://github.com/sentinel-atlas/s.i.n.a.git
cd s.i.n.a
```

### 2) Bootstrap

```bash
bash scripts/bootstrap.sh
```

Optional flags:

```bash
bash scripts/bootstrap.sh --data-dir /mnt/ssd/sina-data
bash scripts/bootstrap.sh --with-ollama
bash scripts/bootstrap.sh --with-docker
```

### 3) Start

```bash
bash scripts/start.sh
```

Open: **http://127.0.0.1:3001**

### 4) Finish setup in dashboard

Setup Wizard handles storage checks, AI runtime/models, knowledge packs, maps, import watchers, and network defaults.

---

## B) Windows Install via WSL2 Ubuntu (Supported)

### 1) Windows prerequisites

- Windows 10 or 11 with virtualization enabled
- WSL2 installed
- Ubuntu distro installed in WSL (Ubuntu 22.04+ recommended)

Install/upgrade WSL from PowerShell (Admin):

```powershell
wsl --install
wsl --set-default-version 2
```

Then install Ubuntu from Microsoft Store (or `wsl --install -d Ubuntu`).

### 2) Open Ubuntu (WSL2) terminal

All S.I.N.A commands run inside WSL terminal, not PowerShell/CMD.

### 3) Clone and install inside WSL filesystem

```bash
cd ~
git clone https://github.com/sentinel-atlas/s.i.n.a.git
cd s.i.n.a
bash scripts/bootstrap.sh
bash scripts/start.sh
```

Open from Windows browser: **http://127.0.0.1:3001**

### 4) Data/storage guidance for WSL

- Prefer Linux-side paths (`~/...`, `~/.sina/data`) for repo and `SINA_DATA_DIR`.
- Avoid `/mnt/c/...` for active project/data to reduce file-watch and I/O overhead.
- External SSDs can be used if mounted in WSL and writable by your Linux user.

### 5) WSL caveats

- Docker features depend on Docker Desktop WSL integration or Docker-in-WSL setup.
- Ollama may run either in WSL2 or Windows host; ensure `OLLAMA_HOST` points to reachable endpoint.
- If file watching is slow, move repository and watched imports to WSL-native filesystem.
- LAN exposure still works, but access may depend on Windows firewall/network profile.

---

## C) Native Windows Without WSL2 (Future / Experimental)

Current PowerShell scripts are placeholders:
- `scripts/bootstrap.ps1`
- `scripts/start.ps1`

These do not provide production native support yet. Use WSL2 path today.

---

## Optional Configuration

Edit `.env` (or use dashboard settings):

```bash
SINA_DATA_DIR=~/.sina/data
BACKEND_PORT=3001
BIND_ADDRESS=127.0.0.1
OLLAMA_HOST=http://127.0.0.1:11434
```

---

## Linux Service Setup (Optional)

For Linux-native installs you can configure systemd for startup-on-boot. This is optional and not required for WSL usage.

---

## Troubleshooting

### App does not open
- Confirm start script is running: `bash scripts/start.sh`
- Confirm backend port in `.env` and terminal output

### AI unavailable
- Check AI page in dashboard
- Verify Ollama endpoint: `curl http://127.0.0.1:11434/api/tags`

### WSL browser access fails
- Try opening `http://127.0.0.1:3001` directly in Windows browser
- Confirm no local firewall/security tool is blocking localhost forwarding

### Slow imports on WSL
- Move repo + watched folders from `/mnt/c/...` to WSL Linux filesystem

