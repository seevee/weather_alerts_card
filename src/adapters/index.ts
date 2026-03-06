import { AlertAdapter, AlertProvider } from '../types';
import { NwsAdapter } from './nws';
import { BomAdapter } from './bom';

const adapters: AlertAdapter[] = [new NwsAdapter(), new BomAdapter()];

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
