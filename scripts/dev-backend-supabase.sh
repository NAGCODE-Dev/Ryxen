#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT_DIR/.env.supabase" ]]; then
  echo "[dev-backend-supabase] Arquivo .env.supabase não encontrado na raiz do projeto."
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

cd "$ROOT_DIR"
node backend/src/server.js
