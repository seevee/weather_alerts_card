import { describe, it, expect, beforeEach } from 'vitest';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import type { WeatherAlertsCardConfig } from '../src/types';
import { saveDismissals, scopeHashForConfig } from '../src/dismissal';

// Reach into private helpers — this suite exists to pin down the
// condition-matching heuristics used to sync HA visibility conditions.
type EditorInternals = {
  _config: WeatherAlertsCardConfig;
  _syncMultiEntityVisibility(
    config: WeatherAlertsCardConfig,
  ): Record<string, unknown>[] | undefined;
  _isManagedCondition(
    c: Record<string, unknown>,
    managedIds: Set<string>,
  ): boolean;
  _currentScopeHash(): string;
  _getDismissedCount(): number;
};

function makeEditor(): EditorInternals {
  return new WeatherAlertsCardEditor() as unknown as EditorInternals;
}

function makeConfig(overrides: Partial<WeatherAlertsCardConfig>): WeatherAlertsCardConfig {
  return {
    entity: 'sensor.nws_alerts',
    ...overrides,
  };
}

describe('_syncMultiEntityVisibility', () => {
  it('returns undefined when hideNoAlerts is off and no other conditions exist', () => {
    const editor = makeEditor();
    expect(editor._syncMultiEntityVisibility(makeConfig({}))).toBeUndefined();
  });

  it('emits a flat state_not condition for a single sensor entity', () => {
    const editor = makeEditor();
    const result = editor._syncMultiEntityVisibility(makeConfig({ hideNoAlerts: true }));
    expect(result).toEqual([
      { condition: 'state', entity: 'sensor.nws_alerts', state_not: '0' },
    ]);
  });

  it('emits state: on for a single binary_sensor entity', () => {
    const editor = makeEditor();
    const result = editor._syncMultiEntityVisibility(makeConfig({
      entity: 'binary_sensor.meteoalarm',
      hideNoAlerts: true,
    }));
    expect(result).toEqual([
      { condition: 'state', entity: 'binary_sensor.meteoalarm', state: 'on' },
    ]);
  });

  it('wraps multi-entity conditions in an OR block', () => {
    const editor = makeEditor();
    const result = editor._syncMultiEntityVisibility(makeConfig({
      entity: 'sensor.nws_alerts',
      entities: ['sensor.nws_alerts_2', 'binary_sensor.meteoalarm'],
      hideNoAlerts: true,
    }));
    expect(result).toHaveLength(1);
    expect(result![0]).toEqual({
      condition: 'or',
      conditions: [
        { condition: 'state', entity: 'sensor.nws_alerts', state_not: '0' },
        { condition: 'state', entity: 'sensor.nws_alerts_2', state_not: '0' },
        { condition: 'state', entity: 'binary_sensor.meteoalarm', state: 'on' },
      ],
    });
  });

  it('preserves unrelated user-authored conditions', () => {
    const editor = makeEditor();
    const userCondition = {
      condition: 'state',
      entity: 'input_boolean.dashboard_mode',
      state: 'on',
    };
    const result = editor._syncMultiEntityVisibility(makeConfig({
      hideNoAlerts: true,
      visibility: [userCondition],
    }));
    expect(result).toEqual([
      userCondition,
      { condition: 'state', entity: 'sensor.nws_alerts', state_not: '0' },
    ]);
  });

  it('strips managed conditions when hideNoAlerts is turned off', () => {
    const editor = makeEditor();
    const userCondition = {
      condition: 'state',
      entity: 'input_boolean.dashboard_mode',
      state: 'on',
    };
    const result = editor._syncMultiEntityVisibility(makeConfig({
      hideNoAlerts: false,
      visibility: [
        userCondition,
        { condition: 'state', entity: 'sensor.nws_alerts', state_not: '0' },
      ],
    }));
    expect(result).toEqual([userCondition]);
  });

  it('replaces a flat condition with an OR wrapper when a second entity is added', () => {
    const editor = makeEditor();
    const result = editor._syncMultiEntityVisibility(makeConfig({
      entity: 'sensor.nws_alerts',
      entities: ['sensor.nws_alerts_2'],
      hideNoAlerts: true,
      visibility: [
        { condition: 'state', entity: 'sensor.nws_alerts', state_not: '0' },
      ],
    }));
    expect(result).toEqual([
      {
        condition: 'or',
        conditions: [
          { condition: 'state', entity: 'sensor.nws_alerts', state_not: '0' },
          { condition: 'state', entity: 'sensor.nws_alerts_2', state_not: '0' },
        ],
      },
    ]);
  });

  it('cleans up a stale OR wrapper referencing a removed entity', () => {
    const editor = makeEditor();
    const result = editor._syncMultiEntityVisibility(makeConfig({
      entity: 'sensor.nws_alerts',
      hideNoAlerts: true,
      visibility: [
        {
          condition: 'or',
          conditions: [
            { condition: 'state', entity: 'sensor.nws_alerts', state_not: '0' },
            { condition: 'state', entity: 'sensor.removed', state_not: '0' },
          ],
        },
      ],
    }));
    expect(result).toEqual([
      { condition: 'state', entity: 'sensor.nws_alerts', state_not: '0' },
    ]);
  });
});

