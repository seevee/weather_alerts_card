# Weather Alerts Card

A custom Home Assistant Lovelace card for displaying weather alerts with severity indicators, progress bars, and expandable details. Supports NWS (US), BoM (Australia), and MeteoAlarm (Europe).

## Screenshots

**Default layout** — severity colors, expanded details

| Light | Dark |
|:---:|:---:|
| ![Light mode](https://raw.githubusercontent.com/seevee/nws_alerts_card/main/img/severity-light-details.png) | ![Dark mode](https://raw.githubusercontent.com/seevee/nws_alerts_card/main/img/severity-dark-details.png) |

**Compact layout** — NWS official colors

| Light | Dark |
|:---:|:---:|
| ![Light mode](https://raw.githubusercontent.com/seevee/nws_alerts_card/main/img/nws-light-compact.png) | ![Dark mode](https://raw.githubusercontent.com/seevee/nws_alerts_card/main/img/nws-dark-compact.png) |

## Features

- **Multi-provider** — NWS (US), BoM (Australia), and MeteoAlarm (Europe) with auto-detection
- **Severity colors** — HA theme colors or NWS official hazard-map colors by event type
- **Time progress bars** — elapsed/remaining time with relative and absolute timestamps
- **Expandable details** — sanitized description, instructions, and source link
- **BoM phase badges** — New, Updated, Renewed lifecycle indicators
- **Compact layout** — collapsed single-row alerts that expand on tap
- **Zone filtering** — show only alerts for specific zones
- **Sort order** — default, onset time, or severity
- **Severity threshold** — minimum severity to display
- **Visual config** — no YAML editing required

## Quick Start

1. Install the [NWS Alerts](https://github.com/finity69x2/nws_alerts) integration (US), [Bureau of Meteorology](https://github.com/bremor/bureau_of_meteorology) integration (Australia), or [MeteoAlarm](https://www.home-assistant.io/integrations/meteoalarm/) integration (Europe, built-in)
2. Install this card via HACS: search "Weather Alerts Card"
3. Add to your dashboard and select your alert entity

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | — | Alert sensor entity (e.g., `sensor.nws_alerts_alerts`, `sensor.sydney_warnings`, or `binary_sensor.meteoalarm`) |
| `provider` | string | auto | `'nws'`, `'bom'`, `'meteoalarm'`, or omit for auto-detect |
| `title` | string | — | Card header title |
| `zones` | string[] | — | Zone codes to filter (NWS zones or BoM `area_id`) |
| `sortOrder` | string | `'default'` | `'default'`, `'onset'`, `'severity'` |
| `minSeverity` | string | — | `'minor'`, `'moderate'`, `'severe'`, `'extreme'` |
| `colorTheme` | string | `'severity'` | `'severity'` or `'nws'` |
| `animations` | boolean | system | `true`, `false`, or respect `prefers-reduced-motion` |
| `layout` | string | `'default'` | `'default'` or `'compact'` |

### Examples

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

## Installation

### HACS (recommended)
1. Open HACS → Search "Weather Alerts Card" → Install
2. Refresh your browser

### Manual
1. Download `weather-alerts-card.js` from the [latest release](../../releases/latest)
2. Copy to `config/www/weather-alerts-card.js`
3. Add as resource: **Settings → Dashboards → Resources** → URL: `/local/weather-alerts-card.js`, Type: JavaScript Module

### MeteoAlarm (Europe)

The [MeteoAlarm integration](https://www.home-assistant.io/integrations/meteoalarm/) is built into Home Assistant. It creates a `binary_sensor.meteoalarm` entity that exposes a single active weather alert per configured province.

1. **Settings → Devices & Services → Add Integration** → search "MeteoAlarm"
2. Select your country and province

> **Note**: The MeteoAlarm integration only reports one alert at a time per entity. If your region has multiple concurrent alerts, only the first one is shown. This is a limitation of the upstream library, not the card.

## Migrating from v1.x

The card was renamed from "NWS Alerts Card" to "Weather Alerts Card" in v2.0 to reflect multi-provider support. **Your existing dashboards will continue to work.** The old `custom:nws-alerts-card` element name is still supported but deprecated. To migrate:

1. Update your dashboard YAML: change `type: custom:nws-alerts-card` to `type: custom:weather-alerts-card`
2. Update your resource URL (Settings → Dashboards → Resources): change `/local/nws-alerts-card.js` to `/local/weather-alerts-card.js`
3. The old names will be removed in v3.

## Development

```bash
npm install
npm run build     # bundle → dist/weather-alerts-card.js
npm run watch     # bundle with file watching
npm run lint      # TypeScript type-check
```

---

**Resources:** [Home Assistant Community thread](https://community.home-assistant.io/t/nws-alerts-card)
