import { AlertAdapter, AlertProvider, AlertSeverity, EcccAlert, WeatherAlert } from '../types';
import { parseTimestamp, SEVERITY_RANK } from '../utils';

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
  let bestRank = SEVERITY_RANK[best];
  for (const s of severities) {
    const r = SEVERITY_RANK[s] ?? SEVERITY_RANK.unknown;
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

function typeLabel(type: string | undefined, severity: AlertSeverity): string {
  if (type) return titleCase(type);
  return titleCase(severity);
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

export class EcccAdapter implements AlertAdapter {
  provider: AlertProvider = 'eccc';

  canHandle(attributes: Record<string, unknown>): boolean {
    const attribution = attributes['attribution'];
    if (typeof attribution !== 'string') return false;
    const lower = attribution.toLowerCase();
    return lower.includes(ENGLISH_ATTRIBUTION_FRAGMENT)
      || lower.includes(FRENCH_ATTRIBUTION_FRAGMENT);
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
    const expiryTs = parseTimestamp(a.expiry);
    const severity = maxSeverity(
      sevFromColor(a.color),
      sevFromType(a.type),
      sevFromImpact(a.impact),
    );
    const headline = str(a.title);
    const eventCode = str(a.alert_code);
    const area = str(a.area);
    const colorHint = a.color ? a.color.toLowerCase() : undefined;
    const impactRaw = str(a.impact);
    const severityBadgeLabel = impactRaw ? titleCase(impactRaw) : undefined;
    const certainty = certaintyFromConfidence(a.confidence);

    return {
      id: `eccc_${eventCode || headline || 'unknown'}_${area}_${issuedTs}`,
      event: headline,
      severity,
      severityLabel: typeLabel(a.type, severity),
      certainty,
      urgency: '',
      sentTs: issuedTs,
      onsetTs: issuedTs,
      endsTs: expiryTs,
      description: str(a.text),
      instruction: '',
      url: str(a.url) || fallbackUrlValue,
      headline,
      areaDesc: area,
      zones: [],
      eventCode,
      provider: 'eccc',
      phase: phaseLabel(a.status),
      severityInferred: true,
      certaintyInferred: true,
      colorHint,
      severityBadgeLabel,
    };
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
