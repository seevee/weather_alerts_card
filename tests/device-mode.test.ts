import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';

// jsdom lacks matchMedia; LitElement/the card's _motionQuery touches it during
// construction, so the polyfill must be installed before the card module loads.
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

import { WeatherAlertsCard, resolveDeviceAlertEntities } from '../src/weather-alerts-card';
import type {
  HomeAssistant,
  EntityRegistryDisplayEntry,
  WeatherAlertsCardConfig,
  DismissalRecord,
} from '../src/types';

const DEVICE = '79aa726d100270b5cdd732f51662d4d0';
const OTHER_DEVICE = 'aa11bb22cc33dd44ee55ff6677889900';

function entry(
  entity_id: string,
  device_id: string | null = DEVICE,
  overrides: Partial<EntityRegistryDisplayEntry> = {},
): EntityRegistryDisplayEntry {
  return { entity_id, device_id, platform: 'cap_alerts', ...overrides };
}

function capAlertAttrs(extra: Record<string, unknown> = {}): Record<string, unknown> {
  // Anchor to Date.now() so the alert is always within its active window;
  // hard-coded ISO strings rot the moment the wall clock crosses `expires`,
  // and `hideExpired` (default true) silently filters them out.
  const now = Date.now();
  return {
    incident_platform_version: '1.0',
    id: 'urn:oid:2.49.0.1.276.0.abc',
    event: 'Frost',
    severity: 'Moderate',
    severity_normalized: 'moderate',
    sent: new Date(now - 9 * 60 * 60 * 1000).toISOString(),
    expires: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
    ...extra,
  };
}

function makeHass(
  entities: EntityRegistryDisplayEntry[],
  states: Record<string, { state: string; attributes: Record<string, unknown> }>,
): HomeAssistant {
  const reg: Record<string, EntityRegistryDisplayEntry> = {};
  for (const e of entities) reg[e.entity_id] = e;
  return {
    states,
    locale: { language: 'en' },
    entities: reg,
  } as unknown as HomeAssistant;
}

describe('resolveDeviceAlertEntities', () => {
  it('returns matching per-alert entities under the device', () => {
    const ids = [
      'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06',
      'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_75f375fc',
    ];
    const hass = makeHass(
      ids.map(id => entry(id)),
      Object.fromEntries(ids.map(id => [id, { state: 'moderate', attributes: capAlertAttrs() }])),
    );
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual(ids);
  });

  it('skips diagnostic siblings (count, last_updated) under the same device', () => {
    const alertId = 'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06';
    const countId = 'sensor.cap_alerts_meteoalarm_germany_alert_count';
    const updatedId = 'sensor.cap_alerts_meteoalarm_germany_last_updated';
    const hass = makeHass(
      [entry(alertId), entry(countId), entry(updatedId)],
      {
        [alertId]: { state: 'moderate', attributes: capAlertAttrs() },
        [countId]: { state: '4', attributes: { friendly_name: 'Alert count' } },
        [updatedId]: { state: '2026-04-26T01:55:00+00:00', attributes: {} },
      },
    );
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([alertId]);
  });

  it('ignores entries from other devices', () => {
    const mineId = 'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_aaa';
    const otherId = 'sensor.cap_alerts_nws_county_cap_alert_tornado_bbb';
    const hass = makeHass(
      [entry(mineId, DEVICE), entry(otherId, OTHER_DEVICE)],
      {
        [mineId]: { state: 'moderate', attributes: capAlertAttrs() },
        [otherId]: { state: 'severe', attributes: capAlertAttrs() },
      },
    );
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([mineId]);
  });

  it('matches the real CAP Alerts entity_id format from a live install', () => {
    // Format observed in production: device slug prefixed by HA when
    // `_attr_has_entity_name` is True and `suggested_object_id` is set.
    const id = 'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06';
    const hass = makeHass(
      [entry(id)],
      { [id]: { state: 'moderate', attributes: capAlertAttrs() } },
    );
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([id]);
  });

  it('returns [] when hass.entities is undefined', () => {
    const hass = { states: {}, locale: { language: 'en' } } as unknown as HomeAssistant;
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([]);
  });

  it('returns [] when registry has the entity but state is missing', () => {
    const id = 'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06';
    const hass = makeHass([entry(id)], {});
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([]);
  });

  it('skips entries with null device_id', () => {
    const id = 'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06';
    const hass = makeHass(
      [entry(id, null)],
      { [id]: { state: 'moderate', attributes: capAlertAttrs() } },
    );
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([]);
  });

  it('skips entries whose state attributes are not recognised by any adapter', () => {
    const id = 'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06';
    // No incident_platform_version, no Alerts, no warnings — nothing matches.
    const hass = makeHass(
      [entry(id)],
      { [id]: { state: 'moderate', attributes: { friendly_name: 'Frost' } } },
    );
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([]);
  });
});

