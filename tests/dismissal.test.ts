import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEY_PREFIX,
  STALE_TTL_SEC,
  computeAlertSignature,
  computeScopeHash,
  storageKey,
  loadDismissals,
  saveDismissals,
  dismissAlert,
  undoDismiss,
  restoreAll,
  applyDismissals,
  subscribeToDismissalChanges,
} from '../src/dismissal';
import type { WeatherAlert, DismissalRecord } from '../src/types';

function makeAlert(overrides: Partial<WeatherAlert> = {}): WeatherAlert {
  return {
    id: 'alert-A',
    event: 'Test Alert',
    severity: 'moderate',
    severityLabel: 'Moderate',
    certainty: 'Likely',
    urgency: 'Expected',
    sentTs: 1_700_000_000,
    onsetTs: 1_700_000_100,
    endsTs: 1_700_003_600,
    description: 'desc',
    instruction: 'instr',
    url: '',
    headline: 'Head',
    areaDesc: 'Area',
    zones: ['Z1'],
    eventCode: 'TST',
    provider: 'nws',
    phase: '',
    severityInferred: false,
    certaintyInferred: false,
    ...overrides,
  };
}

function makeRecord(sig: string, now: number): DismissalRecord {
  return { sig, dismissedAt: now, lastSeenAt: now };
}

// Node 22+/Vitest 4's default localStorage stub is missing several Storage
// API methods. Install a minimal in-memory polyfill so tests are deterministic
// across Node versions.
beforeEach(() => {
  const store = new Map<string, string>();
  const fake: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: fake,
    configurable: true,
    writable: true,
  });
});

describe('computeAlertSignature', () => {
  it('is stable for the same alert', () => {
    const a = makeAlert();
    expect(computeAlertSignature(a)).toBe(computeAlertSignature(a));
  });

  it('varies when severity changes', () => {
    expect(computeAlertSignature(makeAlert({ severity: 'severe' })))
      .not.toBe(computeAlertSignature(makeAlert({ severity: 'moderate' })));
  });

  it('varies when sentTs changes', () => {
    expect(computeAlertSignature(makeAlert({ sentTs: 1 })))
      .not.toBe(computeAlertSignature(makeAlert({ sentTs: 2 })));
  });

  it('varies when endsTs changes', () => {
    expect(computeAlertSignature(makeAlert({ endsTs: 100 })))
      .not.toBe(computeAlertSignature(makeAlert({ endsTs: 200 })));
  });

  it('varies when phase changes', () => {
    expect(computeAlertSignature(makeAlert({ phase: 'Update' })))
      .not.toBe(computeAlertSignature(makeAlert({ phase: 'Final' })));
  });

  it('is stable across headline/description churn', () => {
    expect(computeAlertSignature(makeAlert({ headline: 'Foo', description: 'foo body' })))
      .toBe(computeAlertSignature(makeAlert({ headline: 'Bar', description: 'different body' })));
  });
});

