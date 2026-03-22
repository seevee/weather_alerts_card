import { AlertAdapter, AlertProvider, AlertSeverity, NwsAlert, WeatherAlert } from '../types';
import { normalizeSeverity, parseTimestamp } from '../utils';

function extractZoneCode(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1].toUpperCase();
}

function collectZones(alert: NwsAlert): string[] {
  const zones: string[] = [];
  if (alert.AffectedZones) {
    for (const z of alert.AffectedZones) {
      zones.push(extractZoneCode(z));
    }
  }
  if (alert.Geocode?.UGC) {
    for (const code of alert.Geocode.UGC) {
      const upper = code.toUpperCase();
      if (!zones.includes(upper)) zones.push(upper);
    }
  }
  return zones;
}

export class NwsAdapter implements AlertAdapter {
  provider: AlertProvider = 'nws';

  canHandle(attributes: Record<string, unknown>): boolean {
    const alerts = attributes['Alerts'];
    if (!Array.isArray(alerts)) return false;
    if (alerts.length === 0) return true; // empty NWS array is still NWS
    const first = alerts[0];
    return typeof first === 'object' && first !== null && 'Event' in first && 'Severity' in first;
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    const raw = attributes['Alerts'];
    if (!Array.isArray(raw)) return [];
    return (raw as NwsAlert[]).map(a => this._normalize(a));
  }

  private _normalize(a: NwsAlert): WeatherAlert {
    const severity = normalizeSeverity(a.Severity) as AlertSeverity;
    return {
      id: a.ID,
      event: a.Event || 'Unknown',
      severity,
      severityLabel: a.Severity && normalizeSeverity(a.Severity) !== 'unknown'
        ? a.Severity
        : severity.charAt(0).toUpperCase() + severity.slice(1),
      certainty: a.Certainty || '',
      urgency: a.Urgency || '',
      sentTs: parseTimestamp(a.Sent),
      onsetTs: parseTimestamp(a.Onset),
      endsTs: parseTimestamp(a.Ends) || parseTimestamp(a.Expires),
      description: a.Description || '',
      instruction: a.Instruction || '',
      url: a.URL || '',
      headline: a.Headline || '',
      areaDesc: a.AreaDesc || a.AreasAffected || '',
      zones: collectZones(a),
      provider: 'nws',
      phase: '',
    };
  }
}
