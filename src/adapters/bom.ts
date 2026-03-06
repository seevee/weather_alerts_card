import { AlertAdapter, AlertProvider, AlertSeverity, BomWarning, WeatherAlert } from '../types';
import { parseTimestamp } from '../utils';

// Parse severity from the title first (most specific), then type, then warning_group_type.
// BoM titles embed severity: "Major Flood Warning", "Minor Flood Warning",
// "Moderate Flood Warning", "Severe Thunderstorm Warning", etc.
function bomSeverity(title: string, type: string, groupType: string): AlertSeverity {
  const t = title.toLowerCase();

  // Title-based — most reliable since BoM embeds severity in the warning name
  if (t.includes('extreme') || t.includes('tropical cyclone')) return 'extreme';
  if (t.includes('severe')) return 'severe';
  if (t.includes('major')) return 'severe';
  if (t.includes('moderate')) return 'moderate';
  if (t.includes('minor') || t.includes('initial')) return 'minor';

  // Fall back to type field
  const ty = type.toLowerCase();
  if (ty.includes('tropical_cyclone')) return 'extreme';
  if (ty.includes('severe') || ty.includes('fire_weather')) return 'severe';

  // Fall back to warning_group_type
  if (groupType === 'major') return 'moderate';
  return 'minor';
}

function bomTitle(warning: BomWarning): string {
  return warning.title || warning.short_title || warning.type.replace(/_/g, ' ');
}

function bomUrl(warning: BomWarning): string {
  const state = (warning.state || '').toLowerCase();
  if (state) return `https://www.bom.gov.au/${state}/warnings/`;
  return 'https://www.bom.gov.au/australia/warnings/';
}

const PHASE_LABELS: Record<string, string> = {
  new: 'New',
  update: 'Updated',
  renewal: 'Renewed',
  upgrade: 'Upgraded',
  downgrade: 'Downgraded',
  final: 'Final',
};

function bomPhaseLabel(phase: string): string {
  return PHASE_LABELS[phase.toLowerCase()] || '';
}

export class BomAdapter implements AlertAdapter {
  provider: AlertProvider = 'bom';

  canHandle(attributes: Record<string, unknown>): boolean {
    const warnings = attributes['warnings'];
    if (!Array.isArray(warnings)) return false;
    if (warnings.length === 0) {
      // Empty array — check for BoM attribution as secondary signal
      return typeof attributes['attribution'] === 'string'
        && (attributes['attribution'] as string).toLowerCase().includes('bureau of meteorology');
    }
    const first = warnings[0];
    return typeof first === 'object' && first !== null
      && 'warning_group_type' in first && 'issue_time' in first;
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    const raw = attributes['warnings'];
    if (!Array.isArray(raw)) return [];
    return (raw as BomWarning[])
      .filter(w => w.phase !== 'cancelled')
      .map(w => this._normalize(w));
  }

  private _normalize(w: BomWarning): WeatherAlert {
    const issueTs = parseTimestamp(w.issue_time);
    const expiryTs = parseTimestamp(w.expiry_time);
    const title = bomTitle(w);

    return {
      id: w.id,
      event: title,
      severity: bomSeverity(title, w.type, w.warning_group_type),
      certainty: '',   // BoM API does not expose CAP certainty
      urgency: '',     // BoM API does not expose CAP urgency
      sentTs: issueTs,
      onsetTs: issueTs, // BoM issues when threat is imminent; no separate onset
      endsTs: expiryTs,
      description: '',
      instruction: '',
      url: bomUrl(w),
      headline: w.short_title || title,
      areaDesc: w.state || '',
      zones: [],        // BoM warnings are location-based (geohash), no zone codes
      provider: 'bom',
      phase: bomPhaseLabel(w.phase),
    };
  }
}
