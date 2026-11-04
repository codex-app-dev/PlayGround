#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
PORT="${PORT:-3000}"
export PORT

run_timed() {
  local label="$1"
  shift
  /usr/bin/time -f "[timing] ${label}: %e s" "$@"
}

cd "$PROJECT_DIR"
run_timed 'dependency install (npm ci)' npm ci --no-audit --no-fund
run_timed 'production build (Vite)' ./node_modules/.bin/vite build --base ./
test -s "$PROJECT_DIR/dist/index.html"
run_timed 'create deployment metadata directory' mkdir -p "$WEB_DIR"
PROJECT_DIR="$PROJECT_DIR" WEB_DIR="$WEB_DIR" run_timed 'write deployment metadata' node -e 'const fs=require("node:fs"); const path=require("node:path"); const project=process.env.PROJECT_DIR; const directory=path.join(project,"dist"); const file=path.join(process.env.WEB_DIR,"deployment-output.json"); fs.writeFileSync(file, JSON.stringify({project,directory}));'

# Keep the server in the foreground so the runtime launcher can supervise it.
run_timed "serve static build on port ${PORT}" ./node_modules/.bin/vite preview --host 0.0.0.0 --port "$PORT" --strictPort
