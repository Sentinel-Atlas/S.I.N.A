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
error()   { echo -e "${RED}[✗]${RESET} $*" >&2; exit 1; }
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
    --data-dir)    DATA_DIR="$2"; shift 2 ;;
    --with-ollama) INSTALL_OLLAMA=true; shift ;;
    --with-docker) INSTALL_DOCKER=true; shift ;;
    *) warn "Unknown argument: $1"; shift ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ─── WSL2 detection ──────────────────────────────────────────────────────────
header "Environment Check"

PLATFORM_MODE=linux
if grep -qi microsoft /proc/version 2>/dev/null; then
  PLATFORM_MODE=wsl2
  warn "WSL2 environment detected."
  # Check for Windows path (a common gotcha that causes permission and CRLF issues)
  if [[ "$PROJECT_DIR" == /mnt/* ]]; then
    echo ""
    echo -e "${RED}${BOLD}  ERROR: Running from a Windows filesystem mount (${PROJECT_DIR})${RESET}"
    echo -e "${RED}  This causes CRLF issues, slow I/O, and npm permission errors.${RESET}"
    echo ""
    echo -e "  Fix: Clone the repo to your WSL2 Linux home directory instead:"
    echo -e "    ${YELLOW}cd ~ && git clone <repo-url> && cd S.I.N.A${RESET}"
    echo ""
    exit 1
  fi
  success "WSL2 on Linux filesystem — OK"
fi

# ─── OS Check ─────────────────────────────────────────────────────────────────
if [[ "$(uname -s)" != "Linux" ]]; then
  error "S.I.N.A requires Linux (Ubuntu 22.04+ or Debian 12+). macOS/Windows not supported."
fi

if [[ "$(uname -m)" != "x86_64" ]]; then
  warn "Untested architecture: $(uname -m). x86_64 is the primary supported target."
fi

if command -v lsb_release &>/dev/null; then
  DISTRO=$(lsb_release -is)
  VERSION=$(lsb_release -rs)
  log "Detected distro: $DISTRO $VERSION"
  if [[ "$DISTRO" != "Ubuntu" && "$DISTRO" != "Debian" ]]; then
    warn "Unsupported distro: $DISTRO. Proceeding, but support is not guaranteed."
  fi
  warn "WSL2 note: Docker Desktop integration and Ollama-on-WSL may require extra setup."
fi

success "OS check passed"

# ─── Node.js ──────────────────────────────────────────────────────────────────
header "Node.js"

install_node=false
if command -v node &>/dev/null; then
  NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VER" -lt 20 ]]; then
    warn "Node.js v$NODE_VER found — v20+ required. Will upgrade."
    install_node=true
  else
    success "Node.js $(node --version) — OK"
  fi
else
  log "Node.js not found — will install."
  install_node=true
fi

if [[ "$install_node" == "true" ]]; then
  if ! command -v apt-get &>/dev/null; then
    error "apt-get not found. Install Node.js 20+ manually and re-run: https://nodejs.org"
  fi
  log "Installing Node.js 20 via NodeSource..."
  sudo apt-get update -qq
  sudo apt-get install -y curl gnupg ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  success "Node.js $(node --version) installed"
fi

# Verify npm is available
if ! command -v npm &>/dev/null; then
  error "npm not found after Node.js install. Something went wrong — try re-running bootstrap."
fi
success "npm $(npm --version) — OK"

# ─── System Dependencies ──────────────────────────────────────────────────────
header "System Dependencies"

PACKAGES=(curl git build-essential python3 python3-pip)

if command -v apt-get &>/dev/null; then
  log "Installing system packages: ${PACKAGES[*]}"
  sudo apt-get install -y "${PACKAGES[@]}" || warn "Some system packages failed to install — continuing"
  success "System packages OK"
else
  warn "apt-get not found — skipping system package install. Ensure build tools are available."
fi

# ─── Ollama (optional) ────────────────────────────────────────────────────────
header "Ollama (AI Runtime)"

if command -v ollama &>/dev/null; then
  success "Ollama $(ollama --version 2>/dev/null || echo '— version unknown') — found"
elif [[ "$INSTALL_OLLAMA" == "true" ]]; then
  log "Installing Ollama..."
  curl -fsSL https://ollama.ai/install.sh | sh
  success "Ollama installed"
else
  warn "Ollama not found — AI features will be unavailable until it is installed."
  warn "Install from the S.I.N.A dashboard after first launch, or run:"
  warn "  bash scripts/bootstrap.sh --with-ollama"
fi

# ─── Docker (optional) ────────────────────────────────────────────────────────
header "Docker (Optional — for tile server)"

if command -v docker &>/dev/null; then
  success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') — found"
elif [[ "$INSTALL_DOCKER" == "true" ]]; then
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  success "Docker installed. You may need to log out and back in to use it without sudo."
else
  warn "Docker not found — required only for the offline map tile server."
  warn "Install from the Tools module in the dashboard, or run:"
  warn "  bash scripts/bootstrap.sh --with-docker"
fi

# ─── Project Setup ────────────────────────────────────────────────────────────
header "Project Setup"

cd "$PROJECT_DIR"

if [[ ! -f ".env" ]]; then
  if [[ ! -f ".env.example" ]]; then
    error ".env.example not found. Is this a complete clone? Try: git status"
  fi
  log "Creating .env from .env.example..."
  cp .env.example .env
  # Append custom data dir if non-default
  if [[ "$DATA_DIR" != "$HOME/.sina/data" ]]; then
    echo "SINA_DATA_DIR=$DATA_DIR" >> .env
  fi
  success "Created .env (data dir: $DATA_DIR)"
else
  log ".env already exists — skipping (delete it to reset)"
fi

log "Installing npm dependencies..."
if ! npm install; then
  echo ""
  error "npm install failed. Check the output above for the root cause."
fi
success "Dependencies installed"

# ─── Build ────────────────────────────────────────────────────────────────────
header "Building"

log "Building backend (TypeScript → dist/)..."
if ! npm run build --workspace=app/backend; then
  echo ""
  echo -e "${RED}${BOLD}  Backend build failed.${RESET}"
  echo -e "${RED}  Check the TypeScript errors above.${RESET}"
  echo -e "${RED}  Common causes: missing types, import errors, tsconfig issues.${RESET}"
  exit 1
fi
success "Backend built"

log "Building frontend (Next.js → .next/)..."
if ! npm run build --workspace=app/frontend; then
  echo ""
  echo -e "${RED}${BOLD}  Frontend build failed.${RESET}"
  echo -e "${RED}  Check the Next.js build errors above.${RESET}"
  echo -e "${RED}  Common causes: missing modules, TypeScript errors, Next config issues.${RESET}"
  exit 1
fi
success "Frontend built"

# ─── Data Directories ─────────────────────────────────────────────────────────
header "Data Directories"

log "Creating data directories at: $DATA_DIR"
mkdir -p "$DATA_DIR"/{config,db,logs,cache,downloads,imports,processed,indexes,models,maps,kiwix}
mkdir -p "$DATA_DIR"/knowledge/{medical,survival,repair,wikipedia,technical,web-archives,personal}
mkdir -p "$DATA_DIR"/{vault,tools,backups}
success "Data directories created"

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
