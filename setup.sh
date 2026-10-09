#!/usr/bin/env bash
# One-time setup on a fresh cloud machine: ffmpeg, numpy/scipy/pillow, the two node packages.
# Idempotent and quick when everything is already there. Usage: ./setup.sh
set -uo pipefail
cd "$(dirname "$0")"
SUDO=""; [ "$(id -u)" != 0 ] && command -v sudo >/dev/null && SUDO=sudo
ok=1
if ! command -v ffmpeg >/dev/null; then
  echo "setup: installing ffmpeg (apt)…"
  ($SUDO apt-get update -qq && DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y -qq ffmpeg >/dev/null) || { echo "setup: ffmpeg install FAILED"; ok=0; }
fi
if ! python3 -c "import numpy, scipy, PIL" 2>/dev/null; then
  echo "setup: installing numpy scipy pillow (pip)…"
  pip install -q --break-system-packages numpy scipy pillow 2>/dev/null || pip install -q numpy scipy pillow || { echo "setup: pip install FAILED"; ok=0; }
fi
if [ ! -d node_modules/@napi-rs/canvas ] && [ ! -d /opt/npm-tools/node_modules/@napi-rs/canvas ]; then
  echo "setup: installing node packages (npm)…"
  npm install --no-audit --no-fund --loglevel=error || { echo "setup: npm install FAILED"; ok=0; }
fi
if node engine/engine.mjs stories/2026-10-09-ethiopia-eritrea.json check >/dev/null 2>&1; then echo "setup: engine OK"; else echo "setup: engine check FAILED"; ok=0; fi
for f in Anton-Regular.ttf Inter-ExtraBold.otf InterDisplay-Black.otf Inter-SemiBold.otf; do [ -f "assets/fonts/$f" ] || { echo "setup: missing font $f"; ok=0; }; done
if [ $ok = 1 ]; then echo "setup: all good"; else echo "setup: see problems above"; exit 1; fi