// Reach into the card's privates to keep test surface contained while still
// exercising the real wiring of setConfig → _getAllEntities → render.
type CardInternals = WeatherAlertsCard & {
  _config?: WeatherAlertsCardConfig;
  _registryEntries: EntityRegistryDisplayEntry[] | null;
  _dismissals: Map<string, DismissalRecord>;
  _dismissalsScope: string;
  _scopeHash: string;
  _getAllEntities(): string[];
  _deviceHasAnyEntity(deviceId: string): boolean;
  _getAlerts(): unknown[];
  _onDismiss(alert: unknown): void;
};

function makeCard(): CardInternals {
  return new WeatherAlertsCard() as unknown as CardInternals;
}

describe('WeatherAlertsCard._getAllEntities', () => {
  const ALERT_A = 'sensor.cap_alerts_x_cap_alert_frost_aaa';
  const ALERT_B = 'sensor.cap_alerts_x_cap_alert_frost_bbb';
  const ALERT_C = 'sensor.cap_alerts_x_cap_alert_frost_ccc';

  it('returns the full per-device set when only `device` is configured', () => {
    const card = makeCard();
    const ids = [ALERT_A, ALERT_B, ALERT_C];
    card.setConfig({ type: 'custom:weather-alerts-card', device: DEVICE } as WeatherAlertsCardConfig);
    card.hass = makeHass(
      ids.map(id => entry(id)),
      Object.fromEntries(ids.map(id => [id, { state: 'moderate', attributes: capAlertAttrs() }])),
    );
    expect(card._getAllEntities()).toEqual(ids);
  });

  it('merges `entities:` first then device-discovered ids without duplicates', () => {
    const card = makeCard();
    const explicit = ['sensor.explicit_a', 'sensor.explicit_b'];
    const deviceIds = [ALERT_A, ALERT_B];
    card.setConfig({
      type: 'custom:weather-alerts-card',
      entity: explicit[0],
      entities: explicit,
      device: DEVICE,
    } as WeatherAlertsCardConfig);
    card.hass = makeHass(
      deviceIds.map(id => entry(id)),
      Object.fromEntries(
        [...explicit, ...deviceIds].map(id => [id, { state: 'moderate', attributes: capAlertAttrs() }]),
      ),
    );
    // Explicit-first ordering, no duplicate of `entity` which is also in `entities`.
    expect(card._getAllEntities()).toEqual([explicit[0], explicit[1], ALERT_A, ALERT_B]);
  });

  it('drops device ids that are already in `entities:` (dedup)', () => {
    const card = makeCard();
    card.setConfig({
      type: 'custom:weather-alerts-card',
      entity: ALERT_A,
      entities: [ALERT_A, ALERT_B],
      device: DEVICE,
    } as WeatherAlertsCardConfig);
    card.hass = makeHass(
      [entry(ALERT_A), entry(ALERT_B), entry(ALERT_C)],
      Object.fromEntries(
        [ALERT_A, ALERT_B, ALERT_C].map(id => [id, { state: 'moderate', attributes: capAlertAttrs() }]),
      ),
    );
    expect(card._getAllEntities()).toEqual([ALERT_A, ALERT_B, ALERT_C]);
  });

  it('tolerates an empty-string `entity` (defensive — old YAML)', () => {
    const card = makeCard();
    card.setConfig({
      type: 'custom:weather-alerts-card',
      entity: '',
      device: DEVICE,
    } as WeatherAlertsCardConfig);
    card.hass = makeHass(
      [entry(ALERT_A)],
      { [ALERT_A]: { state: 'moderate', attributes: capAlertAttrs() } },
    );
    expect(card._getAllEntities()).toEqual([ALERT_A]);
  });

  it('returns [] when neither hass nor config provides anything resolvable', () => {
    const card = makeCard();
    card.setConfig({
      type: 'custom:weather-alerts-card',
      device: DEVICE,
    } as WeatherAlertsCardConfig);
    card.hass = makeHass([], {});
    expect(card._getAllEntities()).toEqual([]);
  });
});

