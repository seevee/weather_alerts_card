import { AlertAdapter, AlertProvider, AlertSeverity, EcccAlert, WeatherAlert } from '../types';
import { alertEndTs, ECCC_COLOR_PALETTE, ecccTierHex, parseTimestamp, SEVERITY_RANK } from '../utils';

// Locale-aware fallback URLs for the ECCC weather entry point.
// Used when the per-alert `url` field is absent (the WFS-fed path of the
// upstream env_canada library never sets it; only the XML fallback does).
const ECCC_OVERVIEW_EN = 'https://weather.gc.ca/index_e.html';
const ECCC_OVERVIEW_FR = 'https://meteo.gc.ca/index_f.html';

const ENGLISH_ATTRIBUTION_FRAGMENT = 'environment canada';
const FRENCH_ATTRIBUTION_FRAGMENT = 'environnement canada';

// `color` (ECCC public scheme) → severity tier
const COLOR_SEVERITY: Record<string, AlertSeverity> = {
  red: 'extreme',
  orange: 'severe',
  yellow: 'moderate',
  grey: 'minor',
  green: 'unknown',
  rouge: 'extreme',
  jaune: 'moderate',
  gris: 'minor',
  vert: 'unknown',
};

// `type` (lifecycle/significance) → severity floor
const TYPE_SEVERITY: Record<string, AlertSeverity> = {
  warning: 'severe',
  watch: 'moderate',
  advisory: 'minor',
  statement: 'minor',
  ending: 'unknown',
};

// `impact` (CAP-style hint) → severity floor
const IMPACT_SEVERITY: Record<string, AlertSeverity> = {
  high: 'severe',
  medium: 'moderate',
  moderate: 'moderate',
  low: 'minor',
  'élevé': 'severe',
  'élevée': 'severe',
  'modéré': 'moderate',
  'modérée': 'moderate',
  faible: 'minor',
};

// `confidence` (ECCC's certainty hint) → CAP-style certainty token. ECCC ships
// "High"/"Moderate"/"Low" (and French equivalents); CAP/localize keys expect
// observed/likely/possible/unlikely/unknown, so we map across both axes.
const CONFIDENCE_CERTAINTY: Record<string, string> = {
  high: 'Likely',
  moderate: 'Possible',
  medium: 'Possible',
  low: 'Unlikely',
  'élevée': 'Likely',
  'élevé': 'Likely',
  'modérée': 'Possible',
  'modéré': 'Possible',
  faible: 'Unlikely',
};

const PHASE_LABELS: Record<string, string> = {
  new: 'New',
  issued: 'New',
  continued: 'Continued',
  updated: 'Updated',
  extended: 'Updated',
  expired: 'Final',
  ended: 'Final',
  'émis': 'New',
  maintenu: 'Continued',
  'mis à jour': 'Updated',
  'prolongé': 'Updated',
  'terminé': 'Final',
  'annulé': 'Final',
};

function sevFromColor(color: string | undefined): AlertSeverity {
  if (!color) return 'unknown';
  return COLOR_SEVERITY[color.toLowerCase()] ?? 'unknown';
}

function sevFromType(type: string | undefined): AlertSeverity {
  if (!type) return 'unknown';
  return TYPE_SEVERITY[type.toLowerCase()] ?? 'unknown';
}

function sevFromImpact(impact: string | undefined): AlertSeverity {
  if (!impact) return 'unknown';
  return IMPACT_SEVERITY[impact.toLowerCase()] ?? 'unknown';
}

