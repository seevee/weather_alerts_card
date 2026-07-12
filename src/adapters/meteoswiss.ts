import { AlertAdapter, AlertProvider, AlertSeverity, WeatherAlert } from '../types';
import { parseTimestamp } from '../utils';

// Last-resort fallback when the sensor exposes no per-warning deep link. The
// integration's own `warning_links` are the primary source (mapped per-alert
// in parseAlerts); this constant is only reached when that array is empty,
// which in practice happens only at zero warnings (no alerts emitted). Points
// at the interactive severe-weather warnings map (the English-host mirror of
// meteoschweiz.admin.ch/.../gefahren.html) with the severe-weather tab
// pre-selected. It is a client-routed SPA, so the base path resolves (200) but
// only renders in a real browser.
const METEOSWISS_WARNINGS_URL =
  'https://www.meteoswiss.admin.ch/services-and-publications/applications/hazards.html#tab=severe-weather-map&weather-tab=all';

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
    const links = arr('warning_links');

    // `warning_links` is a flat, warning-ordered array carrying a consistent
    // number of links per warning (observed: 2/warning, lead link = the
    // type-specific natural-hazards page). Even-divide grouping picks each
    // warning's lead link for any consistent N:1 ratio; otherwise fall back to
    // the first real link, then the overview constant.
    const linkFor = (i: number): string => {
      if (types.length > 0 && links.length > 0 && links.length % types.length === 0) {
        return String(links[i * (links.length / types.length)]);
      }
      if (links.length > 0) return String(links[0]);
      return METEOSWISS_WARNINGS_URL;
    };

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
        url: linkFor(i),
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
