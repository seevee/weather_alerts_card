import { AlertAdapter, AlertProvider, AlertSeverity, NswRfsIncident, WeatherAlert } from '../types';
import { parseTimestamp } from '../utils';

// Public overview page (Fires Near Me NSW). The geo_location entity carries no
// per-incident deep link, so v1 uses this single static URL for every incident.
const RFS_OVERVIEW_URL = 'https://www.fire.nsw.gov.au/firesnearme/';

// `category` is the official Australian Warning System ladder. Match
// case-insensitively on substring — defensive against minor wording variance.
// severityInferred is set true only for the empty/unrecognised fallthrough.
function rfsSeverityAndLabel(category: string): { severity: AlertSeverity; label: string; inferred: boolean } {
  const c = category.toLowerCase();
  if (c.includes('emergency warning')) return { severity: 'extreme', label: 'Emergency Warning', inferred: false };
  if (c.includes('watch and act')) return { severity: 'severe', label: 'Watch and Act', inferred: false };
  if (c.includes('advice')) return { severity: 'moderate', label: 'Advice', inferred: false };
  if (c.includes('planned burn')) return { severity: 'minor', label: 'Planned Burn', inferred: false };
  return { severity: 'unknown', label: titleCase(category) || 'Unknown', inferred: true };
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Render size as "<n> ha" when it is (or reads as) a bare number; otherwise
// pass the provider string through verbatim (it may already carry a unit).
function formatSize(size: string | number | undefined): string {
  if (size === undefined || size === null || size === '') return '';
  if (typeof size === 'number') return `${size} ha`;
  const trimmed = size.trim();
  return /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed} ha` : trimmed;
}

// Fields with no first-class WeatherAlert home, synthesised into the detail
// description as `Label: value` lines. Double-newline separation survives
// reflowAlertText (which merges single-newline lines within a paragraph).
function buildDescription(inc: NswRfsIncident): string {
  const lines: string[] = [];
  const push = (label: string, value: string) => {
    if (value) lines.push(`${label}: ${value}`);
  };
  push('Status', str(inc.status));
  push('Type', str(inc.type));
  push('Location', str(inc.location));
  push('Council area', str(inc.council_area));
  push('Size', formatSize(inc.size));
  push('Responsible agency', str(inc.responsible_agency));
  return lines.join('\n\n');
}

export class NswRfsAdapter implements AlertAdapter {
  provider: AlertProvider = 'nsw_rfs';

  canHandle(attributes: Record<string, unknown>): boolean {
    return typeof attributes['category'] === 'string'
      && typeof attributes['status'] === 'string'
      && typeof attributes['responsible_agency'] === 'string';
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    // The attributes object *is* the incident (one geo_location entity = one
    // incident). Guard defensively in parity with canHandle.
    if (!this.canHandle(attributes)) return [];
    return [this._normalize(attributes as NswRfsIncident)];
  }

  private _normalize(inc: NswRfsIncident): WeatherAlert {
    const sentTs = parseTimestamp(inc.publication_date);
    const { severity, label: severityLabel, inferred } = rfsSeverityAndLabel(str(inc.category));

    const location = str(inc.location);
    const type = str(inc.type);
    const event = type ? titleCase(type) : (location || 'Fire Incident');

    return {
      id: str(inc.external_id) || `nsw_rfs_${slug(location)}_${sentTs}`,
      event,
      severity,
      severityLabel,
      certainty: '',
      urgency: '',
      sentTs,
      onsetTs: sentTs, // every incident is already observed/ongoing — mirror sent so progress reports active
      endsTs: 0,       // no real expiry → hasEndTime:false, honest "ongoing" state
      description: buildDescription(inc),
      instruction: '',
      url: RFS_OVERVIEW_URL,
      headline: location || event,
      areaDesc: str(inc.council_area) || location || 'NSW',
      zones: [],
      eventCode: '',
      provider: 'nsw_rfs',
      phase: '',
      severityInferred: inferred,
      certaintyInferred: false,
      providerIcon: 'mdi:fire', // all RFS incident types are fire-related; bypasses the icon dictionary
    };
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
