#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_PORT="${CROSSAPP_DB_PORT:-5432}"
BACKEND_PORT="${CROSSAPP_BACKEND_PORT:-8787}"
MAILPIT_PORT="${CROSSAPP_MAILPIT_PORT:-8025}"
FRONTEND_PORT="${CROSSAPP_FRONTEND_PORT:-8000}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[docker-up] Docker não está instalado ou não está no PATH."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[docker-up] Docker Compose v2 não está disponível."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[docker-up] Docker daemon indisponível. Inicie o Docker Desktop ou o serviço docker antes de continuar."
  exit 1
fi

check_port() {
  local port="$1"
  local label="$2"
  if ss -ltn "( sport = :${port} )" 2>/dev/null | tail -n +2 | grep -q .; then
    echo "[docker-up] Porta ${port} já está em uso (${label})."
    return 1
  fi
  return 0
}

PORT_CONFLICT=0
check_port "$DB_PORT" "Postgres" || PORT_CONFLICT=1
check_port "$BACKEND_PORT" "backend" || PORT_CONFLICT=1
check_port "$MAILPIT_PORT" "Mailpit" || PORT_CONFLICT=1
check_port "$FRONTEND_PORT" "frontend" || PORT_CONFLICT=1

if [ "$PORT_CONFLICT" -ne 0 ]; then
  echo "[docker-up] Ajuste as portas antes de subir o stack. Exemplo:"
  echo "  CROSSAPP_DB_PORT=5433 CROSSAPP_FRONTEND_PORT=8001 npm run docker:up"
  exit 1
fi

if [ -f "backend/.env" ]; then
  if grep -q "@localhost:5432/" backend/.env; then
    echo "[docker-up] Aviso: backend/.env aponta para localhost."
    echo "[docker-up] No Docker Compose, o backend usa DATABASE_URL com host 'db', então isso não impede a subida do stack."
  elif grep -q "@db:5432/" backend/.env; then
    echo "[docker-up] backend/.env já está alinhado com o host 'db' do Docker."
  fi
else
  echo "[docker-up] backend/.env não encontrado. O Docker Compose ainda sobe porque injeta as variáveis principais."
fi

echo "[docker-up] Subindo db, backend, mailpit e frontend..."
docker compose up -d --build

echo "[docker-up] Serviços esperados:"
echo "  frontend: http://localhost:${FRONTEND_PORT}"
echo "  backend:  http://localhost:${BACKEND_PORT}"
echo "  health:   http://localhost:${FRONTEND_PORT}/health"
echo "  mailpit:  http://localhost:${MAILPIT_PORT}"
echo
echo "[docker-up] Use 'npm run docker:ps' para ver status e 'npm run docker:logs' para acompanhar logs."
