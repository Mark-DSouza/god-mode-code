#!/usr/bin/env bash
#
# One command for the whole local environment.
#
#   database  container  (compose.dev.yaml)
#   backend   native     http://localhost:8080  debugger on 5005
#   judge     native     http://localhost:9090
#   frontend  native     http://localhost:5173  hot reload, /api proxied
#
# The applications run natively rather than in containers so debuggers attach
# normally and hot reload is not fighting a bind mount. For the fully
# containerised stack, use compose.e2e.yaml.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

# Go was installed outside the default PATH on some machines.
export PATH="$HOME/.local/go/bin:$HOME/.local/bin:$PATH"

pids=()
cleanup() {
  echo
  echo "==> Stopping"
  for pid in "${pids[@]:-}"; do
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  docker compose -f compose.dev.yaml stop >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required tool: $1" >&2
    exit 1
  }
}
require docker
require pnpm

echo "==> Starting the database"
# --wait blocks on the healthcheck, so the backend does not race the database
# through its first migration.
docker compose -f compose.dev.yaml up -d --wait

if [[ ! -d node_modules ]]; then
  echo "==> Installing dependencies"
  pnpm install
fi

echo "==> Starting the backend (debugger on 5005)"
(
  cd apps/api
  ./mvnw -B spring-boot:run \
    -Dspring-boot.run.jvmArguments="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"
) &
pids+=($!)

if command -v go >/dev/null 2>&1; then
  echo "==> Starting the judge"
  (cd apps/judge && JUDGE_VERSION=dev go run ./cmd/judge) &
  pids+=($!)
else
  # Not fatal: nothing in the product calls the judge yet, and the rest of the
  # stack is perfectly usable without it.
  echo "==> Skipping the judge (Go not installed)"
fi

echo "==> Starting the frontend"
pnpm --filter @gmc/web dev &
pids+=($!)

echo
echo "==> Up. http://localhost:5173  (API proxied at /api)"
echo "    Ctrl-C to stop everything."
wait
