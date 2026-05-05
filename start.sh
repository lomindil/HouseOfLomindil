#!/usr/bin/env bash
# Tavern VTT — unified start script
# Reads MODE from .env (dev | prod). Override with: MODE=prod ./start.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
GREEN='\033[0;32m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${BOLD}[tavern]${RESET} $*"; }
ok()   { echo -e "${GREEN}[tavern]${RESET} $*"; }
warn() { echo -e "${YELLOW}[tavern]${RESET} $*"; }
err()  { echo -e "${RED}[tavern]${RESET} $*" >&2; }

# ── Load .env ──────────────────────────────────────────────────────────────────
if [[ -f ".env" ]]; then
  # Export only simple KEY=VALUE lines, skip comments and blanks
  set -o allexport
  # shellcheck disable=SC1091
  source <(grep -E '^[A-Z_]+=\S' .env)
  set +o allexport
fi

MODE="${MODE:-dev}"

if [[ "$MODE" != "dev" && "$MODE" != "prod" ]]; then
  err "MODE must be 'dev' or 'prod' (got: '$MODE')"; exit 1
fi

# ── Process tracking ───────────────────────────────────────────────────────────
PIDS=()

cleanup() {
  echo ""
  log "Shutting down all processes..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  sleep 1
  for pid in "${PIDS[@]}"; do
    kill -9 "$pid" 2>/dev/null || true
  done
  ok "Stopped. Goodbye!"
}
trap cleanup EXIT INT TERM

pipe_prefix() {
  local color="$1" label="$2"
  while IFS= read -r line; do
    echo -e "${color}[${label}]${RESET} ${line}"
  done
}

# ── Dependency checks ──────────────────────────────────────────────────────────
for cmd in node npm; do
  command -v "$cmd" &>/dev/null || { err "$cmd not found."; exit 1; }
done

if [[ "$MODE" == "prod" ]] && ! command -v cloudflared &>/dev/null; then
  err "cloudflared not found — required for prod mode."
  err "Install it: https://developers.cloudflare.com/cloudflared/get-started/"
  exit 1
fi

# ── Install deps if missing ────────────────────────────────────────────────────
[[ ! -d "node_modules"        ]] && log "Installing root deps..."   && npm install --silent
[[ ! -d "server/node_modules" ]] && log "Installing server deps..." && npm install --workspace=server --silent
[[ ! -d "client/node_modules" ]] && log "Installing client deps..." && npm install --workspace=client --silent

# ══════════════════════════════════════════════════════════════════════════════
# DEV MODE — Vite + Express (tsx watch), no tunnel
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$MODE" == "dev" ]]; then
  log "Starting in ${CYAN}DEV${RESET} mode..."

  (cd server && npm run dev 2>&1) | pipe_prefix "$CYAN"   "backend"  &
  PIDS+=($!)

  log "Waiting for backend..."
  for i in $(seq 1 30); do
    curl -sf http://localhost:3001/socket.io/socket.io.js -o /dev/null 2>/dev/null && break
    kill -0 "${PIDS[0]}" 2>/dev/null || { err "Backend crashed."; exit 1; }
    sleep 1
  done
  ok "Backend ready."

  (cd client && npm run dev 2>&1) | pipe_prefix "$YELLOW" "frontend" &
  PIDS+=($!)

  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}  ⚔  Tavern VTT — DEV${RESET}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "  ${CYAN}App   ${RESET}  http://localhost:5173"
  echo -e "  ${CYAN}API   ${RESET}  http://localhost:3001"
  echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop."
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
fi

# ══════════════════════════════════════════════════════════════════════════════
# PROD MODE — build frontend, run Express only, start tunnel
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$MODE" == "prod" ]]; then
  log "Starting in ${GREEN}PROD${RESET} mode..."

  # Build server (TypeScript → dist/)
  log "Building server..."
  (cd server && npm run build 2>&1) | pipe_prefix "$CYAN" "build"
  ok "Server built → server/dist/"

  # Build frontend into server/public
  log "Building frontend..."
  (cd client && npm run build 2>&1) | pipe_prefix "$YELLOW" "build"
  ok "Frontend built → server/public/"

  # Start Express (production)
  log "Starting Express (production)..."
  (cd server && NODE_ENV=production npm start 2>&1) | pipe_prefix "$CYAN" "server" &
  PIDS+=($!)

  log "Waiting for server..."
  for i in $(seq 1 30); do
    curl -sf http://localhost:3001/socket.io/socket.io.js -o /dev/null 2>/dev/null && break
    kill -0 "${PIDS[0]}" 2>/dev/null || { err "Server crashed."; exit 1; }
    sleep 1
  done
  ok "Server ready."

  # Start Cloudflare tunnel
  log "Starting Cloudflare tunnel..."
  cloudflared tunnel run tavern-vtt 2>&1 | pipe_prefix "$RED" "tunnel" &
  PIDS+=($!)

  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}  ⚔  Tavern VTT — PROD${RESET}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "  ${GREEN}Public  ${RESET}  https://lomindil.com"
  echo -e "  ${CYAN}Local   ${RESET}  http://localhost:3001"
  echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop."
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
fi

# ── Watch for unexpected crashes ───────────────────────────────────────────────
while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      err "A process exited unexpectedly (PID $pid). Shutting down."
      exit 1
    fi
  done
  sleep 3
done
