# GeoSphere Austria (municipality warnings)

[GeoSphere Austria](https://www.geosphere.at/) (formerly ZAMG) issues its weather warnings per
**municipality** — one level finer than the MeteoAlarm feed the card already covers for Austria,
which stops at district level. There is no GeoSphere adapter in the card, and the built-in
`geosphere_austria_warnings` integration cannot feed one: its level sensors carry the attributes
of a single selected warning and no warning text, so a municipality with an orange thunderstorm
and a yellow rain warning at the same time can only ever render one of them.

The way in is the [DWD adapter](../providers#dwd-germany), which reads a flat `warning_count` /
`warning_1`…`warning_N` shape. GeoSphere's open Warn API gives you the full list, the German
warning texts and the validity window in one call, so two YAML blocks are all it takes: a REST
sensor that fetches the raw response, and a template sensor that reshapes it.

The samples below are German throughout — that is the language the API returns for `lang=de`,
and the language the municipalities write in.

## 1. Fetch the raw response

The Warn API is public, needs no API key and is licensed CC BY 4.0. Query it **by coordinates**:
the response is then scoped to the single municipality that contains the point.

```yaml
rest:
  # Eine Gemeinde pro Antwort: nach Koordinaten fragen, nicht nach Bezirk.
  # <lat>/<lon> durch die Koordinaten der eigenen Gemeinde ersetzen,
  # zum Beispiel ?lat=48.0&lon=16.0&lang=de
  - resource: "https://warnungen.zamg.at/wsapp/api/getWarningsForCoords?lat=<lat>&lon=<lon>&lang=de"
    scan_interval: 300
    sensor:
      - name: "Unwetter Rohdaten Municipality"
        unique_id: unwetter_rohdaten_municipality
        value_template: "{{ value_json.properties.location.properties.name }}"
        json_attributes:
          - properties
```

Home Assistant lowercases the entity's object_id, so the entity is
`sensor.unwetter_rohdaten_municipality` — exactly the id the template sensor below reads.

## 2. Reshape it into the DWD shape

The mapping, field by field:

| GeoSphere field | Meaning | Sensor attribute |
|---|---|---|
| `warnstufeid` 1 / 2 / 3 | yellow / orange / red | `level` 2 / 3 / 4 with the DWD severity colours |
| `warntypid` 1..7 | storm, rain, snow, black ice, thunderstorm, heat, cold | `event` (e.g. `Gewitterwarnung`) + `headline` |
| `text` (+ `auswirkungen`) | warning text (+ impact) | `description` |
| `empfehlungen` | recommendations | `instruction` |
| `rawinfo.start` / `rawinfo.end` | validity window (epoch seconds) | `start_time` / `end_time` as `YYYY-MM-DDThh:mm:ssZ`, UTC |
| `location.properties.name` | municipality | `region_name` |

Warnings whose `rawinfo.end` is in the past are filtered out before counting, so
`warning_count` only ever carries active alerts.

```yaml
- sensor:
    - name: "Municipality Unwetterwarnungen"
      unique_id: municipality_unwetterwarnungen
      icon: mdi:weather-lightning
      # state = Anzahl AKTIVER Warnungen (abgelaufene werden gefiltert)
      state: >-
        {%- set props = state_attr('sensor.unwetter_rohdaten_municipality', 'properties') or {} -%}
        {%- set nowts = now().timestamp() | int -%}
        {%- set sortiert = (props.warnings or []) | map(attribute='properties') | sort(attribute='warnstufeid', reverse=true) | list -%}
        {%- set ns = namespace(n=0, top={}) -%}
        {%- for p in sortiert -%}
        {%- if ((p.get('rawinfo') or {}).get('end') | int(0)) > nowts -%}
        {%- set ns.n = ns.n + 1 -%}
        {%- endif -%}
        {%- endfor -%}
        {{ ns.n }}
      attributes:
        warning_count: >-
          {%- set props = state_attr('sensor.unwetter_rohdaten_municipality', 'properties') or {} -%}
          {%- set nowts = now().timestamp() | int -%}
          {%- set sortiert = (props.warnings or []) | map(attribute='properties') | sort(attribute='warnstufeid', reverse=true) | list -%}
          {%- set ns = namespace(n=0, top={}) -%}
          {%- for p in sortiert -%}
          {%- if ((p.get('rawinfo') or {}).get('end') | int(0)) > nowts -%}
          {%- set ns.n = ns.n + 1 -%}
          {%- endif -%}
          {%- endfor -%}
          {{ ns.n }}
        region_name: >-
          {%- set props = state_attr('sensor.unwetter_rohdaten_municipality', 'properties') or {} -%}
          {%- set loc = (props.location or {}).get('properties', {}) -%}
          {{ (loc.get('name') or 'Gemeinde') }}
        attribution: >-
          {%- set props = state_attr('sensor.unwetter_rohdaten_municipality', 'properties') or {} -%}
          {%- set loc = (props.location or {}).get('properties', {}) -%}
          {{ 'Daten: GeoSphere Austria, Gemeinde ' ~ (loc.get('gemeindenr') or '') ~ ' (CC BY 4.0)' }}
        warning_1: >-
          {%- set props = state_attr('sensor.unwetter_rohdaten_municipality', 'properties') or {} -%}
          {%- set nowts = now().timestamp() | int -%}
          {%- set sortiert = (props.warnings or []) | map(attribute='properties') | sort(attribute='warnstufeid', reverse=true) | list -%}
          {%- set ns = namespace(n=0, top={}) -%}
          {%- for p in sortiert -%}
          {%- if ((p.get('rawinfo') or {}).get('end') | int(0)) > nowts -%}
          {%- set ns.n = ns.n + 1 -%}
          {%- if ns.n == 1 -%}{%- set ns.top = p -%}{%- endif -%}
          {%- endif -%}
          {%- endfor -%}
          {%- set stufen = {1:{'sev':2, 'farbe':'#ffff00', 'adj':'Gelbe'},
                            2:{'sev':3, 'farbe':'#ff9900', 'adj':'Orange'},
                            3:{'sev':4, 'farbe':'#ff0000', 'adj':'Rote'}} -%}
          {%- set typen = {1:'Sturm', 2:'Regen', 3:'Schnee', 4:'Glatteis', 5:'Gewitter', 6:'Hitze', 7:'Kälte'} -%}
          {%- set p = ns.top -%}
          {%- if p -%}
          {%- set r = (p.get('rawinfo') or {}) -%}
          {%- set st = stufen.get(p.get('warnstufeid') | int(0), stufen[1]) -%}
          {%- set typ = typen.get(p.get('warntypid') | int(0), 'Wetterwarnung') -%}
          {%- set s = r.get('start') | int(0) -%}
          {%- set e = r.get('end') | int(0) -%}
          {{ {'level': st.sev, 'color': st.farbe, 'event': typ ~ 'warnung', 'headline': st.adj ~ ' Wetterwarnung vor ' ~ typ ~ ' · GeoSphere Austria', 'description': ((p.get('text') or '') ~ ((' Auswirkungen: ' ~ p.auswirkungen) if p.get('auswirkungen') else '')), 'instruction': (p.get('empfehlungen') or ''), 'start_time': ((s | timestamp_custom('%Y-%m-%dT%H:%M:%SZ', false)) if s else ''), 'end_time': ((e | timestamp_custom('%Y-%m-%dT%H:%M:%SZ', false)) if e else '')} }}
          {%- else -%}
          {}
          {%- endif -%}
        warning_2: >-
          {%- set props = state_attr('sensor.unwetter_rohdaten_municipality', 'properties') or {} -%}
          {%- set nowts = now().timestamp() | int -%}
          {%- set sortiert = (props.warnings or []) | map(attribute='properties') | sort(attribute='warnstufeid', reverse=true) | list -%}
          {%- set ns = namespace(n=0, top={}) -%}
          {%- for p in sortiert -%}
          {%- if ((p.get('rawinfo') or {}).get('end') | int(0)) > nowts -%}
          {%- set ns.n = ns.n + 1 -%}
          {%- if ns.n == 2 -%}{%- set ns.top = p -%}{%- endif -%}
          {%- endif -%}
          {%- endfor -%}
          {%- set stufen = {1:{'sev':2, 'farbe':'#ffff00', 'adj':'Gelbe'},
                            2:{'sev':3, 'farbe':'#ff9900', 'adj':'Orange'},
                            3:{'sev':4, 'farbe':'#ff0000', 'adj':'Rote'}} -%}
          {%- set typen = {1:'Sturm', 2:'Regen', 3:'Schnee', 4:'Glatteis', 5:'Gewitter', 6:'Hitze', 7:'Kälte'} -%}
          {%- set p = ns.top -%}
          {%- if p -%}
          {%- set r = (p.get('rawinfo') or {}) -%}
          {%- set st = stufen.get(p.get('warnstufeid') | int(0), stufen[1]) -%}
          {%- set typ = typen.get(p.get('warntypid') | int(0), 'Wetterwarnung') -%}
          {%- set s = r.get('start') | int(0) -%}
          {%- set e = r.get('end') | int(0) -%}
          {{ {'level': st.sev, 'color': st.farbe, 'event': typ ~ 'warnung', 'headline': st.adj ~ ' Wetterwarnung vor ' ~ typ ~ ' · GeoSphere Austria', 'description': ((p.get('text') or '') ~ ((' Auswirkungen: ' ~ p.auswirkungen) if p.get('auswirkungen') else '')), 'instruction': (p.get('empfehlungen') or ''), 'start_time': ((s | timestamp_custom('%Y-%m-%dT%H:%M:%SZ', false)) if s else ''), 'end_time': ((e | timestamp_custom('%Y-%m-%dT%H:%M:%SZ', false)) if e else '')} }}
          {%- else -%}
          {}
          {%- endif -%}
        warning_3: >-
          {%- set props = state_attr('sensor.unwetter_rohdaten_municipality', 'properties') or {} -%}
          {%- set nowts = now().timestamp() | int -%}
          {%- set sortiert = (props.warnings or []) | map(attribute='properties') | sort(attribute='warnstufeid', reverse=true) | list -%}
          {%- set ns = namespace(n=0, top={}) -%}
          {%- for p in sortiert -%}
          {%- if ((p.get('rawinfo') or {}).get('end') | int(0)) > nowts -%}
          {%- set ns.n = ns.n + 1 -%}
          {%- if ns.n == 3 -%}{%- set ns.top = p -%}{%- endif -%}
          {%- endif -%}
          {%- endfor -%}
          {%- set stufen = {1:{'sev':2, 'farbe':'#ffff00', 'adj':'Gelbe'},
                            2:{'sev':3, 'farbe':'#ff9900', 'adj':'Orange'},
                            3:{'sev':4, 'farbe':'#ff0000', 'adj':'Rote'}} -%}
          {%- set typen = {1:'Sturm', 2:'Regen', 3:'Schnee', 4:'Glatteis', 5:'Gewitter', 6:'Hitze', 7:'Kälte'} -%}
          {%- set p = ns.top -%}
          {%- if p -%}
          {%- set r = (p.get('rawinfo') or {}) -%}
          {%- set st = stufen.get(p.get('warnstufeid') | int(0), stufen[1]) -%}
          {%- set typ = typen.get(p.get('warntypid') | int(0), 'Wetterwarnung') -%}
          {%- set s = r.get('start') | int(0) -%}
          {%- set e = r.get('end') | int(0) -%}
          {{ {'level': st.sev, 'color': st.farbe, 'event': typ ~ 'warnung', 'headline': st.adj ~ ' Wetterwarnung vor ' ~ typ ~ ' · GeoSphere Austria', 'description': ((p.get('text') or '') ~ ((' Auswirkungen: ' ~ p.auswirkungen) if p.get('auswirkungen') else '')), 'instruction': (p.get('empfehlungen') or ''), 'start_time': ((s | timestamp_custom('%Y-%m-%dT%H:%M:%SZ', false)) if s else ''), 'end_time': ((e | timestamp_custom('%Y-%m-%dT%H:%M:%SZ', false)) if e else '')} }}
          {%- else -%}
          {}
          {%- endif -%}
        warning_4: >-
          {%- set props = state_attr('sensor.unwetter_rohdaten_municipality', 'properties') or {} -%}
          {%- set nowts = now().timestamp() | int -%}
          {%- set sortiert = (props.warnings or []) | map(attribute='properties') | sort(attribute='warnstufeid', reverse=true) | list -%}
          {%- set ns = namespace(n=0, top={}) -%}
          {%- for p in sortiert -%}
          {%- if ((p.get('rawinfo') or {}).get('end') | int(0)) > nowts -%}
          {%- set ns.n = ns.n + 1 -%}
          {%- if ns.n == 4 -%}{%- set ns.top = p -%}{%- endif -%}
          {%- endif -%}
          {%- endfor -%}
          {%- set stufen = {1:{'sev':2, 'farbe':'#ffff00', 'adj':'Gelbe'},
                            2:{'sev':3, 'farbe':'#ff9900', 'adj':'Orange'},
                            3:{'sev':4, 'farbe':'#ff0000', 'adj':'Rote'}} -%}
          {%- set typen = {1:'Sturm', 2:'Regen', 3:'Schnee', 4:'Glatteis', 5:'Gewitter', 6:'Hitze', 7:'Kälte'} -%}
          {%- set p = ns.top -%}
          {%- if p -%}
          {%- set r = (p.get('rawinfo') or {}) -%}
          {%- set st = stufen.get(p.get('warnstufeid') | int(0), stufen[1]) -%}
          {%- set typ = typen.get(p.get('warntypid') | int(0), 'Wetterwarnung') -%}
          {%- set s = r.get('start') | int(0) -%}
          {%- set e = r.get('end') | int(0) -%}
          {{ {'level': st.sev, 'color': st.farbe, 'event': typ ~ 'warnung', 'headline': st.adj ~ ' Wetterwarnung vor ' ~ typ ~ ' · GeoSphere Austria', 'description': ((p.get('text') or '') ~ ((' Auswirkungen: ' ~ p.auswirkungen) if p.get('auswirkungen') else '')), 'instruction': (p.get('empfehlungen') or ''), 'start_time': ((s | timestamp_custom('%Y-%m-%dT%H:%M:%SZ', false)) if s else ''), 'end_time': ((e | timestamp_custom('%Y-%m-%dT%H:%M:%SZ', false)) if e else '')} }}
          {%- else -%}
          {}
          {%- endif -%}
        warning_5: >-
          {%- set props = state_attr('sensor.unwetter_rohdaten_municipality', 'properties') or {} -%}
          {%- set nowts = now().timestamp() | int -%}
          {%- set sortiert = (props.warnings or []) | map(attribute='properties') | sort(attribute='warnstufeid', reverse=true) | list -%}
          {%- set ns = namespace(n=0, top={}) -%}
          {%- for p in sortiert -%}
          {%- if ((p.get('rawinfo') or {}).get('end') | int(0)) > nowts -%}
          {%- set ns.n = ns.n + 1 -%}
          {%- if ns.n == 5 -%}{%- set ns.top = p -%}{%- endif -%}
          {%- endif -%}
          {%- endfor -%}
          {%- set stufen = {1:{'sev':2, 'farbe':'#ffff00', 'adj':'Gelbe'},
                            2:{'sev':3, 'farbe':'#ff9900', 'adj':'Orange'},
                            3:{'sev':4, 'farbe':'#ff0000', 'adj':'Rote'}} -%}
          {%- set typen = {1:'Sturm', 2:'Regen', 3:'Schnee', 4:'Glatteis', 5:'Gewitter', 6:'Hitze', 7:'Kälte'} -%}
          {%- set p = ns.top -%}
          {%- if p -%}
          {%- set r = (p.get('rawinfo') or {}) -%}
          {%- set st = stufen.get(p.get('warnstufeid') | int(0), stufen[1]) -%}
          {%- set typ = typen.get(p.get('warntypid') | int(0), 'Wetterwarnung') -%}
          {%- set s = r.get('start') | int(0) -%}
          {%- set e = r.get('end') | int(0) -%}
          {{ {'level': st.sev, 'color': st.farbe, 'event': typ ~ 'warnung', 'headline': st.adj ~ ' Wetterwarnung vor ' ~ typ ~ ' · GeoSphere Austria', 'description': ((p.get('text') or '') ~ ((' Auswirkungen: ' ~ p.auswirkungen) if p.get('auswirkungen') else '')), 'instruction': (p.get('empfehlungen') or ''), 'start_time': ((s | timestamp_custom('%Y-%m-%dT%H:%M:%SZ', false)) if s else ''), 'end_time': ((e | timestamp_custom('%Y-%m-%dT%H:%M:%SZ', false)) if e else '')} }}
          {%- else -%}
          {}
          {%- endif -%}
        warning_6: >-
          {%- set props = state_attr('sensor.unwetter_rohdaten_municipality', 'properties') or {} -%}
          {%- set nowts = now().timestamp() | int -%}
          {%- set sortiert = (props.warnings or []) | map(attribute='properties') | sort(attribute='warnstufeid', reverse=true) | list -%}
          {%- set ns = namespace(n=0, top={}) -%}
          {%- for p in sortiert -%}
          {%- if ((p.get('rawinfo') or {}).get('end') | int(0)) > nowts -%}
          {%- set ns.n = ns.n + 1 -%}
          {%- if ns.n == 6 -%}{%- set ns.top = p -%}{%- endif -%}
          {%- endif -%}
          {%- endfor -%}
          {%- set stufen = {1:{'sev':2, 'farbe':'#ffff00', 'adj':'Gelbe'},
                            2:{'sev':3, 'farbe':'#ff9900', 'adj':'Orange'},
                            3:{'sev':4, 'farbe':'#ff0000', 'adj':'Rote'}} -%}
          {%- set typen = {1:'Sturm', 2:'Regen', 3:'Schnee', 4:'Glatteis', 5:'Gewitter', 6:'Hitze', 7:'Kälte'} -%}
          {%- set p = ns.top -%}
          {%- if p -%}
          {%- set r = (p.get('rawinfo') or {}) -%}
          {%- set st = stufen.get(p.get('warnstufeid') | int(0), stufen[1]) -%}
          {%- set typ = typen.get(p.get('warntypid') | int(0), 'Wetterwarnung') -%}
          {%- set s = r.get('start') | int(0) -%}
          {%- set e = r.get('end') | int(0) -%}
          {{ {'level': st.sev, 'color': st.farbe, 'event': typ ~ 'warnung', 'headline': st.adj ~ ' Wetterwarnung vor ' ~ typ ~ ' · GeoSphere Austria', 'description': ((p.get('text') or '') ~ ((' Auswirkungen: ' ~ p.auswirkungen) if p.get('auswirkungen') else '')), 'instruction': (p.get('empfehlungen') or ''), 'start_time': ((s | timestamp_custom('%Y-%m-%dT%H:%M:%SZ', false)) if s else ''), 'end_time': ((e | timestamp_custom('%Y-%m-%dT%H:%M:%SZ', false)) if e else '')} }}
          {%- else -%}
          {}
          {%- endif -%}
```

Two things about that YAML are not style, they are the platform:

- **`attributes:` has to be a mapping** (`attribute_name: template`) on Home Assistant 2026.10;
  the older form, one template rendering the whole dict, fails validation
  (`expected a mapping for dictionary value 'sensor->0->attributes'`). Dynamic keys are therefore
  impossible and the sensor carries fixed slots `warning_1`…`warning_6`. The adapter iterates only
  up to `warning_count` and skips empty slots, so a quiet municipality is not a problem.
- **The list append/update helpers are blocked in the template sandbox**, so the per-warning dict
  is assembled by string concatenation in a `namespace` and emitted as JSON text.

::: warning No `awareness_level` / `awareness_type` here, on purpose
An earlier version of this mapping carried them (plus `active_levels` and `active_type_codes`)
because the MeteoAlarm integration uses that shape. The DWD adapter never reads any of the four —
and `awareness_level` together with `awareness_type` is exactly what the **MeteoAlarm** adapter
keys on, so leaving them in makes the entity claimable by the wrong adapter if auto-detection ever
runs before this card's explicit `provider: dwd`. Do not add them back.
:::

## 3. Point the card at the sensor

```yaml
type: custom:weather-alerts-card
entity: sensor.municipality_unwetterwarnungen
provider: dwd
```

Set `provider: dwd` explicitly. The sensor is a GeoSphere entity carrying DWD-shaped attributes,
and naming the adapter removes any dependence on attribute-shape auto-detection.

## Sample payloads

### Quiet state — no active warnings

A real capture from the API, with the municipality name and number replaced and the polygon
removed:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "MultiPolygon",
    "coordinates": "«omitted: municipality polygon in EPSG:31287»"
  },
  "properties": {
    "location": {
      "type": "Municipal",
      "properties": {
        "gemeindenr": 0,
        "name": "Municipality",
        "urlname": "municipality"
      }
    },
    "warnings": []
  }
}
```

### Warning state — orange thunderstorm plus yellow rain (constructed)

::: warning Constructed sample
This payload is **constructed, not captured**. Austria had zero active warnings when it was
written, so it was built inside a live response envelope using the field names the template reads,
around the orange thunderstorm plus yellow rain pair this recipe uses as its example. Do not treat
it as a real API response.
:::

```json
{
  "type": "Feature",
  "properties": {
    "location": {
      "type": "Municipal",
      "properties": {
        "gemeindenr": 0,
        "name": "Municipality",
        "urlname": "municipality"
      }
    },
    "warnings": [
      {
        "type": "Feature",
        "properties": {
          "warntypid": 5,
          "warnstufeid": 2,
          "text": "Gewitter mit Starkregen und Hagel.",
          "auswirkungen": "Ueberflutungen moeglich.",
          "empfehlungen": "Lose Gegenstaende sichern, Aufenthalt im Freien vermeiden.",
          "rawinfo": {
            "start": 1791900000,
            "end": 1791921600
          }
        }
      },
      {
        "type": "Feature",
        "properties": {
          "warntypid": 2,
          "warnstufeid": 1,
          "text": "Maessiger Regen.",
          "auswirkungen": "Rutschgefahr auf Strassen.",
          "empfehlungen": "Vorsichtig fahren.",
          "rawinfo": {
            "start": 1791892800,
            "end": 1791914400
          }
        }
      }
    ]
  }
}
```

## Notes

- The response geometry is in **EPSG:31287** (Austria Lambert). This recipe does not touch it:
  `region_name` comes from the municipality *name*, so no reprojection is involved anywhere on
  this path.
- `attribution` carries the municipality number and the CC BY 4.0 credit. Keep it — the licence
  requires the source to be named.
- The query returns at most one municipality, so there is nothing to deduplicate; the same warning
  is never reported twice.
- With more than six concurrent warnings the extra ones have no slot and are not rendered — the
  adapter walks `warning_1`…`warning_count` and skips any slot that holds nothing. The sensor's
  state and `warning_count` still report the true total.
