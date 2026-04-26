import type { Connection } from 'home-assistant-js-websocket';
import { HomeAssistant, EntityRegistryDisplayEntry } from './types';
import { canHandleAny } from './adapters';

/**
 * Returns entity IDs of per-alert sensors that belong to the given device.
 * Filters by attribute shape (any adapter's `canHandle`) rather than
 * entity_id prefix — the CAP Alerts integration produces ids of the form
 * `sensor.<device_slug>_cap_alert_<event>_<hash>`, so a prefix filter would
 * miss them. Diagnostic siblings (count, last_updated) carry no recognised
 * alert attributes and are skipped naturally.
 *
 * Reads from `registryEntries` when provided (the card caches a live copy
 * via the WS `entity_registry_updated` subscription) and falls back to
 * `hass.entities` when the subscription has not delivered yet.
 *
 * @internal exported for testing
 */
export function resolveDeviceAlertEntities(
  hass: HomeAssistant,
  deviceId: string,
  registryEntries?: EntityRegistryDisplayEntry[] | null,
): string[] {
  const entries: EntityRegistryDisplayEntry[] | null = registryEntries
    ?? (hass.entities ? Object.values(hass.entities) : null);
  if (!entries) return [];
  const result: string[] = [];
  for (const entry of entries) {
    if (!entry || entry.device_id !== deviceId) continue;
    const id = entry.entity_id;
    if (!id) continue;
    const state = hass.states[id];
    if (!state || !canHandleAny(state.attributes)) continue;
    result.push(id);
  }
  return result;
}

/**
 * Returns true if any entity in the registry (cached or fallback) belongs
 * to the given device. Used by the card to decide between "device exists
 * but has no alerts yet" (preview) and "device totally absent" (preview).
 */
export function deviceHasAnyEntity(
  hass: HomeAssistant,
  deviceId: string,
  registryEntries?: EntityRegistryDisplayEntry[] | null,
): boolean {
  if (registryEntries) {
    return registryEntries.some(e => e?.device_id === deviceId);
  }
  const reg = hass.entities;
  if (!reg) return false;
  for (const entry of Object.values(reg)) {
    if (entry?.device_id === deviceId) return true;
  }
  return false;
}

/**
 * Live subscription to the HA entity registry. The HA frontend exposes
 * this from its private data layer; for cards we reimplement on top of
 * the public `home-assistant-js-websocket` primitives:
 *   - `config/entity_registry/list` for the initial snapshot — canonical
 *     field names (`entity_id`, `device_id`, …) that match the shape the
 *     HA frontend pre-normalizes for `hass.entities`. Do NOT switch to
 *     `list_for_display`: that response uses minified keys (`ei`, `di`,
 *     `ai`, `ec`, …) and would silently break attribute lookups.
 *   - `entity_registry_updated` events to trigger a refetch on change.
 *
 * `onChange` fires once for the initial list, then again every time the
 * registry changes (entities added/removed/edited).
 */
export async function subscribeEntityRegistry(
  conn: Connection,
  onChange: (entries: EntityRegistryDisplayEntry[]) => void,
): Promise<() => void> {
  const fetchAndPush = async (): Promise<void> => {
    const result = await conn.sendMessagePromise<EntityRegistryDisplayEntry[]>({
      type: 'config/entity_registry/list',
    });
    onChange(result ?? []);
  };
  const unsubEvents = await conn.subscribeEvents(() => {
    void fetchAndPush().catch(() => { /* ignore — next event will retry */ });
  }, 'entity_registry_updated');
  await fetchAndPush();
  return () => { void unsubEvents(); };
}
