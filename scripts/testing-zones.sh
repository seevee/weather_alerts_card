#!/usr/bin/env bash
# testing-zones.sh — Find zones with the best cross-section of alert conditions
# Providers: NWS (US), BoM (Australia), MeteoAlarm (Europe), ECCC (Canada), DWD (Germany), MeteoSwiss (Switzerland)
# Optimizes for testing diversity: mixed severities, prep vs active, multiple
# alerts per zone, contiguous zone clusters with overlapping alerts.
#
# Usage: ./scripts/testing-zones.sh [provider ...]
#   provider: nws, bom, meteoalarm, eccc, wmo, dwd, meteoswiss (default: all)
#
# API requests per provider:
#   NWS:       1 (alerts/active) + 1-3 zone geometry lookups
#   BoM:       1 (warnings) + 0-1 location search
#   MeteoAlarm: up to 30 (per-country atom feeds, parallel) — legacy RSS is deprecated
#   ECCC:      2 (NAAD atom + GeoMet WFS Current-Alerts; one per HA integration)
#   WMO CAP:   1-3 (RSS per source) + 1 (CAP XML)
#   DWD:       1 (warnings.json)
#   MeteoSwiss: up to 5 (per-postcode detail, one per sampled postcode)
#
# These are public, free government APIs. To avoid abusing them:
# - Results are cached in .cache/most-alerted-zones/ for 1 hour
# - Request counts are kept minimal (see per-provider counts above)
# - A descriptive User-Agent identifies this as testing tooling
# Do not remove or shorten the cache TTL.
#
# NWS zone limits (relevant when configuring HA):
#   ~850 zones max per API request (URL length limit, undocumented)
#   500 alerts max per response (documented limit param)
#   16,384 bytes HA attribute limit — can overflow with many active alerts
#
# Dependencies: curl, jq

set -euo pipefail

UA="weather-alerts-card-testing/1.0"
CACHE_DIR=".cache/most-alerted-zones"
CACHE_TTL=3600  # seconds

mkdir -p "$CACHE_DIR"

# ─── Shared helpers ──────────────────────────────────────────────────────────

# Fetch with file-level caching. Returns cached content if fresh enough.
cached_fetch() {
  local url="$1" cache_file="$2"
  shift 2
  if [ -f "$cache_file" ]; then
    local age mtime
    mtime=$(stat -c %Y "$cache_file" 2>/dev/null || date -r "$cache_file" +%s 2>/dev/null || echo 0)
    age=$(( $(date +%s) - mtime ))
    if [ "$age" -lt "$CACHE_TTL" ]; then
      cat "$cache_file"
      return 0
    fi
  fi
  curl -sf --max-time 15 -H "User-Agent: $UA" "$@" "$url" | tee "$cache_file"
}

divider() {
  printf '\n%s\n' "──────────────────────────────────────────────"
}

# Compute centroid from coordinate strings.
# georss format (default): "lat lon lat lon ..."
# cap format:              "lat,lon lat,lon ..."
polygon_centroid() {
  local coords="$1" fmt="${2:-georss}"
  echo "$coords" | awk -v fmt="$fmt" '{
    if (fmt == "cap") {
      n = split($0, pairs, " ")
      for (i = 1; i <= n; i++) {
        split(pairs[i], c, ",")
        if (c[1] != "" && c[2] != "") { lat_sum += c[1]; lon_sum += c[2]; count++ }
      }
    } else {
      n = split($0, vals, " ")
      for (i = 1; i <= n - 1; i += 2) { lat_sum += vals[i]; lon_sum += vals[i+1]; count++ }
    }
    if (count > 0) printf "%.6f %.6f\n", lat_sum/count, lon_sum/count
    else print "null null"
  }'
}

# Print a frequency distribution from a newline-separated list of values.
# Args: $1=label, $2=width (printf left-align), $3=max_items (0=unlimited)
show_distribution() {
  local label="$1" width="${2:-12}" max="${3:-0}"
  echo "  $label:"
  local cmd="sort | uniq -c | sort -rn"
  [ "$max" -gt 0 ] && cmd="$cmd | head -$max"
  eval "$cmd" | while read -r cnt val; do
    printf "    %-${width}s %s\n" "$val" "$cnt"
  done
}

# ─── NWS ─────────────────────────────────────────────────────────────────────
# Fetch NWS zone details and print them. Args: $1=zone_code, $2=cache_suffix
nws_zone_details() {
  local zone_code="$1" cache_suffix="${2:-zone}"

  local zone_type="forecast"
  case "${zone_code:2:1}" in
    C) zone_type="county" ;;
    Z) zone_type="forecast" ;;
  esac

  echo "  Fetching zone geometry ($zone_type/$zone_code)..."
  local zone_info
  zone_info=$(cached_fetch "https://api.weather.gov/zones/$zone_type/$zone_code" "$CACHE_DIR/nws-${cache_suffix}.json" \
    -H "Accept: application/geo+json") || {
    echo "  Could not fetch zone geometry."
    echo "  zone:  $zone_code"
    return 1
  }

  local name state
  name=$(echo "$zone_info" | jq -r '.properties.name // "unknown"')
  state=$(echo "$zone_info" | jq -r '.properties.state // "unknown"')

  local lat lon
  read -r lat lon < <(echo "$zone_info" | jq -r '
    def flatten_coords:
      if type == "array" and (.[0] | type) == "number" then [.]
      elif type == "array" then map(flatten_coords) | add
      else empty end;
    .geometry.coordinates | flatten_coords |
    (map(.[1]) | add / length) as $lat |
    (map(.[0]) | add / length) as $lon |
    "\($lat) \($lon)"
  ' 2>/dev/null || echo "null null")

  echo ""
  echo "  zone:  $zone_code"
  echo "  name:  $name, $state"
  echo "  lat:   $lat"
  echo "  lon:   $lon"
}

# Find contiguous zone clusters from a newline-separated list of zone codes.
find_contiguous_clusters() {
  sort | awk '
  {
    codes[NR] = $0
    prefixes[NR] = substr($0, 1, 3)
    nums[NR] = int(substr($0, 4))
    n = NR
  }
  END {
    if (n == 0) exit
    cluster_start = 1
    for (i = 2; i <= n; i++) {
      if (prefixes[i] == prefixes[i-1] && nums[i] == nums[i-1] + 1) continue
      size = i - cluster_start
      if (size >= 2) {
        s = codes[cluster_start]
        for (j = cluster_start + 1; j < i; j++) s = s "," codes[j]
        print size "\t" s
      }
      cluster_start = i
    }
    size = n - cluster_start + 1
    if (size >= 2) {
      s = codes[cluster_start]
      for (j = cluster_start + 1; j <= n; j++) s = s "," codes[j]
      print size "\t" s
    }
  }' | sort -t$'\t' -k1 -nr
}

