import { describe, it, expect } from 'vitest';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import type { WeatherAlertsCardConfig } from '../src/types';

// Reach into private helpers — this suite exists to pin down the
// condition-matching heuristics used to sync HA visibility conditions.
type EditorInternals = {
  _syncMultiEntityVisibility(
    config: WeatherAlertsCardConfig,
  ): Record<string, unknown>[] | undefined;
  _isManagedCondition(
    c: Record<string, unknown>,
    managedIds: Set<string>,
  ): boolean;
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
