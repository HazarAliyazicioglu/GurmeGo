#!/usr/bin/env bash
# Boots the REAL compiled apps/api/dist/main.js with plain `node` (no ts-node, no Jest) and
# polls /health for an exact 200. This is the only valid proof that packages/shared's build
# output is actually consumable at runtime -- `tsc --noEmit` passing is NOT sufficient (that's
# exactly how this bug survived three prior plans undetected).
set -uo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SUPABASE_JWKS_URL:?SUPABASE_JWKS_URL is required}"

PORT="${PORT:-3000}"
API_DIST="apps/api/dist/main.js"

# Set up cleanup before any exit path exists, so a temp file never leaks even if we exit early
# (missing dist, port already occupied) before the API process itself is started.
LOG_FILE="$(mktemp)"
PID=""
cleanup() {
  [ -n "$PID" ] && kill "$PID" 2>/dev/null || true
  [ -n "$PID" ] && wait "$PID" 2>/dev/null || true
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

if [ ! -f "$API_DIST" ]; then
  echo "FAIL: $API_DIST does not exist. Build apps/api first (pnpm exec turbo run build --filter=@gurmego/api...)." >&2
  exit 1
fi

# Refuse to run if something is already answering on $PORT -- otherwise a stray unrelated
# service could make this script false-positive as if our process were healthy.
if curl -s -o /dev/null --max-time 1 "http://localhost:${PORT}/health" 2>/dev/null; then
  echo "FAIL: something is already listening on port ${PORT} before this script started its own process. Set PORT to a free port and retry." >&2
  exit 1
fi

node "$API_DIST" > "$LOG_FILE" 2>&1 &
PID=$!

# Bounded to ~10s worst case: 10 attempts * (0.3s sleep + up to 0.7s curl timeout).
for i in $(seq 1 10); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "FAIL: apps/api process exited early -- it crashed on startup instead of serving requests. Captured output:" >&2
    cat "$LOG_FILE" >&2
    exit 1
  fi
  status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 0.7 "http://localhost:${PORT}/health" 2>/dev/null || echo "000")"
  if [ "$status" = "200" ]; then
    echo "PASS: /health returned exactly 200"
    exit 0
  fi
  sleep 0.3
done

echo "FAIL: /health did not return 200 within the polling window (timeout). Captured output:" >&2
cat "$LOG_FILE" >&2
exit 1
