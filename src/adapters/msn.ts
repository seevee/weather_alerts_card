import { AlertAdapter, AlertProvider, AlertSeverity, WeatherAlert } from '../types';
import { normalizeSeverity, parseTimestamp } from '../utils';

// The integration passes MSN's `credit` through as `source`: the agency that
// issued the alert. WeatherAlert has no field for an issuer, so it is appended
// to the description the way NINA's sender line is. Double-newline separation
// survives reflowAlertText.
const SOURCE_LABEL = 'Source';

// `severity` and `level` are MSN's display text, in the language the
// integration is set to, so they only normalise on an English setup.
// `significance` is the code underneath: MSN maps every national service onto
// R / O / Y / B (red, orange, yellow, blue). W / A / S (warning, watch,
// statement) are the older NWS-style codes, ranked as the NWS adapter ranks
// them: a warning is severe, not extreme.
const SIGNIFICANCE_SEVERITY: Record<string, AlertSeverity> = {
  R: 'extreme', O: 'severe', Y: 'moderate', B: 'minor',
  W: 'severe', A: 'moderate', S: 'minor',
};

function buildDescription(description: string, source: string): string {
  if (!source) return description;
  const attribution = `${SOURCE_LABEL}: ${source}`;
  return description ? `${description}\n\n${attribution}` : attribution;
}

/**
 * Adapter for the MSN Weather integration (42bios/ha-msn-weather).
 *
 * Two entities carry the same alert list under different keys: the alerts
 * count sensor as `alerts`, the "alert active" binary sensor as `all_alerts`.
 *
 *   attribution: "Data provided by MSN Weather (Microsoft)"
 *   alerts | all_alerts: [
 *     {
 *       title, event, level, significance, severity, status,
 *       start, end, description, safety_guide, source
 *     },
 *     ...
 *   ]
 */
export class MsnAdapter implements AlertAdapter {
  provider: AlertProvider = 'msn';

  // MSN republishes the national services' alerts, so in a dedup group the
  // issuer's own copy is the one kept.
  relay = true;

  // Every MSN Weather entity carries the attribution (temperature, pollen...),
  // so it only counts beside the alert list. The list alone is not enough
  // either: the ECCC fork also uses a lowercase `alerts` key.
  canHandle(attributes: Record<string, unknown>): boolean {
    return str(attributes['attribution']).toLowerCase().includes('msn weather')
      && this._rawAlerts(attributes) !== undefined;
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    const raw = this._rawAlerts(attributes);
    if (!raw) return [];

    const alerts: WeatherAlert[] = [];
    raw.forEach(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      const alert = value as Record<string, unknown>;
      const title = str(alert['title']) || str(alert['event']);
      if (!title) return;

      const rawSeverity = str(alert['severity']) || str(alert['level']);
      const severity = SIGNIFICANCE_SEVERITY[str(alert['significance']).toUpperCase()]
        ?? normalizeSeverity(rawSeverity) as AlertSeverity;
      const severityLabel = rawSeverity
        ? rawSeverity.charAt(0).toUpperCase() + rawSeverity.slice(1).toLowerCase()
        : severity.charAt(0).toUpperCase() + severity.slice(1);

      const onsetTs = parseTimestamp(str(alert['start']));
      const endsTs = parseTimestamp(str(alert['end']));
      const description = str(alert['description']);
      const source = str(alert['source']);

      // No array index in the id: it shifts when an earlier alert clears, and
      // the id keys the expanded state and the dismissal list.
      const idBase = [
        str(alert['event']),
        str(alert['start']),
        str(alert['end']),
        str(alert['title']),
      ].join('|');

      alerts.push({
        id: `msn_${idBase}`,
        event: title,
        severity,
        severityLabel,
        certainty: '',
        urgency: '',
        // MSN publishes no issue time, and `start` is not one.
        sentTs: 0,
        onsetTs,
        endsTs,
        description: buildDescription(description, source),
        // The body as MSN sent it, without the source line added above, so the
        // cross-provider text match still finds the issuer's copy.
        matchText: description,
        instruction: str(alert['safety_guide']),
        url: '',
        headline: title,
        areaDesc: '',
        zones: [],
        eventCode: '',
        provider: 'msn',
        // `status` ("Upcoming", "Ongoing") is not a CAP phase. `phase` is in the
        // dismissal signature, so carrying it would bring a dismissed alert
        // back the moment it starts.
        phase: '',
        severityInferred: severity === 'unknown',
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
