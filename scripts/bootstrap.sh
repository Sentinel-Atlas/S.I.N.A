#!/usr/bin/env bash
# S.I.N.A Bootstrap Script
# Installs system dependencies and sets up the project on Ubuntu/Debian Linux
# Usage: bash scripts/bootstrap.sh [--data-dir /path/to/data]
set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

log()     { echo -e "${BLUE}[S.I.N.A]${RESET} $*"; }
success() { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
error()   { echo -e "${RED}[✗]${RESET} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${BLUE}━━━ $* ━━━${RESET}"; }

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${BLUE}"
echo "  ███████╗██╗███╗   ██╗ █████╗ "
echo "  ██╔════╝██║████╗  ██║██╔══██╗"
echo "  ███████╗██║██╔██╗ ██║███████║"
echo "  ╚════██║██║██║╚██╗██║██╔══██║"
echo "  ███████║██║██║ ╚████║██║  ██║"
echo "  ╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝"
echo ""
echo -e "  Personal Offline Command Center${RESET}"
echo -e "  ${BLUE}Bootstrap v0.1.0${RESET}"
echo ""

# ─── Parse args ───────────────────────────────────────────────────────────────
DATA_DIR="${SINA_DATA_DIR:-$HOME/.sina/data}"
INSTALL_OLLAMA=false
INSTALL_DOCKER=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --data-dir)   DATA_DIR="$2"; shift 2 ;;
    --with-ollama) INSTALL_OLLAMA=true; shift ;;
    --with-docker) INSTALL_DOCKER=true; shift ;;
    *) warn "Unknown argument: $1"; shift ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ─── OS Check ────────────────────────────────────────────────────────────────
header "System Check"

if [[ "$(uname -s)" != "Linux" ]]; then
  error "S.I.N.A requires Linux (Ubuntu 22.04+ or Debian 12+)"
fi

if [[ "$(uname -m)" != "x86_64" ]]; then
  warn "Untested architecture: $(uname -m). x86_64 is the primary target."
fi

if command -v lsb_release &>/dev/null; then
  DISTRO=$(lsb_release -is)
  VERSION=$(lsb_release -rs)
  log "Detected: $DISTRO $VERSION"
  if [[ "$DISTRO" != "Ubuntu" && "$DISTRO" != "Debian" ]]; then
    warn "Unsupported distro: $DISTRO. Proceeding anyway."
  fi
fi
success "OS check passed"

# ─── Node.js ─────────────────────────────────────────────────────────────────
header "Node.js"

if command -v node &>/dev/null; then
  NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VER" -lt 20 ]]; then
    warn "Node.js $NODE_VER found. v20+ required. Upgrading..."
    install_node=true
  else
    success "Node.js $(node --version) — OK"
    install_node=false
  fi
else
  install_node=true
fi

if [[ "$install_node" == "true" ]]; then
  log "Installing Node.js 20..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y curl gnupg
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    success "Node.js $(node --version) installed"
  else
    error "apt not found. Please install Node.js 20+ manually: https://nodejs.org"
  fi
fi

# ─── System Dependencies ──────────────────────────────────────────────────────
header "System Dependencies"

PACKAGES=(curl git build-essential python3 python3-pip)

if command -v apt-get &>/dev/null; then
  log "Installing system packages: ${PACKAGES[*]}"
  sudo apt-get install -y "${PACKAGES[@]}" 2>/dev/null || warn "Some packages may have failed — continuing"
  success "System packages OK"
fi

# ─── Ollama (optional) ───────────────────────────────────────────────────────
header "Ollama (AI Runtime)"

if command -v ollama &>/dev/null; then
  success "Ollama $(ollama --version 2>/dev/null || echo 'installed') — found"
elif [[ "$INSTALL_OLLAMA" == "true" ]]; then
  log "Installing Ollama..."
  curl -fsSL https://ollama.ai/install.sh | sh
  success "Ollama installed"
else
  warn "Ollama not found. AI features will be unavailable until installed."
  warn "Install manually: curl -fsSL https://ollama.ai/install.sh | sh"
  warn "Or re-run: bash scripts/bootstrap.sh --with-ollama"
fi

# ─── Docker (optional) ───────────────────────────────────────────────────────
header "Docker (Supporting Services)"

if command -v docker &>/dev/null; then
  success "Docker $(docker --version | cut -d' ' -f3) — found"
elif [[ "$INSTALL_DOCKER" == "true" ]]; then
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  success "Docker installed. Log out and back in to use without sudo."
else
  warn "Docker not found. Optional supporting services (tile server, ChromaDB) will not be available."
  warn "Install manually: curl -fsSL https://get.docker.com | sh"
fi

# ─── Project Dependencies ─────────────────────────────────────────────────────
header "Project Setup"

cd "$PROJECT_DIR"

if [[ ! -f ".env" ]]; then
  log "Creating .env from .env.example..."
  cp .env.example .env
  echo "SINA_DATA_DIR=$DATA_DIR" >> .env
  success "Created .env"
else
  log ".env already exists — skipping"
fi

log "Installing npm dependencies..."
npm install --workspace=app/backend --workspace=app/frontend --workspace=app/shared 2>&1 | tail -5
success "Dependencies installed"

# ─── Build ────────────────────────────────────────────────────────────────────
header "Building"
log "Building frontend..."
npm run build --workspace=app/frontend 2>&1 | tail -5
success "Frontend built"

log "Building backend..."
npm run build --workspace=app/backend 2>&1 | tail -5
success "Backend built"

# ─── Data Directory ───────────────────────────────────────────────────────────
header "Data Directories"

log "Creating data directories at: $DATA_DIR"
mkdir -p "$DATA_DIR"/{config,db,logs,cache,downloads,imports,processed,indexes,models,maps}
mkdir -p "$DATA_DIR"/knowledge/{medical,survival,repair,wikipedia,technical,web-archives,personal}
mkdir -p "$DATA_DIR"/{vault,tools,backups}
success "Data directories created at $DATA_DIR"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}  S.I.N.A installed successfully!${RESET}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  Data directory:  ${BLUE}$DATA_DIR${RESET}"
echo -e "  Start server:    ${BLUE}bash scripts/start.sh${RESET}"
echo -e "  Dashboard:       ${BLUE}http://127.0.0.1:3001${RESET}"
echo ""
echo -e "  Next steps:"
echo -e "    1. Start S.I.N.A:        ${YELLOW}bash scripts/start.sh${RESET}"
echo -e "    2. Install AI model:      ${YELLOW}ollama pull llama3.2${RESET}"
echo -e "    3. Pull embedding model:  ${YELLOW}ollama pull nomic-embed-text${RESET}"
echo -e "    4. Import documents via the Library or Import modules"
echo -e "    5. See docs/INSTALL.md for full guide"
echo ""
