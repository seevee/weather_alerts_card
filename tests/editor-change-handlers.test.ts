import { describe, it, expect } from 'vitest';
import { render } from 'lit';
import type { Connection } from 'home-assistant-js-websocket';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import { scopeHashForConfig } from '../src/dismissal';
import type { HomeAssistant, WeatherAlertsCardConfig, EntityRegistryDisplayEntry } from '../src/types';

// The editor's per-field change handlers all follow one shape: read the
// control, copy the config, set or delete one key, fire config-changed. They
// had no direct tests, so this file drives each through a synthetic event and
// asserts the emitted config, then covers the two lifecycle hooks that keep
// the dismissal and registry subscriptions aligned with the config.

type EditorInternals = Omit<WeatherAlertsCardEditor, never> & {
  _config: WeatherAlertsCardConfig;
  _showPreview: boolean;
  _subscribedDismissalsScope: string;
  _unsubscribeDismissals?: () => void;
  _subscribedRegistryConn?: Connection;
  _registryEntries: EntityRegistryDisplayEntry[] | null;
  _titleChanged(ev: Event): void;
  _zonesChanged(ev: Event): void;
  _eventCodesChanged(ev: Event): void;
  _excludeEventCodesChanged(ev: Event): void;
  _feedsChanged(ev: CustomEvent): void;
  _entityChanged(ev: CustomEvent): void;
  _previewChanged(ev: Event): void;
  _renderSourceHint(lang: string): unknown;
};

const NSW_SOURCE = 'nsw_rural_fire_service_feed';
const DEVICE = '79aa726d100270b5cdd732f51662d4d0';

function makeHass(states: Record<string, { state: string; attributes: Record<string, unknown> }> = {}): HomeAssistant {
  return { states, locale: { language: 'en' } } as unknown as HomeAssistant;
}

