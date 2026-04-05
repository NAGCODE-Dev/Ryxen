#!/usr/bin/env bash

set -euo pipefail

LLAMA_DIR="/home/nagc/llama.cpp"
MODEL_PATH="/home/nagc/models/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"
CTX_SIZE="${CTX_SIZE:-4096}"
THREADS="${THREADS:-6}"

if [[ ! -x "${LLAMA_DIR}/build/bin/llama-server" ]]; then
  echo "llama-server nao encontrado em ${LLAMA_DIR}/build/bin/llama-server" >&2
  exit 1
fi

if [[ ! -f "${MODEL_PATH}" ]]; then
  echo "Modelo nao encontrado em ${MODEL_PATH}" >&2
  exit 1
fi

exec "${LLAMA_DIR}/build/bin/llama-server" \
  -m "${MODEL_PATH}" \
  --host "${HOST}" \
  --port "${PORT}" \
  -c "${CTX_SIZE}" \
  -t "${THREADS}"
