#!/usr/bin/env bash
# S.I.N.A Start Script
# Starts the backend server (which also serves the built frontend)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RESET='\033[0m'
BOLD='\033[1m'

is_wsl() {
  [[ -n "${WSL_DISTRO_NAME:-}" || -n "${WSL_INTEROP:-}" ]] && return 0
  grep -qi microsoft /proc/version 2>/dev/null
}

cd "$PROJECT_DIR"

# Load .env if it exists
if [[ -f ".env" ]]; then
  set -o allexport
  source .env
  set +o allexport
fi

BACKEND_PORT="${BACKEND_PORT:-3001}"
BIND_ADDRESS="${BIND_ADDRESS:-127.0.0.1}"
ACCESS_URL="http://${BIND_ADDRESS}:${BACKEND_PORT}"
LOCAL_URL="http://127.0.0.1:${BACKEND_PORT}"
PLATFORM_LABEL="Linux native"

if is_wsl; then
  PLATFORM_LABEL="Windows via WSL2"
fi

echo ""
echo -e "${BOLD}${BLUE}  S.I.N.A Command Center${RESET}"
echo -e "  Platform: ${BLUE}${PLATFORM_LABEL}${RESET}"
echo -e "  Bind address: ${BLUE}${BIND_ADDRESS}${RESET}"
echo -e "  Access URL: ${BLUE}${ACCESS_URL}${RESET}"

if is_wsl; then
  echo -e "  ${YELLOW}Tip:${RESET} Open ${BLUE}${LOCAL_URL}${RESET} from your Windows browser."
fi

if [[ "$BIND_ADDRESS" == "0.0.0.0" ]]; then
  echo -e "  ${YELLOW}LAN exposure enabled:${RESET} Use this machine's IP address from other devices on your network."
fi

echo ""

# Check if build exists, otherwise run dev mode
if [[ -d "app/backend/dist" ]]; then
  echo -e "  Mode: ${GREEN}production${RESET}"
  NODE_ENV=production node app/backend/dist/index.js
else
  echo -e "  Mode: development (no dist/ found — run bootstrap.sh to build)"
  npm run dev --workspace=app/backend
fi
