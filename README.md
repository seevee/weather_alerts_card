# NWS Alerts Card

A custom Home Assistant Lovelace card for displaying weather alerts with severity indicators, progress bars, and expandable details. Supports NWS (US) and BoM (Australia).

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

- **Multi-provider** — NWS (US) and BoM (Australia) with auto-detection
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

1. Install the [NWS Alerts](https://github.com/finity69x2/nws_alerts) integration (US) or [Bureau of Meteorology](https://github.com/bremor/bureau_of_meteorology) integration (Australia)
2. Install this card via HACS: search "NWS Alerts Card"
3. Add to your dashboard and select your alert entity

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | — | Alert sensor entity (e.g., `sensor.nws_alerts_alerts` or `sensor.sydney_warnings`) |
| `provider` | string | auto | `'nws'`, `'bom'`, or omit for auto-detect |
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
type: custom:nws-alerts-card
entity: sensor.nws_alerts_alerts
```

**With title and zone filtering**
```yaml
type: custom:nws-alerts-card
entity: sensor.nws_alerts_alerts
title: Weather Alerts
zones:
  - COC059
  - COZ039
```

**NWS official colors, compact, sorted by severity**
```yaml
type: custom:nws-alerts-card
entity: sensor.nws_alerts_alerts
colorTheme: nws
layout: compact
sortOrder: severity
```

**Australian BoM warnings**
```yaml
type: custom:nws-alerts-card
entity: sensor.sydney_warnings
provider: bom
```

## Installation

### HACS (recommended)
1. Open HACS → Search "NWS Alerts Card" → Install
2. Refresh your browser

### Manual
1. Download `nws-alerts-card.js` from the [latest release](../../releases/latest)
2. Copy to `config/www/nws-alerts-card.js`
3. Add as resource: **Settings → Dashboards → Resources** → URL: `/local/nws-alerts-card.js`, Type: JavaScript Module

## Development

```bash
npm install
npm run build     # bundle → dist/nws-alerts-card.js
npm run watch     # bundle with file watching
npm run lint      # TypeScript type-check
```

---

**Resources:** [Home Assistant Community thread](https://community.home-assistant.io/t/nws-alerts-card)
