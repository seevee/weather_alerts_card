import { AlertAdapter, AlertProvider, AlertSeverity, WeatherAlert } from '../types';
import { normalizeSeverity, parseTimestamp } from '../utils';

/**
 * Adapter for the Home Assistant MSN Weather alert sensor.
 *
 * Expected attributes:
 *   attribution: "Data provided by MSN Weather (Microsoft)"
 *   all_alerts: [
 *     {
 *       title, event, level, significance, severity, status,
 *       start, end, description, safety_guide, source
 *     },
 *     ...
 *   ]
 *
 * MSN exposes the complete alert list as one array. Depending on the MSN
 * Weather integration/version, that array is exposed as `all_alerts` or
 * `alerts`, so both spellings are accepted.
 */
export class MsnAdapter implements AlertAdapter {
  provider: AlertProvider = 'msn';

  canHandle(attributes: Record<string, unknown>): boolean {
    // Attribution is the strongest signal. This is important because the
    // lowercase `alerts` key is also used by other integrations.
    const attribution = str(attributes['attribution']).toLowerCase();
    if (attribution.includes('msn weather')) return true;

    const raw = this._rawAlerts(attributes);
    if (!Array.isArray(raw) || raw.length === 0) return false;

    // Without attribution, require the characteristic MSN record shape rather
    // than merely accepting any `alerts` array (ECCC also uses that key).
    return raw.some(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const alert = value as Record<string, unknown>;
      return typeof alert['title'] === 'string'
        && (typeof alert['event'] === 'string' || typeof alert['level'] === 'string'
          || typeof alert['severity'] === 'string')
        && (typeof alert['start'] === 'string' || typeof alert['end'] === 'string');
    });
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    const raw = this._rawAlerts(attributes);
    if (!Array.isArray(raw)) return [];

    const alerts: WeatherAlert[] = [];
    raw.forEach((value, index) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      const alert = value as Record<string, unknown>;
      const title = str(alert['title']) || str(alert['event']);
      if (!title) return;

      const rawSeverity = str(alert['severity']) || str(alert['level']);
      const severity = normalizeSeverity(rawSeverity) as AlertSeverity;
      const severityLabel = rawSeverity
        ? rawSeverity.charAt(0).toUpperCase() + rawSeverity.slice(1).toLowerCase()
        : severity.charAt(0).toUpperCase() + severity.slice(1);

      const onsetTs = parseTimestamp(str(alert['start']));
      const endsTs = parseTimestamp(str(alert['end']));
      const status = str(alert['status']);

      // MSN does not expose an issuance timestamp in the supplied schema.
      // Keep sentTs at zero rather than pretending that start is the issue time.
      const idBase = [
        str(alert['event']),
        str(alert['start']),
        str(alert['end']),
        str(alert['title']),
        String(index),
      ].join('|');

      alerts.push({
        id: `msn_${idBase}`,
        event: title,
        severity,
        severityLabel,
        certainty: '',
        urgency: '',
        sentTs: 0,
        onsetTs,
        endsTs,
        description: str(alert['description']),
        instruction: str(alert['safety_guide']),
        url: '',
        headline: title,
        areaDesc: str(alert['source']),
        zones: [],
        eventCode: '',
        provider: 'msn',
        phase: status,
        severityInferred: !rawSeverity || severity === 'unknown',
        certaintyInferred: false,
      });
    });

    return alerts;
  }
  private _rawAlerts(attributes: Record<string, unknown>): unknown[] | undefined {
  const allAlerts: unknown = attributes['all_alerts'];
  if (Array.isArray(allAlerts)) return allAlerts as unknown[];

  const alerts: unknown = attributes['alerts'];
  return Array.isArray(alerts) ? alerts as unknown[] : undefined;
}

}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
