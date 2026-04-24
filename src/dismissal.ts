// Browser-local dismissal state for individual weather alerts.
// Keyed per "card instance scope" (hash of configured entity set). The
// backend/integration is untouched; this is a pure frontend concern.

import type { WeatherAlert, DismissalRecord } from './types';

export const STORAGE_KEY_PREFIX = 'weather-alerts-card:dismissals:v1:';
export const STALE_TTL_SEC = 30 * 86400;
export const DISMISSALS_CHANGED_EVENT = 'weather-alerts-card:dismissals-changed';
// Throttle lastSeenAt bumps to avoid writing localStorage on every render.
// TTL is 30 days; refreshing at most once per hour keeps writes bounded
// while still renewing the record long before the TTL expires.
const LAST_SEEN_BUMP_SEC = 3600;

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function computeAlertSignature(alert: WeatherAlert): string {
  return `${alert.severity}|${alert.sentTs}|${alert.endsTs}|${alert.phase || ''}`;
}

// FNV-1a 32-bit hash → 8 lowercase hex chars. Synchronous, tiny, no deps.
// Truncation is fine for scope keys: one user has dozens of cards at most.
export function computeScopeHash(primaryEntity: string, extras: string[]): string {
  const ids = [primaryEntity, ...extras].filter(Boolean).sort();
  const input = ids.join('\n');
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function storageKey(scope: string): string {
  return STORAGE_KEY_PREFIX + scope;
}

function safeGetStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function notifyDismissalChange(scope: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(DISMISSALS_CHANGED_EVENT, {
      detail: { scope },
    }));
  } catch {
    // Environments without CustomEvent (very old) — skip silently.
  }
}

/**
 * Listen for same-tab dismissal-state changes (dismiss, undo, restore-all)
 * scoped to a specific entity-set hash. Returns an unsubscribe function.
 */
export function subscribeToDismissalChanges(
  scope: string,
  handler: () => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (ev: Event) => {
    const detail = (ev as CustomEvent).detail as { scope?: string } | undefined;
    if (!detail || detail.scope !== scope) return;
    handler();
  };
  window.addEventListener(DISMISSALS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(DISMISSALS_CHANGED_EVENT, listener);
}

export function loadDismissals(
  scope: string,
  now: number = nowSec(),
): Map<string, DismissalRecord> {
  const result = new Map<string, DismissalRecord>();
  const ls = safeGetStorage();
  if (!ls) return result;
  let raw: string | null;
  try {
    raw = ls.getItem(storageKey(scope));
  } catch {
    return result;
  }
  if (!raw) return result;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return result;
  }
  if (!parsed || typeof parsed !== 'object') return result;
  const entries = (parsed as Record<string, unknown>);
  for (const [id, val] of Object.entries(entries)) {
    if (!val || typeof val !== 'object') continue;
    const rec = val as Partial<DismissalRecord>;
    if (typeof rec.sig !== 'string'
        || typeof rec.dismissedAt !== 'number'
        || typeof rec.lastSeenAt !== 'number') {
      continue;
    }
    if (now - rec.lastSeenAt > STALE_TTL_SEC) continue;
    result.set(id, { sig: rec.sig, dismissedAt: rec.dismissedAt, lastSeenAt: rec.lastSeenAt });
  }
  return result;
}

export function saveDismissals(
  scope: string,
  map: Map<string, DismissalRecord>,
): void {
  const ls = safeGetStorage();
  if (!ls) {
    notifyDismissalChange(scope);
    return;
  }
  const key = storageKey(scope);
  try {
    if (map.size === 0) {
      ls.removeItem(key);
    } else {
      const obj: Record<string, DismissalRecord> = {};
      for (const [id, rec] of map) obj[id] = rec;
      ls.setItem(key, JSON.stringify(obj));
    }
  } catch {
    // Quota exceeded / private browsing — dismissals are session-only.
  }
  notifyDismissalChange(scope);
}

export function dismissAlert(
  map: Map<string, DismissalRecord>,
  alert: WeatherAlert,
  now: number = nowSec(),
): Map<string, DismissalRecord> {
  const next = new Map(map);
  next.set(alert.id, {
    sig: computeAlertSignature(alert),
    dismissedAt: now,
    lastSeenAt: now,
  });
  return next;
}

export function undoDismiss(
  map: Map<string, DismissalRecord>,
  id: string,
): Map<string, DismissalRecord> {
  if (!map.has(id)) return map;
  const next = new Map(map);
  next.delete(id);
  return next;
}

export function restoreAll(scope: string): void {
  const ls = safeGetStorage();
  if (ls) {
    try {
      ls.removeItem(storageKey(scope));
    } catch {
      // noop
    }
  }
  notifyDismissalChange(scope);
}

/**
 * Filter dismissed alerts whose stored signature still matches the current
 * alert. Silently un-dismisses alerts whose signature has shifted (CAP
 * lifecycle change) so they resurface on the next render. Refreshes
 * `lastSeenAt` on matches but only when the stored value is stale enough
 * to warrant a new localStorage write.
 *
 * Returns the same Map reference when no records changed — callers use
 * reference equality to decide whether to persist.
 */
export function applyDismissals(
  alerts: WeatherAlert[],
  map: Map<string, DismissalRecord>,
  now: number = nowSec(),
): { visible: WeatherAlert[]; updatedMap: Map<string, DismissalRecord> } {
  if (map.size === 0) return { visible: alerts, updatedMap: map };
  let updated: Map<string, DismissalRecord> | null = null;
  const visible: WeatherAlert[] = [];
  for (const alert of alerts) {
    const rec = map.get(alert.id);
    if (!rec) {
      visible.push(alert);
      continue;
    }
    const sig = computeAlertSignature(alert);
    if (rec.sig !== sig) {
      if (!updated) updated = new Map(map);
      updated.delete(alert.id);
      visible.push(alert);
      continue;
    }
    if (now - rec.lastSeenAt > LAST_SEEN_BUMP_SEC) {
      if (!updated) updated = new Map(map);
      updated.set(alert.id, { ...rec, lastSeenAt: now });
    }
  }
  return { visible, updatedMap: updated ?? map };
}
