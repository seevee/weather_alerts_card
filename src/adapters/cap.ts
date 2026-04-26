import { AlertAdapter, AlertProvider, AlertSeverity, WeatherAlert } from '../types';
import { normalizeSeverity, parseTimestamp } from '../utils';

// CAP Alerts integration sets one entity per active alert. Each entity's
// extra_state_attributes is a flat dict of CAP 1.2 fields plus an
// `incident_platform_version` marker (added unconditionally in the
// integration's sensor.py). Detection keys off that marker; normalisation
// is already done upstream so this adapter is a thin passthrough.
export class CapAdapter implements AlertAdapter {
  provider: AlertProvider = 'cap';

  canHandle(attributes: Record<string, unknown>): boolean {
    return typeof attributes['incident_platform_version'] === 'string'
      && typeof attributes['id'] === 'string';
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    const id = str(attributes['id']);
    if (!id) return [];

    const event = str(attributes['event']);
    const rawSeverity = str(attributes['severity']);
    const normalizedSev = str(attributes['severity_normalized']);
    const severity = (normalizedSev
      ? normalizeSeverity(normalizedSev)
      : normalizeSeverity(rawSeverity)) as AlertSeverity;

    const labelSource = rawSeverity || normalizedSev;
    const severityLabel = labelSource
      ? labelSource.charAt(0).toUpperCase() + labelSource.slice(1).toLowerCase()
      : severity.charAt(0).toUpperCase() + severity.slice(1);

    const sentTs = parseTimestamp(str(attributes['sent']) || str(attributes['effective']));
    const onsetTs = parseTimestamp(str(attributes['onset'])) || sentTs;
    const endsTs = parseTimestamp(str(attributes['ends'])) || parseTimestamp(str(attributes['expires']));

    return [{
      id,
      event: event || 'Unknown',
      severity,
      severityLabel,
      certainty: str(attributes['certainty']),
      urgency: str(attributes['urgency']),
      sentTs,
      onsetTs,
      endsTs,
      description: str(attributes['description']),
      instruction: str(attributes['instruction']),
      url: str(attributes['url']) || str(attributes['web']),
      headline: str(attributes['headline']),
      areaDesc: str(attributes['area_desc']),
      zones: collectZones(attributes),
      eventCode: str(attributes['event_code_nws']) || str(attributes['event_code_same']),
      provider: 'cap',
      phase: phaseLabel(str(attributes['phase'])),
      severityInferred: !rawSeverity && !normalizedSev,
      certaintyInferred: false,
    }];
  }
}

const PHASE_LABELS: Record<string, string> = {
  new: 'New',
  update: 'Update',
  cancel: 'Cancel',
  expired: 'Expired',
};

function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase.toLowerCase()] || '';
}

function collectZones(attributes: Record<string, unknown>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of ['affected_zones', 'geocode_ugc', 'geocode_same']) {
    const raw = attributes[key];
    if (!Array.isArray(raw)) continue;
    for (const z of raw) {
      if (typeof z !== 'string') continue;
      const upper = z.toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        out.push(upper);
      }
    }
  }
  return out;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
