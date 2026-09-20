# Weather Alerts Card

A custom Home Assistant Lovelace card for displaying weather alerts with severity indicators, progress bars, and expandable details. Supports NWS (US), BoM (Australia), MeteoAlarm (Europe), DWD (Germany), MeteoSwiss (Switzerland), ECCC (Canada), NINA (German civil protection), NSW RFS (Australian bushfire), INMET (Brazil), PirateWeather, and CAP Alerts (multi-region).

[![Weather Alerts Card](https://raw.githubusercontent.com/seevee/weather_alerts_card/main/img/hero-adaptive.svg)](https://raw.githubusercontent.com/seevee/weather_alerts_card/main/img/hero-light.webp)

## Documentation

📖 **[Full documentation →](https://seevee.github.io/weather_alerts_card/)** — getting
started, the complete configuration reference, theming, per-provider notes, and pop-up
recipes.

This README covers everything you need to install and configure the card. The docs site
is the same material with more room to breathe, plus per-provider setup detail.

## Features

- **Multi-provider** — NWS (US), BoM (Australia), MeteoAlarm (Europe), DWD (Germany), MeteoSwiss (Switzerland), ECCC (Canada), NINA (German civil protection), NSW RFS (Australian bushfire), INMET (Brazil), PirateWeather, and CAP Alerts (multi-region) with auto-detection
- **Color themes** — severity-based (default), NWS official event colors, MeteoAlarm awareness level colors, or ECCC public-alert colors, plus an opt-in override that paints each alert in the color its issuing agency published (ECCC, MeteoAlarm, INMET)
- **Time progress bars** — elapsed/remaining time with relative and absolute timestamps
- **Alert headlines** — contextual subtitle from provider data, with optional redundancy filtering
- **Expandable details** — sanitized description, instructions, and source link
- **Affected-area mini-map** — optional inline outline of a CAP alert's polygon, or a marker at a point incident's location (NSW RFS, INMET, CAP Alerts point feeds), with an opt-in raster-tile basemap and an opt-in you-are-here dot (`showGeometry`, `showMyLocation`)
- **BoM phase badges** — New, Updated, Renewed lifecycle indicators
- **Compact layout** — collapsed single-row alerts with progress bars that expand on tap
- **Zone filtering** — show only alerts for specific zone codes (CAP Alerts geocodes, BoM `area_id`); see the `zones` note for provider support
- **Dismissable alerts** — optional per-alert dismiss (button or swipe) with undo and a restore-all control, stored browser-locally
- **Broken-source safety badge** — when a configured sensor goes unavailable/unknown, a degraded indicator names the broken source instead of silently showing "no alerts" (a dead feed is never treated as proof of safety) (`unavailableBehavior`)
- **Sort order** — default, onset time, or severity
- **Severity threshold** — minimum severity to display (unclassified alerts always shown)
- **Localized UI** — English, French, Spanish, Italian, German, Dutch, Simplified Chinese, and Brazilian Portuguese; auto-detected from Home Assistant locale
- **Visual config** — the visual editor covers everyday configuration, including tap actions. A few advanced settings stay YAML-only: custom basemap tiles (`geometryTileUrl` / `geometryTileAttribution`) and the payloads carried by the `perform-action` and `fire-dom-event` tap actions

## Themes

[![Severity, NWS, and MeteoAlarm color themes](https://raw.githubusercontent.com/seevee/weather_alerts_card/main/img/themes-adaptive.svg)](https://raw.githubusercontent.com/seevee/weather_alerts_card/main/img/themes-light.webp)

### Surface theming (`--wac-*` tokens)

The card exposes a small, stable set of CSS custom properties for its surfaces.
Set them from theme YAML, [card-mod](https://github.com/thomasloven/lovelace-card-mod),
or a dashboard `style:` block — no card config needed. Unset, every token falls
back to the value the card has always used, so the default look is unchanged.

The outer `<ha-card>` is the single painted surface; each alert box defaults to a
**transparent** fill and reveals it. That means a translucent theme
(`--ha-card-background: rgba(...)`) renders its alpha exactly once, instead of
compounding into a "solid" look on the alert bodies. The standard
`--ha-card-background`, `--ha-card-border-radius`, and `--ha-card-box-shadow` also
work as expected.

| Token | Default | Controls |
|-------|---------|----------|
| `--wac-card-background` | `var(--ha-card-background, var(--card-background-color))` | Outer card wrapper fill |
| `--wac-alert-background` | `transparent` | Per-alert box fill (reveals the outer surface) |
| `--wac-alert-border-radius` | `12px` (full) / `8px` (compact) | Per-alert corner radius |
| `--wac-alert-border` | `1px solid var(--divider-color)` | Per-alert border |
| `--wac-alert-shadow` | `var(--ha-card-box-shadow, 0 2px 5px rgba(0,0,0,0.1))` | Per-alert shadow |
| `--wac-alert-gap` | `16px` (full) / `4px` (compact) | Vertical gap between alerts |
| `--wac-progress-fill-color` | `var(--wac-progress-fg)` | Wash color for `progressFill: background` (inherits the severity color + contrast boost) |
| `--wac-progress-fill-opacity` | `0.10` (light) / `0.14` (dark) | Wash strength — kept low so alert text stays legible |
| `--wac-progress-fill-expired-opacity` | `0.06` | Dimmer wash for expired rows |

[![A translucent-surface card and a pill/chip card, built from the --wac-* tokens](https://raw.githubusercontent.com/seevee/weather_alerts_card/main/img/surface-theming-adaptive.svg)](https://raw.githubusercontent.com/seevee/weather_alerts_card/main/img/surface-theming-light.webp)

*Left: a translucent theme (alert bodies transparent, so the surface alpha lands once). Right: a pill/chip look (transparent wrapper, filled boxes). Both come from the card-mod examples below.*

<details>
<summary>Show card-mod examples</summary>

**Translucent theme** — set a translucent card background and let the alert boxes
inherit it (this is the default, shown here for a per-card override):

```yaml
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
provider: nws
card_mod:
  style: |
    ha-card {
      --ha-card-background: rgba(40, 40, 40, 0.6);
      --wac-alert-background: transparent; /* default; alert bodies stay translucent */
    }
```

**Pill / chip look** — filled alert boxes on a transparent wrapper, built from the
surface tokens (approximates a [Bubble Card](https://github.com/Clooos/Bubble-Card)
style; contributed in [#144](https://github.com/seevee/weather_alerts_card/issues/144)).
Note the standard `--ha-card-box-shadow: none` alongside the tokens: with a
transparent `--wac-card-background`, the outer `<ha-card>` would otherwise still
cast its own shadow around the now-invisible wrapper.

```yaml
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
sortOrder: severity
layout: compact
provider: nws
card_mod:
  style: |
    ha-card {
      --wac-card-background: transparent;
      --ha-card-box-shadow: none; /* flatten the now-invisible outer wrapper */
      --wac-alert-background: rgb(40, 40, 40);
      --wac-alert-border: none;
      --wac-alert-border-radius: 28px;
      --wac-alert-shadow: none;
      --wac-alert-gap: 8px;
    }
```

Deeper layout tweaks (row height, icon chip size) still require reaching into the
card's internal class names, which are **not** a stable public API and may change
between releases. Prefer the tokens above where they suffice.

**Per-alert detail pop-up (built in)** — `tap_action: { action: details }` opens
the tapped alert in a modal instead of expanding it in place. No add-ons
required, and it is genuinely per-alert for **every** provider: the card renders
the alert object it already has, so an aggregate sensor holding five warnings
still gives you five distinct pop-ups. Works in both `layout: default` and
`compact`.

The pop-up shows the **whole alert** — icon, title, headline, area, badges,
progress bar, metadata and the full description/instructions — and since the
pop-up *is* the detail view, the description is always open inside it (no
"Read Details" toggle to click). `showDetails` / `showMetadata` /
`showDescription` / `showInstructions` / `showGeometry` still apply;
`expandDetails` governs the row only, not the pop-up.

```yaml
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
provider: nws
layout: compact
tap_action:
  action: details
```

Prefer this over the Bubble/`browser_mod` recipes below unless you specifically
want their pop-up chrome — both remain available via `navigate` and
`fire-dom-event`.

**Bubble Card pop-up** — send the compact layout's rows to a
[Bubble Card](https://github.com/Clooos/Bubble-Card) pop-up instead of expanding
inline. `tap_action` navigates to the pop-up's hash; the second card *is* the
pop-up (Bubble listens for that hash and opens). Pair with `hideNoAlerts` so the
entry rows vanish when there's nothing to show.

Two things to know before wiring this up:

- **The pop-up is shared, not per-alert.** A Bubble hash addresses one static
  pop-up, so every row navigates to the same one and it shows *all* current
  alerts in full detail — not only the alert you tapped. Per-alert scoping can't
  be expressed with a hash — that is exactly what `action: details` above is for.
  To open the tapped alert's own HA entity dialog instead, use
  `tap_action: { action: more-info }`.
- **`layout: compact` renders one row per alert**, not a single summary chip.
  With three active alerts you get three entry rows, all tapping through to the
  same pop-up.

```yaml
# 1) The entry rows: each row taps through to the shared pop-up
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
provider: nws
layout: compact
hideNoAlerts: true
tap_action:
  action: navigate
  navigation_path: '#weather-alerts'

# 2) The pop-up: one full-detail card behind the hash, listing every current alert
type: custom:bubble-card
card_type: pop-up
hash: '#weather-alerts'
card:
  type: custom:weather-alerts-card
  entity: sensor.nws_alerts_alerts
  provider: nws
  expandDetails: true
```

To open a `browser_mod`-style pop-up instead, use
`tap_action: { action: fire-dom-event, browser_mod: { ... } }` — the card fires
the standard `ll-custom` event `browser_mod` listens for.

</details>

## Quick Start

1. Install a weather alerts integration for your region (see [Supported Providers](#supported-providers))
2. Install this card via HACS: search "Weather Alerts Card"
3. Add to your dashboard and select your alert entity

## Installation

### HACS (recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=seevee&repository=weather_alerts_card)

Then click the Download button, and click Reload when prompted.

### Manual

1. Download `weather-alerts-card.js` from the [latest release](../../releases/latest)
2. Copy to `config/www/weather-alerts-card.js`
3. Add as resource: **Settings → Dashboards → Resources** → URL: `/local/weather-alerts-card.js`, Type: JavaScript Module

## Configuration

> Surface appearance — backgrounds, borders, corners, shadows, translucency — isn't configured here; it's themed via CSS. See [Surface theming (`--wac-*` tokens)](#surface-theming---wac--tokens).

| Option | Default | Description |
|--------|---------|-------------|
| `entity` | *(required, unless `device`, `devices` or `sources` is set)* | Alert sensor entity |
| `entities` | — | Additional alert entities to merge (e.g. DWD current + advance) |
| `device` | — | HA `device_id` — auto-discovers all per-alert sensors under that device and re-discovers as alerts come and go. CAP Alerts and NINA both produce this shape. Can be combined with `entity`/`entities` or used on its own. |
| `devices` | — | Additional device ids, the same shape `entities` gives `entity`. Every CAP Alerts entry is one provider × one scope, so a home zone plus a GPS tracker, or NWS plus GDACS, is two devices. The same alert seen through two devices is shown once; each device that goes dark is named on its own. |
| `sources` | — | Feed `source` attribute values to auto-collect (e.g. `['nsw_rural_fire_service_feed']`). Harvests **every** entity whose `source` attribute matches, re-scanning each render so per-incident entities appear and vanish with the live feed — no volatile `geo_location.*` ids to hand-list. Independent of `provider` (each collected entity still auto-detects its adapter). Can be used on its own or combined with `entity`/`entities`/`device`. |
| `provider` | auto-detect | `'nws'`, `'bom'`, `'meteoalarm'`, `'dwd'`, `'nina'`, `'meteoswiss'`, `'eccc'`, `'nsw_rfs'`, `'inmet'`, `'pirateweather'`, `'cap'` |
| `title` | — | Card header title |
| `zones` | — | Restrict to specific zone codes, matched against each alert's zone list. Populated by CAP Alerts (UGC/SAME/EMMA_ID/NUTS and any other geocode scheme) and BoM (`area_id`, e.g. `NSW_FL049`; fork-dependent — the `safepay/ha_bom_australia` fork emits it). The recommended NWS integration doesn't emit zone codes, so this doesn't apply to it. **Alerts with no matching zone are hidden**, so setting `zones` on a provider that carries none hides everything |
| `sortOrder` | `'default'` | `'default'`, `'onset'`, `'severity'` |
| `minSeverity` | `'all'` | `'all'`, `'minor'`, `'moderate'`, `'severe'`, `'extreme'`. Alerts whose severity is unknown/unclassified are always shown, regardless of this threshold |
| `maxDistanceKm` | — | Hide incidents further than this many **kilometres** from your reference point — the Home Assistant home location (`latitude`/`longitude` under Settings → System → General) unless `myLocationEntity` is set. Opt-in; the YAML value is always km whatever your unit system, though the visual editor shows and accepts miles on a US-customary install. Only applies to point-incident providers that publish a real location (currently NSW RFS and INMET) — area warnings (NWS, CAP, BoM, DWD, MeteoAlarm, MeteoSwiss, ECCC, PirateWeather) have no distance and are never filtered. Ignored when no reference point resolves. Only ever narrows — the upstream `geo_location` integration may apply its own radius before alerts reach the card |
| `myLocationEntity` | — | A `device_tracker`, `person`, or `zone` entity whose `latitude`/`longitude` replace the HA home location as the card's reference point — the origin of `maxDistanceKm`, the detail panel's distance row, and the `showMyLocation` marker. Falls back to HA home when the entity is missing or has no coordinates (a router-based tracker), never to "no filtering". Use a zone for a fixed location, e.g. to match a `geo_location` integration configured somewhere other than HA home |
| `colorTheme` | `'severity'` | `'severity'`, `'nws'`, `'meteoalarm'`, `'eccc'` — the palette every alert is painted from. `'nws'` keys off the event name (NWS's official per-event colors, applied to any provider whose events read like NWS's; anything unmatched falls back to the severity tier); `'meteoalarm'` and `'eccc'` are those agencies' four-tier palettes keyed by severity |
| `providerColors` | `false` | `true` paints each alert in the color its issuing agency published for it, over whatever `colorTheme` selects: ECCC's `red`/`orange`/`yellow`/`grey` tag, MeteoAlarm's awareness color (natively or through CAP Alerts), INMET's hex. Alerts whose provider publishes no color keep the `colorTheme` palette. `colorTheme: 'eccc'` turns this on by default, because that theme always meant it |
| `enhanceContrast` | `'subtle'` | `'off'`, `'subtle'`, `'strict'` — boost foreground colors for NWS/MeteoAlarm events whose raw hex reads poorly against the active theme's card background, applied per event, per theme mode, and only in the direction where it fails. `'subtle'` (default) uses a text tier (~2:1 for icon/label) and a stricter progress tier (~1.3:1 for progress-bar fill, which catches near-invisible tints like yellow Tornado Watch). `'strict'` tightens both tiers (text ~3:1, progress ~2:1) toward WCAG AA-ish guarantees. `'off'` always renders raw theme hex values. Events that already read cleanly (e.g. Tornado Warning) render unchanged in all modes. |
| `eventCodes` | — | Event codes to include, e.g. `['SVR', 'TOR']` (NWS) or `['31', '95']` (DWD) |
| `excludeEventCodes` | — | Event codes to exclude, e.g. `['SCY']` (NWS) or `['22']` (DWD) |
| `timezone` | `'server'` | `'server'` or `'browser'` (client's local time) |
| `deduplicateHeadlines` | `true` | Suppress headlines that repeat the event name |
| `deduplicate` | `true` | Collapse matching alerts across zones and providers |
| `animations` | system | `true`, `false`, or respect `prefers-reduced-motion`. Gates *motion* only; `progressStyle` picks the pattern |
| `progressStyle` | see below | Per-phase progress-bar decoration. An object with optional `preparation` / `active` / `ongoing` keys, each `'solid'` \| `'striped'` \| `'shimmer'` \| `'pulse'`. Defaults reproduce the current look: `preparation: striped`, `active: shimmer`, `ongoing: pulse` (`expired` is always a fixed dimmed solid bar and is not configurable). Flow direction is intrinsic to each phase — a texture keeps the phase's direction wherever it is placed (e.g. `active: striped` marches with the bar). **`ongoing: solid` caveat:** a static full-width ongoing bar no longer signals "indeterminate / no known end" and can read like a nearly-expired alert; the default stays `pulse`. **Has no effect when `progressFill: background`** — the thin track it decorates is hidden, and the low-opacity wash renders the texture invisible, so the wash is always solid. |
| `iconBorderStyle` | see below | Per-phase icon-ring border style. An object with optional `preparation` / `active` / `ongoing` keys, each `'dashed'` \| `'solid'`. Defaults reproduce the current look: `preparation: dashed`, `active: solid`, `ongoing: solid` (`expired` is a fixed dimmed solid ring and is not configurable). |
| `showDetails` | `true` | Show the expandable detail panel (hides entire "Read Details" section when `false`) |
| `expandDetails` | `false` | Always show details inline without a toggle (ideal for wall-mounted displays) |
| `showProvider` | `false` | Show provider label (e.g., NWS) above event title |
| `showMetadata` | `true` | Show issued/onset/expires/area grid in detail panel. Point-incident alerts (currently NSW RFS and INMET) also get a distance row (from HA home, or `myLocationEntity`), in km or miles per your unit system |
| `showDescription` | `true` | Show description text in detail panel |
| `showInstructions` | `true` | Show instructions text in detail panel |
| `showGeometry` | `false` | Show an inline SVG mini-map in the detail panel. Draws whatever the alert carries, best first: the polygon outline (CAP Alerts, fetched out-of-band) → the bounding-box frame (CAP Alerts, immediate) → a marker at the incident's location inside a ~20 km frame (point-incident providers, currently NSW RFS and INMET) → nothing (area providers with no geometry: NWS, BoM, DWD, …). |
| `geometryStyle` | `'shape'` | Mini-map rendering when `showGeometry` is on. `'shape'`: bare outline or marker, fully offline. `'map'`: raster-tile basemap behind the polygon or marker for geographic context — **opt-in and fetches map tiles (online)**. The default source is Home Assistant's own `map_tiles` proxy (core 2026.9+), so the tiles come from your instance and match HA's map; on an older core, or if tiles fail, the card falls back to the outline. |
| `geometryTileUrl` | HA `map_tiles` proxy | Slippy-map tile template (`{z}/{x}/{y}`, optional `{s}`) used when `geometryStyle: 'map'`. Override to point at a self-hosted source, or at a keyed one such as CARTO with your own key (`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=YOUR_KEY`). **An override reveals the alert's bounding box to that host** and is rendered as-is, without the dark-theme inversion the default gets. |
| `geometryTileAttribution` | `© OpenStreetMap contributors` | Attribution label shown over the map. Set this to credit your provider when using a custom `geometryTileUrl` (e.g. `© OpenStreetMap, CARTO`). |
| `showMyLocation` | `false` | Add a small neutral ring at your reference point (HA home, or `myLocationEntity`) to the mini-map — you and the incident in one frame on a point map, or where you sit relative to the affected area on a polygon map. Opt-in because it puts your location (live, when a tracker is set) on a possibly shared display. Never widens a real affected-area frame: a reference point outside it simply clips. On a point map the frame grows to include it up to ~150 km, beyond which it's dropped. Requires `showGeometry: true`. |
| `showSourceLink` | `true` | Show "Open Source" link (`false` for kiosk mode) |
| `hideExpired` | `true` | Hide expired alerts (set `false` to show them dimmed) |
| `hideNoAlerts` | `false` | Hide the "No active alerts" banner when there are no alerts |
| `unavailableBehavior` | `'message'` | Degraded badge shown above the card content whenever *some or all* configured sources are broken (unavailable/unknown with no parseable alert). `'message'`: badge names the broken source (counts when >1); `'compact'`: icon-only badge; `'hide'`: no badge (**not recommended — a broken source is not proof of safety**). A visible badge keeps the card on screen even under `hideNoAlerts`; the card only hides completely when there are no alerts **and** `hideNoAlerts` is set **and** (`unavailableBehavior: 'hide'` **or** nothing is broken). |
| `fontSize` | `'default'` | `'small'`, `'default'`, `'large'`, `'x-large'` — scales text and icons |
| `progressFill` | `'track'` | Progress-indication surface. `'track'`: the thin progress bar (full) / bottom mini-bar (compact). `'background'`: a [Bubble Card](https://github.com/Clooos/Bubble-Card)-style whole-row wash — the entire alert row fills as a low-opacity tint of the alert color, growing to the current progress point behind the content (the thin track is hidden; the textual progress labels stay). Tune or disable the wash via the `--wac-progress-fill-*` [surface tokens](#surface-theming---wac--tokens). Note: `progressStyle` textures do not apply here — the wash is always solid (the thin track is hidden, and texture is imperceptible at the wash's legibility-safe opacity). |
| `reformatText` | `true` | Strip hard line wraps from alert text (NWS 69-char teletype breaks) while preserving paragraph breaks |
| `layout` | `'default'` | `'default'` or `'compact'` |
| `allowDismiss` | `false` | Let users dismiss individual alerts (browser-local). Adds a × button and/or swipe gesture |
| `dismissTrigger` | `'button'` | `'button'`, `'swipe'`, or `'both'` — how an alert is dismissed (swipe covers touch + mouse drag). Requires `allowDismiss` |
| `dismissButtonStyle` | `'icon'` | `'icon'` or `'labeled'` (icon + "Dismiss" text). No effect when `dismissTrigger: 'swipe'`; compact layout is always icon-only |
| `showDismissUndo` | `true` | Show an Undo toast when an alert is dismissed. No effect when `allowDismiss` is off |
| `tap_action` | — | Standard Home Assistant action fired when an alert row is tapped. **When set, the inline expand affordance is replaced** — the whole row becomes the tap target and the compact chevron / "Read Details" toggle is removed (in the default layout, `expandDetails: true` still renders the always-on detail panel below the row). Supported actions: `details`, `more-info`, `navigate`, `url`, `toggle`, `call-service` (alias `perform-action`), `fire-dom-event`, `none` (`assist` is intentionally unsupported — it has no meaning on an alert row; `none` is an inert chip: the toggle is removed but tapping does nothing). For `more-info`/`toggle`, the default entity is resolved **per tapped alert** — `tap_action.entity` (explicit) → the alert's own source sensor → `entity` — so per-alert providers (CAP Alerts, NSW RFS) open *that* alert's sensor while aggregate providers (NWS, DWD, …) fall back to the aggregate sensor. `toggle` uses the generic `homeassistant.toggle` service. `details` is card-owned rather than a standard HA action: it opens the tapped alert in a modal showing the whole alert body (per-alert for every provider, no add-ons — see [Themes](#themes) for an example). Absent = today's inline expand/toggle behavior, unchanged. The visual editor covers the action itself plus the `navigate` and `url` parameters; `perform-action` / `call-service` / `fire-dom-event` carry payloads that stay YAML-edited, and the editor preserves them untouched. |

<details>
<summary><strong>Examples</strong></summary>

**Basic**
```yaml
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
```

**BoM with title and zone filtering**
```yaml
type: custom:weather-alerts-card
entity: sensor.sydney_warnings
provider: bom
title: Weather Alerts
zones:
  - NSW_FL049
```

**NWS official colors, compact, sorted by severity**
```yaml
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
colorTheme: nws
layout: compact
sortOrder: severity
```

**NWS filtered to specific event types, browser timezone**
```yaml
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
eventCodes:
  - TOR
  - SVR
timezone: browser
```

**Custom progress-bar decoration and icon ring per phase**
```yaml
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
progressStyle:
  preparation: solid      # a straight (undecorated) pre-onset bar instead of diagonal dashes
  active: striped         # stripes that march with the bar (right)
iconBorderStyle:
  preparation: solid      # solid pre-onset ring instead of the default dashed
```

**European MeteoAlarm warnings with awareness colors**
```yaml
type: custom:weather-alerts-card
entity: binary_sensor.meteoalarm
colorTheme: meteoalarm
```

**Australian BoM warnings**
```yaml
type: custom:weather-alerts-card
entity: sensor.sydney_warnings
provider: bom
```

**DWD (Germany)**
```yaml
type: custom:weather-alerts-card
entity: sensor.dwd_weather_warnings_hamburg_current
```

**DWD current + advance warnings merged**
```yaml
type: custom:weather-alerts-card
entity: sensor.dwd_weather_warnings_current
entities:
  - sensor.dwd_weather_warnings_advance
```

**NINA (German civil protection)**

NINA pre-creates one `binary_sensor` per region per message slot, and the slots sit
empty until a warning lands. Point the card at the NINA *device* so it picks each slot
up as it fills and drops it again when it clears:

```yaml
type: custom:weather-alerts-card
device: 8f2c1e04a9b7d3651fa0c8e29d47b5a3
```

Pick it from the editor's **Alert devices** selector, which lists NINA devices beside CAP
Alerts ones; two regions are two devices, so list the second under `devices:`.
Listing slot entities directly works too. An empty slot reads as "no active alerts",
never as an unavailable source, and the per-slot diagnostic sensors the integration also
creates (`sensor.*_headline_1`, …) are ignored. See
[Providers](https://seevee.github.io/weather_alerts_card/providers#nina-german-civil-protection)
for details — including the HA 2026.11 attribute removal that this support depends on.

**MeteoSwiss (Switzerland)**
```yaml
type: custom:weather-alerts-card
entity: sensor.weather_warnings_at_8000
```

**ECCC (Canada)**
```yaml
type: custom:weather-alerts-card
entity: sensor.marathon_alerts
```

**ECCC with the official public-alert palette**
```yaml
type: custom:weather-alerts-card
entity: sensor.marathon_alerts
colorTheme: eccc      # ECCC's red/orange/yellow/grey ladder; each ECCC alert in its published color
```

**NSW RFS (Australian bushfire)**

The `nsw_rural_fire_service_feed` integration creates one `geo_location.*` entity
per active incident, and that set churns constantly as fires start and clear.
Rather than hand-list volatile entity ids, point the card at the feed with
`sources:` — it auto-collects every current incident and keeps up as they come
and go:

```yaml
type: custom:weather-alerts-card
sources:
  - nsw_rural_fire_service_feed
```

`nsw_rural_fire_service_feed` is the `source` state attribute each incident entity
carries, so the value maps one-to-one to what you see on the entity. In the visual
editor this is the **Auto-collect from installed feeds** checkbox, which only
appears when the integration is actually installed. (You can still hand-list
specific incidents under `entities:` or group them with a `device:` if you want a
fixed subset instead.)

Severity comes straight from the incident `category` (Emergency Warning / Watch
and Act / Advice — the Australian Warning System ladder). Incidents have no real
expiry, so the card shows an honest "ongoing" state with no progress bar.

Each incident carries a location rather than a fire-ground polygon (the integration
discards that), so with `showGeometry: true` the mini-map shows a marker at the
incident inside a ~20 km frame — most useful with `geometryStyle: map`, which puts
it on real terrain, and with `showMyLocation: true`, which adds a you-are-here ring
so the frame reads as "the fire, and me". The detail panel also shows the incident's
distance from your Home Assistant home location (km, or miles on a US-customary
install), and you can trim a statewide feed down to your own surroundings with
`maxDistanceKm` — kilometres from that same home point:

```yaml
type: custom:weather-alerts-card
sources:
  - nsw_rural_fire_service_feed
maxDistanceKm: 50
```

Note that this only narrows: the integration itself has a `radius` option (default 20 km
from the same home location) and incidents beyond it never reach the card, so a card value
wider than that does nothing. Raise the integration's `radius` to see incidents further out.

**PirateWeather alerts**
```yaml
type: custom:weather-alerts-card
entity: sensor.pirateweather_alerts
```

**CAP Alerts — auto-discover all per-alert sensors under a device**

The [CAP Alerts integration](https://github.com/seevee/cap_alerts) creates one
sensor per active alert under a Home Assistant device. Point the card at the
device and it picks up every active alert sensor automatically — and re-picks
them up as alerts are issued or cleared.

```yaml
type: custom:weather-alerts-card
device: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d
```

Pick the device from the editor's **Alert devices** selector to avoid hand-typing
the id. `device` can also coexist with `entities:` for mixed setups.

Every CAP Alerts entry is one provider for one scope, so a second location or a
second provider is a second device. Add it under `devices:` and the card merges
them, showing an alert that both devices carry only once:

```yaml
type: custom:weather-alerts-card
device: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d      # NWS, home zone
devices:
  - 9f8e7d6c5b4a39281706f5e4d3c2b1a0    # NWS, GPS tracker for the car
  - 0a1b2c3d4e5f60718293a4b5c6d7e8f9    # GDACS, worldwide
```

The editor's device selector is multi-select and writes this shape for you: the
first pick lands in `device:`, the rest in `devices:`.

**Theming the card surface** — see [Surface theming (`--wac-*` tokens)](#surface-theming---wac--tokens) under Themes for the token table and card-mod examples (translucent theme, pill/chip look).

</details>

## Supported Providers

The card auto-detects the provider from entity attributes. Any integration that produces a compatible data shape will work.

| Provider | Region | Tested integrations |
|----------|--------|---------------------|
| NWS | US | [finity69x2/nws_alerts](https://github.com/finity69x2/nws_alerts) |
| BoM | Australia | [bremor/bureau_of_meteorology](https://github.com/bremor/bureau_of_meteorology), [safepay/ha_bom_australia](https://github.com/safepay/ha_bom_australia) |
| MeteoAlarm | Europe | Built-in [meteoalarm](https://www.home-assistant.io/integrations/meteoalarm/) |
| DWD | Germany | Built-in [dwd_weather_warnings](https://www.home-assistant.io/integrations/dwd_weather_warnings/) |
| NINA | Germany (civil protection) | Built-in [nina](https://www.home-assistant.io/integrations/nina/) — one `binary_sensor` per region per message slot; point the card at the NINA **device** so slots are picked up as warnings land in them. Carries DWD weather, LHP flood and MoWaS/KATWARN/BIWAPP civil-protection messages alike |
| MeteoSwiss | Switzerland | [izacus/hass-swissweather](https://github.com/izacus/hass-swissweather) — point the card at `sensor.weather_warnings_at_<postcode>` |
| ECCC | Canada | [seevee/cap_alerts](https://github.com/seevee/cap_alerts) (`provider: eccc`) — the recommended ECCC source; see note below |
| NSW RFS | Australia (NSW) | Built-in [nsw_rural_fire_service_feed](https://www.home-assistant.io/integrations/nsw_rural_fire_service_feed/) — one `geo_location.*` entity per bushfire/grass-fire/hazard-reduction incident; auto-collect the whole feed with `sources: [nsw_rural_fire_service_feed]` |
| INMET | Brazil | [sigrist/inmet](https://github.com/sigrist/inmet) — one `geo_location.*` entity per active INMET alert; auto-collect the whole feed with `sources: [inmet]` |
| PirateWeather | Global | [Pirate-Weather/pirate-weather-ha](https://github.com/Pirate-Weather/pirate-weather-ha) |
| CAP Alerts | Multi-region (NWS, ECCC, MeteoAlarm, WMO) | [seevee/cap_alerts](https://github.com/seevee/cap_alerts) — one sensor per active alert; pair with `device:` for auto-discovery. Ingests any CAP 1.2 feed, including the WMO Severe Weather Information Centre firehose for countries without a dedicated integration |

> **Note on ECCC.** For Environment and Climate Change Canada alerts, use [CAP Alerts](https://github.com/seevee/cap_alerts) (`provider: eccc`). It is the only ECCC source this card recommends — neither the bundled HA core `environment_canada` integration nor the HACS `environment_canada` fork is routed to. See [Canada: ECCC via CAP Alerts](#canada-eccc-via-cap-alerts) below for why.

### Canada: ECCC via CAP Alerts

For Environment and Climate Change Canada (ECCC) alerts, [CAP Alerts](https://github.com/seevee/cap_alerts)
(`provider: eccc`) is the source to use. It ingests the NAAD CAP firehose,
creating one sensor per active alert under a Home Assistant device. That carries
**raw** CAP severity and certainty, preserves the original multi-region alert
polygons, and unlocks the `showGeometry` affected-area mini-map.

Point the card at the device and it auto-discovers every active alert,
re-discovering as alerts come and go:

```yaml
type: custom:weather-alerts-card
device: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d
colorTheme: eccc      # ECCC's official red/orange/yellow/grey palette
showGeometry: true    # affected-area mini-map
```

Pick the device from the editor's **Alert devices** selector rather than
hand-typing the id. The provider auto-detects as `eccc`; set `provider: eccc`
explicitly only if you've disabled auto-detection.

> **Why not the other ECCC integrations?** Two other ECCC integrations exist,
> but neither is the right source for this card:
> - **HA core `environment_canada`** exposes rich alert detail only through a
>   `get_alerts` **action** ([#172393](https://github.com/home-assistant/core/pull/172393),
>   merged in place of the attribute-based [#164481](https://github.com/home-assistant/core/pull/164481)).
>   A Lovelace card reads state and attributes during render and can't consume
>   an action response, so core can't drive this card.
> - The HACS **`environment_canada`** fork does surface alert attributes, but
>   it's a stop-gap its own maintainer would rather not keep running (see
>   [discussion #3130](https://github.com/orgs/home-assistant/discussions/3130)),
>   and it overrides the core integration's domain. Out of respect for that, we
>   don't route ECCC users to it; CAP Alerts is the entity-based path the card
>   author maintains for rich alert data.

> **Heads-up if you also run `environment_canada` for weather.** Its alert list
> (GeoMet WFS, filtered by a point-in-polygon test against your coordinates)
> won't line up with CAP Alerts' (NAAD CAP polygons, ingested directly). The WFS
> feed lags and truncates NAAD coverage, so an alert can show up in one and not
> the other — that's upstream behaviour, not the card.

## Data Fidelity

Severity and certainty badges are always localized to your configured language. When a value was inferred by the card's adapter logic (rather than provided directly by the alert source), it is rendered with italic text and a tilde prefix (`~Moderate`) so you can tell at a glance which badges reflect actual provider data.

| Provider | Severity | Certainty |
|----------|----------|-----------|
| NWS | Raw (from `Severity` field) | Raw (from `Certainty` field) |
| BoM | Inferred (parsed from title/type/group) | Absent |
| MeteoAlarm | Raw (from `awareness_level` or `severity`) | Raw (from `certainty`) |
| DWD | Raw (from integer `level`) | Absent |
| NINA | Raw (CAP vocabulary from `severity`) | Absent |
| MeteoSwiss | Raw (from integer level) | Absent |
| ECCC | Derived (max of `color`, `type`, `impact`; tilde only when all three absent) | Mapped from `confidence` (High → Likely, Moderate → Possible, Low → Unlikely) |
| NSW RFS | Raw (from `category` — the Australian Warning System ladder) | Absent |
| INMET | Raw (from `severity`) | Absent |
| PirateWeather | Raw (from `severity` field) | Absent |
| CAP Alerts | Raw (from `severity_normalized` / `severity`) | Raw (from `certainty` field) |

## Development

```bash
npm install
npm run build     # bundle → dist/weather-alerts-card.js
npm run watch     # bundle with file watching
npm run lint      # TypeScript type-check
```

## Migrating to v3

v3.0.0 removes backwards-compatibility shims that were deprecated in v2. If you are upgrading from v1.x or v2.x, make the following changes:

**1. Card type rename** (v1.x users only)

Change the card type in your dashboard YAML:

```yaml
# Before
type: custom:nws-alerts-card

# After
type: custom:weather-alerts-card
```

**2. `headline` config key removed** (v1.x users only)

The `headline` key was replaced by `deduplicateHeadlines` in v2. If your card config still has `headline:`, rename it:

```yaml
# Before
headline: true   # or false

# After
deduplicateHeadlines: true   # or false
```

**3. Manual install only: resource filename changed**

If you installed manually (not via HACS), update the resource path in Settings → Dashboards → Resources:

| Before | After |
|--------|-------|
| `/local/nws-alerts-card.js` | `/local/weather-alerts-card.js` |

HACS users: no action needed — HACS manages the resource path automatically.

## Support

If you find this card useful, tip me at [Ko-fi](https://ko-fi.com/seeveezee) to support development, or donate to [The Y'all Squad](https://www.theyallsquad.org/donate) — a rapid-response program providing direct aid, chainsaws, and supplies to families affected by severe weather events.

---

**Resources:** [Home Assistant Community thread](https://community.home-assistant.io/t/weather-alerts-card)