describe('WeatherAlertsCard.setConfig', () => {
  it('accepts a device-only config (no entity, no entities)', () => {
    const card = makeCard();
    expect(() =>
      card.setConfig({ type: 'custom:weather-alerts-card', device: DEVICE } as WeatherAlertsCardConfig),
    ).not.toThrow();
    expect(card._config?.device).toBe(DEVICE);
    expect(card._config?.entity).toBeUndefined();
  });

  it('accepts an entity-only config', () => {
    const card = makeCard();
    expect(() =>
      card.setConfig({ type: 'custom:weather-alerts-card', entity: 'sensor.x' } as WeatherAlertsCardConfig),
    ).not.toThrow();
  });

  it('accepts an entities-only config (entity defaults to entities[0])', () => {
    const card = makeCard();
    card.setConfig({
      type: 'custom:weather-alerts-card',
      entities: ['sensor.a', 'sensor.b'],
    } as WeatherAlertsCardConfig);
    expect(card._config?.entity).toBe('sensor.a');
  });

  it('throws when entity, entities, and device are all absent', () => {
    const card = makeCard();
    expect(() =>
      card.setConfig({ type: 'custom:weather-alerts-card' } as WeatherAlertsCardConfig),
    ).toThrow(/entity or device/);
  });
});

// ---------------------------------------------------------------
// Render-mode + reactive-update tests (DOM mount)
// ---------------------------------------------------------------

function makeMockConnection(initial: EntityRegistryDisplayEntry[] = []) {
  let snapshot = initial.slice();
  let registryHandler: (() => void) | null = null;
  const conn = {
    sendMessagePromise: async (msg: { type: string }) => {
      if (msg.type === 'config/entity_registry/list') return snapshot.slice();
      return undefined;
    },
    subscribeEvents: async (handler: () => void, _type: string) => {
      registryHandler = handler;
      return () => { registryHandler = null; };
    },
  } as unknown as Connection;
  return {
    conn,
    setSnapshot(next: EntityRegistryDisplayEntry[]) { snapshot = next.slice(); },
    fireEvent() { registryHandler?.(); },
  };
}

async function flushAsync(): Promise<void> {
  // subscribeEntityRegistry chains an awaited subscribeEvents → awaited
  // sendMessagePromise → onChange. Two macrotask ticks comfortably cover
  // both the subscribe round-trip and the trailing fetch.
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
}

async function mountCard(
  config: WeatherAlertsCardConfig,
  hass: HomeAssistant,
): Promise<{ card: CardInternals; cleanup: () => void }> {
  const card = document.createElement('weather-alerts-card') as unknown as CardInternals;
  card.setConfig(config);
  card.hass = hass;
  document.body.appendChild(card);
  await (card as unknown as { updateComplete: Promise<void> }).updateComplete;
  await flushAsync();
  await (card as unknown as { updateComplete: Promise<void> }).updateComplete;
  return {
    card,
    cleanup: () => { card.remove(); },
  };
}

function shadow(card: CardInternals): ShadowRoot {
  const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
  if (!root) throw new Error('shadowRoot not attached');
  return root;
}

function hasEl(card: CardInternals, selector: string): boolean {
  return shadow(card).querySelector(selector) !== null;
}

beforeEach(() => {
  // Defensive localStorage polyfill — Vitest's jsdom env supplies one but
  // some Node versions ship a Storage stub missing key/length, which the
  // dismissal module doesn't tolerate.
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

describe('WeatherAlertsCard render in device mode', () => {
  const ALERT_ID = 'sensor.cap_alerts_x_cap_alert_frost_aaa';

  it('renders the alert when device resolves ≥1 and states are populated', async () => {
    const hass = makeHass(
      [entry(ALERT_ID)],
      { [ALERT_ID]: { state: 'moderate', attributes: capAlertAttrs({ event: 'Frost' }) } },
    );
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', device: DEVICE } as WeatherAlertsCardConfig,
      hass,
    );
    expect(hasEl(card, '.preview-label')).toBe(false);
    expect(hasEl(card, '.no-alerts')).toBe(false);
    expect(hasEl(card, '.alert-card')).toBe(true);
    cleanup();
  });

  it('renders "No active alerts" when device is registered but states are empty', async () => {
    // Registry entry exists for the device, but hass.states does not include
    // the per-alert sensor — i.e. the integration cleared all active alerts.
    const hass = makeHass([entry(ALERT_ID)], {});
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', device: DEVICE } as WeatherAlertsCardConfig,
      hass,
    );
    expect(hasEl(card, '.preview-label')).toBe(false);
    expect(hasEl(card, '.no-alerts')).toBe(true);
    cleanup();
  });

  it('renders preview when device has no entries at all', async () => {
    const hass = makeHass([], {});
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', device: DEVICE } as WeatherAlertsCardConfig,
      hass,
    );
    expect(hasEl(card, '.preview-label')).toBe(true);
    cleanup();
  });

  it('re-renders when registry subscription delivers entries after initial paint', async () => {
    // Start with empty registry but a live connection so the WS subscription
    // path takes over and `_registryEntries` populates asynchronously.
    const mock = makeMockConnection([]);
    const hass = {
      states: { [ALERT_ID]: { state: 'moderate', attributes: capAlertAttrs({ event: 'Frost' }) } },
      locale: { language: 'en' },
      entities: undefined,  // force fall-through to the WS-cached registry
      connection: mock.conn,
    } as unknown as HomeAssistant;

    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', device: DEVICE } as WeatherAlertsCardConfig,
      hass,
    );
    expect(hasEl(card, '.preview-label')).toBe(true);

    mock.setSnapshot([entry(ALERT_ID)]);
    mock.fireEvent();
    await flushAsync();
    await (card as unknown as { updateComplete: Promise<void> }).updateComplete;

    expect(hasEl(card, '.preview-label')).toBe(false);
    expect(hasEl(card, '.alert-card')).toBe(true);
    cleanup();
  });
});

