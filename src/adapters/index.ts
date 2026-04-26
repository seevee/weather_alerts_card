import { AlertAdapter, AlertProvider } from '../types';
import { NwsAdapter } from './nws';
import { BomAdapter } from './bom';
import { DwdAdapter } from './dwd';
import { MeteoAlarmAdapter } from './meteoalarm';
import { PirateWeatherAdapter } from './pirateweather';
import { CapAdapter } from './cap';

// CAP comes first so its `incident_platform_version` marker wins detection
// over any upstream-shaped attributes that the integration may surface.
const adapters: AlertAdapter[] = [new CapAdapter(), new NwsAdapter(), new BomAdapter(), new DwdAdapter(), new MeteoAlarmAdapter(), new PirateWeatherAdapter()];

/** Name-based heuristic patterns for likely alert entities. */
export const ENTITY_NAME_PATTERNS: RegExp[] = [
  /^sensor\..*alerts?$/i,
  /^sensor\..*warnings?$/i,
  /^binary_sensor\.meteoalarm/i,
  /^sensor\.dwd_weather_warnings/i,
  // CAP Alerts per-alert entities. Real entity_ids are
  // `sensor.<device_slug>_cap_alert_<event>_<hash>` because HA prefixes the
  // device slug onto `suggested_object_id` when `_attr_has_entity_name` is
  // True. `cap_alerts_*_count` and `cap_alerts_*_last_updated` diagnostic
  // siblings don't contain `cap_alert_` (singular + underscore), so they're
  // excluded.
  /^sensor\..*cap_alert_/i,
];

/** Returns true if any adapter recognises the given attributes. */
export function canHandleAny(attributes: Record<string, unknown>): boolean {
  return adapters.some(a => a.canHandle(attributes));
}

export function getAdapter(
  provider: AlertProvider | undefined,
  attributes: Record<string, unknown>,
): AlertAdapter {
  // Explicit provider selection
  if (provider) {
    const match = adapters.find(a => a.provider === provider);
    if (match) return match;
  }
  // Auto-detection
  for (const adapter of adapters) {
    if (adapter.canHandle(attributes)) return adapter;
  }
  // Default to NWS for backwards compatibility
  return adapters.find(a => a.provider === 'nws') ?? adapters[0];
}
