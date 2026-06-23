import { AlertAdapter, AlertProvider, AlertSeverity, WeatherAlert } from '../types';
import { parseTimestamp } from '../utils';

// MeteoSwiss has no per-alert deep link in the aggregate sensor, so we point
// at the official warnings overview page (same approach as DWD).
const METEOSWISS_WARNINGS_URL =
  'https://www.meteoswiss.admin.ch/services-and-publications/service/warnings.html';

// Map the integration's numeric WarningLevel (0-5) to the card's severity tier.
// Mirrors MeteoAlarm's color semantics (the other European provider): red/
// dark-red → extreme, orange → severe, yellow → moderate, green → minor.
function mapSeverity(level: number): { severity: AlertSeverity; label: string } {
  switch (level) {
    case 5: return { severity: 'extreme', label: 'Extreme' };
    case 4: return { severity: 'extreme', label: 'Extreme' };
    case 3: return { severity: 'severe', label: 'Severe' };
    case 2: return { severity: 'moderate', label: 'Moderate' };
    case 1: return { severity: 'minor', label: 'Minor' };
    case 0: return { severity: 'unknown', label: 'Unknown' }; // skipped before here
    default: return { severity: 'unknown', label: 'Unknown' };
  }
}

export class MeteoSwissAdapter implements AlertAdapter {
  provider: AlertProvider = 'meteoswiss';

  canHandle(attributes: Record<string, unknown>): boolean {
    // The parallel-array triple is a distinctive fingerprint present even at
    // zero warnings (the integration returns empty arrays, not None). No
    // attribution fallback: the same "Source: MeteoSwiss" attribution is
    // published by the integration's weather.* entities, which carry none of
    // these arrays — checking attribution would falsely claim those.
    return Array.isArray(attributes['warning_types'])
      && Array.isArray(attributes['warning_levels_numeric'])
      && Array.isArray(attributes['warning_valid_from']);
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    const arr = (key: string): unknown[] =>
      Array.isArray(attributes[key]) ? (attributes[key] as unknown[]) : [];

    const types = arr('warning_types');
    const levels = arr('warning_levels');
    const levelsNumeric = arr('warning_levels_numeric');
    const validFrom = arr('warning_valid_from');
    const validTo = arr('warning_valid_to');
    const texts = arr('warning_texts');

    const alerts: WeatherAlert[] = [];

    for (let i = 0; i < types.length; i++) {
      const level = Number(levelsNumeric[i]);
      // Skip level 0 (no danger) and non-numeric levels.
      if (level === 0) continue;

      const event = String(types[i] ?? '');
      const { severity, label } = mapSeverity(level);
      const severityLabel = String(levels[i] ?? '') || label;

      const onsetTs = validFrom[i] != null ? parseTimestamp(String(validFrom[i])) : 0;
      const endsTs = validTo[i] != null ? parseTimestamp(String(validTo[i])) : 0;

      alerts.push({
        id: `meteoswiss_${event}_${onsetTs}`,
        event,
        severity,
        severityLabel,
        certainty: '',
        urgency: '',
        sentTs: 0,
        onsetTs,
        endsTs,
        description: String(texts[i] ?? ''),
        instruction: '',
        url: METEOSWISS_WARNINGS_URL,
        headline: '',
        areaDesc: '',
        zones: [],
        eventCode: event,
        provider: 'meteoswiss',
        phase: '',
        severityInferred: false,
        certaintyInferred: false,
        iconHint: event,
      });
    }

    return alerts;
  }
}