nws() {
  echo "NWS — National Weather Service (US)"
  echo "  Fetching active alerts..."

  local alerts
  alerts=$(cached_fetch "https://api.weather.gov/alerts/active" "$CACHE_DIR/nws-alerts.json" \
    -H "Accept: application/geo+json") || {
    echo "  FAIL: could not reach api.weather.gov"; return 1
  }

  local total
  total=$(echo "$alerts" | jq '.features | length')
  echo "  Active alerts: $total"

  if [ "$total" -eq 0 ]; then
    echo "  No active alerts."
    return 0
  fi

  # Per-zone diversity analysis
  local zone_analysis
  zone_analysis=$(echo "$alerts" | jq '
    now as $now |
    [.features[] | .properties as $p |
      (($p.onset // null) | if . then (try fromdateiso8601 catch $now) else $now end) as $onset |
      (($p.expires // null) | if . then (try fromdateiso8601 catch 0) else 0 end) as $expires |
      ($p.geocode.UGC // [])[] |
      {
        zone: .,
        severity: ($p.severity // "Unknown"),
        event: ($p.event // "Unknown"),
        is_prep: ($onset > $now),
        is_active: ($onset <= $now),
        has_end: ($expires > 0)
      }
    ] | group_by(.zone) | map(
      . as $arr |
      {
        zone: $arr[0].zone,
        count: ($arr | length),
        severities: ([$arr[].severity] | unique | sort),
        sev_count: ([$arr[].severity] | unique | length),
        events: ([$arr[].event] | unique | sort),
        has_prep: ($arr | any(.is_prep)),
        has_active: ($arr | any(.is_active)),
        has_ongoing: ($arr | any(.is_active and (.has_end | not))),
        score: (
          ([$arr[].severity] | unique | length) * 15
          + (if ($arr | any(.is_prep)) and ($arr | any(.is_active)) then 50 else 0 end)
          + (if ($arr | any(.is_active and (.has_end | not))) then 10 else 0 end)
          + (if ($arr | length) >= 4 then 30 elif ($arr | length) >= 3 then 20 elif ($arr | length) >= 2 then 10 else 0 end)
        )
      }
    ) | sort_by(-.score, -.count)
  ')

  # Best testing zone (single jq call for all fields)
  local best_zone best_score best_count best_sevs best_events best_prep best_active best_ongoing
  IFS=$'\t' read -r best_zone best_score best_count best_sevs best_events best_prep best_active best_ongoing \
    <<< "$(echo "$zone_analysis" | jq -r '.[0] | [.zone, .score, .count, (.severities|join(", ")), (.events|join(", ")), .has_prep, .has_active, .has_ongoing] | @tsv')"

  echo ""
  echo "  ── Best testing zone (score: $best_score) ──"
  nws_zone_details "$best_zone" "best" || true
  echo "  alerts:     $best_count"
  echo "  severities: $best_sevs"
  echo "  events:     $best_events"
  echo "  has prep:   $best_prep"
  echo "  has active: $best_active"
  echo "  ongoing:    $best_ongoing"
  echo ""
  echo "  HA config: zone_id = $best_zone"

  # Top zones by diversity score
  echo ""
  echo "  ── Top zones by diversity score ──"
  echo "$zone_analysis" | jq -r '
    .[0:8] | .[] |
    "    \(.zone)  score=\(.score)  alerts=\(.count)  sev=\(.severities | join(","))  prep=\(.has_prep)  active=\(.has_active)  ongoing=\(.has_ongoing)"
  '

  # Contiguous zone clusters
  local all_zones clusters
  all_zones=$(echo "$zone_analysis" | jq -r '.[].zone')
  clusters=$(echo "$all_zones" | find_contiguous_clusters)

  if [ -n "$clusters" ]; then
    echo ""
    echo "  ── Contiguous zone clusters ──"

    local shown=0
    while IFS=$'\t' read -r cluster_size cluster_zones; do
      local cl_alerts cl_sevs cl_prep cl_active cl_ongoing
      IFS=$'\t' read -r cl_alerts cl_sevs cl_prep cl_active cl_ongoing \
        <<< "$(echo "$zone_analysis" | jq -r --arg zones "$cluster_zones" '
          ($zones | split(",")) as $zlist |
          [.[] | select(.zone as $z | $zlist | any(. == $z))] |
          [(map(.count) | add), ([.[].severities[]] | unique | sort | join(", ")), any(.has_prep), any(.has_active), any(.has_ongoing)] | @tsv')"

      echo "    ${cluster_zones} (${cluster_size} adjacent zones)"
      echo "      alerts: $cl_alerts  sev: $cl_sevs"
      echo "      prep=$cl_prep  active=$cl_active  ongoing=$cl_ongoing"

      shown=$((shown + 1))
      [ "$shown" -ge 3 ] && break
    done <<< "$clusters"

    local best_cluster
    best_cluster=$(echo "$clusters" | head -1 | cut -f2)
    echo ""
    echo "  HA multi-zone config: zone_id = $(echo "$best_cluster" | tr ',' ', ')"
  fi

  # Condition coverage
  echo ""
  echo "  ── Condition coverage ──"
  echo "$zone_analysis" | jq -r '
    {
      total_zones: length,
      multi_alert: ([.[] | select(.count >= 2)] | length),
      mixed_sev: ([.[] | select(.sev_count >= 2)] | length),
      prep_and_active: ([.[] | select(.has_prep and .has_active)] | length),
      ongoing: ([.[] | select(.has_ongoing)] | length),
      prep_only: ([.[] | select(.has_prep and (.has_active | not))] | length),
      active_only: ([.[] | select(.has_active and (.has_prep | not))] | length)
    } |
    "  Zones with alerts:      \(.total_zones)",
    "  Multi-alert zones:      \(.multi_alert)",
    "  Mixed-severity zones:   \(.mixed_sev)",
    "  Prep + active zones:    \(.prep_and_active)",
    "  Prep-only zones:        \(.prep_only)",
    "  Active-only zones:      \(.active_only)",
    "  Ongoing (no end) zones: \(.ongoing)"
  '

  echo ""
  echo "  Severity distribution:"
  echo "$alerts" | jq -r '[.features[].properties.severity // "Unknown"] | .[]' | show_distribution "Severity" 12
}

# ─── BoM ──────────────────────────────────────────────────────────────────────
# BoM warnings carry no geometry. The HA integration calls
# /v1/locations/{geohash}/warnings, so the recommended location must fall
# within an active warning area. We:
#   1. Extract candidate place names from warning titles (multi-pattern).
#   2. Resolve each via the BoM locations API.
#   3. Verify via /v1/locations/{geohash}/warnings (same endpoint HA uses).
#   4. Return the first location that is confirmed to have active warnings.

decode_geohash() {
  echo "$1" | awk '
  BEGIN {
    split("0123456789bcdefghjkmnpqrstuvwxyz", chars, "")
    for (i = 1; i <= 32; i++) base32[chars[i]] = i - 1
  }
  {
    hash = $0
    lat_min = -90; lat_max = 90; lon_min = -180; lon_max = 180; is_lon = 1
    for (i = 1; i <= length(hash); i++) {
      val = base32[substr(hash, i, 1)]
      for (b = 4; b >= 0; b--) {
        bit = int(val / (2^b)) % 2
        if (is_lon) { mid = (lon_min + lon_max) / 2; if (bit) lon_min = mid; else lon_max = mid }
        else { mid = (lat_min + lat_max) / 2; if (bit) lat_min = mid; else lat_max = mid }
        is_lon = !is_lon
      }
    }
    printf "%.6f %.6f\n", (lat_min + lat_max) / 2, (lon_min + lon_max) / 2
  }'
}

extract_bom_places() {
  local title="$1"
  # Specific location after "at" (e.g. "Flood Warning for Murray River at Albury")
  echo "$title" | grep -oP '(?<= at )[A-Z]\w+' || true
  # Strip the warning-type prefix to get just the area description
  local area
  area=$(echo "$title" | sed -E 's/^.*(Warning|Watch|Advice|Advisory) for (the )?//')
  # Directional+city patterns: "Greater Sydney", "Central Coast", etc. → "Sydney", "Coast"
  echo "$area" | grep -oP '(?:Greater|Central|Northern|Southern|Western|Eastern|Inner|Outer|Upper|Lower|Far North|South East|North East) +([A-Z][a-z]+(?:(?: [A-Z][a-z]+)*)?)' \
    | grep -oP '[A-Z][a-z]+(?:(?: [A-Z][a-z]+)*)$' || true
  # "X Region / District / Coast / Valley / Basin" → "X"
  echo "$area" | grep -oP '\b([A-Z][a-z]+(?:(?: [A-Z][a-z]+)+)?)\b(?=\s+(?:Region|District|Coast|Valley|Basin|Peninsula|Ranges|Plateau))' || true
  # All capitalised words (skip common weather/geographic noise) — broadest fallback
  echo "$area" | grep -oP '\b[A-Z][a-z]{2,}\b' \
    | grep -iv 'Warning\|Watch\|Advice\|Advisory\|Region\|District\|Coast\|Valley\|Basin\|Peninsula\|Ranges\|Plateau\|Catchment\|River\|Creek\|Bay\|Lake\|Range\|Weather\|Flood\|Storm\|Fire\|Wind\|Rain\|Hail\|Thunder\|Cyclone\|Tropical\|Severe\|Major\|Minor\|Moderate\|Extreme\|Initial\|Final\|Update\|Australia\|Territory\|State' \
    || true
}

bom_search_place() {
  local place="$1" target_state="$2"
  local result
  result=$(curl -sf --max-time 10 -H "User-Agent: $UA" \
    "https://api.weather.bom.gov.au/v1/locations?search=$(echo "$place" | sed 's/ /%20/g')" 2>/dev/null) || return 1
  echo "$result" | jq -r --arg st "$target_state" '
    (.data[] | select(.state == $st) | "\(.geohash)\t\(.name)") // empty
  ' | head -1
}

# Search for a place and return the first land-based result whose geohash is
# confirmed to have active warnings via /v1/locations/{geohash}/warnings.
#
# "Land-based" = BoM location has a postcode. Marine/offshore stations have no
# postcode, and their geohash centroids typically fall in the ocean.
#
# Prints: "geohash\tname\tlat\tlon\tcount" on success, nothing on failure.
# lat/lon come from the API directly (more accurate than geohash centroid).
bom_search_verified() {
  local place="$1" target_state="$2"
  local search_result
  search_result=$(curl -sf --max-time 10 -H "User-Agent: $UA" \
    "https://api.weather.bom.gov.au/v1/locations?search=$(echo "$place" | sed 's/ /%20/g')" 2>/dev/null) || return 1

  # Only land-based locations (postcode present); iterate in API order.
  while IFS=$'\t' read -r gh name lat lon; do
    [ -z "$gh" ] && continue
    local check count
    check=$(curl -sf --max-time 10 -H "User-Agent: $UA" \
      "https://api.weather.bom.gov.au/v1/locations/${gh}/warnings" 2>/dev/null) || continue
    count=$(echo "$check" | jq '[.data[] | select(.phase != "cancelled")] | length' 2>/dev/null || echo 0)
    if [ "$count" -gt 0 ]; then
      printf '%s\t%s\t%s\t%s\t%s\n' "$gh" "$name" "$lat" "$lon" "$count"
      return 0
    fi
  done < <(echo "$search_result" | jq -r --arg st "$target_state" '
    [.data[] | select(.state == $st and (.postcode? // "") != "")] |
    .[] | "\(.geohash)\t\(.name)\t\(.latitude? // "")\t\(.longitude? // "")"
  ' 2>/dev/null)
}

bom() {
  echo "BoM — Bureau of Meteorology (Australia)"
  echo "  Fetching active warnings..."

  local warnings
  warnings=$(cached_fetch "https://api.weather.bom.gov.au/v1/warnings" "$CACHE_DIR/bom-warnings.json") || {
    echo "  FAIL: could not reach api.weather.bom.gov.au"; return 1
  }

  local total
  total=$(echo "$warnings" | jq '[.data[] | select(.phase != "cancelled")] | length')

  if [ "$total" -eq 0 ]; then
    echo "  Active warnings: 0"
    echo "  No active warnings."
    return 0
  fi

  # Marine warnings (type contains "marine") appear in the coverage totals but are
  # not useful for HA land-integration testing: the integration's point-in-polygon
  # query never matches offshore/marine station geohashes for these alerts.
  local land_warnings land_total marine_total
  land_warnings=$(echo "$warnings" | jq '[.data[] | select(.phase != "cancelled" and (.type | test("marine"; "i") | not))]')
  land_total=$(echo "$land_warnings" | jq 'length')
  marine_total=$((total - land_total))

  echo "  Active warnings: $total  ($land_total land-based, $marine_total marine/coastal)"

  if [ "$land_total" -eq 0 ]; then
    echo ""
    echo "  All active warnings are marine/coastal — not suitable for HA land-integration"
    echo "  testing. Run again when Australia has active flood, storm, or fire warnings."
    echo ""
    echo "  ── Condition coverage (all $total warnings) ──"
    echo "$warnings" | jq -r '
      [.data[] | select(.phase != "cancelled")] |
      "  By type:  \(group_by(.type) | map("\(.[0].type)=\(length)") | join("  "))"
    '
    return 0
  fi

  # Per-state diversity analysis — land warnings only.
  local state_analysis
  state_analysis=$(echo "$land_warnings" | jq '
    group_by(.state) | map(
      . as $arr |
      {
        state: $arr[0].state,
        count: ($arr | length),
        phases: ([$arr[].phase] | unique | sort),
        groups: ([$arr[].warning_group_type] | unique | sort),
        types: ([$arr[].type] | unique | sort),
        score: (
          ([$arr[].warning_group_type] | unique | length) * 20
          + ([$arr[].phase] | unique | length) * 15
          + ([$arr[].type] | unique | length) * 10
          + (if ($arr | length) >= 4 then 30 elif ($arr | length) >= 3 then 20 elif ($arr | length) >= 2 then 10 else 0 end)
        )
      }
    ) | sort_by(-.score, -.count)
  ')

  # Best testing state (single jq call)
  local best_state best_score best_count best_phases best_groups best_types
  IFS=$'\t' read -r best_state best_score best_count best_phases best_groups best_types \
    <<< "$(echo "$state_analysis" | jq -r '.[0] | [.state, .score, .count, (.phases|join(", ")), (.groups|join(", ")), (.types|join(", "))] | @tsv')"

  echo ""
  echo "  ── Best testing state (score: $best_score, land warnings only) ──"
  echo ""
  echo "  state:          $best_state"
  echo "  warnings:       $best_count"
  echo "  phases:         $best_phases"
  echo "  groups:         $best_groups"
  echo "  warning types:  $best_types"

  echo ""
  echo "  ── Top states by diversity score ──"
  echo "$state_analysis" | jq -r '
    .[0:5] | .[] |
    "    \(.state)  score=\(.score)  warnings=\(.count)  phases=\(.phases | join(","))  groups=\(.groups | join(","))"
  '

  # Sample warnings from best state
  echo ""
  echo "  ── Sample warnings from $best_state ──"
  echo "$land_warnings" | jq -r --arg st "$best_state" '
    [.[] | select(.state == $st)] |
    .[0:6] | .[] |
    "    [\(.phase)] \(.title) (\(.type), \(.warning_group_type))"
  '

  # Find a BoM location that is confirmed to have active warnings.
  # Tries place names from up to 5 warning titles; verifies each candidate via
  # /v1/locations/{geohash}/warnings (the same call the HA integration makes).
  local lat="?" lon="?" resolved_name="" bom_geohash="" bom_warning_count=0
  echo ""
  echo "  Searching for a verified location with active warnings..."

  local found_verified=""
  while IFS= read -r wtitle; do
    [ -z "$wtitle" ] && continue
    local places
    places=$(extract_bom_places "$wtitle")
    while IFS= read -r place; do
      [ -z "$place" ] && continue
      local match
      match=$(bom_search_verified "$place" "$best_state") || continue
      if [ -n "$match" ]; then
        found_verified="$match"
        break 2
      fi
    done <<< "$places"
  done < <(echo "$land_warnings" | jq -r --arg st "$best_state" '
    [.[] | select(.state == $st)] | .[0:5] | .[].title
  ')

  if [ -n "$found_verified" ]; then
    bom_geohash=$(echo "$found_verified" | cut -f1)
    resolved_name=$(echo "$found_verified" | cut -f2)
    local api_lat api_lon
    api_lat=$(echo "$found_verified" | cut -f3)
    api_lon=$(echo "$found_verified" | cut -f4)
    bom_warning_count=$(echo "$found_verified" | cut -f5)
    # Prefer coordinates from the API over the geohash centroid (more accurate for coastal towns)
    if [ -n "$api_lat" ] && [ "$api_lat" != "null" ] && [ "$api_lat" != "" ]; then
      lat="$api_lat"; lon="$api_lon"
    else
      read -r lat lon < <(decode_geohash "$bom_geohash")
    fi
    echo "  Verified: $resolved_name (geohash: $bom_geohash, warnings confirmed: $bom_warning_count)"
  else
    # Nothing verified — try the state capital as a last resort with explicit caveat.
    echo "  Could not find a verified warning location — using state capital"
    echo "  (state capital is unlikely to show warnings; use a suburb in the affected area)"
    local cap_place
    case "$best_state" in
      NSW) cap_place="Sydney" ;;
      VIC) cap_place="Melbourne" ;;
      QLD) cap_place="Brisbane" ;;
      SA)  cap_place="Adelaide" ;;
      WA)  cap_place="Perth" ;;
      TAS) cap_place="Hobart" ;;
      NT)  cap_place="Darwin" ;;
      ACT) cap_place="Canberra" ;;
      *)   cap_place="" ;;
    esac
    if [ -n "$cap_place" ]; then
      local cap_match
      cap_match=$(bom_search_place "$cap_place" "$best_state") || true
      if [ -n "$cap_match" ]; then
        bom_geohash=$(echo "$cap_match" | cut -f1)
        resolved_name=$(echo "$cap_match" | cut -f2)
        read -r lat lon < <(decode_geohash "$bom_geohash")
      fi
    fi
  fi

  echo ""
  echo "  place:   $resolved_name"
  echo "  geohash: $bom_geohash"
  echo "  lat:     $lat"
  echo "  lon:     $lon"
  if [ "$bom_warning_count" -gt 0 ]; then
    echo "  warnings at this location: $bom_warning_count (confirmed)"
  fi
  echo ""
  echo "  HA integration: bureau_of_meteorology"
  echo "  Search for \"$resolved_name\" when adding the integration"

  # Condition coverage
  echo ""
  echo "  ── Condition coverage ──"
  echo "$land_warnings" | jq -r '
    {
      total: length,
      phases: (group_by(.phase) | map({phase: .[0].phase, count: length}) | sort_by(-.count)),
      groups: (group_by(.warning_group_type) | map({group: .[0].warning_group_type, count: length}) | sort_by(-.count))
    } |
    "  Land warnings: \(.total)",
    "  By phase:  \(.phases | map("\(.phase)=\(.count)") | join("  "))",
    "  By group:  \(.groups | map("\(.group)=\(.count)") | join("  "))"
  '
  if [ "$marine_total" -gt 0 ]; then
    echo "  Marine/coastal warnings: $marine_total (excluded from analysis)"
  fi
}

# ─── MeteoAlarm ───────────────────────────────────────────────────────────────
# Ref: https://www.home-assistant.io/integrations/meteoalarm/
# The Europe-wide RSS feed was deprecated (returns empty channel) and the
# Europe-wide Atom feed now returns 404. We query per-country Atom feeds
# in parallel, parse cap:severity from entries, and rank by diversity.

# Known MeteoAlarm country slugs (matching feed URL convention).
# This list covers all countries published by MeteoAlarm as of 2026-04.
METEOALARM_COUNTRIES=(
  austria belgium bosnia-herzegovina bulgaria croatia cyprus
  czechia denmark estonia finland france germany greece
  hungary iceland ireland israel italy latvia lithuania
  luxembourg malta moldova montenegro netherlands north-macedonia
  norway poland portugal romania serbia slovakia slovenia
  spain sweden switzerland turkey united-kingdom ukraine
)

meteoalarm() {
  echo "MeteoAlarm — EUMETNET (Europe)"
  echo "  Fetching per-country Atom feeds (${#METEOALARM_COUNTRIES[@]} countries)..."

  local tmpdir
  tmpdir=$(mktemp -d)

  # Fetch all country feeds in parallel (backgrounded curl jobs)
  for slug in "${METEOALARM_COUNTRIES[@]}"; do
    (
      cached_fetch \
        "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${slug}" \
        "$CACHE_DIR/meteoalarm-atom-${slug}.xml" \
        > "$tmpdir/${slug}.xml" 2>/dev/null
    ) &
  done
  wait

  # Parse each country feed: count severities, compute diversity score
  local counts=""
  for slug in "${METEOALARM_COUNTRIES[@]}"; do
    local file="$tmpdir/${slug}.xml"
    [ -s "$file" ] || continue

    local result
    result=$(awk '
      /<cap:severity>/ {
        gsub(/.*<cap:severity>/, ""); gsub(/<\/cap:severity>.*/, "");
        sev = $0
        if (sev == "Moderate") mod++
        else if (sev == "Severe") sev3++
        else if (sev == "Extreme") ext++
      }
      END {
        total = mod + sev3 + ext; levels = 0
        if (mod > 0) levels++; if (sev3 > 0) levels++; if (ext > 0) levels++
        if (total > 0)
          printf "%d\t%d\t%d\t%d\t%d", levels * 200 + total, total, mod, sev3, ext
      }
    ' "$file")

    if [ -n "$result" ]; then
      counts="${counts}${result}\t${slug}\n"
    fi
  done

  rm -rf "$tmpdir"

  if [ -z "$counts" ]; then
    echo "  No active alerts across Europe."
    return 0
  fi

  # Sort by score (first column) descending
  local sorted
  sorted=$(printf '%b' "$counts" | sort -t$'\t' -k1 -nr)

  local total_countries
  total_countries=$(echo "$sorted" | wc -l | tr -d ' ')
  echo "  Countries with alerts: $total_countries"

  echo ""
  echo "  ── Top countries by diversity ──"
  echo "$sorted" | head -8 | while IFS=$'\t' read -r _score total mod sev3 ext slug; do
    local label
    label=$(echo "$slug" | sed 's/-/ /g; s/\b\(.\)/\u\1/g')
    printf "    %-20s total=%-3s  moderate=%-3s severe=%-3s extreme=%s\n" "$label" "$total" "$mod" "$sev3" "$ext"
  done

  local top_slug
  top_slug=$(echo "$sorted" | head -1 | awk -F'\t' '{print $NF}')
  local top_label
  top_label=$(echo "$top_slug" | sed 's/-/ /g; s/\b\(.\)/\u\1/g')
  local top_score
  top_score=$(echo "$sorted" | head -1 | awk -F'\t' '{print $1}')
  local top_total
  top_total=$(echo "$sorted" | head -1 | awk -F'\t' '{print $2}')

  echo ""
  echo "  Best testing country: $top_label (score: $top_score, alerts: $top_total)"

  # Province-level analysis from the top country's cached feed
  local atom_file="$CACHE_DIR/meteoalarm-atom-${top_slug}.xml"

  # Split areaDesc on commas — some countries (e.g. Ukraine) aggregate all
  # affected regions into a single areaDesc. HA's meteoalarm integration
  # matches province as a substring of areaDesc, so individual region names
  # surface far more diverse alerts than the full aggregated string.
  local areas
  areas=$(grep -oP '(?<=<cap:areaDesc>)[^<]+' "$atom_file" 2>/dev/null \
    | sed 's/&amp;amp;/\&/g; s/&amp;/\&/g' \
    | tr ',' '\n' \
    | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' \
    | grep -v '^$')

  if [ -n "$areas" ]; then
    echo ""
    echo "  ── Top provinces ──"
    echo "$areas" | sort | uniq -c | sort -rn | head -5 | \
      while read -r cnt name; do
        printf "    %-50s %s alerts\n" "$name" "$cnt"
      done
  fi

  local top_province
  top_province=$(echo "$areas" | sort | uniq -c | sort -rn | head -1 | sed 's/^ *[0-9]* *//')

  echo ""
  echo "  country:  $top_slug"
  echo "  province: $top_province"
  echo ""
  echo "  # configuration.yaml"
  echo "  binary_sensor:"
  echo "    - platform: meteoalarm"
  echo "      country: \"$top_slug\""
  echo "      province: \"$top_province\""
}

# ─── ECCC ─────────────────────────────────────────────────────────────────────
# Environment and Climate Change Canada is served by two HA integrations that
# read two different upstream feeds, and the feeds don't agree:
#
#   environment_canada (HACS) — GeoMet WFS Current-Alerts layer, point-in-
#     polygon matched against the supplied lat/lon. Per-R.M. features with
#     tight polygons; subject to WFS ingest lag and coverage gaps relative
#     to NAAD. A NAAD-centroid is not guaranteed to land inside any WFS
#     polygon, so this integration needs coords derived from the WFS layer
#     itself.
#   cap_alerts (provider=eccc) — NAAD CAP feed from Pelmorex (multi-region
#     CAP polygons preserved). Same point-in-polygon model, against the
#     authoritative firehose.
#
# This section emits separate recommendations for each integration.
#
# NAAD: https://rss.naad-adna.pelmorex.com/
# WFS:  https://geo.weather.gc.ca/geomet?SERVICE=WFS&TYPENAMES=Current-Alerts
#
# NAAD retains entries well past their expiry (often 24h+). The Expires
# timestamp lives only in the <summary> HTML, not in a category term, so
# we parse it out and drop past-expiry entries — otherwise scoring is
# dominated by recently-ended alerts that no HA integration will surface.

eccc() {
  echo "ECCC — Environment and Climate Change Canada"
  echo "  Two HA integrations consume different feeds; recommending each separately."
  eccc_naad
  eccc_geomet
}

# NAAD CAP feed — the data source for cap_alerts (provider=eccc).
eccc_naad() {
  echo ""
  echo "  ── NAAD CAP feed (for cap_alerts) ──"
  echo "    Fetching NAAD alert feed..."

  local feed
  feed=$(cached_fetch "https://rss.naad-adna.pelmorex.com/" "$CACHE_DIR/eccc-naad.xml") || {
    echo "    FAIL: could not reach rss.naad-adna.pelmorex.com"; return 1
  }

  # ISO timestamp without timezone suffix; entry Expires fields are UTC
  # ("-00:00") and string-compare correctly once their suffix is stripped.
  local now_iso
  now_iso=$(date -u '+%Y-%m-%dT%H:%M:%S')

  # Parse entries into TSV: area \t severity \t event \t polygon \t urgency
  local parsed
  parsed=$(echo "$feed" | sed 's/<entry>/\n<entry>/g' | awk -v now_iso="$now_iso" '
    function strip_tz(t) { sub(/Z$/, "", t); sub(/[+-][0-9][0-9]:?[0-9][0-9]$/, "", t); return t }
    /<entry>/ { lang = ""; status = ""; msg_type = ""; sev = ""; evt = ""; poly = ""; area = ""; urg = ""; expires = "" }
    /term="language=/ { match($0, /term="language=([^"]*)"/, m); lang = m[1] }
    /term="status=/   { match($0, /term="status=([^"]*)"/, m); status = m[1] }
    /term="msgType=/  { match($0, /term="msgType=([^"]*)"/, m); msg_type = m[1] }
    /term="severity=/ { match($0, /term="severity=([^"]*)"/, m); sev = m[1] }
    /term="urgency=/  { match($0, /term="urgency=([^"]*)"/, m); urg = m[1] }
    /term="event=/    { match($0, /term="event=([^"]*)"/, m); evt = m[1] }
    /<georss:polygon>/ && poly == "" { match($0, /<georss:polygon>([^<]+)</, m); poly = m[1] }
    /Expires:/ {
      if (match($0, /Expires:[[:space:]]*([0-9T:.+\-]+)/, m)) expires = strip_tz(m[1])
    }
    /Area:/ {
      match($0, /Area: ([^<]*)/, m); area = m[1]
      gsub(/&amp;/, "\\&", area); gsub(/&lt;/, "<", area); gsub(/&gt;/, ">", area)
    }
    /<\/entry>/ {
      if (lang == "en-CA" && status == "Actual" && msg_type != "Cancel" && area != "" \
          && (expires == "" || expires > now_iso))
        print area "\t" sev "\t" evt "\t" poly "\t" urg
    }
  ')

  if [ -z "$parsed" ]; then
    echo "    No active alerts across Canada."
    return 0
  fi

  local total
  total=$(echo "$parsed" | wc -l | tr -d ' ')
  echo "    Active alert entries: $total"

  # Per-area diversity scoring
  local area_analysis
  area_analysis=$(echo "$parsed" | awk -F'\t' '
  {
    area = $1; sev = $2; evt = $3; poly = $4; urg = $5
    count[area]++
    sevs[area][sev] = 1; evts[area][evt] = 1; urgs[area][urg] = 1
    if (!(area in first_poly) && poly != "") first_poly[area] = poly
    if (!(area in sev_list)) sev_list[area] = sev
    else if (index(sev_list[area], sev) == 0) sev_list[area] = sev_list[area] "," sev
    if (!(area in evt_list)) evt_list[area] = evt
    else if (index(evt_list[area], evt) == 0) evt_list[area] = evt_list[area] "," evt
  }
  END {
    for (area in count) {
      sc = 0; for (s in sevs[area]) sc++
      ec = 0; for (e in evts[area]) ec++
      uc = 0; for (u in urgs[area]) uc++
      score = sc * 20 + ec * 10 + uc * 10
      if (count[area] >= 3) score += 30; else if (count[area] >= 2) score += 15
      printf "%d\t%s\t%d\t%s\t%s\t%s\n", score, area, count[area], sev_list[area], evt_list[area], first_poly[area]
    }
  }' | sort -t$'\t' -k1 -nr)

  local best_score best_area best_count best_sevs best_evts best_poly
  IFS=$'\t' read -r best_score best_area best_count best_sevs best_evts best_poly <<< "$(echo "$area_analysis" | head -1)"

  local lat="?" lon="?"
  if [ -n "$best_poly" ]; then
    read -r lat lon < <(polygon_centroid "$best_poly" georss)
  fi

  echo ""
  echo "    ── Best testing area (score: $best_score) ──"
  echo ""
  echo "    area:       $best_area"
  echo "    lat:        $lat"
  echo "    lon:        $lon"
  echo "    alerts:     $best_count"
  echo "    severities: $best_sevs"
  echo "    events:     $best_evts"

  echo ""
  echo "    ── Top areas by diversity score ──"
  echo "$area_analysis" | head -8 | while IFS=$'\t' read -r score area cnt sevs evts _poly; do
    printf "      score=%-3s alerts=%-2s %-45s sev=%s\n" "$score" "$cnt" "$area" "$sevs"
  done

  # Condition coverage
  echo ""
  echo "    ── Condition coverage ──"
  echo "    Total areas:  $(echo "$area_analysis" | wc -l | tr -d ' ')"
  echo "$parsed" | cut -f2 | sort | uniq -c | sort -rn | while read -r cnt val; do
    printf "      %-12s %s\n" "$val" "$cnt"
  done

  echo ""
  echo "    HA integrations using this lat/lon:"
  echo "      cap_alerts:    provider=eccc, gps_loc=\"$lat,$lon\""
  echo "      pirateweather: latitude=$lat, longitude=$lon"
  echo "                     (note: WMO filtering drops most Canadian alerts)"
}

# GeoMet WFS Current-Alerts layer — the data source for env_canada (HACS).
# Each feature is one (alert × R.M.) pairing; we group by feature_name_en
# inside a province, score on diversity, then take the polygon centroid of
# the winning feature. The env_canada library does point-in-polygon against
# the supplied coords, so the centroid lands inside its own polygon.
eccc_geomet() {
  echo ""
  echo "  ── GeoMet WFS (for environment_canada HACS) ──"
  echo "    Fetching Current-Alerts layer..."

  local wfs_url="https://geo.weather.gc.ca/geomet?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=Current-Alerts&outputFormat=application/json&BBOX=-90,-180,90,180,EPSG:4326&count=2000"
  local wfs
  wfs=$(cached_fetch "$wfs_url" "$CACHE_DIR/eccc-geomet.json") || {
    echo "    FAIL: could not reach geo.weather.gc.ca"; return 1
  }

  local total
  total=$(echo "$wfs" | jq '.features | length' 2>/dev/null || echo 0)
  echo "    Active feature rows (alert × area): $total"
  if [ "$total" = "0" ]; then
    echo "    No active alerts in WFS."
    return 0
  fi

  # Group (province, feature_name_en), score by diversity, return TSV:
  #   score \t feature \t province \t count \t lat \t lon \t colours \t names
  local analysis
  analysis=$(echo "$wfs" | jq -r '
    def centroid_of:
      (if .type == "Polygon" then .coordinates[0]
       elif .type == "MultiPolygon" then .coordinates[0][0]
       else null end) as $ring
      | if $ring == null or ($ring | length) == 0 then "0 0"
        else
          (($ring | map(.[1]) | add) / ($ring | length)) as $lat
          | (($ring | map(.[0]) | add) / ($ring | length)) as $lon
          | "\($lat) \($lon)"
        end;

    [.features[] | {
      province: (.properties.province // "??"),
      feature:  (.properties.feature_name_en // "unknown"),
      type:     (.properties.alert_type // ""),
      name:     (.properties.alert_name_en // ""),
      colour:   (.properties.risk_colour_en // ""),
      impact:   (.properties.impact_en // ""),
      status:   (.properties.status_en // ""),
      coord:    (.geometry | centroid_of)
    }]
    | group_by(.province + "|" + .feature)
    | map({
        province: .[0].province,
        feature:  .[0].feature,
        coord:    .[0].coord,
        count:    length,
        types:    ([.[].type]   | unique - [""]),
        names:    ([.[].name]   | unique - [""]),
        colours:  ([.[].colour] | unique - [""]),
        impacts:  ([.[].impact] | unique - [""]),
        statuses: ([.[].status] | unique - [""]),
        score: (
          (([.[].type]   | unique - [""] | length) * 15)
        + (([.[].name]   | unique - [""] | length) * 10)
        + (([.[].colour] | unique - [""] | length) * 15)
        + (([.[].impact] | unique - [""] | length) * 10)
        + (([.[].status] | unique - [""] | length) * 5)
        + (if length >= 4 then 30 elif length >= 3 then 20 elif length >= 2 then 10 else 0 end)
        )
      })
    | sort_by(-.score, -.count)
    | .[]
    | "\(.score)\t\(.feature)\t\(.province)\t\(.count)\t\(.coord)\t\(.colours | join(","))\t\(.names | join(","))"
  ')

  local best_score best_feature best_prov best_count best_coord best_colours best_names
  IFS=$'\t' read -r best_score best_feature best_prov best_count best_coord best_colours best_names \
    <<< "$(echo "$analysis" | head -1)"
  local best_lat best_lon
  read -r best_lat best_lon <<< "$best_coord"

  echo ""
  echo "    ── Best testing feature (score: $best_score) ──"
  echo ""
  echo "    feature:    $best_feature ($best_prov)"
  printf "    lat:        %.6f\n" "$best_lat"
  printf "    lon:        %.6f\n" "$best_lon"
  echo "    alerts:     $best_count"
  echo "    colours:    $best_colours"
  echo "    names:      $best_names"

  echo ""
  echo "    ── Top features by diversity score ──"
  echo "$analysis" | head -8 | while IFS=$'\t' read -r score feature prov cnt _coord colours _names; do
    printf "      score=%-3s alerts=%-2s [%s] %-45s colours=%s\n" "$score" "$cnt" "$prov" "$feature" "$colours"
  done

  # Condition coverage across all WFS features
  echo ""
  echo "    ── Condition coverage ──"
  echo "$wfs" | jq -r '
    [.features[].properties] |
    "    Total features:  \(length)",
    "    Distinct alerts: \([.[].alert_name_en] | unique | length)",
    "    Distinct areas:  \([.[].feature_name_en] | unique | length)"
  '
  echo "$wfs" | jq -r '[.features[].properties.risk_colour_en // "?"] | .[]' | sort | uniq -c | sort -rn | while read -r cnt val; do
    printf "      colour:%-8s %s\n" "$val" "$cnt"
  done

  echo ""
  echo "    HA integration:"
  printf "      environment_canada: coordinates=(%.6f, %.6f)\n" "$best_lat" "$best_lon"
}

# ─── WMO CAP ─────────────────────────────────────────────────────────────────
# Queries the WMO Severe Weather Information Centre CAP feeds directly.
# These are the same feeds PirateWeather ingests for non-US alerts.
# Ref: https://severeweather.wmo.int/v2/cap-alerts/

wmo_parse_rss() {
  echo "$1" | sed 's/<item>/\n<item>/g' | awk '
    /<item>/ { title=""; sev=""; evt=""; area=""; link="" }
    /<title>/ && !/<title>Latest/ { gsub(/.*<title>/, ""); gsub(/<\/title>.*/, ""); title = $0 }
    /<cap:severity>/ { gsub(/.*<cap:severity>/, ""); gsub(/<\/cap:severity>.*/, ""); sev = $0 }
    /<cap:event>/ { gsub(/.*<cap:event>/, ""); gsub(/<\/cap:event>.*/, ""); evt = $0 }
    /<cap:areaDesc>/ { gsub(/.*<cap:areaDesc>/, ""); gsub(/<\/cap:areaDesc>.*/, ""); area = $0 }
    /<link>https:\/\/severeweather/ { gsub(/.*<link>/, ""); gsub(/<\/link>.*/, ""); link = $0 }
    /<\/item>/ { if (title != "" && sev != "" && sev != "Unknown") print title "\t" sev "\t" evt "\t" area "\t" link }
  '
}

wmo_cap() {
  echo "WMO CAP — Severe Weather Information Centre (PirateWeather source)"

  local -a source_ids=("ca-msc-xx" "mx-smn-es" "br-inmet-pt")
  local -a source_names=("Canada (MSC)" "Mexico (SMN)" "Brazil (INMET)")

  local feed parsed source_id source_name
  for i in "${!source_ids[@]}"; do
    source_id="${source_ids[$i]}"
    source_name="${source_names[$i]}"
    echo "  Trying $source_name ($source_id)..."

    feed=$(cached_fetch "https://severeweather.wmo.int/v2/cap-alerts/$source_id/rss.xml" \
      "$CACHE_DIR/wmo-$source_id.xml") || { echo "    Could not fetch feed."; continue; }

    parsed=$(wmo_parse_rss "$feed")
    if [ -n "$parsed" ]; then
      echo "  Found alerts in $source_name."
      break
    else
      echo "    No alerts."
      parsed=""
    fi
  done

  if [ -z "$parsed" ]; then
    echo "  No active alerts found in any WMO source."
    return 0
  fi

  local total
  total=$(echo "$parsed" | wc -l | tr -d ' ')
  echo "  Active alerts: $total"

  echo ""
  echo "$parsed" | cut -f2 | show_distribution "Severity" 12

  # Per-area diversity scoring
  local area_analysis
  area_analysis=$(echo "$parsed" | awk -F'\t' '
  {
    area = $4; sev = $2; evt = $3; link = $5
    count[area]++
    sevs[area][sev] = 1
    if (!(area in sev_list)) sev_list[area] = sev
    else if (index(sev_list[area], sev) == 0) sev_list[area] = sev_list[area] "," sev
    if (!(area in first_link)) first_link[area] = link
    if (!(area in first_evt)) first_evt[area] = evt
  }
  END {
    for (area in count) {
      sc = 0; for (s in sevs[area]) sc++
      score = sc * 20
      if (count[area] >= 3) score += 30; else if (count[area] >= 2) score += 15
      printf "%d\t%s\t%d\t%s\t%s\t%s\n", score, area, count[area], sev_list[area], first_evt[area], first_link[area]
    }
  }' | sort -t$'\t' -k1 -nr)

  local best_score best_area best_count best_sevs best_evt best_link
  IFS=$'\t' read -r best_score best_area best_count best_sevs best_evt best_link <<< "$(echo "$area_analysis" | head -1)"

  # Fetch CAP XML for polygon coordinates
  local lat="?" lon="?"
  if [ -n "$best_link" ]; then
    echo ""
    echo "  Fetching CAP XML for polygon..."
    local cap_xml
    cap_xml=$(cached_fetch "$best_link" "$CACHE_DIR/wmo-cap-best.xml") || true
    if [ -n "$cap_xml" ]; then
      local polygon
      polygon=$(echo "$cap_xml" | grep -oP '<polygon>[^<]+</polygon>' | head -1 | sed 's/<[^>]*>//g')
      if [ -n "$polygon" ]; then
        read -r lat lon < <(polygon_centroid "$polygon" cap)
      fi
    fi
  fi

  echo ""
  echo "  ── Top areas by diversity score ──"
  echo "$area_analysis" | head -5 | while IFS=$'\t' read -r score area cnt sevs _evt _link; do
    printf "    score=%-3s alerts=%-2s %-50s sev=%s\n" "$score" "$cnt" "$area" "$sevs"
  done

  echo ""
  echo "  ── Best testing area (score: $best_score) ──"
  echo ""
  echo "  area:     $best_area"
  echo "  alerts:   $best_count"
  echo "  sevs:     $best_sevs"
  echo "  event:    $best_evt"
  echo "  lat:      $lat"
  echo "  lon:      $lon"
  echo ""
  echo "  PirateWeather config: lat=$lat, lon=$lon"
  echo "  WMO source: $source_id ($source_name)"
}

# ─── DWD ─────────────────────────────────────────────────────────────────────
# DWD publishes warnings as JSONP at warnings.json. We strip the wrapper and
# parse the inner JSON. API requests: 1 (warnings.json)

dwd() {
  echo "DWD — Deutscher Wetterdienst (Germany)"
  echo "  Fetching active warnings..."

  local raw
  raw=$(cached_fetch "https://www.dwd.de/DWD/warnungen/warnapp/json/warnings.json" "$CACHE_DIR/dwd-warnings.json") || {
    echo "  FAIL: could not reach dwd.de"; return 1
  }

  # Strip JSONP wrapper: warnWetter.loadWarnings(...);
  local json
  json=$(echo "$raw" | sed 's/^warnWetter\.loadWarnings(//; s/);$//')

  local total
  total=$(echo "$json" | jq '[.warnings | to_entries[].value[]] | length') || {
    echo "  FAIL: could not parse DWD JSON"; return 1
  }
  echo "  Active warnings: $total"

  if [ "$total" -eq 0 ]; then
    echo "  No active warnings."
    return 0
  fi

  # Per-state diversity analysis
  local state_analysis
  state_analysis=$(echo "$json" | jq '
    [.warnings | to_entries[].value[]] |
    group_by(.stateShort) | map(
      . as $arr |
      {
        state: $arr[0].stateShort,
        state_name: $arr[0].state,
        count: ($arr | length),
        levels: ([$arr[].level] | unique | sort),
        events: ([$arr[].event] | unique | sort),
        score: (
          ([$arr[].level] | unique | length) * 20
          + ([$arr[].event] | unique | length) * 10
          + (if ($arr | length) >= 4 then 30 elif ($arr | length) >= 3 then 20 elif ($arr | length) >= 2 then 10 else 0 end)
        )
      }
    ) | sort_by(-.score, -.count)
  ')

  # Best testing state
  local best_state best_state_name best_score best_count best_levels best_events
  IFS=$'\t' read -r best_state best_state_name best_score best_count best_levels best_events \
    <<< "$(echo "$state_analysis" | jq -r '.[0] | [.state, .state_name, .score, .count, (.levels|map(tostring)|join(",")), (.events|join(", "))] | @tsv')"

  echo ""
  echo "  ── Best testing state (score: $best_score) ──"
  echo ""
  echo "  state:    $best_state ($best_state_name)"
  echo "  warnings: $best_count"
  echo "  levels:   $best_levels"
  echo "  events:   $best_events"

  echo ""
  echo "  ── Top states by diversity score ──"
  echo "$state_analysis" | jq -r '
    .[0:5] | .[] |
    "    \(.state)  score=\(.score)  warnings=\(.count)  levels=\(.levels|map(tostring)|join(","))  events=\(.events|join(","))"
  '

  # Best warncell (region) in the best state — most warnings = most test coverage
  local best_warncell
  best_warncell=$(echo "$json" | jq -r --arg st "$best_state" '
    [.warnings | to_entries[] | {id: .key, warnings: [.value[] | select(.stateShort == $st)]} | select(.warnings | length > 0)] |
    sort_by(-(
      (.warnings | [.[].level] | unique | length) * 20
      + (.warnings | [.[].event] | unique | length) * 10
      + (.warnings | length)
    )) | .[0] |
    "\(.id)\t\(.warnings[0].regionName)\t\(.warnings | length)"
  ')

  local warncell_id warncell_name warncell_count
  IFS=$'\t' read -r warncell_id warncell_name warncell_count <<< "$best_warncell"

  echo ""
  echo "  ── Best testing warncell ──"
  echo ""
  echo "  warncell ID:   $warncell_id"
  echo "  warncell name: $warncell_name"
  echo "  warnings:      $warncell_count"

  # Sample warnings from best warncell
  echo ""
  echo "  ── Sample warnings from $warncell_name ──"
  echo "$json" | jq -r --arg wid "$warncell_id" '
    .warnings[$wid] // [] |
    .[0:6] | .[] |
    "    [level \(.level)] \(.headline // .event)"
  '

  # Top warncells in best state
  echo ""
  echo "  ── Top warncells in $best_state by warning count ──"
  echo "$json" | jq -r --arg st "$best_state" '
    [.warnings | to_entries[] | {id: .key, warnings: [.value[] | select(.stateShort == $st)]} | select(.warnings | length > 0)] |
    sort_by(-(.warnings | length)) |
    .[0:5] | .[] |
    "    \(.id)  \(.warnings[0].regionName)  warnings=\(.warnings | length)"
  '

  # Condition coverage
  echo ""
  echo "  ── Condition coverage ──"
  echo "$json" | jq -r '
    [.warnings | to_entries[].value[]] |
    {
      total: length,
      by_level: (group_by(.level) | map({level: .[0].level, count: length}) | sort_by(-.count)),
      by_event: (group_by(.event) | map({event: .[0].event, count: length}) | sort_by(-.count))
    } |
    "  Total active warnings: \(.total)",
    "  By level:  \(.by_level | map("L\(.level)=\(.count)") | join("  "))",
    "  By event:  \(.by_event | .[0:8] | map("\(.event)=\(.count)") | join("  "))"
  '

  echo ""
  echo "  HA integration: dwd_weather_warnings"
  echo "  Warncell ID or name: $warncell_id  ($warncell_name)"
  echo "  Paste either value into the 'Warncell ID or name' field"
}

meteoswiss() {
  echo "MeteoSwiss — Federal Office of Meteorology and Climatology (Switzerland)"
  echo "  Probing a sample of postcodes (no national listing endpoint exists)..."

  # The hass-swissweather integration reads per-postcode data from the
  # MeteoSwiss app backend, where warnings live in the top-level `warnings`
  # array (meteo.py: warnType / warnLevel / validFrom / validTo / text, with
  # validFrom/validTo as epoch milliseconds). The 4-digit Swiss postcode is
  # left-padded to 6 digits with trailing zeros ("8000" → "800000").
  #
  # The integration's documented FORECAST_URL (`/v2/plzDetail`) intermittently
  # 500s; `/v2/forecast` returns the identical `warnings` array and is the
  # more reliable probe. Representative spread across language regions:
  #   8000 Zürich (DE), 1200 Genève (FR), 6900 Lugano (IT), 3900 Brig (DE/IT),
  #   7000 Chur (DE/RM)
  local postcodes=("8000" "1200" "6900" "3900" "7000")
  local with_warnings=0

  for pc in "${postcodes[@]}"; do
    local padded raw count
    padded="${pc}00"  # left-justify to 6 digits with trailing zeros
    raw=$(cached_fetch \
      "https://app-prod-ws.meteoswiss-app.ch/v2/forecast?plz=${padded}" \
      "$CACHE_DIR/meteoswiss-${pc}.json") || {
      echo "  [$pc] FAIL: could not reach app-prod-ws.meteoswiss-app.ch"
      echo "       (endpoint may require browser-like headers or be rate-limited)"
      continue
    }

    count=$(echo "$raw" | jq '(.warnings // []) | length' 2>/dev/null) || {
      echo "  [$pc] FAIL: could not parse response"; continue
    }

    if [ "$count" -eq 0 ]; then
      echo "  [$pc] no active warnings"
      continue
    fi

    with_warnings=$((with_warnings + 1))
    echo ""
    echo "  ── [$pc] $count warning(s) ──"
    # validFrom/validTo are epoch ms; show ISO via (value/1000 | todate).
    echo "$raw" | jq -r '
      (.warnings // [])[] |
      "    [level \(.warnLevel)] type=\(.warnType)  " +
        ((.validFrom // null) | if . == null then "?" else (./1000 | todate) end) + " → " +
        ((.validTo   // null) | if . == null then "?" else (./1000 | todate) end),
      "       \((.text // "") | gsub("\\s+"; " ") | .[0:90])"
    '
  done

  echo ""
  if [ "$with_warnings" -eq 0 ]; then
    echo "  No sampled postcode currently carries a warning."
  else
    echo "  $with_warnings of ${#postcodes[@]} sampled postcodes carry warnings."
  fi
  echo ""
  echo "  HA integration: izacus/hass-swissweather"
  echo "  Card entity:    sensor.weather_warnings_at_<postcode>  (e.g. sensor.weather_warnings_at_8000)"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
VALID_PROVIDERS="nws bom meteoalarm eccc wmo dwd meteoswiss"

run_provider() { case "$1" in nws|bom|meteoalarm|eccc) "$1";; wmo) wmo_cap;; dwd) dwd;; meteoswiss) meteoswiss;; esac; }

providers=()
if [ $# -eq 0 ]; then
  providers=($VALID_PROVIDERS)
else
  for arg in "$@"; do
    arg_lower=$(echo "$arg" | tr '[:upper:]' '[:lower:]')
    if ! echo " $VALID_PROVIDERS " | grep -q " $arg_lower "; then
      echo "Unknown provider: $arg" >&2
      echo "Valid providers: $VALID_PROVIDERS" >&2
      exit 1
    fi
    providers+=("$arg_lower")
  done
fi

echo "Finding zones with best testing cross-section for each provider..."
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Cache: $CACHE_DIR (TTL ${CACHE_TTL}s)"
echo ""
echo "NWS zone limits: ~850/request (URL length), 500 alerts/response, 16KB HA attribute cap"
echo ""
echo "Scoring criteria: severity diversity, prep vs active, multiple alerts,"
echo "contiguous zones, ongoing (no end time)"

for p in "${providers[@]}"; do
  divider
  run_provider "$p" || true
done
divider

echo ""
echo "Done. Use the zone/location info above to configure HA integrations for testing."
