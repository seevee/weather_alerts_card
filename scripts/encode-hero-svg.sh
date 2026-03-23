#!/usr/bin/env bash
# Generates a self-contained hero-adaptive.svg with base64-encoded PNGs
# so GitHub/HACS don't block external image requests.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMG_DIR="$SCRIPT_DIR/../img"

LIGHT_PNG="$IMG_DIR/hero-light.png"
DARK_PNG="$IMG_DIR/hero-dark.png"
OUTPUT="$IMG_DIR/hero-adaptive.svg"

for f in "$LIGHT_PNG" "$DARK_PNG"; do
  if [[ ! -f "$f" ]]; then
    echo "Error: $f not found" >&2
    exit 1
  fi
done

LIGHT_B64=$(base64 -w 0 "$LIGHT_PNG")
DARK_B64=$(base64 -w 0 "$DARK_PNG")

# Read actual pixel dimensions from the PNGs
read -r PX_WIDTH PX_HEIGHT < <(file "$LIGHT_PNG" | grep -oP '\d+ x \d+' | tr -d ' ' | tr 'x' ' ')

# Use logical dimensions for the SVG viewBox (half pixel size for 2x DPR images).
# If PNGs are 1x, this still works — viewBox just matches pixel size.
VB_WIDTH=$(( PX_WIDTH / 2 ))
VB_HEIGHT=$(( PX_HEIGHT / 2 ))

# Sanity check: if PNGs are odd-sized or 1x, fall back to pixel dimensions
if (( VB_WIDTH < 400 )); then
  VB_WIDTH=$PX_WIDTH
  VB_HEIGHT=$PX_HEIGHT
fi

cat > "$OUTPUT" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_WIDTH} ${VB_HEIGHT}" width="100%">
  <style>
    .light { display: block; }
    .dark { display: none; }
    @media (prefers-color-scheme: dark) {
      .light { display: none; }
      .dark { display: block; }
    }
  </style>
  <image class="light" href="data:image/png;base64,${LIGHT_B64}" width="${VB_WIDTH}" height="${VB_HEIGHT}" />
  <image class="dark" href="data:image/png;base64,${DARK_B64}" width="${VB_WIDTH}" height="${VB_HEIGHT}" />
</svg>
EOF

echo "Written: $OUTPUT ($(wc -c < "$OUTPUT") bytes)"
