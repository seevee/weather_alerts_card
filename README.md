# Weather Alerts Card

A custom Home Assistant Lovelace card for displaying weather alerts with severity indicators, progress bars, and expandable details. Supports NWS (US), BoM (Australia), MeteoAlarm (Europe), and PirateWeather.

![NWS Alerts Card](https://raw.githubusercontent.com/seevee/weather_alerts_card/main/img/hero-adaptive.svg)

## Features

- **Multi-provider** — NWS (US), BoM (Australia), MeteoAlarm (Europe), and PirateWeather with auto-detection
- **Severity colors** — HA theme colors or NWS official hazard-map colors by event type
- **Time progress bars** — elapsed/remaining time with relative and absolute timestamps
- **Expandable details** — sanitized description, instructions, and source link
- **BoM phase badges** — New, Updated, Renewed lifecycle indicators
- **Compact layout** — collapsed single-row alerts that expand on tap
- **Zone filtering** — show only alerts for specific zones
- **Sort order** — default, onset time, or severity
- **Severity threshold** — minimum severity to display
- **Localized UI** — English, French, and Spanish; auto-detected from Home Assistant locale
- **Visual config** — no YAML editing required

## Quick Start

1. Install a weather alerts integration for your region (see [Supported Providers](#supported-providers))
2. Install this card via HACS: search "Weather Alerts Card"
3. Add to your dashboard and select your alert entity

## Installation

### HACS (recommended)

Open HACS → Search "Weather Alerts Card" → Install → Refresh your browser

### Manual

1. Download `weather-alerts-card.js` from the [latest release](../../releases/latest)
2. Copy to `config/www/weather-alerts-card.js`
3. Add as resource: **Settings → Dashboards → Resources** → URL: `/local/weather-alerts-card.js`, Type: JavaScript Module

## Configuration

- **`entity`** — Alert sensor entity
- **`provider`** — `'nws'`, `'bom'`, `'meteoalarm'`, `'pirateweather'`, or omit for auto-detect
- **`title`** — Card header title
- **`zones`** — Zone codes to filter (NWS zones or BoM `area_id`)
- **`sortOrder`** — `'default'`, `'onset'`, `'severity'`
- **`minSeverity`** — `'minor'`, `'moderate'`, `'severe'`, `'extreme'`
- **`colorTheme`** — `'severity'` (default) or `'nws'`
- **`eventCodes`** — NWS event codes to include, e.g. `['SVR', 'TOR']` — omit for all events
- **`timezone`** — `'server'` (default) or `'browser'` to use the client's local timezone
- **`deduplicate`** — Collapse matching alerts into one card (default: `true`)
- **`animations`** — `true`, `false`, or respect `prefers-reduced-motion` (default: system)
- **`layout`** — `'default'` or `'compact'`

<details>
<summary><strong>Examples</strong></summary>

**Basic**
```yaml
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
```

**With title and zone filtering**
```yaml
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
title: Weather Alerts
zones:
  - COC059
  - COZ039
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

**European MeteoAlarm warnings**
```yaml
type: custom:weather-alerts-card
entity: binary_sensor.meteoalarm
```

**Australian BoM warnings**
```yaml
type: custom:weather-alerts-card
entity: sensor.sydney_warnings
provider: bom
```

**PirateWeather alerts**
```yaml
type: custom:weather-alerts-card
entity: sensor.pirateweather_alerts
```

</details>

## Supported Providers

The card auto-detects the provider from entity attributes. Any integration that produces a compatible data shape will work.

| Provider | Region | Tested integrations |
|----------|--------|---------------------|
| NWS | US | [finity69x2/nws_alerts](https://github.com/finity69x2/nws_alerts) |
| BoM | Australia | [bremor/bureau_of_meteorology](https://github.com/bremor/bureau_of_meteorology), [safepay/ha_bom_australia](https://github.com/safepay/ha_bom_australia) |
| MeteoAlarm | Europe | Built-in [meteoalarm](https://www.home-assistant.io/integrations/meteoalarm/) |
| PirateWeather | Global | [Pirate-Weather/pirate-weather-ha](https://github.com/Pirate-Weather/pirate-weather-ha) |

## Development

```bash
npm install
npm run build     # bundle → dist/weather-alerts-card.js
npm run watch     # bundle with file watching
npm run lint      # TypeScript type-check
```

<details>
<summary><strong>Migrating from v1.x</strong></summary>

The card was renamed from "NWS Alerts Card" to "Weather Alerts Card" in v2.0 to reflect multi-provider support. **Your existing dashboards will continue to work.** The old `custom:nws-alerts-card` element name is still supported but deprecated. To migrate:

1. Update your dashboard YAML: change `type: custom:nws-alerts-card` to `type: custom:weather-alerts-card`
2. Update your resource URL:
   - **HACS users:** HACS updates the resource path automatically — no action needed.
   - **Manual install:** In Settings → Dashboards → Resources, change `/local/nws-alerts-card.js` to `/local/weather-alerts-card.js`
3. The old names will be removed in v3.

</details>

---

**Resources:** [Home Assistant Community thread](https://community.home-assistant.io/t/nws-alerts-card)
