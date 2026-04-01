import { AlertAdapter, AlertProvider } from '../types';
import { NwsAdapter } from './nws';
import { BomAdapter } from './bom';
import { DwdAdapter } from './dwd';
import { MeteoAlarmAdapter } from './meteoalarm';
import { PirateWeatherAdapter } from './pirateweather';

const adapters: AlertAdapter[] = [new NwsAdapter(), new BomAdapter(), new DwdAdapter(), new MeteoAlarmAdapter(), new PirateWeatherAdapter()];

/** Name-based heuristic patterns for likely alert entities. */
export const ENTITY_NAME_PATTERNS: RegExp[] = [
  /^sensor\..*alerts?$/i,
  /^sensor\..*warnings?$/i,
  /^binary_sensor\.meteoalarm/i,
  /^sensor\.dwd_weather_warnings/i,
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
  return adapters[0];
}
