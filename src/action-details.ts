import type { HassEntity, HomeAssistant } from './types';
import { isStrippedNinaSlot } from './adapters/nina';

// Alert data that an integration serves through an action instead of entity
// attributes (#403).
//
// Home Assistant 2026.11 left the NINA warning slot with `id` alone; the
// headline, text and times come from `nina.get_details`. The card asks for
// them here, outside render, and hands the answer to the adapter as if it
// were the slot's attributes: the response uses the attribute names the
// integration had before, so `NinaAdapter` parses it unchanged.
//
// State is module-level on purpose. Every card on a dashboard shares one
// answer per warning, and a card rebuilt by a view change starts with the
// text already in hand instead of flashing "unavailable".
//
// Rules the callers rely on:
//   - `actionAttributes` is pure and safe in render. It never fetches.
//   - `requestActionDetails` is the only thing that fetches. Call it from
//     `updated()`, never from render (render purity).
//   - A slot is asked once per warning. A failure is retried after
//     ACTION_RETRY_MS, never on the next state push.

/** How long a failed call stands before the slot is asked again. */
export const ACTION_RETRY_MS = 5 * 60 * 1000;

interface Entry { key: string; attributes: Record<string, unknown> }

const cache = new Map<string, Entry>();
const failures = new Map<string, { key: string; at: number }>();
const inFlight = new Map<string, string>();
const listeners = new Set<() => void>();

/**
 * The warning an action-backed entity holds now, or null when the entity's
 * own attributes are the whole story. The key changes when the warning does,
 * which is what invalidates a cached answer.
 */
export function actionDetailKey(entity: HassEntity): string | null {
  return isStrippedNinaSlot(entity.state, entity.attributes)
    ? `nina:${String(entity.attributes['id'])}`
    : null;
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
 * answered, in flight, or inside its retry window. One call covers them all.
 */
export function requestActionDetails(hass: HomeAssistant, entityIds: Iterable<string>, now = Date.now()): void {
  const wanted: { entityId: string; key: string }[] = [];
  for (const entityId of entityIds) {
    const entity = hass.states[entityId];
    const key = entity ? actionDetailKey(entity) : null;
    if (key === null) {
      // The slot emptied or moved on: its answer is for a warning that is gone.
      cache.delete(entityId);
      failures.delete(entityId);
      continue;
    }
    if (cache.get(entityId)?.key === key || inFlight.get(entityId) === key) continue;
    const failure = failures.get(entityId);
    if (failure?.key === key && now - failure.at < ACTION_RETRY_MS) continue;
    // The slot shape can match another integration's binary sensor, and
    // `nina.get_details` rejects the whole call over one foreign entity.
    const platform = hass.entities?.[entityId]?.platform;
    if (platform !== undefined && platform !== 'nina') continue;
    wanted.push({ entityId, key });
  }
  if (wanted.length === 0) return;

  for (const { entityId, key } of wanted) inFlight.set(entityId, key);
  void fetchNinaDetails(hass, wanted.map(({ entityId }) => entityId)).then((response) => {
    const at = Date.now();
    let failed = false;
    for (const { entityId, key } of wanted) {
      // A newer request for the same slot supersedes this answer.
      if (inFlight.get(entityId) !== key) continue;
      inFlight.delete(entityId);
      const attributes = response?.[entityId];
      if (attributes && typeof attributes === 'object') {
        cache.set(entityId, { key, attributes: attributes as Record<string, unknown> });
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

// One `nina.get_details` call for all the slots. Resolves to the per-entity
// response, or null when the call could not be made or failed; never rejects.
async function fetchNinaDetails(
  hass: HomeAssistant,
  entityIds: string[],
): Promise<Record<string, unknown> | null> {
  const conn = hass.connection;
  if (!conn) return null;
  try {
    const result = await conn.sendMessagePromise<{ response?: unknown }>({
      type: 'call_service',
      domain: 'nina',
      service: 'get_details',
      target: { entity_id: entityIds },
      return_response: true,
    });
    const response = result?.response;
    return response && typeof response === 'object' ? response as Record<string, unknown> : null;
  } catch (err) {
    console.warn('weather-alerts-card: nina.get_details failed', err);
    return null;
  }
}

/** @internal test hook: forget every answer, failure and listener. */
export function resetActionDetails(): void {
  cache.clear();
  failures.clear();
  inFlight.clear();
  listeners.clear();
}