describe('_isManagedCondition', () => {
  it('recognizes a flat state_not condition for a managed entity', () => {
    const editor = makeEditor();
    expect(editor._isManagedCondition(
      { condition: 'state', entity: 'sensor.x', state_not: '0' },
      new Set(['sensor.x']),
    )).toBe(true);
  });

  it('ignores flat state conditions for non-managed entities', () => {
    const editor = makeEditor();
    expect(editor._isManagedCondition(
      { condition: 'state', entity: 'input_boolean.other', state: 'on' },
      new Set(['sensor.x']),
    )).toBe(false);
  });

  it('recognizes an OR wrapper whose subs all match the managed shape', () => {
    const editor = makeEditor();
    expect(editor._isManagedCondition(
      {
        condition: 'or',
        conditions: [
          { condition: 'state', entity: 'sensor.a', state_not: '0' },
          { condition: 'state', entity: 'binary_sensor.b', state: 'on' },
        ],
      },
      new Set(),
    )).toBe(true);
  });

  it('leaves an OR block with non-matching subs alone', () => {
    const editor = makeEditor();
    expect(editor._isManagedCondition(
      {
        condition: 'or',
        conditions: [
          { condition: 'state', entity: 'sensor.a', state_not: '0' },
          { condition: 'state', entity: 'input_boolean.mode', state: 'off' },
        ],
      },
      new Set(),
    )).toBe(false);
  });

  it('does not treat an empty OR block as managed', () => {
    const editor = makeEditor();
    expect(editor._isManagedCondition(
      { condition: 'or', conditions: [] },
      new Set(),
    )).toBe(false);
  });
});

describe('editor dismissal scope (device-mode CAP)', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        get length() { return store.size; },
        clear: () => store.clear(),
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        key: (i: number) => Array.from(store.keys())[i] ?? null,
      },
      configurable: true,
      writable: true,
    });
  });

  it('derives the same scope hash the card uses for a device-only config', () => {
    const editor = makeEditor();
    const config = { type: 'custom:weather-alerts-card', device: 'cap-dev-1' } as WeatherAlertsCardConfig;
    editor._config = config;
    // The card writes under scopeHashForConfig(config); the editor must read
    // the identical key, even though there is no `entity`.
    expect(editor._currentScopeHash()).toBe(scopeHashForConfig(config));
    expect(editor._currentScopeHash()).not.toBe('');
  });

  it('counts dismissals stored under the device scope so restore-all is reachable', () => {
    const config = { type: 'custom:weather-alerts-card', device: 'cap-dev-1' } as WeatherAlertsCardConfig;
    // Simulate the card having dismissed two alerts under its device scope.
    // Fresh lastSeenAt so loadDismissals' 30-day staleness prune doesn't drop them.
    const fresh = Math.floor(Date.now() / 1000);
    saveDismissals(scopeHashForConfig(config), new Map([
      ['a', { sig: 's1', dismissedAt: fresh, lastSeenAt: fresh }],
      ['b', { sig: 's2', dismissedAt: fresh, lastSeenAt: fresh }],
    ]));
    const editor = makeEditor();
    editor._config = config;
    // Before the fix this was 0 (empty scope) and the restore-all UI never showed.
    expect(editor._getDismissedCount()).toBe(2);
  });
});
