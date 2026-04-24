# Weather Alerts Card

A custom Home Assistant Lovelace card for displaying weather alerts with severity indicators, progress bars, and expandable details. Supports NWS (US), BoM (Australia), MeteoAlarm (Europe), DWD (Germany), and PirateWeather.

[![Weather Alerts Card](https://raw.githubusercontent.com/seevee/weather_alerts_card/main/img/hero-adaptive.svg)](https://raw.githubusercontent.com/seevee/weather_alerts_card/main/img/hero-light.png)

## Features

- **Multi-provider** — NWS (US), BoM (Australia), MeteoAlarm (Europe), DWD (Germany), and PirateWeather with auto-detection
- **Color themes** — severity-based (default), NWS official event colors, or MeteoAlarm awareness level colors
- **Time progress bars** — elapsed/remaining time with relative and absolute timestamps
- **Alert headlines** — contextual subtitle from provider data, with optional redundancy filtering
- **Expandable details** — sanitized description, instructions, and source link
- **BoM phase badges** — New, Updated, Renewed lifecycle indicators
- **Compact layout** — collapsed single-row alerts with progress bars that expand on tap
- **Zone filtering (BoM)** — show only alerts for specific `area_id` zones
- **Sort order** — default, onset time, or severity
- **Severity threshold** — minimum severity to display
- **Localized UI** — English, French, Spanish, Italian, and German; auto-detected from Home Assistant locale
- **Visual config** — no YAML editing required

## Themes

[![Severity, NWS, and MeteoAlarm color themes](https://raw.githubusercontent.com/seevee/weather_alerts_card/main/img/themes-adaptive.svg)](https://raw.githubusercontent.com/seevee/weather_alerts_card/main/img/themes-light.png)

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

| Option | Default | Description |
|--------|---------|-------------|
| `entity` | *(required)* | Alert sensor entity |
| `entities` | — | Additional alert entities to merge (e.g. DWD current + advance) |
| `provider` | auto-detect | `'nws'`, `'bom'`, `'meteoalarm'`, `'dwd'`, `'pirateweather'` |
| `title` | — | Card header title |
| `zones` | — | BoM `area_id` codes to filter (e.g. `NSW_FL049`) |
| `sortOrder` | `'default'` | `'default'`, `'onset'`, `'severity'` |
| `minSeverity` | `'all'` | `'all'`, `'minor'`, `'moderate'`, `'severe'`, `'extreme'` |
| `colorTheme` | `'severity'` | `'severity'`, `'nws'`, `'meteoalarm'` |
| `enhanceContrast` | `'subtle'` | `'off'`, `'subtle'`, `'strict'` — boost foreground colors for NWS/MeteoAlarm events whose raw hex reads poorly against the active theme's card background, applied per event, per theme mode, and only in the direction where it fails. `'subtle'` (default) uses a text tier (~2:1 for icon/label) and a stricter progress tier (~1.3:1 for progress-bar fill, which catches near-invisible tints like yellow Tornado Watch). `'strict'` tightens both tiers (text ~3:1, progress ~2:1) toward WCAG AA-ish guarantees. `'off'` always renders raw theme hex values. Events that already read cleanly (e.g. Tornado Warning) render unchanged in all modes. |
| `eventCodes` | — | Event codes to include, e.g. `['SVR', 'TOR']` (NWS) or `['31', '95']` (DWD) |
| `excludeEventCodes` | — | Event codes to exclude, e.g. `['SCY']` (NWS) or `['22']` (DWD) |
| `timezone` | `'server'` | `'server'` or `'browser'` (client's local time) |
| `deduplicateHeadlines` | `true` | Suppress headlines that repeat the event name |
| `deduplicate` | `true` | Collapse matching alerts across zones and providers |
| `animations` | system | `true`, `false`, or respect `prefers-reduced-motion` |
| `showDetails` | `true` | Show the expandable detail panel (hides entire "Read Details" section when `false`) |
| `expandDetails` | `false` | Always show details inline without a toggle (ideal for wall-mounted displays) |
| `showProvider` | `false` | Show provider label (e.g., NWS) above event title |
| `showMetadata` | `true` | Show issued/onset/expires/area grid in detail panel |
| `showDescription` | `true` | Show description text in detail panel |
| `showInstructions` | `true` | Show instructions text in detail panel |
| `showSourceLink` | `true` | Show "Open Source" link (`false` for kiosk mode) |
| `hideExpired` | `true` | Hide expired alerts (set `false` to show them dimmed) |
| `hideNoAlerts` | `false` | Hide the "No active alerts" banner when there are no alerts |
| `fontSize` | `'default'` | `'small'`, `'default'`, `'large'`, `'x-large'` — scales text and icons |
| `reformatText` | `true` | Strip hard line wraps from alert text (NWS 69-char teletype breaks) while preserving paragraph breaks |
| `layout` | `'default'` | `'default'` or `'compact'` |

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

**PirateWeather alerts**
```yaml
type: custom:weather-alerts-card
entity: sensor.pirateweather_alerts
```

**Match Bubble Card styling (requires [card-mod](https://github.com/thomasloven/lovelace-card-mod))**

<details>
<summary>Show snippet</summary>

Styles this card to visually match [Bubble Card](https://github.com/Clooos/Bubble-Card)'s large layout — 28px corners, 56px rows, 42×42 icon chip. Note: the selectors below reach into this card's internal CSS class names, which aren't a stable public API and may change between releases. Contributed in [#144](https://github.com/seevee/weather_alerts_card/issues/144).

```yaml
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
sortOrder: severity
layout: compact
provider: nws
card_mod:
  style: |
    ha-card {
      background: transparent !important;
      border: none !important;
      border-radius: 28px !important;
      box-shadow: none !important;
    }
    .alert-card {
      background: rgb(40, 40, 40) !important;
      border: none !important;
      border-radius: 28px !important;
      box-shadow: none !important;
      overflow: hidden !important;
      min-height: 56px !important;
      margin: 0 0 8px !important;
    }
    .alert-card:last-child {
      margin-bottom: 0 !important;
    }
    .alert-header-row {
      min-height: 0 !important;
      height: 56px !important;
      padding: 0 12px 0 8px !important;
    }
    .icon-box {
      width: 42px !important;
      height: 42px !important;
      flex: 0 0 42px !important;
      --mdc-icon-size: 24px !important;
    }
    .icon-box ha-icon {
      --mdc-icon-size: 24px !important;
      width: 24px !important;
      height: 24px !important;
    }
    .compact-time {
      font-size: 13px !important;
    }
```

</details>

</details>

## Supported Providers

The card auto-detects the provider from entity attributes. Any integration that produces a compatible data shape will work.

| Provider | Region | Tested integrations |
|----------|--------|---------------------|
| NWS | US | [finity69x2/nws_alerts](https://github.com/finity69x2/nws_alerts) |
| BoM | Australia | [bremor/bureau_of_meteorology](https://github.com/bremor/bureau_of_meteorology), [safepay/ha_bom_australia](https://github.com/safepay/ha_bom_australia) |
| MeteoAlarm | Europe | Built-in [meteoalarm](https://www.home-assistant.io/integrations/meteoalarm/) |
| DWD | Germany | Built-in [dwd_weather_warnings](https://www.home-assistant.io/integrations/dwd_weather_warnings/) |
| PirateWeather | Global | [Pirate-Weather/pirate-weather-ha](https://github.com/Pirate-Weather/pirate-weather-ha) |

## Data Fidelity

Severity and certainty badges are always localized to your configured language. When a value was inferred by the card's adapter logic (rather than provided directly by the alert source), it is rendered with italic text and a tilde prefix (`~Moderate`) so you can tell at a glance which badges reflect actual provider data.

| Provider | Severity | Certainty |
|----------|----------|-----------|
| NWS | Raw (from `Severity` field) | Raw (from `Certainty` field) |
| BoM | Inferred (parsed from title/type/group) | Absent |
| MeteoAlarm | Raw (from `awareness_level` or `severity`) | Raw (from `certainty`) |
| DWD | Raw (from integer `level`) | Absent |
| PirateWeather | Raw (from `severity` field) | Absent |

## Development

```bash
npm install
npm run build     # bundle → dist/weather-alerts-card.js
npm run watch     # bundle with file watching
npm run lint      # TypeScript type-check
```

## Support

If you find this card useful, tip me at [Ko-fi](https://ko-fi.com/seeveezee) to support development, or donate to [The Y'all Squad](https://www.theyallsquad.org/donate) — a rapid-response program providing direct aid, chainsaws, and supplies to families affected by severe weather events.

---

**Resources:** [Home Assistant Community thread](https://community.home-assistant.io/t/nws-alerts-card)
