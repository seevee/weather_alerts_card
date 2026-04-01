import { AlertAdapter, AlertProvider, AlertSeverity, DwdWarning, WeatherAlert } from '../types';
import { parseTimestamp } from '../utils';

const DWD_WARNINGS_URL = 'https://www.dwd.de/DE/wetter/warnungen_gemeinden/warnWetter_node.html';

// Map DWD color hex to severity as fallback when level is absent or unrecognized
const COLOR_SEVERITY: Record<string, { severity: AlertSeverity; label: string }> = {
  '#880e4f': { severity: 'extreme', label: 'Extreme' },
  '#ff0000': { severity: 'severe', label: 'Severe' },
  '#ff9900': { severity: 'moderate', label: 'Moderate' },
  '#ffff00': { severity: 'minor', label: 'Minor' },
};

function mapSeverity(level: unknown, color: unknown): { severity: AlertSeverity; label: string } {
  if (typeof level === 'number') {
    switch (level) {
      case 4: return { severity: 'extreme', label: 'Extreme' };
      case 3: return { severity: 'severe', label: 'Severe' };
      case 2: return { severity: 'moderate', label: 'Moderate' };
      case 1: return { severity: 'minor', label: 'Minor' };
      case 0: return { severity: 'unknown', label: 'Unknown' }; // should be filtered before here
    }
  }
  // Fallback to color hex
  if (typeof color === 'string') {
    const match = COLOR_SEVERITY[color.toLowerCase()];
    if (match) return match;
  }
  return { severity: 'unknown', label: 'Unknown' };
}

function isDwdWarningObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null
    && typeof (obj as Record<string, unknown>)['level'] === 'number'
    && typeof (obj as Record<string, unknown>)['color'] === 'string';
}

export class DwdAdapter implements AlertAdapter {
  provider: AlertProvider = 'dwd';

  canHandle(attributes: Record<string, unknown>): boolean {
    if (typeof attributes['warning_count'] !== 'number') return false;
    if (typeof attributes['region_name'] !== 'string') return false;

    const count = attributes['warning_count'] as number;
    if (count > 0) {
      return isDwdWarningObject(attributes['warning_1']);
    }
    // Zero warnings — warning_count (number) + region_name (string) is sufficient
    return true;
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    const count = typeof attributes['warning_count'] === 'number'
      ? (attributes['warning_count'] as number) : 0;
    if (count <= 0) return [];

    const regionName = typeof attributes['region_name'] === 'string'
      ? (attributes['region_name'] as string) : '';
    const alerts: WeatherAlert[] = [];

    for (let i = 1; i <= count; i++) {
      const raw = attributes[`warning_${i}`];
      if (!raw || typeof raw !== 'object') continue;

      const w = raw as Partial<DwdWarning>;
      const level = typeof w.level === 'number' ? w.level : undefined;

      // Skip level 0 (no warning)
      if (level === 0) continue;

      const { severity, label: severityLabel } = mapSeverity(level, w.color);
      const onsetTs = parseTimestamp(w.start_time);
      const endsTs = parseTimestamp(w.end_time);
      const eventCode = typeof w.event_code === 'number' ? String(w.event_code) : '';
      const event = typeof w.event === 'string' ? w.event : '';

      alerts.push({
        id: `dwd_${eventCode || event}_${onsetTs}`,
        event,
        severity,
        severityLabel,
        certainty: '',
        urgency: '',
        sentTs: 0,
        onsetTs,
        endsTs,
        description: typeof w.description === 'string' ? w.description : '',
        instruction: typeof w.instruction === 'string' ? w.instruction : '',
        url: DWD_WARNINGS_URL,
        headline: typeof w.headline === 'string' ? w.headline : '',
        areaDesc: regionName,
        zones: [],
        eventCode,
        provider: 'dwd',
        phase: '',
        severityInferred: false,
        certaintyInferred: false,
      });
    }

    return alerts;
  }
}
