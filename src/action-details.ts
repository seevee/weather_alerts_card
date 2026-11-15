import type { HassEntity, HomeAssistant } from './types';
import { isStrippedNinaSlot } from './adapters/nina';
import { ECCC_CORE_LISTS, coreEcccAlertsKey, fromCoreEcccAlert } from './adapters/eccc';

// Alert data that an integration serves through an action instead of entity
// attributes (#403, #205).
//
// The card asks for it here, outside render, and hands the answer to the
// adapter as if it were the entity's attributes, so each adapter parses one
// shape whichever way the alert arrived. Two sources today:
//
//   - NINA on Home Assistant 2026.11+. The warning slot carries `id` alone;
//     `nina.get_details` returns the rest under the attribute names the
//     integration had before.
//   - Core `environment_canada`. Its count sensors carry alert titles only;
//     `get_alerts` returns the full records, renamed here into the list the
//     ECCC adapter already reads.
//
// State is shared on purpose. Every card on a dashboard uses one answer per
// alert, and a card rebuilt by a view change starts with the text already in
// hand instead of flashing "unavailable".
//
// Rules the callers rely on:
//   - `actionAttributes` is pure and safe in render. It never fetches.
//   - `requestActionDetails` is the only thing that fetches. Call it from
//     `updated()`, never from render (render purity).
//   - An entity is asked once per alert set. A failure is retried after
//     ACTION_RETRY_MS, never on the next state push.

/** How long a failed call stands before the slot is asked again. */
export const ACTION_RETRY_MS = 5 * 60 * 1000;

interface Entry { key: string; attributes: Record<string, unknown> }

interface Store {
  cache: Map<string, Entry>;
  failures: Map<string, { key: string; at: number }>;
  inFlight: Map<string, string>;
  listeners: Set<() => void>;
}

// The card and the editor are separate files, each with its own copy of this
// module (#394). The state hangs off `window` so both read the same answers:
// with a copy each, the editor would see a NINA device's live slots as
// unrecognised and say the device has no alerts.
const STORE_KEY = '__weatherAlertsCardActionDetails';
const scope = window as unknown as Record<string, Store | undefined>;
const store: Store = scope[STORE_KEY] ?? (scope[STORE_KEY] = {
  cache: new Map(),
  failures: new Map(),
  inFlight: new Map(),
  listeners: new Set(),
});
const { cache, failures, inFlight, listeners } = store;

type Overlay = Record<string, Record<string, unknown>>;

interface ActionSource {
  /** Registry platform of the entities this source may call an action for. */
  platform: string;
  /** The alert(s) the entity holds now, or null when it is not this source's. */
  key(entity: HassEntity): string | null;
  /**
   * Fetch for all the listed entities. Resolves to the attributes to lay over
   * each one; an entity left out counts as a failed call. Never rejects.
   */
  fetch(hass: HomeAssistant, entityIds: string[]): Promise<Overlay>;
}

const SOURCES: ActionSource[] = [
  {
    platform: 'nina',
    key: entity => (isStrippedNinaSlot(entity.state, entity.attributes) ? `nina:${String(entity.attributes['id'])}` : null),
    fetch: fetchNinaDetails,
  },
  {
    platform: 'environment_canada',
    key: (entity) => {
      const alerts = coreEcccAlertsKey(entity.attributes);
      return alerts === null ? null : `eccc:${alerts}`;
    },
    fetch: fetchEcccAlerts,
  },
];

function sourceFor(entity: HassEntity): { source: ActionSource; key: string } | null {
  for (const source of SOURCES) {
    const key = source.key(entity);
    if (key !== null) return { source, key };
  }
  return null;
}

/**
 * The alert(s) an action-backed entity holds now, or null when the entity's
 * own attributes are the whole story. The key changes when the alerts do,
 * which is what invalidates a cached answer.
 */
export function actionDetailKey(entity: HassEntity): string | null {
  return sourceFor(entity)?.key ?? null;
}

/**
 * The attributes an adapter should read for this entity: its own, with the
 * fetched details laid over them once they are in hand for the current
 * warning. Unchanged for every entity that is not action-backed.
 */
export function actionAttributes(entityId: string, entity: HassEntity): Record<string, unknown> {
  const key = actionDetailKey(entity);
  if (key === null) return entity.attributes;
  const entry = cache.get(entityId);
  return entry?.key === key ? { ...entity.attributes, ...entry.attributes } : entity.attributes;
}

