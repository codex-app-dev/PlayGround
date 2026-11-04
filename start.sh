#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"
export PORT

if [[ -f package.json ]]; then
  /usr/bin/time -p npm install --package-lock=false --ignore-scripts --no-audit --no-fund
  if node -e 'const p = require("./package.json"); process.exit(p.scripts?.build ? 0 : 1)'; then
    /usr/bin/time -p npm run build
  else
    /usr/bin/time -p rm -rf "$PROJECT_DIR/dist"
    /usr/bin/time -p mkdir -p "$PROJECT_DIR/dist"
    /usr/bin/time -p cp -R index.html css js favicon.svg "$PROJECT_DIR/dist/"
  fi
elif [[ ! -f "$PROJECT_DIR/dist/index.html" ]]; then
  /usr/bin/time -p rm -rf "$PROJECT_DIR/dist"
  /usr/bin/time -p mkdir -p "$PROJECT_DIR/dist"
  /usr/bin/time -p cp -R index.html css js favicon.svg "$PROJECT_DIR/dist/"
fi

if [[ ! -f "$PROJECT_DIR/dist/index.html" ]]; then
  echo "Build did not produce $PROJECT_DIR/dist/index.html" >&2
  exit 1
fi

WEB_METADATA_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
/usr/bin/time -p mkdir -p "$WEB_METADATA_DIR"
PROJECT_DIR="$PROJECT_DIR" WEB_METADATA_DIR="$WEB_METADATA_DIR" /usr/bin/time -p node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const project = process.env.PROJECT_DIR;
  const directory = path.resolve(project, "dist");
  fs.writeFileSync(path.join(process.env.WEB_METADATA_DIR, "deployment-output.json"), JSON.stringify({ project, directory }, null, 2) + "\n");
'

# Keep the static server in the foreground for the controller-owned app-server session.
/usr/bin/time -p python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$PROJECT_DIR/dist"
