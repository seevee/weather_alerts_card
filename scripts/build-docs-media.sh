#!/usr/bin/env bash
# Generates the docs-site figures and stages them under docs/public/img/.
#
# Docs figures are NOT committed. They are regenerated deterministically from
# the harnesses on every Pages build (see .github/workflows/docs.yml) and both
# img/ (beyond the six storefront files) and docs/public/img/ are gitignored.
#
# The scene content is deterministic (frozen clock, fixed fixtures), but the
# encoded bytes are not portable: a different Chromium or ImageMagick build
# re-encodes the same scene to a slightly different file. So this rewrites the
# six *tracked* storefront figures in place and leaves them dirty, exactly as
# `npm run screenshot:hero` already did. That is harmless in CI (nothing is
# committed there); locally, `git restore img/` afterwards unless you actually
# mean to refresh the storefront — which is a release-time job, not a docs one.
#
# Run: npm run docs:media
#
# Env: DOCS_MOTION=1  also record the tap_action motion capture (WebM + animated
#                     WebP). Off by default: it needs ffmpeg *and* ffprobe, and
#                     the motion demo is still being tuned.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST="$ROOT/docs/public/img"

cd "$ROOT"

# The harnesses import /dist/weather-alerts-card.js, so the bundle must be current.
npm run build

node scripts/screenshot.js
bash scripts/encode-adaptive-svgs.sh

if [[ "${DOCS_MOTION:-}" == "1" ]]; then
  node scripts/capture-tap-action.js
fi

mkdir -p "$DEST"

# The site embeds the adaptive SVGs — one theme-aware URL each, with both
# rasters already inlined as base64. The WebPs come along so a figure can be
# opened on its own, and because DOCS_MOTION emits the animated capture as one.
# The intermediate PNGs are deliberately left behind: nothing references them,
# and they are several times the weight of everything else combined.
shopt -s nullglob
copied=0
for f in "$ROOT"/img/*.svg "$ROOT"/img/*.webp; do
  cp "$f" "$DEST/"
  copied=$((copied + 1))
done
shopt -u nullglob

if (( copied == 0 )); then
  echo "Error: no figures were produced in img/ — nothing to publish." >&2
  exit 1
fi

echo "Copied $copied figure(s) to docs/public/img/"