describe('WeatherAlertsCard reactive registry updates', () => {
  const ALERT_ID_1 = 'sensor.cap_alerts_x_cap_alert_frost_aaa';
  const ALERT_ID_2 = 'sensor.cap_alerts_x_cap_alert_wind_bbb';

  it('renders preview → alert → no-alerts as the registry mutates', async () => {
    const mock = makeMockConnection([]);
    const hass = {
      states: {
        [ALERT_ID_1]: { state: 'moderate', attributes: capAlertAttrs({ event: 'Frost' }) },
        [ALERT_ID_2]: { state: 'moderate', attributes: capAlertAttrs({ event: 'Wind' }) },
      },
      locale: { language: 'en' },
      entities: undefined,
      connection: mock.conn,
    } as unknown as HomeAssistant;

    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', device: DEVICE } as WeatherAlertsCardConfig,
      hass,
    );
    // Phase 1: empty registry → preview.
    expect(hasEl(card, '.preview-label')).toBe(true);

    // Phase 2: one matching entry → alert renders.
    mock.setSnapshot([entry(ALERT_ID_1)]);
    mock.fireEvent();
    await flushAsync();
    await (card as unknown as { updateComplete: Promise<void> }).updateComplete;
    expect(hasEl(card, '.alert-card')).toBe(true);

    // Phase 3: registry now lists an entry whose state is missing — device is
    // still "linked" (deviceHasAnyEntity is true) so we surface "No active
    // alerts" rather than falling back to preview.
    const stripped = {
      ...hass,
      states: {},  // alert state evicted
    } as unknown as HomeAssistant;
    card.hass = stripped;
    await (card as unknown as { updateComplete: Promise<void> }).updateComplete;
    expect(hasEl(card, '.no-alerts')).toBe(true);

    cleanup();
  });
});

describe('WeatherAlertsCard dismissal scope stability across registry churn', () => {
  const ALERT_ID_1 = 'sensor.cap_alerts_x_cap_alert_frost_aaa';
  const ALERT_ID_2 = 'sensor.cap_alerts_x_cap_alert_wind_bbb';

  it('keeps the dismissal scope stable when the resolved entity set changes', async () => {
    const mock = makeMockConnection([entry(ALERT_ID_1)]);
    const hass = {
      states: {
        [ALERT_ID_1]: { state: 'moderate', attributes: capAlertAttrs({ event: 'Frost' }) },
        [ALERT_ID_2]: { state: 'moderate', attributes: capAlertAttrs({ event: 'Wind' }) },
      },
      locale: { language: 'en' },
      entities: undefined,
      connection: mock.conn,
    } as unknown as HomeAssistant;

    const { card, cleanup } = await mountCard(
      {
        type: 'custom:weather-alerts-card',
        device: DEVICE,
        allowDismiss: true,
      } as WeatherAlertsCardConfig,
      hass,
    );

    const scopeBefore = card._scopeHash;
    expect(scopeBefore).not.toBe('');

    // Force one alert through to the dismissal map.
    const alerts = card._getAlerts() as { id: string; severity: string; sentTs: number; endsTs: number; phase: string }[];
    expect(alerts.length).toBeGreaterThan(0);
    card._onDismiss(alerts[0]);
    expect(card._dismissals.size).toBe(1);

    // Resolved set grows from 1 → 2 entities. Dismissal scope must NOT
    // recompute (it keys on the *configured* tokens, not resolved ids).
    mock.setSnapshot([entry(ALERT_ID_1), entry(ALERT_ID_2)]);
    mock.fireEvent();
    await flushAsync();
    await (card as unknown as { updateComplete: Promise<void> }).updateComplete;

    expect(card._scopeHash).toBe(scopeBefore);
    expect(card._dismissals.size).toBe(1);
    cleanup();
  });
});
