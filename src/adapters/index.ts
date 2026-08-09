import { AlertAdapter, AlertProvider } from '../types';
import { NwsAdapter } from './nws';
import { BomAdapter } from './bom';
import { DwdAdapter } from './dwd';
import { MeteoSwissAdapter } from './meteoswiss';
import { MeteoAlarmAdapter } from './meteoalarm';
import { PirateWeatherAdapter } from './pirateweather';
import { CapAdapter } from './cap';
import { EcccAdapter } from './eccc';
import { NswRfsAdapter } from './nsw_rfs';
import { NinaAdapter } from './nina';

// CAP comes first so its `incident_platform_version` marker wins detection
// over any upstream-shaped attributes that the integration may surface.
const adapters: AlertAdapter[] = [new CapAdapter(), new NwsAdapter(), new BomAdapter(), new NswRfsAdapter(), new NinaAdapter(), new DwdAdapter(), new MeteoSwissAdapter(), new MeteoAlarmAdapter(), new EcccAdapter(), new PirateWeatherAdapter()];

/** Name-based heuristic patterns for likely alert entities. */
export const ENTITY_NAME_PATTERNS: RegExp[] = [
  /^sensor\..*alerts?$/i,
  /^sensor\..*warnings?$/i,
  /^binary_sensor\.meteoalarm/i,
  /^sensor\.dwd_weather_warnings/i,
  /^sensor\.weather_warnings_at_/i,
  // CAP Alerts per-alert entities. Real entity_ids are
  // `sensor.<device_slug>_cap_alert_<event>_<hash>` because HA prefixes the
  // device slug onto `suggested_object_id` when `_attr_has_entity_name` is
  // True. `cap_alerts_*_count` and `cap_alerts_*_last_updated` diagnostic
  // siblings don't contain `cap_alert_` (singular + underscore), so they're
  // excluded.
  /^sensor\..*cap_alert_/i,
  // NINA warning slots: `binary_sensor.<region>_warning_<n>`, slugged from the
  // entity name HA translated at creation time (German instances get
  // `..._warnung_1`). An idle slot publishes no attributes for `canHandleAny`
  // to recognise, so without this pattern the editor's picker would hide the
  // very entities a user needs to select *before* a warning ever lands.
  /^binary_sensor\..*_warn(?:ing|ung)_\d+$/i,
];

/** Returns true if any adapter recognises the given attributes. */
export function canHandleAny(attributes: Record<string, unknown>): boolean {
  return adapters.some(a => a.canHandle(attributes));
}

/**
 * Every per-incident feed `source` an adapter can auto-collect, paired with the
 * provider that parses it (for labelling the editor's feed picker). Independent
 * of the `provider` *override* — collection by source leaves the adapter to
 * auto-detection so mixed-provider cards (e.g. RFS feed + a BoM sensor) keep
 * routing each entity to its own adapter.
 */
export function knownFeedSources(): { source: string; provider: AlertProvider }[] {
  const out: { source: string; provider: AlertProvider }[] = [];
  for (const a of adapters) {
    for (const source of a.feedSources ?? []) {
      out.push({ source, provider: a.provider });
    }
  }
  return out;
}

/**
 * Providers whose adapters can populate `WeatherAlert.point`. Editor-facing
 * capability derivation (it decides whether to offer the radius control) —
 * never a filter gate: the radius filter tests the alert for a point, so any
 * future point-carrying source works without being listed anywhere.
 */
export function pointCapableProviders(): Set<AlertProvider> {
  return new Set(adapters.filter(a => a.carriesPoint).map(a => a.provider));
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
