import type { Connection } from 'home-assistant-js-websocket';
import { HomeAssistant, EntityRegistryDisplayEntry } from './types';
import { canHandleAny } from './adapters';

/**
 * The device ids a card collects from: `device` first, then `devices`, with
 * empties and repeats dropped. `device` stays the single-value form so a
 * one-device config is unchanged; `devices` is to `device` what `entities` is
 * to `entity`. Every reader of the device list (card, editor, dismissal scope)
 * goes through here so none of them can disagree on what is configured.
 */
export function configuredDevices(
  config: { device?: string; devices?: string[] } | undefined,
): string[] {
  if (!config) return [];
  const result: string[] = [];
  for (const id of [config.device, ...(config.devices || [])]) {
    if (id && !result.includes(id)) result.push(id);
  }
  return result;
}

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
 * Returns ALL registry entries for the given device, unfiltered.
 *
 * Unlike `resolveDeviceAlertEntities`, this does NOT filter by `canHandle`.
 * When a source (e.g. a CAP Alerts device) goes `unavailable`/`unknown` its
 * per-alert sensors lose their alert attributes, so `canHandle` rejects them
 * and they vanish from the alert-resolution path — which is why the degraded
 * signal was blind to a dark device. Availability detection must look at the
 * whole device, including entities that no longer parse. The entries carry
 * `entity_category`, which that detection reads: `unknown` on a diagnostic
 * sibling is a resting state, not a fault (see `_brokenSources`).
 *
 * @internal exported for testing
 */
export function deviceRegistryEntries(
  hass: HomeAssistant,
  deviceId: string,
  registryEntries?: EntityRegistryDisplayEntry[] | null,
): EntityRegistryDisplayEntry[] {
  const entries: EntityRegistryDisplayEntry[] | null = registryEntries
    ?? (hass.entities ? Object.values(hass.entities) : null);
  if (!entries) return [];
  return entries.filter(entry => entry?.device_id === deviceId && !!entry.entity_id);
}

/**
 * Returns ALL entity IDs registered to the given device, unfiltered.
 * See `deviceRegistryEntries`.
 *
 * @internal exported for testing
 */
export function deviceEntityIds(
  hass: HomeAssistant,
  deviceId: string,
  registryEntries?: EntityRegistryDisplayEntry[] | null,
): string[] {
  return deviceRegistryEntries(hass, deviceId, registryEntries).map(entry => entry.entity_id);
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
  // entity_registry_updated fires in bursts (integration reloads add/rename
  // many entities at once). Leading-edge throttle: fetch immediately on the
  // first event so the UI stays responsive, then coalesce any further events
  // within the window into a single trailing refetch — so we don't re-pull
  // the full registry once per entity.
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  let trailingPending = false;
  const scheduleFetch = (): void => {
    if (throttleTimer !== null) {
      trailingPending = true;
      return;
    }
    void fetchAndPush().catch(() => { /* ignore — next event will retry */ });
    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      if (trailingPending) {
        trailingPending = false;
        scheduleFetch();
      }
    }, 250);
  };
  const unsubEvents = await conn.subscribeEvents(() => scheduleFetch(), 'entity_registry_updated');
  await fetchAndPush();
  return () => {
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    trailingPending = false;
    void unsubEvents();
  };
}
