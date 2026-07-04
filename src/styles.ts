import { css } from 'lit';

export const cardStyles = css`
  @keyframes pulse-border {
    0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--wac-fg) 70%, transparent); }
    70% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--wac-fg) 0%, transparent); }
    100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--wac-fg) 0%, transparent); }
  }

  @keyframes ongoing-pulse {
    0% { background: color-mix(in srgb, var(--wac-progress-fg) 80%, transparent); }
    50% { background: color-mix(in srgb, var(--wac-progress-fg) 50%, transparent); }
    100% { background: color-mix(in srgb, var(--wac-progress-fg) 80%, transparent); }
  }

  @keyframes stripe-march-sm {
    to { background-position: -12px 0; }
  }

  @keyframes stripe-march-lg {
    to { background-position: -24px 0; }
  }

  @keyframes fill-shimmer {
    0% { background-position: -75% 0; }
    60% { background-position: 175% 0; }
    100% { background-position: 175% 0; }
  }

  :host {
    display: block;
  }

  .error {
    padding: 16px;
    color: var(--error-color, red);
  }

  .sensor-unavailable {
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--secondary-text-color);
    font-style: italic;
  }

  .sensor-unavailable.compact {
    padding: 6px 16px;
    gap: 8px;
    font-size: 0.85em;
  }

  .sensor-unavailable.compact ha-icon {
    --mdc-icon-size: 18px;
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
    position: relative;
    margin-bottom: 16px;
    padding: 0;
    border-radius: 12px;
    background: var(--card-background-color);
    border: 1px solid var(--divider-color);
    box-shadow: var(--ha-card-box-shadow, 0 2px 5px rgba(0,0,0,0.1));
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

  .alert-card:last-child {
    margin-bottom: 0;
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
    animation: pulse-border 2s infinite;
    border-color: var(--color);
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
    transition: width 0.3s ease;
  }

  .active .progress-fill {
    background-color: var(--wac-progress-fg);
    background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%);
    background-size: 40% 100%;
    background-repeat: no-repeat;
    animation: fill-shimmer 5s ease-in-out infinite;
  }

  .expired .progress-fill {
    background-color: var(--divider-color);
  }

  .preparation .progress-fill {
    background-color: transparent;
    background-image: linear-gradient(
      -45deg,
      var(--wac-progress-fg) 25%,
      transparent 25%,
      transparent 50%,
      var(--wac-progress-fg) 50%,
      var(--wac-progress-fg) 75%,
      transparent 75%
    );
    background-size: 24px 24px;
    opacity: 0.6;
    animation: stripe-march-lg 6s linear infinite;
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
  .meta-relative {
    font-size: calc(0.75rem * var(--wac-scale, 1));
    color: var(--secondary-text-color);
    font-style: italic;
  }

  /* --- GEOMETRY MINI-MAP (cap_alerts, opt-in) --- */
  .alert-geometry {
    display: block;
    width: 100%;
    max-width: 260px;
    height: 120px;
    margin: 0 auto 16px;
    /* No basemap — the shape reads against the panel background. */
  }
  .alert-geometry .geometry-frame {
    fill: rgba(var(--color-rgb), 0.04);
    stroke: var(--divider-color);
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }
  .alert-geometry .geometry-shape {
    fill: rgba(var(--color-rgb), 0.18);
    stroke: var(--wac-fg, var(--color));
    stroke-width: 1.5px;
    stroke-linejoin: round;
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
  }
  .alert-geometry.map image {
    image-rendering: auto;
  }
  /* Over tiles the bbox frame is just a hairline; the polygon does the work. */
  .alert-geometry.map .geometry-frame {
    fill: none;
    stroke: rgba(var(--rgb-primary-text-color, 128, 128, 128), 0.25);
  }
  .alert-geometry.map .geometry-shape {
    fill: rgba(var(--color-rgb), 0.22);
    stroke-width: 2px;
  }
  /* White casing under the colored stroke keeps the outline legible over busy
     tiles (light or dark). */
  .alert-geometry.map .geometry-shape-casing {
    fill: none;
    stroke: rgba(255, 255, 255, 0.85);
    stroke-width: 4px;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
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
    margin-bottom: 4px;
    border-radius: 8px;
  }

  .compact .alert-card::before {
    display: block;
    top: auto;
    bottom: 0;
    left: var(--progress, 0%);
    right: 0;
    width: auto;
    height: 4px;
    border-radius: 0;
    z-index: 1;
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

  /* Compact progress track (bottom border) */
  .compact .alert-card::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--secondary-background-color);
  }
  .compact .active.alert-card::before {
    background-color: var(--wac-progress-fg);
    background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%);
    background-size: 40% 100%;
    background-repeat: no-repeat;
    animation: fill-shimmer 5s ease-in-out infinite;
  }
  .compact .expired.alert-card::before {
    background-color: var(--divider-color);
  }
  .compact .preparation.alert-card::before {
    background-image: linear-gradient(
      -45deg,
      color-mix(in srgb, var(--wac-progress-fg) 60%, transparent) 25%,
      transparent 25%,
      transparent 50%,
      color-mix(in srgb, var(--wac-progress-fg) 60%, transparent) 50%,
      color-mix(in srgb, var(--wac-progress-fg) 60%, transparent) 75%,
      transparent 75%
    );
    background-size: 12px 12px;
    background-color: transparent;
    animation: stripe-march-sm 3s linear infinite;
  }
  .compact .active.ongoing.alert-card::before {
    left: 0;
    background: color-mix(in srgb, var(--wac-progress-fg) 80%, transparent);
    animation: ongoing-pulse 5s infinite;
  }

  /* --- NO ANIMATIONS --- */
  .no-animations .alert-card {
    animation: none !important;
  }
  .no-animations .progress-fill,
  .no-animations .alert-card::before,
  .no-animations .alert-card::after {
    animation: none !important;
    transition: none !important;
  }
  .no-animations .active .progress-fill,
  .no-animations.compact .active.alert-card::before {
    background-position: -33% 0 !important;
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

  /* --- EMPTY STATE --- */
  .no-alerts {
    padding: 20px;
    opacity: 0.6;
    text-align: center;
    font-style: italic;
  }
  .no-alerts ha-icon {
    margin-bottom: 10px;
  }
`;