function maxSeverity(...severities: AlertSeverity[]): AlertSeverity {
  let best: AlertSeverity = 'unknown';
  let bestRank = SEVERITY_RANK[best] ?? 0;
  for (const s of severities) {
    const r = SEVERITY_RANK[s] ?? SEVERITY_RANK.unknown ?? 0;
    if (r < bestRank) {
      best = s;
      bestRank = r;
    }
  }
  return best;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function phaseLabel(status: string | undefined): string {
  if (!status) return '';
  const lower = status.toLowerCase();
  return PHASE_LABELS[lower] ?? titleCase(status);
}

function certaintyFromConfidence(confidence: string | undefined): string {
  if (!confidence) return '';
  return CONFIDENCE_CERTAINTY[confidence.toLowerCase()] ?? '';
}

function isFrench(attribution: unknown): boolean {
  return typeof attribution === 'string'
    && attribution.toLowerCase().includes(FRENCH_ATTRIBUTION_FRAGMENT);
}

function fallbackUrl(attribution: unknown): string {
  return isFrench(attribution) ? ECCC_OVERVIEW_FR : ECCC_OVERVIEW_EN;
}

function isEnvironmentCanada(attribution: unknown): boolean {
  if (typeof attribution !== 'string') return false;
  const lower = attribution.toLowerCase();
  return lower.includes(ENGLISH_ATTRIBUTION_FRAGMENT) || lower.includes(FRENCH_ATTRIBUTION_FRAGMENT);
}

// --- Home Assistant core `environment_canada` ------------------------------
//
// Core publishes no alert detail on its entities. It has five count sensors
// (warnings, watches, advisories, statements, endings) that carry only
// `alert_N` / `alert_time_N` titles while alerts are active, and a
// `get_alerts` action that returns the full records, one list per sensor.
// Those records are the WFS fields the HACS fork puts in `attributes.alerts`
// under other names, so `fromCoreEcccAlert` renames them and this adapter
// parses them as it always has. The fetch lives in `action-details.ts`.

/** The action's list names, and the lifecycle `type` each stands for. */
export const ECCC_CORE_LISTS: Record<string, string> = {
  warnings: 'warning',
  watches: 'watch',
  advisories: 'advisory',
  statements: 'statement',
  endings: 'ending',
};

/**
 * The alerts a core ECCC count sensor holds now, as one string that changes
 * when they do, or null when the entity is not such a sensor or holds none.
 * The HACS fork's sensor has `alerts` on it and never matches.
 */
export function coreEcccAlertsKey(attributes: Record<string, unknown>): string | null {
  if (!isEnvironmentCanada(attributes['attribution']) || 'alerts' in attributes) return null;
  const parts: string[] = [];
  for (let n = 1; ; n++) {
    const title = attributes[`alert_${n}`];
    if (typeof title !== 'string') break;
    const time = attributes[`alert_time_${n}`];
    parts.push(`${title}@${typeof time === 'string' ? time : ''}`);
  }
  return parts.length > 0 ? parts.join('|') : null;
}

// `get_alerts` field → the name `parseAlerts` reads.
const CORE_FIELDS: [keyof EcccAlert, string][] = [
  ['title', 'title'],
  ['issued', 'date'],
  ['expiry', 'expiry_time'],
  ['color', 'alert_colour_level'],
  ['text', 'text'],
  ['area', 'area'],
  ['status', 'status'],
  ['confidence', 'confidence'],
  ['impact', 'impact'],
  ['alert_code', 'alert_code'],
  ['url', 'url'],
  ['validity_time', 'validity_time'],
  ['event_end_time', 'event_end_time'],
];

/** One `get_alerts` record, in the shape `parseAlerts` reads. */
export function fromCoreEcccAlert(item: Record<string, unknown>, list: string): EcccAlert {
  const alert: EcccAlert = {};
  for (const [field, key] of CORE_FIELDS) {
    const value = item[key];
    if (typeof value === 'string' && value !== '') alert[field] = value;
  }
  const type = ECCC_CORE_LISTS[list];
  if (type) alert.type = type;
  return alert;
}

export class EcccAdapter implements AlertAdapter {
  provider: AlertProvider = 'eccc';

  canHandle(attributes: Record<string, unknown>): boolean {
    return isEnvironmentCanada(attributes['attribution']);
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    const raw = attributes['alerts'];
    if (!Array.isArray(raw)) return [];
    const fallback = fallbackUrl(attributes['attribution']);

    return raw
      .filter((a): a is EcccAlert => typeof a === 'object' && a !== null)
      .filter(a => {
        const lower = str(a.status).toLowerCase();
        return lower !== 'cancelled' && lower !== 'annulé';
      })
      .map(a => this._normalize(a, fallback));
  }

  private _normalize(a: EcccAlert, fallbackUrlValue: string): WeatherAlert {
    const issuedTs = parseTimestamp(a.issued);
    // `issued` and `expiry` are the bulletin's own times: when it was published
    // and when it lapses. The hazard's start and end are separate fields, which
    // the library carries from env-canada 0.20.7 (env_canada#184). A statement
    // can lapse before the weather it announces begins, so the hazard start
    // wins over the publication time.
    const onsetTs = parseTimestamp(a.validity_time) || issuedTs;
    const endsTs = alertEndTs(issuedTs, onsetTs, parseTimestamp(a.event_end_time), parseTimestamp(a.expiry));
    const severity = maxSeverity(
      sevFromColor(a.color),
      sevFromType(a.type),
      sevFromImpact(a.impact),
    );
    const headline = str(a.title);
    const eventCode = str(a.alert_code);
    const area = str(a.area);
    const colorHint = ecccColorHex(a.color, severity);
    const impactRaw = str(a.impact);
    // `impact` mirrors CAP's raw severity word (preserves locale, e.g. "Élevée");
    // when absent we fall back to the canonical tier so severityLabel is never
    // empty. severityBadgeLabel stays undefined in that case so the badge uses
    // the localized i18n tier label instead of repeating English.
    const rawSeverityLabel = impactRaw ? titleCase(impactRaw) : undefined;
    const severityLabel = rawSeverityLabel
      ?? (severity.charAt(0).toUpperCase() + severity.slice(1));
    const certainty = certaintyFromConfidence(a.confidence);

    return {
      id: `eccc_${eventCode || headline || 'unknown'}_${area}_${issuedTs}`,
      event: headline,
      severity,
      severityLabel,
      certainty,
      urgency: '',
      sentTs: issuedTs,
      onsetTs,
      endsTs,
      description: str(a.text),
      instruction: '',
      url: str(a.url) || fallbackUrlValue,
      headline,
      areaDesc: area,
      zones: [],
      eventCode,
      provider: 'eccc',
      phase: phaseLabel(a.status),
      severityInferred: !a.color && !a.type && !a.impact,
      certaintyInferred: !a.confidence,
      colorHint,
      severityBadgeLabel: rawSeverityLabel,
    };
  }
}

// `colorHint` is a hex contract: resolve ECCC's colour tag against its own
// palette here, and keep the ECCC look by tier when the tag is absent.
function ecccColorHex(color: string | undefined, severity: AlertSeverity): string {
  const tag = color ? color.trim().toLowerCase() : '';
  const tagged = (ECCC_COLOR_PALETTE as Record<string, string | undefined>)[tag];
  return tagged ?? ecccTierHex(severity);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
