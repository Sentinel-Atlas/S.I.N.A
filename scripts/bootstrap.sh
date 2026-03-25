#!/usr/bin/env bash
# S.I.N.A Platform Initialization Script
# ─────────────────────────────────────────────────────────────────────────────
# This script initializes the platform. It does exactly one thing:
# get S.I.N.A running so the dashboard can do the rest.
#
# Usage: bash scripts/bootstrap.sh [--data-dir /path/to/data] [--with-ollama] [--with-docker]
#
# After this completes, open http://127.0.0.1:3001
# The Setup Wizard will guide you through AI, content, and map configuration.
# ─────────────────────────────────────────────────────────────────────────────
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
echo -e "  Survival Intelligence & Navigation Assistant${RESET}"
echo -e "  ${BLUE}Platform Initialization${RESET}"
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

is_wsl() {
  [[ -n "${WSL_DISTRO_NAME:-}" || -n "${WSL_INTEROP:-}" ]] && return 0
  grep -qi microsoft /proc/version 2>/dev/null
}

# ─── OS Check ────────────────────────────────────────────────────────────────
header "System Check"

if [[ "$(uname -s)" != "Linux" ]]; then
  error "S.I.N.A bootstrap is supported on Ubuntu/Debian Linux, or Windows via WSL2 Ubuntu."
fi

PLATFORM_MODE="linux"
if is_wsl; then
  PLATFORM_MODE="wsl2"
  log "Detected environment: Windows via WSL2"
else
  log "Detected environment: Linux native"
fi

if [[ "$(uname -m)" != "x86_64" ]]; then
  warn "Untested architecture: $(uname -m). x86_64 is the primary target."
fi

if command -v lsb_release &>/dev/null; then
  DISTRO=$(lsb_release -is)
  VERSION=$(lsb_release -rs)
  log "Detected distro: $DISTRO $VERSION"
  if [[ "$DISTRO" != "Ubuntu" && "$DISTRO" != "Debian" ]]; then
    warn "Official support targets Ubuntu/Debian. Proceeding anyway."
  fi
fi

if [[ "$PLATFORM_MODE" == "wsl2" ]]; then
  if [[ "$(pwd)" == /mnt/* ]]; then
    warn "Repo is on a Windows-mounted path ($(pwd))."
    warn "For better performance, keep the repo and SINA_DATA_DIR inside the WSL Linux filesystem (e.g. ~/s.i.n.a)."
  fi
  warn "WSL2 note: Docker Desktop integration and Ollama-on-WSL may require extra setup."
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
  warn "Ollama not found — AI features require it."
  warn "You can install and configure Ollama from the S.I.N.A dashboard after first launch."
  warn "Or install now: bash scripts/bootstrap.sh --with-ollama"
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
  warn "Docker not found — required for the offline map tile server."
  warn "You can install Docker from the Tools module inside the dashboard."
  warn "Or install now: bash scripts/bootstrap.sh --with-docker"
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
mkdir -p "$DATA_DIR"/{config,db,logs,cache,downloads,imports,processed,indexes,models,maps,kiwix}
mkdir -p "$DATA_DIR"/knowledge/{medical,survival,repair,wikipedia,technical,web-archives,personal}
mkdir -p "$DATA_DIR"/{vault,tools,backups}
success "Data directories created at $DATA_DIR"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}  S.I.N.A platform initialized.${RESET}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  Data directory:  ${BLUE}$DATA_DIR${RESET}"
echo ""
echo -e "${BOLD}  Terminal work is done. Start the server and open the dashboard:${RESET}"
echo ""
echo -e "    ${YELLOW}bash scripts/start.sh${RESET}"
echo ""
if [[ "$PLATFORM_MODE" == "wsl2" ]]; then
  echo -e "  Then open from Windows or WSL browser: ${BLUE}http://127.0.0.1:3001${RESET}"
else
  echo -e "  Then open: ${BLUE}http://127.0.0.1:3001${RESET}"
fi
echo ""
echo -e "  The ${BOLD}Setup Wizard${RESET} will launch on first visit and guide you through:"
echo -e "    • Installing AI models (no terminal required)"
echo -e "    • Downloading knowledge packs (Wikipedia, medical, survival)"
echo -e "    • Configuring offline maps"
echo -e "    • Setting up watched import folders"
echo -e "    • Configuring network exposure"
echo ""
echo -e "  ${BLUE}Everything else is managed from inside the dashboard.${RESET}"
echo ""
