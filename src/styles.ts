import { css } from 'lit';

export const cardStyles = css`
  /* --- MOTION -------------------------------------------------------------
     Every keyframe below animates only transform or opacity. Those two run on
     the compositor thread; anything else (box-shadow, background-position,
     background color) forces a main-thread repaint and a re-raster on every
     frame for as long as an alert is on screen. On a low-end kiosk tablet that
     was 70%+ CPU for two idle alerts (#364). Keep it that way: no paint-path
     property may be animated here. */

  /* Severe/extreme breathe: an inset ring on .pulse-ring (a real child, since
     .alert-card clips its overflow and both pseudo-elements are taken) fading
     in and out. Peaks at ~70% like the former outward halo did. */
  @keyframes pulse-ring {
    0%, 100% { opacity: 0; }
    50% { opacity: 0.7; }
  }

  /* Indeterminate "ongoing" breathe. Peaks at the full progress color (same
     brightness as an active bar) and eases down to a still-prominent ~70%, so
     ongoing reads as full-strength-and-alive rather than dimmed — opacity here
     is motion, not a phase cue (direction/fill/labels carry the phase). */
  @keyframes ongoing-pulse {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
  }

  /* Shared, direction-parametrized stripe march. The striped surface is painted
     one full width past each end of its bar (left/right: -100%) and the whole
     surface slides by one tile, so the loop is seamless and the overhang is
     clipped by the bar's own overflow. --wac-flow (±1) is set by the phase and
     flips the direction; --wac-stripe-tile is the loop tile (24px full, 12px
     compact). A negative flow marches left (preparation); positive marches
     right (e.g. a striped active fill). */
  @keyframes stripe-march {
    to { transform: translateX(calc(var(--wac-flow, 1) * var(--wac-stripe-tile, 24px))); }
  }

  /* Highlight sweep. The band sits centered on a surface three bar-widths wide
     (left/right: -100%), so one bar width is 33.33% of the surface and the
     40%-of-bar band is 13.33%. Sliding the surface ±23.33% carries the band
     from fully off one end to fully off the other. Authored rightward and
     mirrored by --wac-flow. */
  @keyframes fill-shimmer {
    0% { transform: translateX(calc(var(--wac-flow, 1) * -23.333%)); }
    60% { transform: translateX(calc(var(--wac-flow, 1) * 23.333%)); }
    100% { transform: translateX(calc(var(--wac-flow, 1) * 23.333%)); }
  }

  :host {
    display: block;
  }

  /* Public surface-theming API (--wac-* custom properties). Set these from
     theme YAML, card_mod, or a dashboard style: block. Each is applied inline
     as var(--token, <default>) at its use site (no :host declaration), so one
     token can drive both full and compact layouts while preserving each site's
     current default when unset. Documented in the README token table.

       --wac-card-background   outer wrapper fill.  default:
                               var(--ha-card-background, var(--card-background-color))
       --wac-alert-background  per-alert fill.       default: transparent
                               (reveals the outer surface — no compounding)
       --wac-alert-border-radius  per-alert corners. default: 12px full / 8px compact
       --wac-alert-border      per-alert border.     default: 1px solid var(--divider-color)
       --wac-alert-shadow      per-alert shadow.     default:
                               var(--ha-card-box-shadow, 0 2px 5px rgba(0,0,0,0.1))
       --wac-alert-gap         inter-alert vgap.     default: 16px full / 4px compact */

  /* Positioning context for the degraded corner dot (see .degraded-dot).
     The outer surface is the single painted layer: inner .alert-card boxes
     default to transparent (see --wac-alert-background) and reveal this fill,
     so a translucent theme renders its alpha exactly once. The fallback chain
     mirrors HA's own default so an unset --wac-card-background is identical to
     today's ha-card background. */
  ha-card {
    position: relative;
    background: var(--wac-card-background, var(--ha-card-background, var(--card-background-color)));
  }

  .error {
    padding: 16px;
    color: var(--error-color, red);
  }

  /* Availability channel: how the card signals that some (or all) configured
     sources are dark, independent of the alert list. Two anchored forms — a
     full-width strip above real alert content ('message'), or a corner dot
     floating over it ('compact', at zero layout cost). With no alerts to anchor
     to, neither renders; the empty state carries the caveat instead (see
     .no-alerts-caveat), so a bare all-clear never sits next to a stale source. */
  .degraded-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    /* Warning wash carries the tone; text stays on a legible token so it passes
       contrast on a white card (raw --warning-color as text does not). Derived
       from --warning-color via color-mix (the codebase's tint idiom) so a
       custom theme's warning color is always respected — the icon, dot, and this
       wash share one source. Unsupported engines just drop the tint. */
    background: color-mix(in srgb, var(--warning-color) 14%, transparent);
    color: var(--primary-text-color);
    font-size: 0.85em;
    border-bottom: 1px solid var(--divider-color);
  }

  .degraded-badge ha-icon {
    color: var(--warning-color);
    --mdc-icon-size: 18px;
    flex-shrink: 0;
  }

  /* Corner warning badge for 'compact' — an annotation on the alert(s) beneath
     it, so it is positioned against the ha-card box and ringed in the card
     background to stay legible over any underlying content, in either theme.
     An inverted alert glyph (white on the amber disc) conveys "unavailable"
     where a bare dot would not. */
  .degraded-dot {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--warning-color);
    /* Ring intentionally tracks the outer ha-card surface (--card-background-color),
       not --wac-alert-background: the dot floats over the ha-card box, and
       --wac-alert-background is transparent by default. */
    box-shadow: 0 0 0 2px var(--card-background-color, #fff);
    z-index: 2;
  }

  .degraded-dot ha-icon {
    /* Punch the glyph to the card background, matching how the pill badges sit
       their content on a colored chip rather than plain white. */
    color: var(--card-background-color, #fff);
    --mdc-icon-size: 12px;
  }

  /* --- COLOR MAPPING --- */
  .severity-extreme,
  .severity-severe { --color: var(--error-color); --color-rgb: 244, 67, 54; --color-on: #ffffff; }
  .severity-moderate { --color: var(--warning-color); --color-rgb: 255, 152, 0; --color-on: #1a1a1a; }
  .severity-minor { --color: var(--info-color); --color-rgb: 33, 150, 243; --color-on: #ffffff; }
  .severity-unknown { --color: var(--secondary-text-color); --color-rgb: 128, 128, 128; --color-on: var(--primary-text-color); }

  /* --- CARD CONTAINER --- */
  .alert-card {
    /* Two foreground tokens, both default to the raw theme color:
         --wac-fg          — icon + label text (boost-{light,dark}, ~2:1 tier)
         --wac-progress-fg — progress-bar fill (progress-boost-{light,dark},
                             ~1.3:1 tier — only kicks in for near-invisible
                             tints like yellow Tornado Watch)
       Boost rules below override these only when the event's color fails
       the corresponding threshold on the active side (precomputed per
       NWS/MeteoAlarm entry). HA's --primary-text-color flips with theme
       mode; --text-primary-color is the "text on accent" color — do not
       confuse them. */
    --wac-fg: var(--color);
    --wac-progress-fg: var(--color);
    /* progressFill:background wash tokens (Bubble-Card-style whole-row fill).
       Deliberately low-opacity so alert text stays legible over translucent
       themes (#215); all three overridable via theme YAML / card_mod / --wac-*.
       Only consumed by the .fill-mode-background rules — inert in track mode. */
    --wac-progress-fill-color: var(--wac-progress-fg);
    --wac-progress-fill-opacity: 0.10;
    --wac-progress-fill-expired-opacity: 0.06;
    position: relative;
    margin-bottom: var(--wac-alert-gap, 16px);
    padding: 0;
    border-radius: var(--wac-alert-border-radius, 12px);
    background: var(--wac-alert-background, transparent);
    border: var(--wac-alert-border, 1px solid var(--divider-color));
    box-shadow: var(--wac-alert-shadow, var(--ha-card-box-shadow, 0 2px 5px rgba(0,0,0,0.1)));
    overflow: hidden;
    transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out, transform 0.15s ease-out;
  }

  /* Contrast boost: only when theme mode matches the failing side.
     Scoped to event-color themes (nws, meteoalarm). Severity theme
     never receives these classes — its colors are HA theme tokens. */
  [data-theme-mode="light"] .alert-card.boost-light,
  [data-theme-mode="dark"] .alert-card.boost-dark {
    --wac-fg: color-mix(in oklch, var(--color) 65%, var(--primary-text-color));
  }
  [data-theme-mode="light"] .alert-card.progress-boost-light,
  [data-theme-mode="dark"] .alert-card.progress-boost-dark {
    --wac-progress-fg: color-mix(in oklch, var(--color) 65%, var(--primary-text-color));
  }

  /* Badge text follows the card background color (knockout effect) so
     saturated pills read as windows into the page rather than dark markings
     on color. Event-color themes emit both --color-on-light and
     --color-on-dark inline; this rule picks the right one per theme mode. */
  [data-theme-mode="light"] .alert-card { --color-on: var(--color-on-light, #ffffff); }
  [data-theme-mode="dark"]  .alert-card { --color-on: var(--color-on-dark,  #1a1a1a); }

  /* Dark themes need a touch more wash to read at the same strength. */
  [data-theme-mode="dark"] .alert-card { --wac-progress-fill-opacity: 0.14; }

  .alert-card:last-child {
    margin-bottom: 0;
  }

  /* tap_action: the whole row is a keyboard-operable action target (the inline
     expand affordance is dropped). Only applied to actionable rows (present AND
     not action:none); inert rows carry no cursor/role/focus. */
  .alert-card.tappable {
    cursor: pointer;
  }
  .alert-card.tappable:focus-visible {
    outline: 2px solid var(--wac-focus-ring, var(--primary-color));
    outline-offset: 2px;
  }

  .alert-card::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 6px;
    background: var(--color);
  }

  .alert-card.severity-extreme,
  .alert-card.severity-severe {
    border-color: var(--color);
  }

  /* Rendered only for severe/extreme alerts. Sits under the content and the
     compact bar (z-index 0 vs 1/2) so it reads as a glowing inner edge. */
  .pulse-ring {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    z-index: 0;
    box-shadow: inset 0 0 0 2px var(--wac-fg);
    opacity: 0;
    animation: pulse-ring 2s ease-in-out infinite;
  }

  /* --- HEADER --- */
  .alert-header-row {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 16px;
  }

  .icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(var(--color-rgb), 0.1);
    color: var(--wac-fg);
    width: calc(44px * var(--wac-scale, 1));
    height: calc(44px * var(--wac-scale, 1));
    border-radius: 50%;
    flex-shrink: 0;
    box-sizing: border-box;
    border: 2px solid transparent;
    transition: border 0.2s, background 0.2s, color 0.2s;
  }

  /* Temporal state: active — icon "lights up" with solid ring */
  .active .icon-box {
    border-color: var(--color);
    background: rgba(var(--color-rgb), 0.12);
  }

  /* Temporal state: expired — dimmed */
  .expired .icon-box {
    border-color: var(--divider-color);
    opacity: 0.5;
  }
  .expired {
    opacity: 0.6;
  }

  /* Temporal state: preparation — dashed ring */
  .preparation .icon-box {
    border: 2px dashed var(--color);
  }

  /* Per-phase icon-ring border-style override (iconBorderStyle). Emitted as
     icon-border-<style> on the alert-card root, resolved per-alert from the
     phase. Only border-style is overridden; the phase rules above already set
     the ring color (var(--color)). Placed after the phase rules so the equal-
     specificity override wins on source order. Expired never receives a class. */
  .icon-border-dashed .icon-box {
    border-style: dashed;
  }
  .icon-border-solid .icon-box {
    border-style: solid;
  }
  .icon-box ha-icon { --mdc-icon-size: calc(26px * var(--wac-scale, 1)); }

  .info-box { flex-grow: 1; }

  .title-row { margin-bottom: 4px; }
  .alert-title {
    font-size: calc(1.15rem * var(--wac-scale, 1));
    font-weight: 600;
    line-height: 1.2;
    color: var(--primary-text-color);
  }

  .alert-headline {
    font-size: calc(0.8rem * var(--wac-scale, 1));
    line-height: 1.3;
    color: var(--secondary-text-color);
    margin-bottom: 4px;
  }

  .area-desc {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    font-size: calc(0.8rem * var(--wac-scale, 1));
    line-height: 1.4;
    color: var(--secondary-text-color);
    margin-bottom: 6px;
    max-width: 100%;
    opacity: 0.85;
  }
  .area-desc ha-icon {
    flex-shrink: 0;
    margin-top: 1px;
    --mdc-icon-size: calc(13px * var(--wac-scale, 1));
    width: calc(13px * var(--wac-scale, 1));
    height: calc(13px * var(--wac-scale, 1));
    opacity: 0.7;
  }
  .area-desc-text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Compact expanded headline + area-desc get consistent inner padding */
  .compact .alert-expanded .alert-headline {
    padding: 4px 12px 0;
    margin-bottom: 2px;
  }
  .compact .alert-expanded .area-desc {
    padding: 4px 12px 0;
    margin-bottom: 4px;
  }

  .badges-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    line-height: 1;
    font-size: calc(0.75rem * var(--wac-scale, 1));
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .severity-badge {
    background: var(--color);
    color: var(--color-on);
    font-weight: 700;
  }
  .certainty-badge {
    background: var(--secondary-background-color);
    color: var(--secondary-text-color);
    border: 1px solid var(--divider-color);
  }
  .phase-badge {
    background: var(--secondary-background-color);
    color: var(--secondary-text-color);
    border: 1px solid var(--divider-color);
  }
  .event-code-badge {
    background: var(--secondary-background-color);
    color: var(--secondary-text-color);
    border: 1px solid var(--divider-color);
    font-family: monospace;
    text-transform: none;
    letter-spacing: 1px;
  }
  .badge-inferred {
    font-style: italic;
  }
  .badge-inferred::before {
    content: '~';
    opacity: 0.6;
    margin-right: 1px;
  }

  .zones-badge {
    background: transparent;
    color: var(--secondary-text-color);
    border: none;
    padding: 2px 0;
    font-weight: 400;
  }
  .zones-badge::before { content: '('; opacity: 0.5; }
  .zones-badge::after { content: ')'; opacity: 0.5; }

  /* --- PROGRESS --- */
  .progress-section {
    padding: 0 16px 16px 16px;
  }

  .progress-labels {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    font-size: calc(0.85rem * var(--wac-scale, 1));
    color: var(--primary-text-color);
    margin-bottom: 6px;
  }

  .label-left, .label-center, .label-right {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .label-sub {
    font-size: calc(0.7rem * var(--wac-scale, 1));
    color: var(--secondary-text-color);
    text-transform: uppercase;
  }
  .label-center {
    text-align: center;
    font-weight: bold;
    color: var(--wac-fg);
    white-space: nowrap;
  }
  .label-right { text-align: right; }

  .progress-track {
    height: 8px;
    background: var(--secondary-background-color);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    position: absolute;
    top: 0;
    overflow: hidden;
    transition: width 0.3s ease;
  }

  /* Phase classes supply a FILLED base (progress color) + flow direction; the
     .deco-* classes below add only the pattern/animation on top. A filled base
     is what makes solid/shimmer/pulse visible in any phase. Every phase renders
     at full opacity — dimness is not a phase cue (phase is read from the stripe
     flow direction, the fill behavior, the icon ring, and the labels). Striped
     is the one decoration that is never a filled bar: it is a "barber pole" of
     solid progress-color stripes on an empty track in every phase (see the
     .deco-striped override below). */
  .active .progress-fill {
    background-color: var(--wac-progress-fg);
  }

  .expired .progress-fill {
    background-color: var(--divider-color);
  }

  .preparation .progress-fill {
    background-color: var(--wac-progress-fg);
    --wac-flow: -1;
  }
  /* Striped is a barber pole in every phase: solid color stripes on an empty
     track, never a filled bar. Clear whatever fill the phase set. Equal
     specificity to the phase rules, placed after them so it wins on source
     order in full mode. */
  .deco-striped .progress-fill {
    background-color: transparent;
  }

  /* --- PROGRESS DECORATIONS (pattern + animation, phase-independent) ---
     Emitted as deco-<pattern> on the alert-card root from progressStyle. Each
     rule pairs a full-mode selector with its compact equivalent. Direction/tile/
     duration are supplied by the phase via --wac-flow / --wac-stripe-tile /
     --wac-stripe-dur so any pattern adopts the phase it lands in.

     Moving patterns (striped, shimmer) are painted on a surface that overhangs
     the bar by one bar width at each end and are animated with transform only
     (see MOTION above). In full mode that surface is .progress-fill::after,
     clipped by the fill's overflow:hidden. In compact mode the bar *is* the
     ::before pseudo-element, which cannot carry children, so the ::before itself
     is the overhanging surface (see .compact .alert-card::before) and ::after
     covers the elapsed portion on top instead of laying a track underneath. */
  .deco-solid .progress-fill,
  .compact .deco-solid.alert-card::before {
    background-image: none;
    animation: none;
  }

  .deco-striped .progress-fill::after,
  .deco-shimmer .progress-fill::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: -100%;
    right: -100%;
  }

  .deco-striped .progress-fill::after,
  .compact .deco-striped.alert-card::before {
    background-image: linear-gradient(
      -45deg,
      var(--wac-progress-fg) 25%,
      transparent 25%,
      transparent 50%,
      var(--wac-progress-fg) 50%,
      var(--wac-progress-fg) 75%,
      transparent 75%
    );
    background-size: var(--wac-stripe-tile, 24px) var(--wac-stripe-tile, 24px);
    /* steps(), not linear: a composited texture drawn at a fractional pixel
       offset is bilinear-resampled, which blurs the diagonal edges and makes
       the slow (4px/s) crawl look like it swims. Stepping one device pixel at a
       time keeps every frame pixel-exact. --wac-stripe-steps is the tile in
       device pixels (24 full / 12 compact, scaled by the dppx blocks below). */
    animation: stripe-march var(--wac-stripe-dur, 6s) steps(var(--wac-stripe-steps, 24)) infinite;
  }
  @media (min-resolution: 2dppx) {
    .deco-striped .progress-fill::after { --wac-stripe-steps: 48; }
    .compact .deco-striped.alert-card::before { --wac-stripe-steps: 24; }
  }
  @media (min-resolution: 3dppx) {
    .deco-striped .progress-fill::after { --wac-stripe-steps: 72; }
    .compact .deco-striped.alert-card::before { --wac-stripe-steps: 36; }
  }

  .deco-shimmer .progress-fill::after,
  .compact .deco-shimmer.alert-card::before {
    background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%);
    background-size: 13.333% 100%;
    background-position: 50% 0;
    background-repeat: no-repeat;
    animation: fill-shimmer 5s ease-in-out infinite;
  }

  .deco-pulse .progress-fill,
  .compact .deco-pulse.alert-card::before {
    animation: ongoing-pulse 5s infinite;
  }

  /* --- DETAILS (custom toggle, not native <details>) --- */
  .alert-details-section {
    border-top: 1px solid var(--divider-color);
    background: rgba(var(--rgb-primary-text-color), 0.02);
  }

  .details-summary {
    padding: 10px 16px;
    font-size: calc(0.9rem * var(--wac-scale, 1));
    font-weight: 500;
    color: var(--secondary-text-color);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.2s;
    user-select: none;
  }
  .details-summary:hover {
    background: rgba(var(--color-rgb), 0.05);
    color: var(--primary-text-color);
  }

  .chevron {
    transition: transform 0.2s;
  }
  .chevron.expanded {
    transform: rotate(180deg);
  }

  .details-content {
    padding: 16px;
    font-size: calc(0.9rem * var(--wac-scale, 1));
  }

  /* Details Grid */
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px dashed var(--divider-color);
  }

  .meta-item { display: flex; flex-direction: column; }
  .meta-label {
    font-size: calc(0.7rem * var(--wac-scale, 1));
    color: var(--secondary-text-color);
    text-transform: uppercase;
  }
  .meta-value {
    font-weight: 500;
    color: var(--primary-text-color);
  }
  /* AREA row collapse toggle (#322): a text button that reads as the tail of
     the sentence ("City of Regina" + "and 111 more areas"). */
  .area-toggle {
    align-self: flex-start;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    font-size: calc(0.8rem * var(--wac-scale, 1));
    color: var(--secondary-text-color);
    cursor: pointer;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }
  .area-toggle:hover,
  .area-toggle:focus-visible {
    color: var(--primary-text-color);
    outline: none;
  }
  .meta-relative {
    font-size: calc(0.75rem * var(--wac-scale, 1));
    color: var(--secondary-text-color);
    font-style: italic;
  }

  /* --- GEOMETRY MINI-MAP (opt-in): cap_alerts polygon/bbox, or a marker at a
     point-incident's location (NSW RFS and any point-carrying source) --- */
  .alert-geometry {
    display: block;
    width: 100%;
    max-width: 260px;
    height: 120px;
    margin: 0 auto 16px;
    /* No basemap — the shape reads against the panel background. The merged
       outline is stroked on the OUTSIDE of a shape that spans the viewBox, so
       it may spill a hair past the frame; keep it rather than clip it. */
    overflow: visible;
  }
  .alert-geometry .geometry-frame {
    fill: rgba(var(--color-rgb), 0.04);
    stroke: var(--divider-color);
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }
  /* The affected area is one path: a nonzero fill painted once over the
     union of every region, and the same path stroked under a mask that keeps
     only the half of the stroke outside the shape (#348). Interior region
     borders fall entirely inside and vanish; stroke widths here are doubled
     so the visible outer half keeps the intended weight. */
  .alert-geometry .geometry-fill {
    fill: rgba(var(--color-rgb), 0.18);
    stroke: none;
  }
  .alert-geometry .geometry-shape {
    fill: none;
    stroke: var(--wac-fg, var(--color));
    stroke-width: 3px;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  /* A synthesized point frame is an invented viewport, not an affected area —
     the tint would claim otherwise, so it goes untinted. */
  .alert-geometry.point .geometry-frame {
    fill: none;
  }
  /* Markers are sub-pixel paths sized entirely by a round-capped, non-scaling
     stroke, so they stay the same on-screen size whatever the viewBox scale.
     The incident is the subject: a filled, severity-colored dot. The user's
     own location is reference chrome: a smaller neutral ring, built from a
     neutral outer dot with a background-colored core stacked on top — shape
     and weight carry the hierarchy, not a new hue. */
  .alert-geometry .geometry-marker {
    fill: none;
    stroke: var(--wac-fg, var(--color));
    stroke-width: 10px;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .alert-geometry .geometry-marker-casing {
    fill: none;
    stroke: rgba(255, 255, 255, 0.85);
    stroke-width: 14px;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .alert-geometry .geometry-reference-ring {
    fill: none;
    stroke: var(--secondary-text-color);
    stroke-width: 8px;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .alert-geometry .geometry-reference-core {
    fill: none;
    stroke: var(--wac-surface, var(--card-background-color, #fff));
    stroke-width: 4px;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }

  /* Map style: raster tiles behind the polygon. The wrapper carries an inline
     aspect-ratio (matching the tile viewBox) so tiles fill with no letterbox. */
  .alert-geometry-map {
    position: relative;
    display: block;
    width: 100%;
    max-width: 320px;
    max-height: 220px;
    margin: 0 auto 16px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--divider-color);
  }
  .alert-geometry.map {
    display: block;
    width: 100%;
    height: 100%;
    margin: 0;
    max-width: none;
    overflow: hidden;
  }
  .alert-geometry.map image {
    image-rendering: auto;
  }
  /* HA's proxy serves one light raster. Dark themes invert the tile layer the
     way HA's own map does; a theme that sets --map-filter wins either way. The
     polygon and frame sit outside the group so they keep their true colors. */
  .alert-geometry.map .geometry-tiles {
    filter: var(--map-filter, none);
  }
  .alert-geometry.map.dark .geometry-tiles {
    filter: var(--map-filter, invert(0.9) hue-rotate(170deg) brightness(1.5) contrast(1.2) saturate(0.3));
  }
  /* Over tiles the bbox frame is just a hairline; the polygon does the work. */
  .alert-geometry.map .geometry-frame {
    fill: none;
    stroke: rgba(var(--rgb-primary-text-color, 128, 128, 128), 0.25);
  }
  .alert-geometry.map .geometry-fill {
    fill: rgba(var(--color-rgb), 0.22);
  }
  .alert-geometry.map .geometry-shape {
    stroke-width: 4px;
  }
  /* White casing under the colored stroke keeps the outline legible over busy
     tiles (light or dark). Masked like the stroke, so it reads as a halo on
     the outside of the merged edge only. */
  .alert-geometry.map .geometry-shape-casing {
    fill: none;
    stroke: rgba(255, 255, 255, 0.85);
    stroke-width: 8px;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  /* Over tiles the dot reads slightly smaller under its white casing, and the
     ring's core is white like the casing (tiles are light, or inverted from
     light) rather than the card surface. */
  .alert-geometry.map .geometry-marker {
    stroke-width: 9px;
  }
  .alert-geometry.map .geometry-reference-core {
    stroke: rgba(255, 255, 255, 0.95);
  }
  .geometry-attrib {
    position: absolute;
    right: 0;
    bottom: 0;
    font-size: 9px;
    line-height: 1.2;
    padding: 1px 4px;
    color: #333;
    background: rgba(255, 255, 255, 0.7);
    border-top-left-radius: 4px;
    pointer-events: none;
  }

  .text-block { margin-bottom: 16px; }
  .text-label {
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--primary-text-color);
  }
  .text-body {
    white-space: pre-wrap;
    color: var(--secondary-text-color);
    line-height: 1.5;
    background: var(--primary-background-color);
    padding: 10px;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
  }

  .provider-hint {
    font-size: calc(0.7rem * var(--wac-scale, 1));
    color: var(--secondary-text-color);
    letter-spacing: 0.5px;
    opacity: 0.5;
    margin-right: 6px;
    flex-shrink: 0;
  }
  .provider-hint::after {
    content: '·';
    margin-left: 6px;
    opacity: 0.6;
  }
  .footer-link { text-align: right; margin-top: 10px; }
  .footer-link a {
    color: var(--wac-fg);
    text-decoration: none;
    font-weight: 500;
    font-size: calc(0.85rem * var(--wac-scale, 1));
  }

  /* --- DISMISS BUTTON --- */
  .dismiss-button {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    margin: 0;
    flex-shrink: 0;
    width: calc(24px * var(--wac-scale, 1));
    height: calc(24px * var(--wac-scale, 1));
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--secondary-text-color);
    opacity: 0.6;
    transition: opacity 0.2s, background 0.2s;
    --mdc-icon-size: calc(18px * var(--wac-scale, 1));
  }
  .dismiss-button:hover,
  .dismiss-button:focus-visible {
    opacity: 1;
    background: rgba(var(--rgb-primary-text-color, 128, 128, 128), 0.08);
    outline: none;
  }
  /* Full layout: corner-tuck the dismiss button as window-decoration so it
     doesn't reserve space in the flex flow (which would squeeze title,
     headline, area, and badges). Labeled variant overrides position below
     to sit flush against the card's rounded corner. */
  .alert-header-row:not(.compact-row) > .dismiss-button {
    position: absolute;
    top: 6px;
    right: 6px;
    margin-left: 0;
  }
  .compact-row > .dismiss-button {
    margin-left: 4px;
  }

  /* Labeled dismiss button (full layout only) — window-decoration placement:
     absolute at top-right of the card, outside the header flex flow, so title,
     headline, area, and badges flow full row width. The button is visually
     subtle and overlays the rare long title that reaches its column. */
  .dismiss-button.labeled {
    border-left: 1px solid var(--divider-color);
    border-bottom: 1px solid var(--divider-color);
    border-radius: 12px;
    padding: 2px 8px 2px 4px;
    color: var(--secondary-text-color);
    opacity: 1;
    gap: 4px;
    font-size: calc(0.78rem * var(--wac-scale, 1));
    width: auto;
    height: auto;
    --mdc-icon-size: calc(16px * var(--wac-scale, 1));
  }
  .dismiss-button.labeled:hover,
  .dismiss-button.labeled:focus-visible {
    background: rgba(var(--rgb-primary-text-color, 128, 128, 128), 0.08);
    opacity: 1;
  }
  .alert-header-row:not(.compact-row) > .dismiss-button.labeled {
    position: absolute;
    top: 0px;
    right: 0px;
    margin-left: 0;
  }
  /* Compact row: revert labeled button to icon-only */
  .compact-row > .dismiss-button.labeled {
    border: none;
    border-radius: 50%;
    padding: 0;
    color: var(--secondary-text-color);
    gap: 0;
    font-size: inherit;
    width: calc(24px * var(--wac-scale, 1));
    height: calc(24px * var(--wac-scale, 1));
    --mdc-icon-size: calc(18px * var(--wac-scale, 1));
  }
  .compact-row > .dismiss-button.labeled span {
    display: none;
  }

  /* --- SWIPE GESTURE ---
     swipe-enabled: applied whenever pointer drag-to-dismiss is wired up. Sets
     touch-action so vertical scroll stays native while horizontal is reserved
     for the JS gesture; shows the grab cursor on hover. */
  .alert-card.swipe-enabled {
    touch-action: pan-y;
    cursor: grab;
  }
  .alert-card.swiping {
    transition: none !important;
    user-select: none;
    cursor: grabbing;
  }
  .alert-card.swipe-exit {
    transform: translateX(-110%) !important;
    opacity: 0 !important;
    transition: transform 0.2s ease-in, opacity 0.2s ease-in !important;
  }
  @media (prefers-reduced-motion: reduce) {
    .alert-card.swipe-exit {
      transition: none !important;
    }
  }

  /* --- COMPACT LAYOUT --- */
  .compact .alert-card {
    margin-bottom: var(--wac-alert-gap, 4px);
    border-radius: var(--wac-alert-border-radius, 8px);
  }

  /* Re-assert the last-child gap reset for compact: the generic
     .alert-card:last-child rule above has equal specificity but loses on
     source order to .compact .alert-card, which would otherwise leave a
     trailing --wac-alert-gap below the last chip (visible as stray bottom
     margin, and previously hand-patched with margin-bottom:0 !important). */
  .compact .alert-card:last-child {
    margin-bottom: 0;
  }

  .compact .alert-card::before {
    display: block;
    top: auto;
    bottom: 0;
    /* Spans the full width plus a one-width overhang each side so a moving
       pattern (stripes, shimmer) can slide under the card's overflow clip. The
       elapsed portion up to --progress is covered by ::after, which is what
       gives the bar its visible left edge. */
    left: -100%;
    right: -100%;
    width: auto;
    height: 4px;
    border-radius: 0;
    z-index: 1;
    /* Compact mini-bar uses a smaller stripe tile and faster march than the
       full progress-fill; scoped to the ::before so the compact-expanded
       .progress-fill keeps the 24px / 6s defaults. */
    --wac-stripe-tile: 12px;
    --wac-stripe-steps: 12;
    --wac-stripe-dur: 3s;
  }

  .compact .alert-header-row.compact-row {
    padding: 8px 12px;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }
  .compact .alert-header-row.compact-row:hover {
    background: rgba(var(--color-rgb), 0.05);
  }

  .compact .icon-box {
    width: calc(32px * var(--wac-scale, 1));
    height: calc(32px * var(--wac-scale, 1));
  }
  .compact .icon-box ha-icon {
    --mdc-icon-size: calc(18px * var(--wac-scale, 1));
  }

  .compact .alert-title {
    font-size: calc(0.95rem * var(--wac-scale, 1));
    flex-grow: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact-time {
    font-size: calc(0.8rem * var(--wac-scale, 1));
    color: var(--wac-fg);
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .compact-chevron {
    color: var(--secondary-text-color);
    transition: transform 0.2s;
    flex-shrink: 0;
    --mdc-icon-size: calc(20px * var(--wac-scale, 1));
  }
  .compact-chevron.expanded {
    transform: rotate(180deg);
  }

  .compact .alert-expanded {
    padding-top: 4px;
    border-top: 1px solid var(--divider-color);
  }

  /* Compact track: ::after paints the elapsed portion (0 → --progress) in the
     track color ON TOP of the full-width ::before fill, so the fill's visible
     left edge is a clip, not a position, and the fill can translate freely. */
  .compact .alert-card::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: var(--progress, 0%);
    height: 4px;
    background: var(--secondary-background-color);
    z-index: 2;
  }
  /* Ongoing never has an elapsed portion, so ::after reverts to a full-width
     track underneath the fill (keeps the pulse trough on the track color). */
  .compact .ongoing.alert-card::after {
    width: 100%;
    z-index: 0;
  }
  /* Compact phase rules mirror the full-mode split: base color / position /
     flow only; the pattern + animation comes from the .deco-* classes above. */
  .compact .active.alert-card::before {
    background-color: var(--wac-progress-fg);
  }
  .compact .expired.alert-card::before {
    background-color: var(--divider-color);
  }
  .compact .preparation.alert-card::before {
    background-color: var(--wac-progress-fg);
    --wac-flow: -1;
  }
  /* Compact striped: barber pole on an empty track (mirrors full mode). These
     phase+deco selectors outrank the compact phase rules above, so the fill is
     cleared in either source order. All phases render full-strength progress-
     color stripes — no dim tint. */
  .compact .preparation.deco-striped.alert-card::before,
  .compact .active.deco-striped.alert-card::before,
  .compact .ongoing.deco-striped.alert-card::before {
    /* The track color, not transparent: nothing lies under the un-elapsed part
       of the ::before any more (see the ::after cover), so the gaps between
       stripes paint the track themselves. */
    background-color: var(--secondary-background-color);
  }
  .compact .ongoing.alert-card::before {
    /* Color longhand only, so a non-default ongoing pattern's background-image
       (from a .deco-* class) survives; the shorthand would reset it. */
    background-color: var(--wac-progress-fg);
  }

  /* --- TIMELINE LAYOUT ---
     One shared axis; each alert is a row of gutter | lane (| dismiss). The row
     keeps .alert-card for its token block only (--color, --wac-fg, boosts and
     the phase classes) and every piece of row chrome is stripped here, as the
     detail dialog does. The bar is a static per-phase surface: what moves is
     the now marker, drawn as one segment per lane at --wac-tl-now (set once on
     .timeline-body; the ha-card carries .timeline like .compact) and
     overhanging the row gap so the segments join into a single line. The only
     motion is the ongoing breathe on the bar and the severe/extreme ring on
     the icon chip, both opacity-only (see MOTION). */
  .timeline-body {
    --wac-tl-gutter: clamp(96px, 40%, 280px);
    --wac-tl-row: calc(36px * var(--wac-scale, 1));
    --wac-tl-axis: calc(18px * var(--wac-scale, 1));
    --wac-tl-gap: 4px;
    --wac-tl-bar: calc(10px * var(--wac-scale, 1));
    --wac-tl-arrow-len: calc(7px * var(--wac-scale, 1));
    --wac-tl-now-color: var(--primary-text-color);
    /* The axis is the first thing in the card: content-area padding when it
       starts at the card edge, a smaller gap under a header's own padding. */
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: var(--wac-tl-gap);
  }
  .timeline-body.headed {
    padding-top: 4px;
  }
  .timeline-axis,
  .timeline .alert-card {
    display: grid;
    grid-template-columns: var(--wac-tl-gutter) minmax(0, 1fr);
    align-items: center;
    column-gap: 10px;
  }
  /* The dismiss column exists only when the card can dismiss, on the axis too,
     so the axis lane and the row lanes always share one width. */
  .timeline-body.dismissable .timeline-axis,
  .timeline-body.dismissable .alert-card {
    grid-template-columns: var(--wac-tl-gutter) minmax(0, 1fr) auto;
  }
  .timeline-dismiss-spacer {
    width: calc(24px * var(--wac-scale, 1));
  }
  .timeline .alert-card {
    margin: 0;
    padding: 0;
    border: none;
    border-radius: var(--wac-alert-border-radius, 8px);
    box-shadow: none;
    background: transparent;
    min-height: var(--wac-tl-row);
    overflow: visible; /* the now segments overhang the row gap */
  }
  .timeline .alert-card::before,
  .timeline .alert-card::after {
    content: none; /* no accent bar, no track */
  }
  .timeline .alert-card.tappable:hover {
    background: rgba(var(--color-rgb), 0.05);
  }

  .timeline-gutter {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  /* Name over the one-phrase time state ("for 3h"), both ellipsized to the
     gutter: the stack keeps the name's width instead of sharing a line. */
  .timeline-gutter-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.25;
  }
  .timeline-time {
    font-size: calc(0.7rem * var(--wac-scale, 1));
    color: var(--secondary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .timeline .icon-box {
    position: relative; /* hosts the severe/extreme .pulse-ring */
    width: calc(28px * var(--wac-scale, 1));
    height: calc(28px * var(--wac-scale, 1));
  }
  .timeline .icon-box ha-icon {
    --mdc-icon-size: calc(16px * var(--wac-scale, 1));
  }
  .timeline .alert-title {
    font-size: calc(0.9rem * var(--wac-scale, 1));
    font-weight: 500;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* A bar's length is its duration, so the most urgent alert is often the
     smallest mark on the axis. Weight on the name gives the severe tiers a
     second channel that is not color (the chip's pulse ring is the first). */
  .timeline .severity-extreme .alert-title,
  .timeline .severity-severe .alert-title {
    font-weight: 600;
  }

  .timeline-lane {
    position: relative;
    height: var(--wac-tl-row);
    min-width: 0;
  }
  /* Now marker: one segment per lane, reaching up through the row gap above
     so the segments read as one line down the card. Only upward: the marker
     is translucent, and segments overhanging both ways stacked in every gap,
     a brighter dash between each pair of rows. The first row's segment meets
     the axis head. */
  .timeline-lane::after {
    content: "";
    position: absolute;
    top: calc(-1 * var(--wac-tl-gap));
    bottom: 0;
    left: var(--wac-tl-now, 11.111%);
    width: 2px;
    margin-left: -1px;
    background: var(--wac-tl-now-color);
    opacity: 0.7;
    pointer-events: none;
    z-index: 2;
  }

  .timeline-bar {
    position: absolute;
    top: 50%;
    height: var(--wac-tl-bar);
    margin-top: calc(var(--wac-tl-bar) / -2);
    min-width: 2px;
    border-radius: calc(var(--wac-tl-bar) / 2);
    background-color: var(--wac-progress-fg);
    z-index: 1;
  }
  /* Phase surfaces, fixed (progressStyle does not apply): preparation is a
     static barber pole on the track color, expired the divider grey (the row's
     .expired opacity dims the rest), ongoing breathes. Active is the plain fill. */
  .timeline .preparation .timeline-bar {
    background-color: var(--secondary-background-color);
    background-image: linear-gradient(
      -45deg,
      var(--wac-progress-fg) 25%,
      transparent 25%,
      transparent 50%,
      var(--wac-progress-fg) 50%,
      var(--wac-progress-fg) 75%,
      transparent 75%
    );
    background-size: var(--wac-tl-bar) var(--wac-tl-bar);
  }
  .timeline .expired .timeline-bar {
    background-color: var(--divider-color);
  }
  /* Bar and arrowheads breathe as one layer. Two animations would stay in
     step only if both elements were created on the same frame, and an
     arrowhead is added whenever a re-render first clips the bar, so it drifted
     out of phase with a bar already running.
     The span hangs one arrowhead past each lane edge, because a mask clips
     everything outside its box, and the inner lane box puts the bar's
     percentages back in lane coordinates. */
  .timeline-span {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(-1 * var(--wac-tl-arrow-len));
    right: calc(-1 * var(--wac-tl-arrow-len));
  }
  .timeline-span-lane {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--wac-tl-arrow-len);
    right: var(--wac-tl-arrow-len);
  }
  /* Elapsed time recedes: everything left of now, arrowhead included, drops
     to 40% so the bright part of a bar is what remains (the default layout's
     fill reads the same way). One mask over bar and arrowheads, so they dim
     as a unit, and its hard edge sits under the now marker. An expired bar is
     all past and already grey, so it is left alone. */
  .timeline-row:not(.expired) .timeline-span {
    --wac-tl-elapsed: calc(var(--wac-tl-arrow-len) + (100% - 2 * var(--wac-tl-arrow-len)) * var(--wac-tl-now-f, 0.11111));
    -webkit-mask-image: linear-gradient(to right, rgba(0, 0, 0, 0.4) var(--wac-tl-elapsed), #000 var(--wac-tl-elapsed));
    mask-image: linear-gradient(to right, rgba(0, 0, 0, 0.4) var(--wac-tl-elapsed), #000 var(--wac-tl-elapsed));
  }
  /* Severity in shape: a bar's length is its duration, so the most urgent
     alert is often the smallest mark. The severe tiers draw a thicker bar,
     and the arrowheads, sized off it, follow. */
  .timeline .severity-extreme,
  .timeline .severity-severe {
    --wac-tl-bar: calc(14px * var(--wac-scale, 1));
  }
  /* Local midnights in wide windows: a divider-grey line down every lane,
     under the bars, reaching up through the gap like the now marker (HA's
     divider is translucent too, so the same no-overlap rule applies). */
  .timeline-day-line {
    position: absolute;
    top: calc(-1 * var(--wac-tl-gap));
    bottom: 0;
    width: 1px;
    background: var(--divider-color);
    pointer-events: none;
  }
  .timeline .ongoing .timeline-span {
    animation: ongoing-pulse 5s infinite;
  }

  /* Each right end is its own sign: a rounded cap ends here, an arrowhead
     continues past the window (same on the left for "started before it"), and
     a bar that dissolves has no known end. The arrowhead is a triangle in the
     bar's color, a little taller than the bar and hung just past the lane edge,
     so it points off the axis. It is a sibling of the bar, not a child: a cut
     bar always meets the lane edge, and the open-end mask below would fade a
     child of the bar to nothing (an open-ended alert that began before the
     window lost its arrowhead that way). */
  .timeline-bar.clip-start {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .timeline-bar.clip-end {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  .timeline-clip {
    --wac-tl-arrow: calc(var(--wac-tl-bar) / 2 + 2px);
    position: absolute;
    top: 50%;
    z-index: 1;
    width: 0;
    height: 0;
    margin-top: calc(-1 * var(--wac-tl-arrow));
    border-top: var(--wac-tl-arrow) solid transparent;
    border-bottom: var(--wac-tl-arrow) solid transparent;
  }
  /* Each arrowhead overlaps its bar by 1px. Butted exactly, both edges land
     on the same fractional pixel and anti-alias, leaving a dark seam. The
     overlap cannot double up: the span's opacity applies to the group. */
  .timeline-clip.start {
    left: calc(1px - var(--wac-tl-arrow-len));
    border-right: var(--wac-tl-arrow-len) solid var(--wac-progress-fg);
  }
  .timeline-clip.end {
    right: calc(1px - var(--wac-tl-arrow-len));
    border-left: var(--wac-tl-arrow-len) solid var(--wac-progress-fg);
  }
  .timeline .expired .timeline-clip.start { border-right-color: var(--divider-color); }
  .timeline .expired .timeline-clip.end { border-left-color: var(--divider-color); }
  /* Entirely outside the window: no bar, just the arrowhead at that edge. */
  .timeline-bar.off-axis {
    display: none;
  }
  /* No known end: run to the edge and dissolve. No glyph here on purpose —
     solid shapes (cap, arrowhead) are for known facts, and a second glyph in
     the arrowhead's slot would read as inconsistency rather than meaning.
     The fade is the last 64px, floored at half the bar so a short bar (an
     open-ended alert starting late in the window) keeps a solid half rather
     than dissolving entirely. */
  .timeline-bar.open-end {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    -webkit-mask-image: linear-gradient(to right, #000 max(50%, calc(100% - 64px * var(--wac-scale, 1))), transparent 100%);
    mask-image: linear-gradient(to right, #000 max(50%, calc(100% - 64px * var(--wac-scale, 1))), transparent 100%);
  }

  .timeline-axis {
    font-size: calc(0.7rem * var(--wac-scale, 1));
    color: var(--secondary-text-color);
  }
  .timeline-axis .timeline-lane {
    height: var(--wac-tl-axis);
  }
  .timeline-axis .timeline-lane::after {
    content: none; /* the head below stands in for the segment */
  }
  .timeline-tick {
    position: absolute;
    top: 0;
    padding-left: 3px;
    line-height: var(--wac-tl-axis);
    white-space: nowrap;
  }
  .timeline-tick::before {
    content: "";
    position: absolute;
    left: 0;
    bottom: 0;
    width: 1px;
    height: 4px;
    background: currentColor;
    opacity: 0.6;
  }
  /* A tick near the right edge hangs its label to the left of the mark. */
  .timeline-tick.edge {
    padding-left: 0;
    padding-right: 3px;
    transform: translateX(-100%);
  }
  .timeline-tick.edge::before {
    left: auto;
    right: 0;
  }
  .timeline-tick.quiet {
    padding: 0; /* mark only */
  }
  .timeline-tick.day {
    font-weight: 600;
    color: var(--primary-text-color);
  }
  /* The clock time beside the head, so "now" needs no reading off the ticks.
     Neighbouring ticks within a label of it go mark-only. */
  .timeline-now-label {
    position: absolute;
    top: 0;
    left: var(--wac-tl-now, 11.111%);
    padding-left: 6px;
    line-height: var(--wac-tl-axis);
    white-space: nowrap;
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .timeline-now-head {
    position: absolute;
    bottom: -3px;
    left: var(--wac-tl-now, 11.111%);
    width: 0;
    height: 0;
    margin-left: -5px;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid var(--wac-tl-now-color);
    z-index: 3;
  }

  /* --- PROGRESS FILL: whole-row wash (progressFill: background) ---
     Opt-in Bubble-Card-style surface: instead of the thin track, the entire
     alert row fills as a low-opacity wash of the progress color, behind the
     content, growing to the --progress point (the exact geometry the thin
     track uses today). Full mode paints the wash on .alert-card::after (::before
     is the 6px accent bar); compact grows its existing ::before fill to full
     height. Content wrappers are lifted to z-index:1 so text stays legible. */

  /* Full-mode wash */
  .fill-mode-background:not(.compact) .alert-card::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--progress, 0%);
    right: 0;
    z-index: 0;
    background: var(--wac-progress-fill-color);
    opacity: var(--wac-progress-fill-opacity);
    transition: left 0.3s ease;
    pointer-events: none;
  }
  .fill-mode-background:not(.compact) .expired.alert-card::after {
    left: 0;
    opacity: var(--wac-progress-fill-expired-opacity);
  }
  /* Hide the now-redundant thin track wherever it renders (the full-mode section
     and the compact expanded section both draw one) — the textual progress
     labels stay. */
  .fill-mode-background .progress-track {
    display: none;
  }

  /* Compact-mode wash: grow the existing ::before fill from a 4px bottom bar to
     a full-height surface, recolor it to the wash token, drop the grey track
     base (::after), and keep it a quiet solid (no per-phase deco texture). */
  .fill-mode-background.compact .alert-card::before {
    top: 0;
    height: auto;
    /* Back to a positioned edge: the wash has no ::after cover (hidden below)
       and never carries a moving pattern (the frozen-shimmer freeze rule
       excludes it too). */
    left: var(--progress, 0%);
    right: 0;
    transform: none;
    z-index: 0;
    opacity: var(--wac-progress-fill-opacity);
    background-image: none;
    animation: none;
  }
  .fill-mode-background.compact .active.alert-card::before,
  .fill-mode-background.compact .preparation.alert-card::before,
  .fill-mode-background.compact .ongoing.alert-card::before {
    background-color: var(--wac-progress-fill-color);
  }
  .fill-mode-background.compact .expired.alert-card::before {
    left: 0;
    background-color: var(--wac-progress-fill-color);
    opacity: var(--wac-progress-fill-expired-opacity);
  }
  .fill-mode-background.compact .alert-card::after {
    display: none;
  }

  /* Lift content above the z-index:0 wash so text/icons never sit under it. */
  .fill-mode-background .alert-header-row,
  .fill-mode-background .alert-expanded,
  .fill-mode-background .progress-section,
  .fill-mode-background .alert-details-section {
    position: relative;
    z-index: 1;
  }

  /* --- NO ANIMATIONS --- */
  .no-animations .alert-card {
    animation: none !important;
  }
  .no-animations .pulse-ring {
    display: none;
  }
  .no-animations .timeline-span {
    animation: none !important;
  }
  .no-animations .progress-fill,
  .no-animations .progress-fill::after,
  .no-animations .alert-card::before,
  .no-animations .alert-card::after {
    animation: none !important;
    transition: none !important;
  }
  /* Frozen shimmer: park the band half-visible at the bar's leading edge (the
     former -33% background-position), not off-screen, so the pattern still
     reads as shimmer at rest. */
  .no-animations .deco-shimmer .progress-fill::after,
  .no-animations.compact:not(.fill-mode-background) .deco-shimmer.alert-card::before {
    transform: translateX(calc(var(--wac-flow, 1) * -16.667%)) !important;
  }

  /* --- PREVIEW LABEL --- */
  .preview-label {
    text-align: center;
    font-size: calc(0.75rem * var(--wac-scale, 1));
    font-style: italic;
    color: var(--secondary-text-color);
    padding: 8px 16px 0;
    opacity: 0.7;
  }

  /* --- PER-ALERT DETAIL POP-UP (tap_action: { action: details }) --- */
  /* The dialog renders as a sibling of <ha-card>, outside the context that
     normally supplies the per-row tokens (data-theme-mode on the card root,
     --color/--wac-fg on .alert-card). So .detail-dialog-body carries the former
     and its inner row re-uses .alert-card for the latter — the row chrome is
     then stripped below, because inside a dialog the alert *is* the surface.
     Only the severity spine survives, as the one carry-over cue. */
  /* A NATIVE <dialog>, not <ha-dialog>: HA changed that element's API
     incompatibly in 2026.02 and the card spans both sides of the split. See
     the comment on _renderDetailPopup. showModal() supplies the scrim, focus
     trap and Esc, so only the surface is styled here. */
  dialog.detail-dialog {
    width: min(560px, 92vw);
    max-width: min(560px, 92vw);
    max-height: 86vh;
    padding: 0;
    border: none;
    border-radius: var(--ha-card-border-radius, 12px);
    background: var(--ha-card-background, var(--card-background-color, #fff));
    color: var(--primary-text-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    overflow: hidden;
  }
  dialog.detail-dialog::backdrop {
    background: rgba(0, 0, 0, 0.55);
  }
  /* Sits in the alert header row where the dismiss button sits on a real row,
     so it inherits that slot's alignment. A touch larger than .dismiss-button:
     this is the modal's only pointer affordance besides the scrim. */
  .detail-dialog-close {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: calc(32px * var(--wac-scale, 1));
    height: calc(32px * var(--wac-scale, 1));
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--secondary-text-color);
    cursor: pointer;
  }
  .detail-dialog-close:hover {
    background: var(--secondary-background-color);
  }
  .detail-dialog-close:focus-visible {
    outline: 2px solid var(--wac-focus-ring, var(--primary-color));
    outline-offset: 2px;
  }
  .detail-dialog-close ha-icon {
    --mdc-icon-size: calc(20px * var(--wac-scale, 1));
  }

  /* A long description scrolls inside the dialog, never the dashboard behind
     it (overscroll-behavior stops the scroll chaining at the edge). Matches the
     dialog's own max-height, which has no padding of its own. */
  .detail-dialog-body {
    max-height: 86vh;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .detail-dialog-body .alert-card {
    margin-bottom: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
    /* No severe/extreme pulse here: the dialog renders the body straight into
       its own frame (no .pulse-ring), since a modal already has the user's full
       attention and a breathing edge would only compete with the text. */
  }

  /* --- EMPTY STATE --- */
  .no-alerts {
    padding: 20px;
    text-align: center;
    font-style: italic;
    /* Explicit muted token rather than opacity: keeps the all-clear legible in
       both themes (opacity of inherited text can wash out on dark) and, unlike
       opacity, does not dim the availability caveat nested below. */
    color: var(--secondary-text-color);
  }
  .no-alerts ha-icon {
    margin-bottom: 10px;
  }

  /* Availability caveat under the all-clear, shown when there are no alerts but
     a source is dark: "No active alerts" is qualified, never asserted alone. */
  .no-alerts-caveat {
    /* Block flow (not inline-flex) so the caveat always drops onto its own
       centered line under the all-clear, regardless of length — a short
       "2 sources unavailable" must not ride up beside "No active alerts." the
       way a long single-source name wraps away from it. */
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    font-style: normal;
    font-size: 0.9em;
    color: var(--primary-text-color);
  }
  .no-alerts-caveat ha-icon {
    color: var(--warning-color);
    --mdc-icon-size: 16px;
    margin-bottom: 0;
  }
`;
