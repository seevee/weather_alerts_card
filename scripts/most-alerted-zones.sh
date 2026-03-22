#!/usr/bin/env bash
# most-alerted-zones.sh — Find the most-alerted zone for each provider (NWS, BoM, MeteoAlarm)
# Outputs lat/long/zone info useful for configuring HA integrations during testing.
#
# Usage: ./scripts/most-alerted-zones.sh
#
# Makes exactly 3 API requests (one per provider) plus 1 NWS zone lookup.
# Results are cached in .cache/most-alerted-zones/ for 1 hour to avoid
# hammering public endpoints on repeated runs.
#
# Dependencies: curl, jq

set -euo pipefail

UA="weather-alerts-card-testing/1.0"
CACHE_DIR=".cache/most-alerted-zones"
CACHE_TTL=3600  # seconds

mkdir -p "$CACHE_DIR"

# Fetch with file-level caching. Returns cached content if fresh enough.
# Optional 3rd arg: extra curl headers.
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

# ─── NWS ─────────────────────────────────────────────────────────────────────
# 1 request: GET /alerts/active (returns all active alerts with zone codes)
# 1 request: GET /zones/{type}/{id} (zone geometry for centroid)
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

  # Count alerts per UGC zone code, pick the top one
  local top_zone
  top_zone=$(echo "$alerts" | jq -r '
    [.features[].properties.geocode.UGC // [] | .[]] |
    group_by(.) |
    map({zone: .[0], count: length}) |
    sort_by(-.count) |
    .[0] |
    "\(.zone)\t\(.count)"
  ')

  local zone_code zone_count
  zone_code=$(echo "$top_zone" | cut -f1)
  zone_count=$(echo "$top_zone" | cut -f2)

  echo "  Most-alerted zone: $zone_code ($zone_count alerts)"

  # Determine zone type from 3rd character (e.g. COZ → forecast, COC → county)
  local zone_type="forecast"
  case "${zone_code:2:1}" in
    C) zone_type="county" ;;
    Z) zone_type="forecast" ;;
  esac

  # Fetch zone geometry for centroid (1 additional request)
  echo "  Fetching zone geometry ($zone_type/$zone_code)..."
  local zone_info
  zone_info=$(cached_fetch "https://api.weather.gov/zones/$zone_type/$zone_code" "$CACHE_DIR/nws-zone.json" \
    -H "Accept: application/geo+json") || {
    echo "  Could not fetch zone geometry."
    echo ""
    echo "  zone:  $zone_code"
    echo "  count: $zone_count"
    return 0
  }

  local name state
  name=$(echo "$zone_info" | jq -r '.properties.name // "unknown"')
  state=$(echo "$zone_info" | jq -r '.properties.state // "unknown"')

  # Centroid: average all coordinate points
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
  echo "  count: $zone_count active alerts"
  echo ""
  echo "  HA config: zone_id = $zone_code"
}

# ─── BoM ──────────────────────────────────────────────────────────────────────
# 1 request: GET /v1/warnings (all active warnings across Australia)
# 1 request: GET /v1/locations?search={place} (resolve place name → geohash)
# BoM warnings have no geometry — we extract a place name from the warning
# title, resolve it via the BoM locations API, and decode the geohash locally
# to get coordinates that fall within the actual alerted area.

# Decode a geohash to lat/lon (pure awk, no external dependencies).
decode_geohash() {
  echo "$1" | awk '
  BEGIN {
    split("0123456789bcdefghjkmnpqrstuvwxyz", chars, "")
    for (i = 1; i <= 32; i++) base32[chars[i]] = i - 1
  }
  {
    hash = $0
    lat_min = -90; lat_max = 90
    lon_min = -180; lon_max = 180
    is_lon = 1
    for (i = 1; i <= length(hash); i++) {
      c = substr(hash, i, 1)
      val = base32[c]
      for (b = 4; b >= 0; b--) {
        bit = int(val / (2^b)) % 2
        if (is_lon) {
          mid = (lon_min + lon_max) / 2
          if (bit) lon_min = mid; else lon_max = mid
        } else {
          mid = (lat_min + lat_max) / 2
          if (bit) lat_min = mid; else lat_max = mid
        }
        is_lon = !is_lon
      }
    }
    printf "%.6f %.6f\n", (lat_min + lat_max) / 2, (lon_min + lon_max) / 2
  }'
}

