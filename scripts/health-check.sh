#!/usr/bin/env bash
# S.I.N.A Health Check
set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-3001}"
BIND_ADDRESS="${BIND_ADDRESS:-127.0.0.1}"
BASE="http://${BIND_ADDRESS}:${BACKEND_PORT}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
RESET='\033[0m'

check() {
  local name="$1"
  local url="$2"
  if curl -sf "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}[✓]${RESET} $name"
    return 0
  else
    echo -e "${RED}[✗]${RESET} $name — not responding at $url"
    return 1
  fi
}

echo ""
echo "S.I.N.A Health Check"
echo "─────────────────────"

check "Backend API"      "$BASE/api/dashboard/health"
check "Dashboard Stats"  "$BASE/api/dashboard/stats"

# Check Ollama
OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
if curl -sf "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
  echo -e "${GREEN}[✓]${RESET} Ollama AI Runtime"
else
  echo -e "${YELLOW}[!]${RESET} Ollama — not running (AI features unavailable)"
fi

echo ""