function makeEditor(config: Partial<WeatherAlertsCardConfig> = {}, hass: HomeAssistant = makeHass()) {
  const editor = new WeatherAlertsCardEditor() as unknown as EditorInternals;
  editor._config = { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', ...config };
  editor.hass = hass;
  const events: WeatherAlertsCardConfig[] = [];
  editor.addEventListener('config-changed', (ev) => events.push((ev as CustomEvent).detail.config));
  return { editor, events };
}

const input = (value: string) => ({ target: { value } }) as unknown as Event;
const checkbox = (checked: boolean) => ({ target: { checked } }) as unknown as Event;
const selector = (value: unknown) => ({ detail: { value } }) as CustomEvent;

describe('comma-list text fields', () => {
  const cases: {
    key: 'zones' | 'eventCodes' | 'excludeEventCodes';
    handler: '_zonesChanged' | '_eventCodesChanged' | '_excludeEventCodesChanged';
    raw: string;
    parsed: string[];
  }[] = [
    { key: 'zones', handler: '_zonesChanged', raw: ' ILZ014, ILZ015 ,,', parsed: ['ILZ014', 'ILZ015'] },
    { key: 'eventCodes', handler: '_eventCodesChanged', raw: 'tor, sv ', parsed: ['TOR', 'SV'] },
    { key: 'excludeEventCodes', handler: '_excludeEventCodesChanged', raw: ' ffa ,,heat', parsed: ['FFA', 'HEAT'] },
  ];

  for (const c of cases) {
    it(`${c.key}: splits on commas, trims, drops empties${c.key === 'zones' ? '' : ', upper-cases'}`, () => {
      const { editor, events } = makeEditor();
      (editor[c.handler])(input(c.raw));
      expect(events).toHaveLength(1);
      expect(events[0][c.key]).toEqual(c.parsed);
    });

    it(`${c.key}: a blank field removes the key`, () => {
      const { editor, events } = makeEditor({ [c.key]: ['X'] });
      (editor[c.handler])(input('   '));
      expect(events).toHaveLength(1);
      expect(events[0]).not.toHaveProperty(c.key);
    });
  }
});

describe('_titleChanged', () => {
  it('writes a new title', () => {
    const { editor, events } = makeEditor();
    editor._titleChanged(input('Storms'));
    expect(events).toEqual([expect.objectContaining({ title: 'Storms' })]);
  });

  it('removes the key when cleared', () => {
    const { editor, events } = makeEditor({ title: 'Storms' });
    editor._titleChanged(input(''));
    expect(events).toHaveLength(1);
    expect(events[0]).not.toHaveProperty('title');
  });

  it('does not emit when the value is unchanged, including empty against unset', () => {
    const { editor, events } = makeEditor({ title: 'Storms' });
    editor._titleChanged(input('Storms'));
    const unset = makeEditor();
    unset.editor._titleChanged(input(''));
    expect(events).toHaveLength(0);
    expect(unset.events).toHaveLength(0);
  });
});

describe('_feedsChanged', () => {
  it('writes the selected sources', () => {
    const { editor, events } = makeEditor();
    editor._feedsChanged(selector([NSW_SOURCE, 'inmet']));
    expect(events[0].sources).toEqual([NSW_SOURCE, 'inmet']);
  });

  it('accepts a single-string value', () => {
    const { editor, events } = makeEditor();
    editor._feedsChanged(selector(NSW_SOURCE));
    expect(events[0].sources).toEqual([NSW_SOURCE]);
  });

  it('removes the key on an empty selection, array or falsy', () => {
    for (const value of [[], '', undefined]) {
      const { editor, events } = makeEditor({ sources: [NSW_SOURCE] });
      editor._feedsChanged(selector(value));
      expect(events[0]).not.toHaveProperty('sources');
    }
  });
});

describe('_entityChanged', () => {
  it('writes the first pick to entity and the rest to entities', () => {
    const { editor, events } = makeEditor();
    editor._entityChanged(selector(['sensor.a', 'sensor.b', 'sensor.c']));
    expect(events[0].entity).toBe('sensor.a');
    expect(events[0].entities).toEqual(['sensor.b', 'sensor.c']);
  });

  it('drops entities again when the selection shrinks to one, and accepts a bare string', () => {
    const { editor, events } = makeEditor({ entities: ['sensor.b'] });
    editor._entityChanged(selector('sensor.a'));
    expect(events[0].entity).toBe('sensor.a');
    expect(events[0]).not.toHaveProperty('entities');
  });

  it('clears entity to an empty string on an empty selection', () => {
    const { editor, events } = makeEditor({ entities: ['sensor.b'] });
    editor._entityChanged(selector([]));
    expect(events[0].entity).toBe('');
    expect(events[0]).not.toHaveProperty('entities');
  });

  it('leaves visibility alone unless hideNoAlerts is on', () => {
    const { editor, events } = makeEditor({ visibility: [{ condition: 'user', users: ['u'] }] });
    editor._entityChanged(selector(['sensor.a', 'sensor.b']));
    expect(events[0].visibility).toEqual([{ condition: 'user', users: ['u'] }]);
  });

  it('rebuilds a flat managed condition for one entity under hideNoAlerts', () => {
    const { editor, events } = makeEditor({ hideNoAlerts: true });
    editor._entityChanged(selector(['sensor.a']));
    const vis = events[0].visibility as Record<string, unknown>[];
    expect(vis).toHaveLength(1);
    expect(vis[0]).toMatchObject({ condition: 'state', entity: 'sensor.a' });
  });

  it('wraps two or more entities in an or block under hideNoAlerts, keeping user conditions', () => {
    const { editor, events } = makeEditor({ hideNoAlerts: true, visibility: [{ condition: 'user', users: ['u'] }] });
    editor._entityChanged(selector(['sensor.a', 'sensor.b']));
    const vis = events[0].visibility as Record<string, unknown>[];
    expect(vis[0]).toEqual({ condition: 'user', users: ['u'] });
    expect(vis[1]).toMatchObject({ condition: 'or' });
    const subs = (vis[1] as { conditions: Record<string, unknown>[] }).conditions;
    expect(subs.map(s => s.entity)).toEqual(['sensor.a', 'sensor.b']);
  });

  it('removes a flat managed condition when hideNoAlerts is on but the selection is emptied', () => {
    const { editor, events } = makeEditor({
      hideNoAlerts: true,
      visibility: [{ condition: 'state', entity: 'sensor.nws_alerts', state_not: '0' }],
    });
    editor._entityChanged(selector([]));
    expect(events[0]).not.toHaveProperty('visibility');
  });

  it('removes a managed or wrapper when hideNoAlerts is on but the selection is emptied', () => {
    const { editor, events } = makeEditor({
      hideNoAlerts: true,
      entities: ['sensor.b'],
      visibility: [{
        condition: 'or',
        conditions: [
          { condition: 'state', entity: 'sensor.nws_alerts', state_not: '0' },
          { condition: 'state', entity: 'sensor.b', state_not: '0' },
        ],
      }],
    });
    editor._entityChanged(selector([]));
    expect(events[0]).not.toHaveProperty('visibility');
  });
});

describe('_previewChanged', () => {
  it('sets the _preview key and the local flag when checked', () => {
    const { editor, events } = makeEditor();
    editor._previewChanged(checkbox(true));
    expect(editor._showPreview).toBe(true);
    expect(events[0]._preview).toBe(true);
  });

  it('removes the key when unchecked', () => {
    const { editor, events } = makeEditor({ _preview: true });
    editor._previewChanged(checkbox(false));
    expect(editor._showPreview).toBe(false);
    expect(events[0]).not.toHaveProperty('_preview');
  });
});

describe('_renderSourceHint', () => {
  function hint(editor: EditorInternals): { warning: string[]; info: string[] } {
    const host = document.createElement('div');
    render(editor._renderSourceHint('en'), host);
    const of = (type: string) => [...host.querySelectorAll(`ha-alert[alert-type="${type}"]`)].map(el => (el.textContent || '').trim());
    return { warning: of('warning'), info: of('info') };
  }

  const incident = (source: string) => ({ state: '1', attributes: { source } });

  it('renders nothing without sources, and nothing without hass', () => {
    expect(hint(makeEditor().editor)).toEqual({ warning: [], info: [] });
    const { editor } = makeEditor({ sources: [NSW_SOURCE] });
    (editor as { hass: HomeAssistant | undefined }).hass = undefined;
    expect(hint(editor)).toEqual({ warning: [], info: [] });
  });

  it('counts live incidents across the configured sources', () => {
    const hass = makeHass({
      'geo_location.a': incident(NSW_SOURCE),
      'geo_location.b': incident(NSW_SOURCE),
      'geo_location.c': incident('unrelated_feed'),
      'sensor.plain': { state: '0', attributes: {} },
    });
    const { editor } = makeEditor({ sources: [NSW_SOURCE] }, hass);
    const out = hint(editor);
    expect(out.warning).toEqual([]);
    expect(out.info).toHaveLength(1);
    expect(out.info[0]).toContain('2 live incident');
  });

  it('warns for a configured source with no live entity, naming known feeds by provider', () => {
    const { editor } = makeEditor({ sources: [NSW_SOURCE, 'mystery_feed'] }, makeHass({ 'geo_location.a': incident('other') }));
    const out = hint(editor);
    expect(out.info).toEqual([]);
    expect(out.warning).toHaveLength(1);
    expect(out.warning[0]).toContain('NSW RFS (Australia), mystery_feed');
  });
});

// ---------------------------------------------------------------
// Lifecycle: updated() keeps the dismissal-change and entity-registry
// subscriptions aligned with the config; disconnectedCallback tears down.
// ---------------------------------------------------------------

function makeMockConnection(initial: EntityRegistryDisplayEntry[] = [], opts: { reject?: boolean } = {}) {
  let snapshot = initial.slice();
  let unsubscribes = 0;
  const conn = {
    sendMessagePromise: async (msg: { type: string }) => {
      if (opts.reject) throw new Error('boom');
      if (msg.type === 'config/entity_registry/list') return snapshot.slice();
      return undefined;
    },
    subscribeEvents: async (_handler: () => void, _type: string) => {
      return () => { unsubscribes++; };
    },
  } as unknown as Connection;
  return {
    conn,
    setSnapshot(next: EntityRegistryDisplayEntry[]) { snapshot = next.slice(); },
    get unsubscribes() { return unsubscribes; },
  };
}

async function flushAsync(): Promise<void> {
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
}

async function mountEditor(config: Partial<WeatherAlertsCardConfig>, hass: HomeAssistant) {
  const editor = document.createElement('weather-alerts-card-editor') as unknown as EditorInternals;
  editor.setConfig({ type: 'custom:weather-alerts-card', ...config } as WeatherAlertsCardConfig);
  editor.hass = hass;
  document.body.appendChild(editor);
  await editor.updateComplete;
  return editor;
}

describe('updated(): dismissal subscription follows the scope', () => {
  it('subscribes for the configured entity set and moves when the set changes', async () => {
    const editor = await mountEditor({ entity: 'sensor.nws_alerts' }, makeHass());
    expect(editor._subscribedDismissalsScope).toBe(scopeHashForConfig({ entity: 'sensor.nws_alerts' }));
    expect(editor._unsubscribeDismissals).toBeDefined();

    editor.setConfig({ type: 'custom:weather-alerts-card', entity: 'sensor.other' });
    await editor.updateComplete;
    expect(editor._subscribedDismissalsScope).toBe(scopeHashForConfig({ entity: 'sensor.other' }));
  });

  it('drops the subscription when no source is configured', async () => {
    const editor = await mountEditor({ entity: 'sensor.nws_alerts' }, makeHass());
    editor.setConfig({ type: 'custom:weather-alerts-card', entity: '' });
    await editor.updateComplete;
    expect(editor._subscribedDismissalsScope).toBe('');
    expect(editor._unsubscribeDismissals).toBeUndefined();
  });

  it('tears down on disconnect', async () => {
    const editor = await mountEditor({ entity: 'sensor.nws_alerts' }, makeHass());
    editor.remove();
    expect(editor._subscribedDismissalsScope).toBe('');
    expect(editor._unsubscribeDismissals).toBeUndefined();
    expect(editor._subscribedRegistryConn).toBeUndefined();
  });
});

describe('updated(): registry subscription only in device mode', () => {
  const entry = (entity_id: string): EntityRegistryDisplayEntry => ({ entity_id, device_id: DEVICE, platform: 'cap_alerts' });

  it('does not subscribe for a plain entity card', async () => {
    const mock = makeMockConnection([entry('sensor.x')]);
    const hass = { ...makeHass(), connection: mock.conn } as unknown as HomeAssistant;
    const editor = await mountEditor({ entity: 'sensor.nws_alerts' }, hass);
    await flushAsync();
    expect(editor._subscribedRegistryConn).toBeUndefined();
    expect(editor._registryEntries).toBeNull();
  });

  it('subscribes for a device card and receives the registry snapshot', async () => {
    const mock = makeMockConnection([entry('sensor.x')]);
    const hass = { ...makeHass(), connection: mock.conn } as unknown as HomeAssistant;
    const editor = await mountEditor({ device: DEVICE }, hass);
    await flushAsync();
    expect(editor._subscribedRegistryConn).toBe(mock.conn);
    expect(editor._registryEntries).toEqual([entry('sensor.x')]);
  });

  it('tears down when the config leaves device mode', async () => {
    const mock = makeMockConnection([entry('sensor.x')]);
    const hass = { ...makeHass(), connection: mock.conn } as unknown as HomeAssistant;
    const editor = await mountEditor({ device: DEVICE }, hass);
    await flushAsync();
    editor.setConfig({ type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts' });
    await editor.updateComplete;
    expect(editor._subscribedRegistryConn).toBeUndefined();
    expect(mock.unsubscribes).toBe(1);
  });

  it('resubscribes on a new connection and unsubscribes the old one', async () => {
    const first = makeMockConnection([entry('sensor.x')]);
    const second = makeMockConnection([entry('sensor.y')]);
    const editor = await mountEditor({ device: DEVICE }, { ...makeHass(), connection: first.conn });
    await flushAsync();
    editor.hass = { ...makeHass(), connection: second.conn };
    await editor.updateComplete;
    await flushAsync();
    expect(editor._subscribedRegistryConn).toBe(second.conn);
    expect(editor._registryEntries).toEqual([entry('sensor.y')]);
    expect(first.unsubscribes).toBe(1);
  });

  it('discards a subscription that resolves after the connection was swapped', async () => {
    const first = makeMockConnection([entry('sensor.x')]);
    const second = makeMockConnection([entry('sensor.y')]);
    const editor = await mountEditor({ device: DEVICE }, { ...makeHass(), connection: first.conn });
    // Swap before the first subscribe round-trip completes.
    editor.hass = { ...makeHass(), connection: second.conn };
    await editor.updateComplete;
    await flushAsync();
    expect(editor._subscribedRegistryConn).toBe(second.conn);
    expect(first.unsubscribes).toBe(1);
    expect(second.unsubscribes).toBe(0);
  });

  it('forgets the connection when the subscription fails, so a later update retries', async () => {
    const mock = makeMockConnection([], { reject: true });
    const editor = await mountEditor({ device: DEVICE }, { ...makeHass(), connection: mock.conn });
    await flushAsync();
    expect(editor._subscribedRegistryConn).toBeUndefined();
    expect(editor._registryEntries).toBeNull();
  });
});
