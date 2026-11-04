#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export CAPTURE_STRICT=1
: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL to capture.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the project.}"
/usr/bin/time -p node "${RUNTIME_DIR:?}/scripts/default-capture.mjs"
