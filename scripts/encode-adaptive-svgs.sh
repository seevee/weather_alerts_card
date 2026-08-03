#!/usr/bin/env bash
# Generates self-contained adaptive SVGs with base64-encoded PNGs
# so GitHub/HACS don't block external image requests.
# Each SVG embeds a light and dark PNG, switching via prefers-color-scheme.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMG_DIR="$SCRIPT_DIR/../img"

# Pairs: light-png dark-png output-svg codec
#
# The codec is chosen per figure because these screenshots are not all the same
# kind of image, and the wrong choice is expensive in both directions:
#
#   lossless — flat UI with sharp text. PNG is already good at this and lossy
#              WebP is actively worse: it blurs glyph edges AND comes out
#              larger, because q90 adds noise to large flat colour areas.
#              Lossless WebP still beats PNG here (hero: 118K PNG -> 54K).
#   lossy    — translucency, gradients, blur. PNG's worst case by a wide
#              margin. surface-theming is 576K as PNG and 81K as lossy WebP at
#              identical dimensions, a 7x saving with no visible artefact,
#              because there is almost no text in it to damage.
#
# When adding a figure: if it is mostly card chrome and labels use lossless; if
# it showcases translucent/blurred surfaces use lossy. Measure rather than
# assume — `magick in.png -quality 90 out.webp` and compare.
PAIRS=(
  "hero-light.png     hero-dark.png     hero-adaptive.svg     lossless"
  "themes-light.png   themes-dark.png   themes-adaptive.svg   lossless"
  "geometry-light.png geometry-dark.png geometry-adaptive.svg lossless"
  "unavailable-light.png unavailable-dark.png unavailable-adaptive.svg lossless"
  "surface-theming-light.png surface-theming-dark.png surface-theming-adaptive.svg lossy"
  "tap-action-light.png tap-action-dark.png tap-action-adaptive.svg lossless"
)

# ImageMagick is optional. Without it every figure falls back to an embedded
# PNG, which is exactly the previous behaviour — the script keeps working, it
# just produces larger SVGs.
if command -v magick >/dev/null 2>&1; then
  HAVE_MAGICK=true
else
  HAVE_MAGICK=false
  echo "Note: ImageMagick not found — embedding PNGs directly (larger output)." >&2
fi

# Encodes $1 (a PNG) to WebP at $2 (lossless|lossy), printing the output path.
# Falls back to echoing the input path when ImageMagick is unavailable.
to_webp() {
  local src=$1 mode=$2
  local out="${src%.png}.webp"

  if [[ "$HAVE_MAGICK" != true ]]; then
    printf '%s' "$src"
    return
  fi

  if [[ "$mode" == "lossy" ]]; then
    magick "$src" -quality 90 "$out"
  else
    magick "$src" -define webp:lossless=true "$out"
  fi

  # Only keep the WebP if it actually won. Guards against a future figure whose
  # content makes WebP the wrong call, without needing anyone to notice.
  if [[ $(stat -c%s "$out") -lt $(stat -c%s "$src") ]]; then
    printf '%s' "$out"
  else
    rm -f "$out"
    printf '%s' "$src"
  fi
}

for pair in "${PAIRS[@]}"; do
  read -r LIGHT_NAME DARK_NAME OUTPUT_NAME CODEC <<< "$pair"

  LIGHT_PNG="$IMG_DIR/$LIGHT_NAME"
  DARK_PNG="$IMG_DIR/$DARK_NAME"
  OUTPUT="$IMG_DIR/$OUTPUT_NAME"

  for f in "$LIGHT_PNG" "$DARK_PNG"; do
    if [[ ! -f "$f" ]]; then
      echo "Warning: $f not found, skipping $OUTPUT_NAME" >&2
      continue 2
    fi
  done

  # Dimensions come from the source PNG, before any conversion.
  read -r PX_WIDTH PX_HEIGHT < <(file "$LIGHT_PNG" | grep -oP '\d+ x \d+' | tr -d ' ' | tr 'x' ' ')

  LIGHT_SRC=$(to_webp "$LIGHT_PNG" "$CODEC")
  DARK_SRC=$(to_webp "$DARK_PNG" "$CODEC")

  # The light raster doubles as README's click-through target, so its MIME type
  # decides the extension the README must link to.
  [[ "$LIGHT_SRC" == *.webp ]] && LIGHT_MIME="image/webp" || LIGHT_MIME="image/png"
  [[ "$DARK_SRC" == *.webp ]] && DARK_MIME="image/webp" || DARK_MIME="image/png"

  LIGHT_B64=$(base64 -w 0 "$LIGHT_SRC")
  DARK_B64=$(base64 -w 0 "$DARK_SRC")

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
  <image class="light" href="data:${LIGHT_MIME};base64,${LIGHT_B64}" width="${VB_WIDTH}" height="${VB_HEIGHT}" />
  <image class="dark" href="data:${DARK_MIME};base64,${DARK_B64}" width="${VB_WIDTH}" height="${VB_HEIGHT}" />
</svg>
EOF

  echo "Written: $OUTPUT_NAME ($(( $(wc -c < "$OUTPUT") / 1024 )) KB, $CODEC, $(basename "$LIGHT_SRC" | sed "s/.*\.//"))"
done
