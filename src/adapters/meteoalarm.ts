import { AlertAdapter, AlertProvider, AlertSeverity, WeatherAlert } from '../types';
import { normalizeSeverity, parseTimestamp } from '../utils';

// MeteoAlarm awareness_level format: "2; yellow; Moderate"
// Level 2 = Yellow (Moderate), 3 = Orange (Severe), 4 = Red (Extreme)
function awarenessLevelToSeverity(awarenessLevel: string | undefined): AlertSeverity | undefined {
  if (!awarenessLevel || typeof awarenessLevel !== 'string') return undefined;
  const levelId = parseInt(awarenessLevel.split(';')[0].trim(), 10);
  if (levelId >= 4) return 'extreme';
  if (levelId === 3) return 'severe';
  if (levelId === 2) return 'moderate';
  if (levelId === 1) return 'minor';
  return undefined;
}

// Extract human-readable label from awareness_level third segment (e.g. "Severe" from "3; orange; Severe")
function awarenessLevelLabel(awarenessLevel: string | undefined): string {
  if (!awarenessLevel || typeof awarenessLevel !== 'string') return '';
  const parts = awarenessLevel.split(';');
  return parts.length >= 3 ? parts[2].trim() : '';
}

// MeteoAlarm awareness_type format: "1; Wind"
// Extract the human-readable type name after the semicolon
function awarenessTypeLabel(awarenessType: string | undefined): string {
  if (!awarenessType || typeof awarenessType !== 'string') return '';
  const parts = awarenessType.split(';');
  return parts.length > 1 ? parts.slice(1).join(';').trim() : '';
}

export class MeteoAlarmAdapter implements AlertAdapter {
  provider: AlertProvider = 'meteoalarm';

  canHandle(attributes: Record<string, unknown>): boolean {
    // Primary signal: MeteoAlarm attribution string
    if (typeof attributes['attribution'] === 'string'
      && (attributes['attribution'] as string).toLowerCase().includes('meteoalarm')) {
      return true;
    }
    // Secondary: presence of awareness_level (fairly unique to MeteoAlarm)
    return typeof attributes['awareness_level'] === 'string'
      && typeof attributes['awareness_type'] === 'string';
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    // MeteoAlarm binary_sensor exposes a single alert as flat attributes.
    // If no event/headline data, there's no active alert.
    const event = str(attributes['event']);
    const headline = str(attributes['headline']);
    if (!event && !headline) return [];

    const awarenessLevel = str(attributes['awareness_level']);
    const severity = awarenessLevelToSeverity(awarenessLevel)
      || normalizeSeverity(str(attributes['severity'])) as AlertSeverity;

    // Label cascade: awareness_level third segment → raw severity attr → title-cased enum
    const severityLabel = awarenessLevelLabel(awarenessLevel)
      || str(attributes['severity'])
      || severity.charAt(0).toUpperCase() + severity.slice(1);

    const onsetTs = parseTimestamp(str(attributes['onset']) || str(attributes['effective']));
    const endsTs = parseTimestamp(str(attributes['expires']));
    const sentTs = parseTimestamp(str(attributes['effective']));

    const typeLabel = awarenessTypeLabel(str(attributes['awareness_type']));
    const eventName = event || typeLabel || headline;

    // Severity is raw if awareness_level or raw severity attribute provided a value
    const severityInferred = !awarenessLevelToSeverity(awarenessLevel) && !str(attributes['severity']);

    return [{
      id: `meteoalarm_${eventName}_${onsetTs}`,
      event: eventName,
      severity,
      severityLabel,
      certainty: str(attributes['certainty']),
      urgency: str(attributes['urgency']),
      sentTs,
      onsetTs: onsetTs || sentTs,
      endsTs,
      description: str(attributes['description']),
      instruction: str(attributes['instruction']),
      url: '',
      headline: headline || eventName,
      areaDesc: str(attributes['senderName']),
      zones: [],
      eventCode: '',
      provider: 'meteoalarm',
      iconHint: typeLabel,
      phase: '',
      severityInferred,
      certaintyInferred: false,
    }];
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
