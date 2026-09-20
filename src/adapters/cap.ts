import { AlertAdapter, AlertProvider, AlertSeverity, WeatherAlert } from '../types';
import { extractPoint, meteoalarmAwarenessColorHex, normalizeSeverity, parseTimestamp } from '../utils';

// CAP Alerts integration sets one entity per active alert. Each entity's
// extra_state_attributes is a flat dict of CAP 1.2 fields plus an
// `incident_platform_version` marker (added unconditionally in the
// integration's sensor.py). Detection keys off that marker; normalisation
// is already done upstream so this adapter is a thin passthrough.
export class CapAdapter implements AlertAdapter {
  provider: AlertProvider = 'cap';

  // `id` is the CAP identifier, so the same alert seen through two cap_alerts
  // devices (overlapping scopes) is one alert with one id.
  stableIds = true;

  // The Australian state feeds put a location marker on every incident, so a
  // cap_alerts card can carry points and the editor offers the radius control.
  // On an NWS- or ECCC-backed card the field is inert (no alert has a point,
  // so nothing is filtered); the docs say which feeds carry one.
  carriesPoint = true;

  canHandle(attributes: Record<string, unknown>): boolean {
    return typeof attributes['incident_platform_version'] === 'string'
      && typeof attributes['id'] === 'string';
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    const id = str(attributes['id']);
    if (!id) return [];

    const event = str(attributes['event']);
    const rawSeverity = str(attributes['severity']);
    const normalizedSev = str(attributes['severity_normalized']);
    const severity = (normalizedSev
      ? normalizeSeverity(normalizedSev)
      : normalizeSeverity(rawSeverity)) as AlertSeverity;

    const labelSource = rawSeverity || normalizedSev;
    const severityLabel = labelSource
      ? labelSource.charAt(0).toUpperCase() + labelSource.slice(1).toLowerCase()
      : severity.charAt(0).toUpperCase() + severity.slice(1);

    const sentTs = parseTimestamp(str(attributes['sent']) || str(attributes['effective']));
    const onsetTs = parseTimestamp(str(attributes['onset'])) || sentTs;
    const endsTs = parseTimestamp(str(attributes['ends'])) || parseTimestamp(str(attributes['expires']));

    const rawIcon = str(attributes['icon']);
    const providerIcon = rawIcon.startsWith('mdi:') ? rawIcon : undefined;

    const geometryRefRaw = str(attributes['geometry_ref']);
    const geometryRef = geometryRefRaw || undefined;

    // Where the incident IS. cap_alerts publishes a CAP <circle> marker in
    // `points` (lon-first pairs) alongside whatever polygon exists — one per
    // marker, so only a single marker names a location; several name nothing
    // in particular. A marker-only alert also arrives with a *degenerate*
    // bbox around the same coordinate, which is the fallback for an
    // integration old enough to omit `points`. Either way that bbox is not
    // an extent and is dropped: framing it as one pads it to ~10 m, lands at
    // the deepest zoom and stretches a few pixels of tile across the card.
    // The mini-map synthesizes a frame around `point` instead (#206).
    const rawBbox = numArray4(attributes['bbox']);
    const degenerate = rawBbox !== undefined && rawBbox[0] === rawBbox[2] && rawBbox[1] === rawBbox[3];
    const point = singlePoint(attributes['points'])
      ?? (degenerate ? extractPoint(rawBbox[1], rawBbox[0]) : undefined);
    const bbox = degenerate ? undefined : rawBbox;

    // cap_alerts serialises the raw CAP `<parameter>` map under `parameters`.
    // MeteoAlarm members publish their awareness colour there; it is the only
    // issuer colour any cap_alerts provider carries today.
    const params = attributes['parameters'];
    const colorHint = params && typeof params === 'object' && !Array.isArray(params)
      ? meteoalarmAwarenessColorHex((params as Record<string, unknown>)['awareness_level'])
      : undefined;

    return [{
      id,
      event: event || 'Unknown',
      severity,
      severityLabel,
      certainty: str(attributes['certainty']),
      urgency: str(attributes['urgency']),
      sentTs,
      onsetTs,
      endsTs,
      description: str(attributes['description']),
      instruction: str(attributes['instruction']),
      url: httpUrl(str(attributes['url'])) || httpUrl(str(attributes['web'])),
      headline: str(attributes['headline']),
      areaDesc: str(attributes['area_desc']),
      zones: collectZones(attributes),
      eventCode: str(attributes['event_code_nws']) || str(attributes['event_code_same']),
      provider: 'cap',
      phase: phaseLabel(str(attributes['phase'])),
      severityInferred: !rawSeverity && !normalizedSev,
      certaintyInferred: false,
      ...(providerIcon !== undefined && { providerIcon }),
      ...(geometryRef !== undefined && { geometryRef }),
      ...(bbox !== undefined && { bbox }),
      ...(point !== undefined && { point }),
      ...(colorHint !== undefined && { colorHint }),
    }];
  }
}

const PHASE_LABELS: Record<string, string> = {
  new: 'New',
  update: 'Update',
  cancel: 'Cancel',
  expired: 'Expired',
};

function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase.toLowerCase()] || '';
}

function collectZones(attributes: Record<string, unknown>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (z: unknown): void => {
    if (typeof z !== 'string') return;
    const upper = z.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      out.push(upper);
    }
  };
  for (const key of ['affected_zones', 'geocode_ugc', 'geocode_same']) {
    const raw = attributes[key];
    if (!Array.isArray(raw)) continue;
    for (const z of raw) push(z);
  }
  // cap_alerts's typed geocode container: { scheme: [codes] } (e.g. MeteoAlarm
  // EMMA_ID/NUTS3). Flatten the array values only — scheme keys are not zones.
  // Read after the flat keys so existing providers' zone order is unchanged.
  const geocodes = attributes['geocodes'];
  if (geocodes && typeof geocodes === 'object' && !Array.isArray(geocodes)) {
    for (const codes of Object.values(geocodes as Record<string, unknown>)) {
      if (!Array.isArray(codes)) continue;
      for (const z of codes) push(z);
    }
  }
  return out;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// Returns a [minlon, minlat, maxlon, maxlat] tuple only when `v` is an array
// of exactly 4 finite numbers; otherwise undefined (malformed bbox is dropped,
// never thrown).
function numArray4(v: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 4) return undefined;
  if (!v.every(n => typeof n === 'number' && Number.isFinite(n))) return undefined;
  return [v[0], v[1], v[2], v[3]];
}

// `points` as cap_alerts serialises it: a list of [lon, lat] pairs. Returns
// the one marker when the list holds exactly one well-formed pair; a malformed
// or multi-marker list is "no point" (never thrown, never a guess).
function singlePoint(v: unknown): [number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 1) return undefined;
  const pair = v[0];
  if (!Array.isArray(pair) || pair.length !== 2) return undefined;
  return extractPoint(pair[1], pair[0]);
}

function httpUrl(v: string): string {
  return v.startsWith('http://') || v.startsWith('https://') ? v : '';
}