# Extract candidate place names from a BoM warning title.
# Titles look like: "Herbert River at Abergowrie Bridge, Tully River at Euramo"
# Strategy: pull tokens after " at " (most specific), then try the first
# comma-segment as a bare search term.
extract_bom_places() {
  local title="$1"
  # Prefer "at <Place>" patterns — these are specific localities
  echo "$title" | grep -oP '(?<= at )\w+' || true
  # Fallback: first comma-segment, stripped of "River", "Creek" etc.
  echo "$title" | cut -d, -f1 | sed 's/\b\(River\|Creek\|Bay\|Lake\|Range\)\b//g; s/^ *//; s/ *$//'
}

# Search BoM locations API for a place name within a given state.
# Returns "geohash\tname" or empty string.
bom_search_place() {
  local place="$1" target_state="$2"
  local result
  result=$(curl -sf --max-time 10 -H "User-Agent: $UA" \
    "https://api.weather.bom.gov.au/v1/locations?search=$(echo "$place" | sed 's/ /%20/g')" 2>/dev/null) || return 1
  # Prefer a match in the target state
  echo "$result" | jq -r --arg st "$target_state" '
    (.data[] | select(.state == $st) | "\(.geohash)\t\(.name)") // empty
  ' | head -1
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
  echo "  Active warnings: $total"

  if [ "$total" -eq 0 ]; then
    echo "  No active warnings."
    return 0
  fi

  # Count non-cancelled warnings per state
  local top_state
  top_state=$(echo "$warnings" | jq -r '
    [.data[] | select(.phase != "cancelled") | .state // empty] |
    group_by(.) |
    map({state: .[0], count: length}) |
    sort_by(-.count) |
    .[0] |
    "\(.state)\t\(.count)"
  ')

  local state_code state_count
  state_code=$(echo "$top_state" | cut -f1)
  state_count=$(echo "$top_state" | cut -f2)

  echo "  Most-alerted state: $state_code ($state_count warnings)"

  # Sample warning from that state
  local sample
  sample=$(echo "$warnings" | jq -r --arg st "$state_code" '
    [.data[] | select(.state == $st and .phase != "cancelled")] |
    .[0] |
    "\(.id // "?")\t\(.type // "?")\t\(.title // "?")\t\(.warning_group_type // "?")"
  ')

  local warn_id warn_type warn_title warn_group
  warn_id=$(echo "$sample" | cut -f1)
  warn_type=$(echo "$sample" | cut -f2)
  warn_title=$(echo "$sample" | cut -f3)
  warn_group=$(echo "$sample" | cut -f4)

  # Resolve a location within the alerted area from the warning title.
  # Extract place names and search BoM locations API (1 additional request).
  local lat="?" lon="?" resolved_name=""
  echo "  Resolving location from warning title..."

  local places
  places=$(extract_bom_places "$warn_title")

  local found=""
  while IFS= read -r place; do
    [ -z "$place" ] && continue
    local match
    match=$(bom_search_place "$place" "$state_code") || continue
    if [ -n "$match" ]; then
      found="$match"
      break
    fi
  done <<< "$places"

  if [ -n "$found" ]; then
    local geohash
    geohash=$(echo "$found" | cut -f1)
    resolved_name=$(echo "$found" | cut -f2)
    read -r lat lon < <(decode_geohash "$geohash")
    echo "  Resolved: $resolved_name ($geohash)"
  else
    echo "  Could not resolve a location from title — using state capital"
    case "$state_code" in
      NSW) lat="-33.8688"; lon="151.2093"; resolved_name="Sydney" ;;
      VIC) lat="-37.8136"; lon="144.9631"; resolved_name="Melbourne" ;;
      QLD) lat="-27.4698"; lon="153.0251"; resolved_name="Brisbane" ;;
      SA)  lat="-34.9285"; lon="138.6007"; resolved_name="Adelaide" ;;
      WA)  lat="-31.9505"; lon="115.8605"; resolved_name="Perth" ;;
      TAS) lat="-42.8821"; lon="147.3272"; resolved_name="Hobart" ;;
      NT)  lat="-12.4634"; lon="130.8456"; resolved_name="Darwin" ;;
      ACT) lat="-35.2809"; lon="149.1300"; resolved_name="Canberra" ;;
      *)   resolved_name="unknown" ;;
    esac
  fi

  echo ""
  echo "  state:   $state_code"
  echo "  place:   $resolved_name"
  echo "  lat:     $lat"
  echo "  lon:     $lon"
  echo "  count:   $state_count active warnings"
  echo "  example: $warn_title ($warn_type, $warn_group)"
  echo "  id:      $warn_id"
  echo ""
  echo "  HA integration: bureau_of_meteorology"
  echo "  Configure for a location near $resolved_name, $state_code to pick up warnings"
}

