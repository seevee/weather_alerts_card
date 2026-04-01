#!/usr/bin/env bash
# testing-zones.sh — Find zones with the best cross-section of alert conditions
# Providers: NWS (US), BoM (Australia), MeteoAlarm (Europe), ECCC (Canada), DWD (Germany)
# Optimizes for testing diversity: mixed severities, prep vs active, multiple
# alerts per zone, contiguous zone clusters with overlapping alerts.
#
# Usage: ./scripts/testing-zones.sh [provider ...]
#   provider: nws, bom, meteoalarm, eccc, wmo, dwd (default: all)
#
# API requests per provider:
#   NWS:       1 (alerts/active) + 1-3 zone geometry lookups
#   BoM:       1 (warnings) + 0-1 location search
#   MeteoAlarm: 1 (RSS) + 1 (atom feed)
#   ECCC:      1 (NAAD atom)
#   WMO CAP:   1-3 (RSS per source) + 1 (CAP XML)
#   DWD:       1 (warnings.json)
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
# BoM warnings have no geometry — we extract a place name from the warning
# title, resolve it via the BoM locations API, and decode the geohash locally.

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
  echo "$title" | grep -oP '(?<= at )\w+' || true
  echo "$title" | cut -d, -f1 | sed 's/\b\(River\|Creek\|Bay\|Lake\|Range\)\b//g; s/^ *//; s/ *$//'
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

  # Per-state diversity analysis
  local state_analysis
  state_analysis=$(echo "$warnings" | jq '
    [.data[] | select(.phase != "cancelled")] |
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
  echo "  ── Best testing state (score: $best_score) ──"
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
  echo "$warnings" | jq -r --arg st "$best_state" '
    [.data[] | select(.state == $st and .phase != "cancelled")] |
    .[0:6] | .[] |
    "    [\(.phase)] \(.title) (\(.type), \(.warning_group_type))"
  '

  # Resolve a location for the best state
  local lat="?" lon="?" resolved_name=""
  echo ""
  echo "  Resolving location..."

  local sample_title
  sample_title=$(echo "$warnings" | jq -r --arg st "$best_state" '
    [.data[] | select(.state == $st and .phase != "cancelled")] | .[0].title // ""
  ')

  local places found=""
  places=$(extract_bom_places "$sample_title")
  while IFS= read -r place; do
    [ -z "$place" ] && continue
    local match
    match=$(bom_search_place "$place" "$best_state") || continue
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
    case "$best_state" in
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
  echo "  place: $resolved_name"
  echo "  lat:   $lat"
  echo "  lon:   $lon"
  echo ""
  echo "  HA integration: bureau_of_meteorology"
  echo "  Configure for a location near $resolved_name, $best_state to pick up warnings"

  # Condition coverage
  echo ""
  echo "  ── Condition coverage ──"
  echo "$warnings" | jq -r '
    [.data[] | select(.phase != "cancelled")] |
    {
      total: length,
      phases: (group_by(.phase) | map({phase: .[0].phase, count: length}) | sort_by(-.count)),
      groups: (group_by(.warning_group_type) | map({group: .[0].warning_group_type, count: length}) | sort_by(-.count))
    } |
    "  Total active warnings: \(.total)",
    "  By phase:  \(.phases | map("\(.phase)=\(.count)") | join("  "))",
    "  By group:  \(.groups | map("\(.group)=\(.count)") | join("  "))"
  '
}

# ─── MeteoAlarm ───────────────────────────────────────────────────────────────
# Ref: https://www.home-assistant.io/integrations/meteoalarm/

country_to_slug() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g'
}

