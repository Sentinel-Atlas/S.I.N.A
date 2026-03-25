#!/usr/bin/env bash
# S.I.N.A Start Script
# Starts the backend server (which also serves the built frontend)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RESET='\033[0m'
BOLD='\033[1m'

cd "$PROJECT_DIR"

# Load .env if it exists
if [[ -f ".env" ]]; then
  set -o allexport
  source .env
  set +o allexport
fi

BACKEND_PORT="${BACKEND_PORT:-3001}"
BIND_ADDRESS="${BIND_ADDRESS:-127.0.0.1}"

echo ""
echo -e "${BOLD}${BLUE}  S.I.N.A Command Center${RESET}"
echo -e "  Starting backend on ${BLUE}http://${BIND_ADDRESS}:${BACKEND_PORT}${RESET}"
echo ""

# Check if build exists, otherwise run dev mode
if [[ -d "app/backend/dist" ]]; then
  echo -e "  Mode: ${GREEN}production${RESET}"
  NODE_ENV=production node app/backend/dist/index.js
else
  echo -e "  Mode: development (no dist/ found — run bootstrap.sh to build)"
  npm run dev --workspace=app/backend
fi
