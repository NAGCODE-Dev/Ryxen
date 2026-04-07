#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FRONTEND_PORT="${RYXEN_FRONTEND_PORT:-${CROSSAPP_FRONTEND_PORT:-8000}}"
BACKEND_PORT="${RYXEN_BACKEND_PORT:-${CROSSAPP_BACKEND_PORT:-8787}}"
KEEP_STACK_UP="${RYXEN_VALIDATE_KEEP_UP:-${CROSSAPP_VALIDATE_KEEP_UP:-0}}"
FRONTEND_BASE_URL="http://127.0.0.1:${FRONTEND_PORT}"
API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}"

cleanup() {
  local exit_code=$?
  if [ "$KEEP_STACK_UP" != "1" ]; then
    echo "[validate:stack] derrubando stack Docker..."
    docker compose down >/dev/null 2>&1 || true
  else
    echo "[validate:stack] stack mantido ativo porque RYXEN_VALIDATE_KEEP_UP=1"
  fi
  exit "$exit_code"
}

trap cleanup EXIT

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-45}"

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[validate:stack] ${label} pronto em ${url}"
      return 0
    fi
    sleep 2
  done

  echo "[validate:stack] timeout aguardando ${label} em ${url}"
  return 1
}

echo "[validate:stack] subindo Docker..."
npm run docker:up

wait_for_url "${API_BASE_URL}/health" "backend health"
wait_for_url "${FRONTEND_BASE_URL}/health" "frontend health"

echo "[validate:stack] rodando smoke do backend..."
RYXEN_API_BASE_URL="${API_BASE_URL}" npm run smoke:auth

echo "[validate:stack] rodando e2e contra o frontend Docker..."
PLAYWRIGHT_BASE_URL="${FRONTEND_BASE_URL}" npm run test:e2e

echo "[validate:stack] validação completa."
