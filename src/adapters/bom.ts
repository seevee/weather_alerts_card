import { AlertAdapter, AlertProvider, AlertSeverity, BomWarning, WeatherAlert } from '../types';
import { parseTimestamp } from '../utils';

// Parse severity and human-readable label from the title first (most specific),
// then type, then warning_group_type.
// BoM titles embed severity: "Major Flood Warning", "Minor Flood Warning",
// "Moderate Flood Warning", "Severe Thunderstorm Warning", etc.
function bomSeverityAndLabel(title: string, type: string, groupType: string): { severity: AlertSeverity; label: string } {
  const t = title.toLowerCase();

  // Title-based — most reliable since BoM embeds severity in the warning name
  if (t.includes('extreme') || t.includes('tropical cyclone')) {
    return { severity: 'extreme', label: t.includes('extreme') ? 'Extreme' : 'Extreme' };
  }
  if (t.includes('severe')) return { severity: 'severe', label: 'Severe' };
  if (t.includes('major')) return { severity: 'severe', label: 'Major' };
  if (t.includes('moderate')) return { severity: 'moderate', label: 'Moderate' };
  if (t.includes('minor') || t.includes('initial')) return { severity: 'minor', label: 'Minor' };

  // Fall back to type field
  const ty = type.toLowerCase();
  if (ty.includes('tropical_cyclone')) return { severity: 'extreme', label: 'Extreme' };
  if (ty.includes('severe') || ty.includes('fire_weather')) return { severity: 'severe', label: 'Severe' };

  // Fall back to warning_group_type
  const gtLabel = groupType.charAt(0).toUpperCase() + groupType.slice(1);
  if (groupType === 'major') return { severity: 'moderate', label: gtLabel };
  return { severity: 'minor', label: gtLabel };
}

function bomTitle(warning: BomWarning): string {
  return warning.title || warning.short_title || warning.type.replace(/_/g, ' ');
}

function bomUrl(warning: BomWarning): string {
  // Direct link: https://www.bom.gov.au/warning/{type-hyphenated}/{product_code}
  // Product code is the id with the area_id prefix stripped (e.g. NSW_FL049_IDN36503 → IDN36503)
  if (warning.area_id && warning.id.startsWith(warning.area_id + '_')) {
    const productCode = warning.id.slice(warning.area_id.length + 1);
    const typePath = warning.type.replace(/_/g, '-');
    return `https://www.bom.gov.au/warning/${typePath}/${productCode}`;
  }
  return 'https://www.bom.gov.au/weather-and-climate/warnings-and-alerts';
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

    const { severity, label: severityLabel } = bomSeverityAndLabel(title, w.type, w.warning_group_type);

    return {
      id: w.id,
      event: title,
      severity,
      severityLabel,
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
      zones: w.area_id ? [w.area_id.toUpperCase()] : [],
      provider: 'bom',
      phase: bomPhaseLabel(w.phase),
    };
  }
}
