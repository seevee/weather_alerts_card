#!/usr/bin/env bash
# Generates self-contained adaptive SVGs with base64-encoded PNGs
# so GitHub/HACS don't block external image requests.
# Each SVG embeds a light and dark PNG, switching via prefers-color-scheme.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMG_DIR="$SCRIPT_DIR/../img"

# Pairs: light-png dark-png output-svg
PAIRS=(
  "hero-light.png   hero-dark.png   hero-adaptive.svg"
  "themes-light.png themes-dark.png themes-adaptive.svg"
)

for pair in "${PAIRS[@]}"; do
  read -r LIGHT_NAME DARK_NAME OUTPUT_NAME <<< "$pair"

  LIGHT_PNG="$IMG_DIR/$LIGHT_NAME"
  DARK_PNG="$IMG_DIR/$DARK_NAME"
  OUTPUT="$IMG_DIR/$OUTPUT_NAME"

  for f in "$LIGHT_PNG" "$DARK_PNG"; do
    if [[ ! -f "$f" ]]; then
      echo "Warning: $f not found, skipping $OUTPUT_NAME" >&2
      continue 2
    fi
  done

  LIGHT_B64=$(base64 -w 0 "$LIGHT_PNG")
  DARK_B64=$(base64 -w 0 "$DARK_PNG")

  # Read actual pixel dimensions from the PNGs
  read -r PX_WIDTH PX_HEIGHT < <(file "$LIGHT_PNG" | grep -oP '\d+ x \d+' | tr -d ' ' | tr 'x' ' ')

  # Use logical dimensions for the SVG viewBox (half pixel size for 2x DPR images).
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

  echo "Written: $OUTPUT_NAME ($(wc -c < "$OUTPUT") bytes)"
done
