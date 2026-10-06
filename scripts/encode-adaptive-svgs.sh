#!/usr/bin/env bash
# Generates self-contained adaptive SVGs with base64-encoded PNGs
# so GitHub/HACS don't block external image requests.
# Each SVG embeds a light and dark PNG, switching via prefers-color-scheme.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMG_DIR="$SCRIPT_DIR/../img"

# Pairs: light-png dark-png output-svg codec forum-width
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
#
# The forum-width field is the Discourse guard (#324). The community threads
# embed these SVGs inline, and Discourse cooks every inline image to at most
# 500 px tall, scaling the width to match; the composer preview does not show
# it, so a portrait figure looks right until it is posted and then lands as a
# thumbnail (#321 has the measured table). The field is the width the thread
# writes in its `![alt|WxH]` tag: 690 for a full-width embed, 560 for the
# card-width ones. The script fails when a figure's height at that width
# would exceed 500. `-` means the figure is never embedded inline on the forum
# (docs-site only, or reached only through a link), and the field is required
# so adding a figure means deciding which it is.
PAIRS=(
  "hero-light.png     hero-dark.png     hero-adaptive.svg     lossless 690"
  "themes-light.png   themes-dark.png   themes-adaptive.svg   lossless 690"
  # The three full-card geometry figures are the link-through targets of the
  # crops below and the docs-site embeds; the threads never inline them.
  "geometry-light.png geometry-dark.png geometry-adaptive.svg lossless -"
  "geometry-point-light.png geometry-point-dark.png geometry-point-adaptive.svg lossless -"
  "geometry-watch-light.png geometry-watch-dark.png geometry-watch-adaptive.svg lossless -"
  # Forum-sized crops of the three above (#321): the mini-map and the metadata
  # rows that fit under Discourse's 500 px inline-height clamp at 560 wide.
  "geometry-map-light.png geometry-map-dark.png geometry-map-adaptive.svg lossless 560"
  "geometry-point-map-light.png geometry-point-map-dark.png geometry-point-map-adaptive.svg lossless 560"
  "geometry-watch-map-light.png geometry-watch-map-dark.png geometry-watch-map-adaptive.svg lossless 560"
  "unavailable-light.png unavailable-dark.png unavailable-adaptive.svg lossless -"
  "surface-theming-light.png surface-theming-dark.png surface-theming-adaptive.svg lossy -"
  "tap-action-light.png tap-action-dark.png tap-action-adaptive.svg lossless 690"
  # Captured from a live HA by capture-editor.js, not by screenshot.js, so the
  # PNGs are absent on CI and the pair is skipped there; its SVG is tracked.
  # Seven stacked panels can't fit under the clamp at any sensible width and a
  # side-by-side recomposition would photograph a layout HA never shows, so
  # the thread keeps it as a click-through thumbnail (#324) and it is not
  # guarded.
  "editor-light.png editor-dark.png editor-adaptive.svg lossless -"
)

# Discourse's max_image_height, in CSS px, applied to the cooked <img>.
FORUM_MAX_HEIGHT=500

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

FORUM_VIOLATIONS=()

for pair in "${PAIRS[@]}"; do
  read -r LIGHT_NAME DARK_NAME OUTPUT_NAME CODEC FORUM_WIDTH <<< "$pair"

  if [[ -z "$FORUM_WIDTH" ]]; then
    echo "Error: $OUTPUT_NAME has no forum-width field (690, 560 or -). Decide whether the threads embed it." >&2
    exit 1
  fi

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

  # Forum clamp (#324): the cooked height at the declared display width must
  # stay under FORUM_MAX_HEIGHT. The SVG is still written so the overrun can
  # be looked at; the script fails once every pair has been reported.
  if [[ "$FORUM_WIDTH" != "-" ]]; then
    COOKED_HEIGHT=$(( FORUM_WIDTH * VB_HEIGHT / VB_WIDTH ))
    if (( COOKED_HEIGHT > FORUM_MAX_HEIGHT )); then
      FORUM_VIOLATIONS+=("$OUTPUT_NAME is ${VB_WIDTH}x${VB_HEIGHT}; at ${FORUM_WIDTH} wide Discourse cooks it to $(( FORUM_WIDTH * FORUM_MAX_HEIGHT / COOKED_HEIGHT ))x${FORUM_MAX_HEIGHT} (limit at that width: ${VB_WIDTH}x$(( FORUM_MAX_HEIGHT * VB_WIDTH / FORUM_WIDTH )))")
    fi
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

  FORUM_NOTE=""
  [[ "$FORUM_WIDTH" != "-" ]] && FORUM_NOTE=", forum ${FORUM_WIDTH}x${COOKED_HEIGHT}"
  echo "Written: $OUTPUT_NAME ($(( $(wc -c < "$OUTPUT") / 1024 )) KB, $CODEC, $(basename "$LIGHT_SRC" | sed "s/.*\.//")${FORUM_NOTE})"
done

if (( ${#FORUM_VIOLATIONS[@]} > 0 )); then
  echo >&2
  echo "Error: ${#FORUM_VIOLATIONS[@]} forum figure(s) exceed Discourse's ${FORUM_MAX_HEIGHT} px inline-height clamp (#324):" >&2
  for v in "${FORUM_VIOLATIONS[@]}"; do echo "  - $v" >&2; done
  echo "Rebalance the harness (landscape, wider canvas, tighter padding) or mark the pair '-' if the threads never embed it inline." >&2
  exit 1
fi
