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
| INMET | Brazil | [sigrist/inmet](https://github.com/sigrist/inmet) |
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

Pick it from the editor's **Alert devices** selector, which lists NINA devices beside CAP
Alerts ones. Two regions are two devices; list the second under `devices:`.

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
- `showGeometry` draws a **marker**, not an outline — the entity carries only a point, the
  integration discards the fire-ground polygon. Pair it with `geometryStyle: map` for
  terrain and `showMyLocation: true` for a you-are-here ring in the same frame.

That point does drive one thing: `maxDistanceKm` trims a statewide feed to incidents
within a given number of kilometres of your Home Assistant home location (or of a
`myLocationEntity`). It is opt-in, always expressed in km in YAML, and has no effect on
area-warning providers.

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
If the platform's `latitude`/`longitude` differ from HA home, set `myLocationEntity` to a zone
at the platform's coordinates so the card measures from the same origin.
:::

### INMET (Brazil)

The [sigrist/inmet](https://github.com/sigrist/inmet) integration creates one
`geo_location.*` entity per active INMET alert and stamps each entity with
`source: inmet`. Point the card at that feed so alert entities can appear and
clear without updating YAML:

```yaml
type: custom:weather-alerts-card
sources:
  - inmet
```

Severity comes from INMET's textual `severity` field. The adapter maps `Perigo
Potencial` to moderate, `Perigo` to severe, and `Grande Perigo` to extreme.
`risks` render as the description, `instructions` render as the action text, and
the alert URL opens the matching INMET aviso page. Set `providerColors: true` to paint
each alert in the color INMET published for it (`aviso_cor`).

INMET entities carry the coordinates of the city you configured in the
integration, identical on every alert, rather than the alert's own location.
So `showGeometry` draws a marker at that city, the distance row reads as the
distance to it, and `maxDistanceKm` is deliberately not offered in the editor:
over a constant point it either changes nothing or, set below the home-to-city
distance, hides every alert. The YAML key still applies if you set it. The
alert's real extent is a polygon the integration does not expose; INMET's own
CAP feed carries it, which is a CAP Alerts provider candidate rather than a
card change.

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

Pick the device from the editor's **Alert devices** selector rather than hand-typing the
id. `device` can coexist with `entities:` for mixed setups.

Every CAP Alerts entry is one provider for one scope, so a second location or a second
provider is a second device. Add it under `devices:` and the card merges them. An alert
both devices carry (a home zone and a GPS tracker that overlap) is shown once, and a
device that goes dark is named on its own while the other keeps serving:

```yaml
type: custom:weather-alerts-card
device: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d      # NWS, home zone
devices:
  - 9f8e7d6c5b4a39281706f5e4d3c2b1a0    # NWS, GPS tracker for the car
  - 0a1b2c3d4e5f60718293a4b5c6d7e8f9    # GDACS, worldwide
```

The device selector is multi-select and writes this shape: first pick to `device`, the
rest to `devices`.

It ingests any CAP 1.2 feed — NWS, ECCC, MeteoAlarm, and the WMO Severe Weather
Information Centre firehose for countries with no dedicated integration. Because it
carries raw CAP fields and the original alert polygons, it is the only source that
unlocks the `showGeometry` mini-map, and the only one with a per-alert entity for
`tap_action: more-info` to target.

Some of its feeds mark **where an incident is** as well as, or instead of, the area it
covers: the Australian state feeds (NSW RFS, Queensland, WA, Tasmania) put a location
marker on every fire and a fire-ground polygon on about half of them. The integration
publishes the marker in `points`, and the card reads a single marker as the alert's
`point`, so `maxDistanceKm` and the distance row work on those entities exactly as they
do for the `nsw_rural_fire_service_feed` route. A marker-only alert draws the same
synthesized town-scale frame a point incident gets; one with a polygon keeps the
polygon as its frame.

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
value was inferred by the card's adapter logic (rather than provided directly by the
alert source), it is rendered with italic text and a tilde prefix (`~Moderate`) so you
can tell at a glance which badges reflect actual provider data.

The matrix below is the per-provider capability table from
[weather_alerts_card#205](https://github.com/seevee/weather_alerts_card/issues/205): how
each source reaches the card, what shape it carries, where its severity really comes
from, and which filters can act on it. Alerts that arrive through CAP Alerts all look
the same to the card (`provider: cap`), so read the row for the provider your CAP Alerts
device was set up with. "Never marked" in the severity column means the value is derived
upstream and the card cannot tell, because CAP Alerts does not yet carry a
derived-severity flag.

Geometry is a tier: **polygon** (fetched out of band by `geometry_ref`, with `bbox`
drawn meanwhile), **point** (a single marker, the origin of `maxDistanceKm`,
`sortOrder: distance` and the distance row) or **none**. Filters: **Z** `zones`, **E**
`eventCodes` / `excludeEventCodes`, **S** `minSeverity`, **D** `maxDistanceKm` and
`sortOrder: distance`, **X** `hideExpired`. `zones` and `eventCodes` hide every alert
that carries no matching value, so a row that says a filter "hides everything" means do
not set it for that source.

| Provider | Route | Geometry | What the shape is | `point` | Severity | Certainty | Filters that act |
|---|---|---|---|---|---|---|---|
| NWS | card adapter (`nws_alerts`) | none | — | no | Raw `Severity`; tilde when missing or unknown | Raw `Certainty` | E (`NWSCode`), S, X. Z only if the integration emits zone codes, and it does not |
| BoM | card adapter (`bureau_of_meteorology`) | none | — | no | Inferred from title, type and group; always tilde | Absent | S, X. Z with the safepay fork's `area_id` |
| MeteoAlarm | card adapter | none | — | no | Raw `awareness_level`, else `severity`; tilde only when both are absent | Raw `certainty` | S, X |
| DWD | card adapter (`dwd_weather_warnings`) | none | — | no | Raw integer `level`; the colour-hex fallback is not marked | Absent | E (numeric DWD id), S, X |
| NINA | card adapter (`nina`) | none | NINA publishes no geometry | no | Raw CAP `severity`, never marked (the integration substitutes `Unknown`) | Absent | S. X where the warning carries an expiry |
| MeteoSwiss | card adapter (`meteoswiss`) | none | — | no | Raw integer level | Absent | E (the warning type name, e.g. `Wind`, not a code), S, X |
| ECCC | card adapter (`environment_canada` fork) | none | — | no | Derived, the highest of `color`, `type`, `impact`; tilde only when all three are absent | Mapped from `confidence`; no badge when it is missing | E (`alert_code`), S, X |
| NSW RFS | card adapter (`geo_location`, `nsw_rural_fire_service_feed`) | point | The incident's location marker; the integration discards the fire-ground polygon | yes | Raw `category` (Australian Warning System); tilde on an empty or unrecognised value | Absent | D, S. X never acts (no expiry). The integration's own radius, 20 km by default, applies first |
| INMET | card adapter (`geo_location`, `inmet`) | point | The configured city, the same point on every alert | yes | Raw `severity` text; the colour fallback is tilde | Absent | S, X. D applies from YAML, but every alert is the same distance away, so the editor does not offer it |
| PirateWeather | card adapter | none | — | no | Raw `severity`; tilde when empty or unknown | Absent | S, X |
| CAP Alerts: NWS | cap_alerts (zone, GPS, tracker) | polygon or none | The warning's own polygon on storm-based warnings; zone-based alerts carry no shape, only `affected_zones` | no | VTEC significance (warning severe, watch moderate, advisory minor; tornado and extreme-wind warnings extreme), else CAP; never marked | Raw CAP | Z (UGC, SAME), E (`event_code_nws`, `event_code_same`), S, X |
| CAP Alerts: ECCC | cap_alerts (province, GPS, tracker) | polygon | Severe thunderstorm and tornado warnings: the forecaster-drawn threat area; everything else the union of the zone polygons | rare (zero-radius circles) | Raw CAP; never marked | Raw CAP | Z (CLC, SGC), S, X. E hides everything: the CAP-CP event code lives in `parameters` |
| CAP Alerts: MeteoAlarm | cap_alerts (country, region, GPS, tracker) | none in practice | Feeds publish EMMA region codes, not polygons (0 across ~5,900 areas sampled) | no | Awareness colour (yellow moderate, orange severe, red extreme), else CAP; never marked. The colour also drives the `meteoalarm` palette | Raw CAP | Z (EMMA_ID, NUTS), S, X. E hides everything |
| CAP Alerts: WMO | cap_alerts (source, GPS, tracker, geocode prefix) | source-dependent | The CAP `<polygon>` union where the authority publishes one; many publish none | zero-radius circles, source-dependent | Raw CAP; never marked | Raw CAP | Z (whatever the source publishes), S. X where the authority publishes an expiry (Macao and Curaçao never do). E hides everything |
| CAP Alerts: GDACS | cap_alerts (global, GPS, tracker) | polygon | Impact rings by alert level, forecast cones and wind radii excluded; an intensity circle for earthquakes | yes, the event centroid | Synthesised from the GDACS alert level (Green minor, Orange severe, Red extreme); the CAP body's own severity is not used; never marked | Raw CAP | D, S. Z hides everything (no geocodes), E hides everything, X never acts (no expiry) |
| CAP Alerts: BBK / NINA | cap_alerts (district, GPS, tracker) | polygon | The warning polygon from BBK's per-warning GeoJSON | no | Raw CAP; never marked | Raw CAP | S. X for DWD relays and all-clears; MoWaS warnings carry no expiry. Z and E hide everything |
| CAP Alerts: Australia | cap_alerts (state) | polygon or point | The fire-ground polygon where the agency draws one, about half the time, else the incident marker | yes, the incident's street-address marker | Australian Warning System tier (Emergency Warning extreme, Watch and Act severe, Advice moderate, the informational tiers minor); never marked | Raw CAP, near-uniform | D, S. X never acts (expiry is blank by design). Z hides all but the one state code; E hides everything |