# ─── MeteoAlarm ───────────────────────────────────────────────────────────────
# 1 request: GET /feeds/meteoalarm-legacy-rss-europe (aggregate RSS — country ranking)
# 1 request: GET /feeds/meteoalarm-legacy-atom-{country} (province/region details)
# Ref: https://www.home-assistant.io/integrations/meteoalarm/

# Map RSS title "MeteoAlarm {Name}" → feed slug used by both the atom URL and
# the HA meteoalarm integration's `country:` config key.
country_to_slug() {
  local name="$1"
  echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g'
}

meteoalarm() {
  echo "MeteoAlarm — EUMETNET (Europe)"
  echo "  Fetching aggregate RSS feed..."

  local feed
  feed=$(cached_fetch "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-rss-europe" "$CACHE_DIR/meteoalarm-rss.xml") || {
    echo "  FAIL: could not reach feeds.meteoalarm.org"; return 1
  }

  # Parse RSS: each <item><title>MeteoAlarm {Country}</title> contains
  # <td data-awareness-level="N"> elements — count them per country.
  local counts
  counts=$(echo "$feed" | awk '
    /<title>MeteoAlarm / {
      gsub(/.*<title>MeteoAlarm /, ""); gsub(/<\/title>.*/, "");
      country = $0;
      alert_count = 0;
    }
    /data-awareness-level="[2-4]"/ {
      n = gsub(/data-awareness-level="[2-4]"/, "&");
      alert_count += n;
    }
    /<\/item>/ {
      if (country != "" && alert_count > 0) {
        printf "%d\t%s\n", alert_count, country;
      }
      country = "";
      alert_count = 0;
    }
  ' | sort -t$'\t' -k1 -nr)

  if [ -z "$counts" ]; then
    echo "  No active alerts (awareness level >= 2) across Europe."
    return 0
  fi

  local total_countries
  total_countries=$(echo "$counts" | wc -l | tr -d ' ')
  echo "  Countries with alerts: $total_countries"
  echo ""
  echo "  Top 5:"
  echo "$counts" | head -5 | while IFS=$'\t' read -r cnt name; do
    printf "    %-20s %s alerts\n" "$name" "$cnt"
  done

  local top_count top_country
  top_count=$(echo "$counts" | head -1 | cut -f1)
  top_country=$(echo "$counts" | head -1 | cut -f2)

  local country_slug
  country_slug=$(country_to_slug "$top_country")

  # Fetch the country's atom feed to find the most-alerted province (1 additional request).
  # Each <entry> has <cap:areaDesc> with the region/province name and <cap:geocode>
  # with the EMMA_ID. Count entries per areaDesc.
  echo ""
  echo "  Fetching atom feed for $top_country..."
  local atom
  atom=$(cached_fetch "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${country_slug}" \
    "$CACHE_DIR/meteoalarm-atom.xml") || {
    echo "  Could not fetch atom feed for $country_slug."
    echo ""
    echo "  # configuration.yaml (province unknown — check meteoalarm.org)"
    echo "  binary_sensor:"
    echo "    - platform: meteoalarm"
    echo "      country: \"$country_slug\""
    echo "      province: \"???\"  # visit meteoalarm.org to find province"
    return 0
  }

  # Extract areaDesc values and count per province
  local province_counts
  province_counts=$(echo "$atom" | grep -oP '(?<=<cap:areaDesc>)[^<]+' | \
    sort | uniq -c | sort -rn)

  local top_province top_province_count
  top_province_count=$(echo "$province_counts" | head -1 | awk '{print $1}')
  top_province=$(echo "$province_counts" | head -1 | sed 's/^ *[0-9]* *//')

  echo "  Most-alerted province: $top_province ($top_province_count alerts)"

  # Show top 3 provinces
  echo ""
  echo "  Top provinces:"
  echo "$province_counts" | head -3 | while read -r cnt name; do
    printf "    %-35s %s alerts\n" "$name" "$cnt"
  done

  echo ""
  echo "  count:    $top_count country-level alerts"
  echo "  country:  $country_slug"
  echo "  province: $top_province"
  echo ""
  echo "  # configuration.yaml"
  echo "  binary_sensor:"
  echo "    - platform: meteoalarm"
  echo "      country: \"$country_slug\""
  echo "      province: \"$top_province\""
}

# ─── Main ─────────────────────────────────────────────────────────────────────
echo "Finding most-alerted zones for each provider..."
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Cache: $CACHE_DIR (TTL ${CACHE_TTL}s)"

divider
nws || true
divider
bom || true
divider
meteoalarm || true
divider

echo ""
echo "Done. Use the zone/location info above to configure HA integrations for testing."
