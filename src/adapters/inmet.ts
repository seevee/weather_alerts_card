import { AlertAdapter, AlertProvider, AlertSeverity, InmetAlert, WeatherAlert } from '../types';
import { extractPoint, parseTimestamp } from '../utils';

const INMET_SOURCE = 'inmet';

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function stringish(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function textList(v: unknown): string {
  if (Array.isArray(v)) {
    return v
      .filter(item => typeof item === 'string' && item.trim() !== '')
      .join('\n\n');
  }
  return str(v);
}

function timestamp(v: unknown): number {
  const s = str(v).trim();
  if (!s) return 0;
  return parseTimestamp(/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(s) ? s : `${s}-03:00`);
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function severityFromColor(color: string): AlertSeverity | undefined {
  const c = color.trim().toLowerCase();
  if (!c) return undefined;
  if (c.includes('vermel') || c === 'red' || c === '#ff0000') return 'extreme';
  if (c.includes('laranja') || c === 'orange' || c === '#f96602') return 'severe';
  if (c.includes('amarel') || c === 'yellow' || c === '#fffe00') return 'moderate';
  return undefined;
}

function severityAndLabel(alert: InmetAlert): { severity: AlertSeverity; label: string; inferred: boolean } {
  const rawSeverity = str(alert.severity);
  const s = rawSeverity.toLowerCase();
  if (s.includes('grande')) return { severity: 'extreme', label: rawSeverity, inferred: false };
  if (s.includes('potencial')) return { severity: 'moderate', label: rawSeverity, inferred: false };
  if (s === 'perigo' || s.includes('perigo')) return { severity: 'severe', label: rawSeverity, inferred: false };

  const colorSeverity = severityFromColor(str(alert.color));
  if (colorSeverity) {
    return { severity: colorSeverity, label: rawSeverity || titleCase(str(alert.color)), inferred: true };
  }

  return { severity: 'unknown', label: rawSeverity || 'Unknown', inferred: true };
}

export class InmetAdapter implements AlertAdapter {
  provider: AlertProvider = 'inmet';

  feedSources = [INMET_SOURCE];
  carriesPoint = true;
  stableIds = true;

  canHandle(attributes: Record<string, unknown>): boolean {
    return attributes['source'] === INMET_SOURCE
      && stringish(attributes['alert_id']) !== ''
      && typeof attributes['description'] === 'string'
      && typeof attributes['severity'] === 'string';
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    if (!this.canHandle(attributes)) return [];
    const alert = attributes as InmetAlert;
    const alertId = stringish(alert.alert_id);
    const event = str(alert.description) || 'INMET Alert';
    const { severity, label: severityLabel, inferred } = severityAndLabel(alert);
    const sentTs = timestamp(alert.updated) || timestamp(alert.start_date);
    const onsetTs = timestamp(alert.start_date) || sentTs;
    const endsTs = timestamp(alert.end_date);
    const point = extractPoint(alert.latitude, alert.longitude);
    const phase = alert.finished ? 'Final' : alert.updated ? 'Update' : alert.future ? 'Future' : '';

    return [{
      id: alertId || `inmet_${slug(event)}_${onsetTs}`,
      event,
      severity,
      severityLabel,
      certainty: '',
      urgency: '',
      sentTs,
      onsetTs,
      endsTs,
      description: textList(alert.risks),
      instruction: textList(alert.instructions),
      url: str(alert.url),
      headline: event,
      areaDesc: 'Brazil',
      zones: [],
      eventCode: stringish(alert.sequence),
      provider: 'inmet',
      phase,
      severityInferred: inferred,
      certaintyInferred: false,
      providerIcon: str(attributes['icon']) || 'mdi:alert',
      colorHint: str(alert.color),
      ...(point !== undefined && { point }),
    }];
  }
}
