#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"
: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an evidence directory outside the project}"

run_timed() {
  local label="$1"
  shift
  /usr/bin/time -f "[timing] ${label}: %e s" "$@"
}

cd "$PROJECT_DIR"
run_timed 'resolve capture output directory' realpath -m "$CAPTURE_DIR"
CAPTURE_DIR="$(realpath -m "$CAPTURE_DIR")"
case "$CAPTURE_DIR/" in
  "$PROJECT_DIR/"*) echo 'CAPTURE_DIR must be outside the project directory.' >&2; exit 1 ;;
esac
run_timed 'create capture output directory' mkdir -p "$CAPTURE_DIR"

# The runtime capture helper owns and closes its browser; strict mode makes
# page errors and failed same-origin assets count as rendering defects.
export CAPTURE_STRICT=1
export CAPTURE_READY_SELECTOR="${CAPTURE_READY_SELECTOR:-#start-screen}"
export CAPTURE_AUTO_START="${CAPTURE_AUTO_START:-false}"
run_timed 'capture desktop and mobile previews' node "$RUNTIME_DIR/scripts/default-capture.mjs"