describe('computeScopeHash', () => {
  it('is stable for the same input', () => {
    expect(computeScopeHash('a', ['b'])).toBe(computeScopeHash('a', ['b']));
  });

  it('differs for different primary entities', () => {
    expect(computeScopeHash('a', ['b'])).not.toBe(computeScopeHash('c', ['b']));
  });

  it('differs for different extras', () => {
    expect(computeScopeHash('a', ['b'])).not.toBe(computeScopeHash('a', ['c']));
  });

  it('is order-independent across entire entity set', () => {
    expect(computeScopeHash('a', ['b', 'c'])).toBe(computeScopeHash('c', ['a', 'b']));
  });

  it('returns 8 lowercase hex characters', () => {
    const h = computeScopeHash('sensor.one', ['sensor.two']);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('storageKey', () => {
  it('prefixes with the v1 namespace', () => {
    expect(storageKey('abc')).toBe(`${STORAGE_KEY_PREFIX}abc`);
  });
});

describe('loadDismissals', () => {
  it('returns empty map when key is missing', () => {
    expect(loadDismissals('missing').size).toBe(0);
  });

  it('returns empty map on malformed JSON', () => {
    localStorage.setItem(storageKey('scope'), 'not-json');
    expect(loadDismissals('scope').size).toBe(0);
  });

  it('prunes records older than TTL', () => {
    const now = 1_800_000_000;
    const stale = { sig: 's', dismissedAt: 0, lastSeenAt: now - STALE_TTL_SEC - 10 };
    const fresh = { sig: 's', dismissedAt: now, lastSeenAt: now - 10 };
    localStorage.setItem(storageKey('scope'), JSON.stringify({ stale, fresh }));
    const map = loadDismissals('scope', now);
    expect(map.has('stale')).toBe(false);
    expect(map.has('fresh')).toBe(true);
  });

  it('preserves fresh records round-trip', () => {
    const rec = makeRecord('sig-1', 1_700_000_000);
    localStorage.setItem(storageKey('scope'), JSON.stringify({ 'alert-A': rec }));
    const map = loadDismissals('scope', 1_700_000_100);
    expect(map.get('alert-A')).toEqual(rec);
  });

  it('skips malformed entries', () => {
    localStorage.setItem(storageKey('scope'), JSON.stringify({
      good: makeRecord('s', 1_700_000_000),
      bad1: null,
      bad2: 'string',
      bad3: { sig: 'x' },
    }));
    const map = loadDismissals('scope', 1_700_000_100);
    expect([...map.keys()]).toEqual(['good']);
  });
});

describe('saveDismissals', () => {
  it('removes the key when map is empty', () => {
    localStorage.setItem(storageKey('scope'), '{"x":1}');
    saveDismissals('scope', new Map());
    expect(localStorage.getItem(storageKey('scope'))).toBeNull();
  });

  it('round-trips a non-empty map', () => {
    const m = new Map<string, DismissalRecord>();
    const rec = makeRecord('sig-1', 1_700_000_000);
    m.set('alert-A', rec);
    saveDismissals('scope', m);
    const loaded = loadDismissals('scope', 1_700_000_010);
    expect(loaded.get('alert-A')).toEqual(rec);
  });
});

describe('dismissAlert', () => {
  it('returns a new map with a record for the alert', () => {
    const before = new Map<string, DismissalRecord>();
    const now = 1_700_000_500;
    const after = dismissAlert(before, makeAlert(), now);
    expect(after).not.toBe(before);
    expect(before.size).toBe(0);
    const rec = after.get('alert-A')!;
    expect(rec.dismissedAt).toBe(now);
    expect(rec.lastSeenAt).toBe(now);
    expect(rec.sig).toBe(computeAlertSignature(makeAlert()));
  });

  it('replaces an existing record for the same alert id', () => {
    const now1 = 1_700_000_000;
    const now2 = 1_700_000_500;
    let map = dismissAlert(new Map(), makeAlert(), now1);
    map = dismissAlert(map, makeAlert({ severity: 'severe' }), now2);
    expect(map.get('alert-A')!.dismissedAt).toBe(now2);
    expect(map.get('alert-A')!.sig).toContain('severe');
  });
});

describe('undoDismiss', () => {
  it('returns a new map without the record', () => {
    const seed = dismissAlert(new Map(), makeAlert(), 1_700_000_000);
    const after = undoDismiss(seed, 'alert-A');
    expect(after).not.toBe(seed);
    expect(after.has('alert-A')).toBe(false);
    expect(seed.has('alert-A')).toBe(true);
  });

  it('returns the same map when id not present', () => {
    const seed = new Map<string, DismissalRecord>();
    expect(undoDismiss(seed, 'nope')).toBe(seed);
  });
});

describe('restoreAll', () => {
  it('removes the scoped storage key', () => {
    localStorage.setItem(storageKey('scope'), '{"x":1}');
    localStorage.setItem(storageKey('other'), '{"y":1}');
    restoreAll('scope');
    expect(localStorage.getItem(storageKey('scope'))).toBeNull();
    expect(localStorage.getItem(storageKey('other'))).toBe('{"y":1}');
  });
});

describe('subscribeToDismissalChanges', () => {
  it('fires on saveDismissals for the matching scope', () => {
    let hits = 0;
    const unsub = subscribeToDismissalChanges('scope', () => { hits++; });
    saveDismissals('scope', new Map([['a', makeRecord('s', 1)]]));
    expect(hits).toBe(1);
    unsub();
  });

  it('fires on restoreAll for the matching scope', () => {
    let hits = 0;
    const unsub = subscribeToDismissalChanges('scope', () => { hits++; });
    restoreAll('scope');
    expect(hits).toBe(1);
    unsub();
  });

  it('ignores events for different scopes', () => {
    let hits = 0;
    const unsub = subscribeToDismissalChanges('scope', () => { hits++; });
    saveDismissals('other', new Map([['a', makeRecord('s', 1)]]));
    restoreAll('other');
    expect(hits).toBe(0);
    unsub();
  });

  it('stops firing after unsubscribe', () => {
    let hits = 0;
    const unsub = subscribeToDismissalChanges('scope', () => { hits++; });
    unsub();
    restoreAll('scope');
    expect(hits).toBe(0);
  });
});

describe('applyDismissals', () => {
  it('passes through when the map is empty', () => {
    const alerts = [makeAlert()];
    const map = new Map<string, DismissalRecord>();
    const { visible, updatedMap } = applyDismissals(alerts, map);
    expect(visible).toBe(alerts);
    expect(updatedMap).toBe(map);
  });

  it('filters alerts with matching signatures', () => {
    const alert = makeAlert();
    const now = 1_700_000_000;
    const map = new Map<string, DismissalRecord>([
      ['alert-A', makeRecord(computeAlertSignature(alert), now)],
    ]);
    const { visible } = applyDismissals([alert], map, now);
    expect(visible).toHaveLength(0);
  });

  it('refreshes lastSeenAt on matches when stale', () => {
    const alert = makeAlert();
    const then = 1_700_000_000;
    const now = then + 7200; // more than the 1h bump threshold
    const map = new Map<string, DismissalRecord>([
      ['alert-A', makeRecord(computeAlertSignature(alert), then)],
    ]);
    const { updatedMap } = applyDismissals([alert], map, now);
    expect(updatedMap).not.toBe(map);
    expect(updatedMap.get('alert-A')!.lastSeenAt).toBe(now);
    expect(updatedMap.get('alert-A')!.dismissedAt).toBe(then);
  });

  it('does not bump lastSeenAt within the throttle window', () => {
    const alert = makeAlert();
    const then = 1_700_000_000;
    const now = then + 60; // well under 1h
    const map = new Map<string, DismissalRecord>([
      ['alert-A', makeRecord(computeAlertSignature(alert), then)],
    ]);
    const { updatedMap } = applyDismissals([alert], map, now);
    expect(updatedMap).toBe(map);
  });

  it('silently un-dismisses when signature has changed', () => {
    const alert = makeAlert();
    const now = 1_700_000_000;
    const map = new Map<string, DismissalRecord>([
      ['alert-A', makeRecord('stale-sig', now)],
    ]);
    const { visible, updatedMap } = applyDismissals([alert], map, now);
    expect(visible).toEqual([alert]);
    expect(updatedMap).not.toBe(map);
    expect(updatedMap.has('alert-A')).toBe(false);
  });

  it('leaves non-dismissed alerts untouched', () => {
    const a = makeAlert({ id: 'alert-A' });
    const b = makeAlert({ id: 'alert-B' });
    const now = 1_700_000_000;
    const map = new Map<string, DismissalRecord>([
      ['alert-A', makeRecord(computeAlertSignature(a), now)],
    ]);
    const { visible } = applyDismissals([a, b], map, now);
    expect(visible).toEqual([b]);
  });

  it('does not mutate the input map', () => {
    const alert = makeAlert();
    const map = new Map<string, DismissalRecord>([
      ['alert-A', makeRecord('stale-sig', 0)],
    ]);
    const snapshot = new Map(map);
    applyDismissals([alert], map, 1_700_000_000);
    expect([...map]).toEqual([...snapshot]);
  });
});
