import { AlertAdapter, AlertProvider, AlertSeverity, WeatherAlert } from '../types';
import { normalizeSeverity, parseTimestamp } from '../utils';

export class PirateWeatherAdapter implements AlertAdapter {
  provider: AlertProvider = 'pirateweather';

  canHandle(attributes: Record<string, unknown>): boolean {
    return typeof attributes['attribution'] === 'string'
      && (attributes['attribution'] as string).toLowerCase().includes('pirate weather');
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    const alerts: WeatherAlert[] = [];

    // Single alert: unindexed keys (title, severity, ...)
    // Multiple alerts: indexed keys (title_0, title_1, ...)
    // The integration uses one scheme or the other, never both.
    const hasUnindexed = typeof attributes['title'] === 'string' && attributes['title'] !== '';
    const hasIndexed = typeof attributes['title_0'] === 'string' && attributes['title_0'] !== '';

    if (hasUnindexed && !hasIndexed) {
      const alert = this._parseOne(attributes, '');
      if (alert) alerts.push(alert);
    }

    // Iterate indexed attributes until exhausted
    for (let i = 0; ; i++) {
      const suffix = `_${i}`;
      if (typeof attributes[`title${suffix}`] !== 'string' || attributes[`title${suffix}`] === '') break;
      const alert = this._parseOne(attributes, suffix);
      if (alert) alerts.push(alert);
    }

    return alerts;
  }

  private _parseOne(attributes: Record<string, unknown>, suffix: string): WeatherAlert | null {
    const title = str(attributes[`title${suffix}`]);
    if (!title) return null;

    const rawSeverity = str(attributes[`severity${suffix}`]);
    const severity = normalizeSeverity(rawSeverity) as AlertSeverity;
    const severityLabel = rawSeverity
      ? rawSeverity.charAt(0).toUpperCase() + rawSeverity.slice(1).toLowerCase()
      : severity.charAt(0).toUpperCase() + severity.slice(1);

    // The integration converts Unix timestamps to local ISO 8601 strings
    const sentTs = parseTimestamp(str(attributes[`time${suffix}`]));
    const endsTs = parseTimestamp(str(attributes[`expires${suffix}`]));

    // regions is an array from the API
    const rawRegions = attributes[`regions${suffix}`];
    const areaDesc = Array.isArray(rawRegions)
      ? rawRegions.join(', ')
      : str(rawRegions);

    const uri = str(attributes[`uri${suffix}`]);
    const description = str(attributes[`description${suffix}`]);

    return {
      id: `pirateweather_${title}_${sentTs}`,
      event: title,
      severity,
      severityLabel,
      certainty: '',
      urgency: '',
      sentTs,
      onsetTs: sentTs,
      endsTs,
      description,
      instruction: '',
      url: uri,
      headline: title,
      areaDesc,
      zones: [],
      eventCode: '',
      provider: 'pirateweather',
      phase: '',
      severityInferred: !rawSeverity || normalizeSeverity(rawSeverity) === 'unknown',
      certaintyInferred: false,
    };
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
