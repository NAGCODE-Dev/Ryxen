#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT_DIR/.env.supabase" ]]; then
  echo "[dev-backend-supabase-and-smoke] Arquivo .env.supabase não encontrado na raiz do projeto."
  exit 1
fi

set -a
source "$ROOT_DIR/.env.supabase"
set +a

export PORT="${PORT:-8788}"
export FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:8000}"
export EXPOSE_RESET_CODE="${EXPOSE_RESET_CODE:-true}"
export DEV_EMAILS="${DEV_EMAILS:-nagcode.contact@gmail.com}"
export SUPPORT_EMAIL="${SUPPORT_EMAIL:-nagcode.contact@gmail.com}"
export JWT_SECRET="${JWT_SECRET:-dev-local-secret-123}"

export CROSSAPP_API_BASE_URL="${CROSSAPP_API_BASE_URL:-http://localhost:8788}"
export CROSSAPP_COACH_EMAIL="${CROSSAPP_COACH_EMAIL:-coach1.1@ryxen.local}"
export CROSSAPP_COACH_PASSWORD="${CROSSAPP_COACH_PASSWORD:-RyxenSeed123}"
export CROSSAPP_ATHLETE_EMAIL="${CROSSAPP_ATHLETE_EMAIL:-athlete1.1@ryxen.local}"
export CROSSAPP_ATHLETE_PASSWORD="${CROSSAPP_ATHLETE_PASSWORD:-RyxenSeed123}"

cd "$ROOT_DIR"

if curl -fsS "http://localhost:${PORT}/health" >/dev/null 2>&1; then
  echo "[dev-backend-supabase-and-smoke] backend já está rodando na porta ${PORT}"
  BACKEND_PID=""
else
  EXISTING_PID="$(lsof -ti :"${PORT}" 2>/dev/null || true)"
  if [[ -n "${EXISTING_PID}" ]]; then
    echo "[dev-backend-supabase-and-smoke] porta ${PORT} ocupada (pid ${EXISTING_PID}), encerrando..."
    kill "${EXISTING_PID}" || true
  fi

  node backend/src/server.js &
  BACKEND_PID=$!
fi

cleanup() {
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID"
  fi
}

trap cleanup EXIT

echo "[dev-backend-supabase-and-smoke] aguardando backend subir..."
for i in {1..15}; do
  if curl -fsS "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[dev-backend-supabase-and-smoke] smoke:auth"
npm run smoke:auth

echo "[dev-backend-supabase-and-smoke] smoke:coach-trial"
npm run smoke:coach-trial
