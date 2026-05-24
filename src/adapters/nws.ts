import { AlertAdapter, AlertProvider, AlertSeverity, NwsAlert, WeatherAlert } from '../types';
import { normalizeSeverity, parseTimestamp } from '../utils';

function extractZoneCode(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1].toUpperCase();
}

function collectZones(alert: NwsAlert): string[] {
  const zones: string[] = [];
  // Guard element types: a single non-string entry (malformed payload from a
  // future/buggy integration version) must not throw and blank the whole card.
  if (Array.isArray(alert.AffectedZones)) {
    for (const z of alert.AffectedZones) {
      if (typeof z !== 'string' || !z) continue;
      zones.push(extractZoneCode(z));
    }
  }
  if (Array.isArray(alert.Geocode?.UGC)) {
    for (const code of alert.Geocode!.UGC!) {
      if (typeof code !== 'string' || !code) continue;
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
    // Skip non-object entries so a single malformed element can't crash
    // normalization of the rest of the array.
    return (raw as unknown[])
      .filter((a): a is NwsAlert => typeof a === 'object' && a !== null)
      .map(a => this._normalize(a));
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
      eventCode: a.NWSCode || '',
      provider: 'nws',
      phase: '',
      severityInferred: !a.Severity || normalizeSeverity(a.Severity) === 'unknown',
      certaintyInferred: false,
    };
  }
}
