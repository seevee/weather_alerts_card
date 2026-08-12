# Providers

The card auto-detects a provider from the entity's attributes, so `provider:` is almost
never needed. Any integration producing a compatible data shape will work — the table
below lists the ones that are actually tested.

| Provider | Region | Tested integrations |
|----------|--------|---------------------|
| NWS | US | [finity69x2/nws_alerts](https://github.com/finity69x2/nws_alerts) |
| BoM | Australia | [bremor/bureau_of_meteorology](https://github.com/bremor/bureau_of_meteorology), [safepay/ha_bom_australia](https://github.com/safepay/ha_bom_australia) |
| MeteoAlarm | Europe | Built-in [meteoalarm](https://www.home-assistant.io/integrations/meteoalarm/) |
| DWD | Germany | Built-in [dwd_weather_warnings](https://www.home-assistant.io/integrations/dwd_weather_warnings/) |
| NINA | Germany (civil protection) | Built-in [nina](https://www.home-assistant.io/integrations/nina/) — see [the note below](#nina-german-civil-protection) |
| MeteoSwiss | Switzerland | [izacus/hass-swissweather](https://github.com/izacus/hass-swissweather) |
| ECCC | Canada | [seevee/cap_alerts](https://github.com/seevee/cap_alerts) (`provider: eccc`) — see [below](#canada-eccc-via-cap-alerts) |
| NSW RFS | Australia (NSW) | Built-in [nsw_rural_fire_service_feed](https://www.home-assistant.io/integrations/nsw_rural_fire_service_feed/) |
| PirateWeather | Global | [Pirate-Weather/pirate-weather-ha](https://github.com/Pirate-Weather/pirate-weather-ha) |
| CAP Alerts | Multi-region | [seevee/cap_alerts](https://github.com/seevee/cap_alerts) |

## How auto-detection works

Each provider has an **adapter** that converts raw entity attributes into one normalized
alert shape, which is all the card UI ever consumes. Detection is by attribute
signature — NWS by its `Alerts` array, BoM by `warnings`, DWD by `warning_count` plus
`region_name`, MeteoAlarm by its awareness-level attribute, NINA by `recommended_actions`
plus `affected_areas`, PirateWeather by its attribution string, and so on.

Set `provider:` explicitly only if you have a reason to override this.

## Per-provider notes

### NWS (US)

```yaml
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
```

Severity and certainty both come straight from the feed. The recommended integration
does **not** emit zone codes, so `zones` does not apply to it — use `eventCodes` to
filter instead. Zone codes must be comma-delimited with **no spaces** when configuring
the integration itself (`COC059,COZ039`); spaces make it silently return nothing.

NWS descriptions arrive hard-wrapped at 69 characters, a teletype legacy. `reformatText`
(on by default) strips those breaks while preserving real paragraphs.

### BoM (Australia)

```yaml
type: custom:weather-alerts-card
entity: sensor.sydney_warnings
provider: bom
```

Cancelled warnings are filtered out. Severity is **inferred** from the warning type and
group rather than provided — BoM carries no CAP severity field — so badges render with a
tilde (`~Moderate`). Phase badges (New, Updated, Renewed) come from the feed's lifecycle
field. `issue_time` is used as the onset, since BoM issues warnings when the threat is
already imminent.

`area_id` maps to `zones` for filtering, but only the `safepay/ha_bom_australia` fork
emits it.

### MeteoAlarm (Europe)

```yaml
type: custom:weather-alerts-card
entity: binary_sensor.meteoalarm
colorTheme: meteoalarm
```

The MeteoAlarm integration exposes a `binary_sensor` with flat attributes and returns
**one alert per entity** — an upstream library limitation, not a card one. For full
multi-alert European coverage, ingest the same feeds through
[CAP Alerts](#cap-alerts-multi-region) instead.

Alert text arrives in whatever language the platform's `language:` option selects, which
defaults to English. See [Alert text in your own
language](./recipes/alert-language) for that setting and for the title caveat, which
depends on your national service rather than on MeteoAlarm.

### DWD (Germany)

```yaml
type: custom:weather-alerts-card
entity: sensor.dwd_weather_warnings_hamburg_current
```

DWD splits current and advance warnings across two sensors. Merge them:

```yaml
type: custom:weather-alerts-card
entity: sensor.dwd_weather_warnings_current
entities:
  - sensor.dwd_weather_warnings_advance
```

### NINA (German civil protection)

NINA is the BBK's national warning app. It carries far more than weather: DWD storm and
heat warnings, LHP flood warnings, and MoWaS / KATWARN / BIWAPP civil-protection messages
(evacuations, hazmat, utility outages) all arrive on the same feed.

The integration creates one `binary_sensor` per region **per message slot**, and the slots
are pre-created empty. Point the card at the NINA **device** rather than hand-listing
slots — it picks up each slot as a warning lands in it and drops it again when the slot
clears:

```yaml
type: custom:weather-alerts-card
device: 8f2c1e04a9b7d3651fa0c8e29d47b5a3
```

Listing the slot entities directly works too, and is what you want if you only care about
the first slot or two:

```yaml
type: custom:weather-alerts-card
entity: binary_sensor.mittelfranken_warnung_1
entities:
  - binary_sensor.mittelfranken_warnung_2
  - binary_sensor.mittelfranken_warnung_3
```

An empty slot reports `off` with no attributes, which the card reads as "no active alerts"
— an all-quiet NINA region is never flagged as an unavailable source. The per-slot
diagnostic sensors the integration also creates (`sensor.*_headline_1`,
`sensor.*_severity_1`, …) hold one value each and are ignored.

Severity is the CAP vocabulary verbatim, so badges render without the inferred-value
tilde, and real `start` / `expires` timestamps drive the progress bar. Row titles are
lifted out of the DWD headline template — "Amtliche WARNUNG vor extremer HITZE" titles
the row "Extremer Hitze" and keeps the full headline underneath. Headlines from the
non-DWD senders are free prose and pass through unchanged. NINA publishes no geometry, so
`showGeometry` has nothing to draw.

::: warning Attribute removal in HA 2026.11
Everything the card reads apart from `id` is deprecated on the NINA binary sensor and
scheduled for removal in Home Assistant 2026.11
([core#161882](https://github.com/home-assistant/core/pull/161882)). The replacement is
the per-field diagnostic sensors plus a `nina.get_details` action; `description` and
`recommended_actions` got no sensor at all. Card support as described here is correct
through HA 2026.10 and will need reworking after that — tracked in
[#234](https://github.com/seevee/weather_alerts_card/issues/234).
:::

### MeteoSwiss (Switzerland)

```yaml
type: custom:weather-alerts-card
entity: sensor.weather_warnings_at_8000
```

Point the card at `sensor.weather_warnings_at_<postcode>`. Severity comes from an
integer level; there is no certainty field.

### NSW RFS (Australian bushfire)

The `nsw_rural_fire_service_feed` integration creates one `geo_location.*` entity per
active incident, and that set churns constantly as fires start and clear. Rather than
hand-listing volatile entity ids, point the card at the feed:

```yaml
type: custom:weather-alerts-card
sources:
  - nsw_rural_fire_service_feed
```

`nsw_rural_fire_service_feed` is the `source` state attribute each incident entity
carries, so the value maps one-to-one to what you see on the entity. In the visual
editor this is the **Auto-collect from installed feeds** checkbox. You can still
hand-list specific incidents under `entities:`, or group them with `device:`, for a
fixed subset.

Severity comes straight from the incident `category` — the Australian Warning System
ladder (Emergency Warning / Watch and Act / Advice). Two consequences worth knowing:

- Incidents have **no real expiry**, so the card shows an honest "ongoing" state with no
  progress bar rather than inventing a countdown.
- `showGeometry` is unavailable — the entity carries only a point, not the fire-ground
  polygon.

That point does drive one thing: `maxDistanceKm` trims a statewide feed to incidents
within a given number of kilometres of your Home Assistant home location. It is opt-in,
always expressed in km in YAML, and has no effect on area-warning providers.

```yaml
type: custom:weather-alerts-card
sources:
  - nsw_rural_fire_service_feed
maxDistanceKm: 50
```

::: warning The card filter only narrows — check the integration's radius first
`nsw_rural_fire_service_feed` has its own `radius` option, **default 20 km**, measured from
the same Home Assistant home location. Incidents beyond it never reach the card at all, so
`maxDistanceKm` can only trim that set further, never widen it. On the default, a card set to
`maxDistanceKm: 50` changes nothing — raise the integration's `radius` to see incidents
further out. The card-side filter is for narrowing per card without touching the integration.
:::

### PirateWeather

```yaml
type: custom:weather-alerts-card
entity: sensor.pirateweather_alerts
```

### CAP Alerts (multi-region)

The [CAP Alerts integration](https://github.com/seevee/cap_alerts) creates **one sensor
per active alert** under a Home Assistant device. Point the card at the device and it
picks up every active alert automatically, re-discovering them as alerts are issued and
cleared:

```yaml
type: custom:weather-alerts-card
device: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d
```

Pick the device from the editor's CAP Alerts device selector rather than hand-typing the
id. `device` can coexist with `entities:` for mixed setups.

It ingests any CAP 1.2 feed — NWS, ECCC, MeteoAlarm, and the WMO Severe Weather
Information Centre firehose for countries with no dedicated integration. Because it
carries raw CAP fields and the original alert polygons, it is the only source that
unlocks the `showGeometry` mini-map, and the only one with a per-alert entity for
`tap_action: more-info` to target.

## Canada: ECCC via CAP Alerts

For Environment and Climate Change Canada alerts,
[CAP Alerts](https://github.com/seevee/cap_alerts) (`provider: eccc`) is the source to
use. It ingests the NAAD CAP firehose, creating one sensor per active alert under a
device. That carries **raw** CAP severity and certainty, preserves the original
multi-region polygons, and unlocks the affected-area mini-map.

```yaml
type: custom:weather-alerts-card
device: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d
colorTheme: eccc      # ECCC's official red/orange/yellow/grey palette
showGeometry: true    # affected-area mini-map
```

The provider auto-detects as `eccc`; set `provider: eccc` explicitly only if you have
disabled auto-detection.

### Why not the other ECCC integrations?

Two others exist, and neither is the right source for this card.

- **HA core `environment_canada`** exposes rich alert detail only through a `get_alerts`
  **action** ([#172393](https://github.com/home-assistant/core/pull/172393), merged in
  place of the attribute-based [#164481](https://github.com/home-assistant/core/pull/164481)).
  A Lovelace card reads state and attributes during render and cannot consume an action
  response, so core simply cannot drive this card.
- The HACS **`environment_canada`** fork does surface alert attributes, but it is a
  stop-gap its own maintainer would rather not keep running (see
  [discussion #3130](https://github.com/orgs/home-assistant/discussions/3130)), and it
  overrides the core integration's domain. Out of respect for that, ECCC users are not
  routed to it.

::: warning If you also run `environment_canada` for weather
Its alert list (GeoMet WFS, filtered by a point-in-polygon test against your
coordinates) will not line up with CAP Alerts' (NAAD CAP polygons, ingested directly).
The WFS feed lags and truncates NAAD coverage, so an alert can appear in one and not the
other. That is upstream behaviour, not the card.
:::

## Data fidelity

Severity and certainty badges are always localized to your configured language. When a
value was **inferred** by the card's adapter rather than provided by the source, it is
rendered in italics with a tilde prefix (`~Moderate`) — so you can tell at a glance which
badges reflect real provider data.

| Provider | Severity | Certainty |
|----------|----------|-----------|
| NWS | Raw (from `Severity`) | Raw (from `Certainty`) |
| BoM | Inferred (parsed from title/type/group) | Absent |
| MeteoAlarm | Raw (from `awareness_level` or `severity`) | Raw (from `certainty`) |
| DWD | Raw (from integer `level`) | Absent |
| NINA | Raw (CAP vocabulary from `severity`) | Absent |
| MeteoSwiss | Raw (from integer level) | Absent |
| ECCC | Derived (max of `color`, `type`, `impact`; tilde only when all three are absent) | Mapped from `confidence` (High → Likely, Moderate → Possible, Low → Unlikely) |
| NSW RFS | Raw (from `category`) | Absent |
| PirateWeather | Raw (from `severity`) | Absent |
| CAP Alerts | Raw (from `severity_normalized` / `severity`) | Raw (from `certainty`) |
