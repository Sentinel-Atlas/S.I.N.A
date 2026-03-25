#!/usr/bin/env bash
# S.I.N.A Development Mode
# Runs frontend and backend with hot reload
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

if [[ -f ".env" ]]; then
  set -o allexport
  source .env
  set +o allexport
fi

echo ""
echo "  S.I.N.A — Development Mode"
echo "  Backend:  http://127.0.0.1:${BACKEND_PORT:-3001}"
echo "  Frontend: http://localhost:${FRONTEND_PORT:-3000}"
echo ""

NODE_ENV=development npm run dev