/** Be told when an answer arrives or a retry falls due. Returns the unsubscribe. */
export function subscribeActionDetails(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Fetch details for every listed entity that needs them and is not already
 * answered, in flight, or inside its retry window. One fetch per source covers
 * all of that source's entities.
 */
export function requestActionDetails(hass: HomeAssistant, entityIds: Iterable<string>, now = Date.now()): void {
  const wanted = new Map<ActionSource, { entityId: string; key: string }[]>();
  for (const entityId of entityIds) {
    const entity = hass.states[entityId];
    const found = entity ? sourceFor(entity) : null;
    if (found === null) {
      // The entity emptied or moved on: its answer is for alerts that are gone.
      cache.delete(entityId);
      failures.delete(entityId);
      continue;
    }
    const { source, key } = found;
    if (cache.get(entityId)?.key === key || inFlight.get(entityId) === key) continue;
    const failure = failures.get(entityId);
    if (failure?.key === key && now - failure.at < ACTION_RETRY_MS) continue;
    // A shape can match another integration's entity, and an action rejects
    // the whole call over one foreign entity.
    const platform = hass.entities?.[entityId]?.platform;
    if (platform !== undefined && platform !== source.platform) continue;
    const group = wanted.get(source);
    if (group) group.push({ entityId, key });
    else wanted.set(source, [{ entityId, key }]);
  }

  for (const [source, group] of wanted) {
    for (const { entityId, key } of group) inFlight.set(entityId, key);
    void source.fetch(hass, group.map(({ entityId }) => entityId)).then((overlay) => {
      const at = Date.now();
      let failed = false;
      for (const { entityId, key } of group) {
        // A newer request for the same entity supersedes this answer.
        if (inFlight.get(entityId) !== key) continue;
        inFlight.delete(entityId);
        const attributes = overlay[entityId];
        if (attributes) {
          cache.set(entityId, { key, attributes });
          failures.delete(entityId);
        } else {
          failures.set(entityId, { key, at });
          failed = true;
        }
      }
      // A card with no alerts runs no clock, so the retry needs its own wake-up.
      if (failed) setTimeout(notify, ACTION_RETRY_MS);
      notify();
    });
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A service call that returns data. Null when it could not be made or failed.
async function callForResponse(
  hass: HomeAssistant,
  domain: string,
  service: string,
  extra: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const conn = hass.connection;
  if (!conn) return null;
  try {
    const result = await conn.sendMessagePromise<{ response?: unknown }>({
      type: 'call_service',
      domain,
      service,
      ...extra,
      return_response: true,
    });
    return isRecord(result?.response) ? result.response : null;
  } catch (err) {
    console.warn(`weather-alerts-card: ${domain}.${service} failed`, err);
    return null;
  }
}

// One `nina.get_details` call for all the slots: the response is keyed by
// entity id and already uses the attribute names the adapter reads.
async function fetchNinaDetails(hass: HomeAssistant, entityIds: string[]): Promise<Overlay> {
  const response = await callForResponse(hass, 'nina', 'get_details', { target: { entity_id: entityIds } });
  const overlay: Overlay = {};
  for (const entityId of entityIds) {
    const details = response?.[entityId];
    if (isRecord(details)) overlay[entityId] = details;
  }
  return overlay;
}

// Core ECCC: `get_alerts` is addressed by config entry and returns all five
// lists. The entity registry says which entry a sensor belongs to and which
// list it counts (its translation key), so each sensor gets its own list and
// two sensors of one location never double up. One call per config entry.
async function fetchEcccAlerts(hass: HomeAssistant, entityIds: string[]): Promise<Overlay> {
  const overlay: Overlay = {};
  const conn = hass.connection;
  if (!conn) return overlay;

  const byEntry = new Map<string, { entityId: string; list: string }[]>();
  await Promise.all(entityIds.map(async (entityId) => {
    try {
      const entry = await conn.sendMessagePromise<{ config_entry_id?: string | null; translation_key?: string | null }>({
        type: 'config/entity_registry/get',
        entity_id: entityId,
      });
      const list = entry?.translation_key;
      if (!entry?.config_entry_id || !list || !(list in ECCC_CORE_LISTS)) return;
      const members = byEntry.get(entry.config_entry_id);
      if (members) members.push({ entityId, list });
      else byEntry.set(entry.config_entry_id, [{ entityId, list }]);
    } catch (err) {
      console.warn('weather-alerts-card: entity registry lookup failed', entityId, err);
    }
  }));

  await Promise.all([...byEntry].map(async ([configEntryId, members]) => {
    const response = await callForResponse(hass, 'environment_canada', 'get_alerts', {
      service_data: { config_entry_id: configEntryId },
    });
    if (!response) return;
    for (const { entityId, list } of members) {
      const items = response[list];
      if (!Array.isArray(items)) continue;
      overlay[entityId] = { alerts: items.filter(isRecord).map(item => fromCoreEcccAlert(item, list)) };
    }
  }));
  return overlay;
}

/** @internal test hook: forget every answer, failure and listener. */
export function resetActionDetails(): void {
  cache.clear();
  failures.clear();
  inFlight.clear();
  listeners.clear();
}
