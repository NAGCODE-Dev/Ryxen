#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT_DIR/.env.supabase" ]]; then
  echo "[smoke-backend-supabase] Arquivo .env.supabase não encontrado na raiz do projeto."
  exit 1
fi

set -a
source "$ROOT_DIR/.env.supabase"
set +a

export RYXEN_API_BASE_URL="${RYXEN_API_BASE_URL:-${CROSSAPP_API_BASE_URL:-http://localhost:8788}}"
export RYXEN_COACH_EMAIL="${RYXEN_COACH_EMAIL:-${CROSSAPP_COACH_EMAIL:-coach1.1@ryxen.local}}"
export RYXEN_COACH_PASSWORD="${RYXEN_COACH_PASSWORD:-${CROSSAPP_COACH_PASSWORD:-RyxenSeed123}}"
export RYXEN_ATHLETE_EMAIL="${RYXEN_ATHLETE_EMAIL:-${CROSSAPP_ATHLETE_EMAIL:-athlete1.1@ryxen.local}}"
export RYXEN_ATHLETE_PASSWORD="${RYXEN_ATHLETE_PASSWORD:-${CROSSAPP_ATHLETE_PASSWORD:-RyxenSeed123}}"

cd "$ROOT_DIR"

echo "[smoke-backend-supabase] smoke:auth"
npm run smoke:auth

echo "[smoke-backend-supabase] smoke:coach-trial"
npm run smoke:coach-trial