meteoalarm() {
  echo "MeteoAlarm — EUMETNET (Europe)"
  echo "  Fetching aggregate RSS feed..."

  local feed
  feed=$(cached_fetch "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-rss-europe" "$CACHE_DIR/meteoalarm-rss.xml") || {
    echo "  FAIL: could not reach feeds.meteoalarm.org"; return 1
  }

  # Parse RSS: count awareness levels per country, score by level diversity
  local counts
  counts=$(echo "$feed" | awk '
    /<title>MeteoAlarm / {
      gsub(/.*<title>MeteoAlarm /, ""); gsub(/<\/title>.*/, "");
      country = $0; lvl2 = 0; lvl3 = 0; lvl4 = 0;
    }
    /data-awareness-level="2"/ { lvl2 += gsub(/data-awareness-level="2"/, "&"); }
    /data-awareness-level="3"/ { lvl3 += gsub(/data-awareness-level="3"/, "&"); }
    /data-awareness-level="4"/ { lvl4 += gsub(/data-awareness-level="4"/, "&"); }
    /<\/item>/ {
      total = lvl2 + lvl3 + lvl4; levels = 0;
      if (lvl2 > 0) levels++; if (lvl3 > 0) levels++; if (lvl4 > 0) levels++;
      if (country != "" && total > 0)
        printf "%d\t%s\t%d\t%d\t%d\t%d\n", levels * 20 + total, country, total, lvl2, lvl3, lvl4;
      country = ""; lvl2 = 0; lvl3 = 0; lvl4 = 0;
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
  echo "  ── Top countries by diversity ──"
  echo "$counts" | head -8 | while IFS=$'\t' read -r _score name total l2 l3 l4; do
    printf "    %-20s total=%-3s  yellow=%-3s orange=%-3s red=%s\n" "$name" "$total" "$l2" "$l3" "$l4"
  done

  local top_score top_country top_total
  IFS=$'\t' read -r top_score top_country top_total _ _ _ <<< "$(echo "$counts" | head -1)"

  local country_slug
  country_slug=$(country_to_slug "$top_country")

  echo ""
  echo "  Best testing country: $top_country (score: $top_score, alerts: $top_total)"

  # Fetch the country's atom feed for province-level analysis
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

  local province_data
  province_data=$(echo "$atom" | grep -oP '(<cap:areaDesc>[^<]+</cap:areaDesc>|<cap:severity>[^<]+</cap:severity>)' | \
    paste - - 2>/dev/null | sed 's/<[^>]*>//g' | sort)

  if [ -n "$province_data" ]; then
    echo ""
    echo "  ── Top provinces ──"
    echo "$atom" | grep -oP '(?<=<cap:areaDesc>)[^<]+' | sort | uniq -c | sort -rn | head -5 | \
      while read -r cnt name; do
        printf "    %-35s %s alerts\n" "$name" "$cnt"
      done
  fi

  local top_province
  top_province=$(echo "$atom" | grep -oP '(?<=<cap:areaDesc>)[^<]+' | sort | uniq -c | sort -rn | head -1 | sed 's/^ *[0-9]* *//')

  echo ""
  echo "  country:  $country_slug"
  echo "  province: $top_province"
  echo ""
  echo "  # configuration.yaml"
  echo "  binary_sensor:"
  echo "    - platform: meteoalarm"
  echo "      country: \"$country_slug\""
  echo "      province: \"$top_province\""
}

# ─── ECCC ─────────────────────────────────────────────────────────────────────
# Atom entries use <category term="key=value"/> for CAP fields, <georss:polygon>
# for coordinates, and area names in <summary>.
# Ref: https://rss.naad-adna.pelmorex.com/

eccc() {
  echo "ECCC — Environment and Climate Change Canada"
  echo "  Fetching NAAD alert feed..."

  local feed
  feed=$(cached_fetch "https://rss.naad-adna.pelmorex.com/" "$CACHE_DIR/eccc-naad.xml") || {
    echo "  FAIL: could not reach rss.naad-adna.pelmorex.com"; return 1
  }

  # Parse entries into TSV: area \t severity \t event \t polygon \t urgency
  local parsed
  parsed=$(echo "$feed" | sed 's/<entry>/\n<entry>/g' | awk '
    /<entry>/ { lang = ""; status = ""; msg_type = ""; sev = ""; evt = ""; poly = ""; area = ""; urg = "" }
    /term="language=/ { match($0, /term="language=([^"]*)"/, m); lang = m[1] }
    /term="status=/   { match($0, /term="status=([^"]*)"/, m); status = m[1] }
    /term="msgType=/  { match($0, /term="msgType=([^"]*)"/, m); msg_type = m[1] }
    /term="severity=/ { match($0, /term="severity=([^"]*)"/, m); sev = m[1] }
    /term="urgency=/  { match($0, /term="urgency=([^"]*)"/, m); urg = m[1] }
    /term="event=/    { match($0, /term="event=([^"]*)"/, m); evt = m[1] }
    /<georss:polygon>/ && poly == "" { match($0, /<georss:polygon>([^<]+)</, m); poly = m[1] }
    /Area:/ {
      match($0, /Area: ([^<]*)/, m); area = m[1]
      gsub(/&amp;/, "\\&", area); gsub(/&lt;/, "<", area); gsub(/&gt;/, ">", area)
    }
    /<\/entry>/ {
      if (lang == "en-CA" && status == "Actual" && msg_type != "Cancel" && area != "")
        print area "\t" sev "\t" evt "\t" poly "\t" urg
    }
  ')

  if [ -z "$parsed" ]; then
    echo "  No active alerts across Canada."
    return 0
  fi

  local total
  total=$(echo "$parsed" | wc -l | tr -d ' ')
  echo "  Active alert entries: $total"

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
  echo "  ── Best testing area (score: $best_score) ──"
  echo ""
  echo "  area:       $best_area"
  echo "  lat:        $lat"
  echo "  lon:        $lon"
  echo "  alerts:     $best_count"
  echo "  severities: $best_sevs"
  echo "  events:     $best_evts"

  echo ""
  echo "  ── Top areas by diversity score ──"
  echo "$area_analysis" | head -8 | while IFS=$'\t' read -r score area cnt sevs evts _poly; do
    printf "    score=%-3s alerts=%-2s %-45s sev=%s\n" "$score" "$cnt" "$area" "$sevs"
  done

  # Condition coverage
  echo ""
  echo "  ── Condition coverage ──"
  echo "  Total areas:  $(echo "$area_analysis" | wc -l | tr -d ' ')"
  echo "$parsed" | cut -f2 | show_distribution "Severity" 12
  echo "$parsed" | cut -f3 | show_distribution "Event types" 45 8

  echo ""
  echo "  Use these coordinates when configuring PirateWeather for Canadian alert testing."
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

# ─── Main ─────────────────────────────────────────────────────────────────────
VALID_PROVIDERS="nws bom meteoalarm eccc wmo dwd"

run_provider() { case "$1" in nws|bom|meteoalarm|eccc) "$1";; wmo) wmo_cap;; dwd) dwd;; esac; }

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
