import { describe, it, expect } from 'vitest';
import { render } from 'lit';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import type { HomeAssistant, WeatherAlertsCardConfig, EntityRegistryDisplayEntry } from '../src/types';

// Reach into the private helpers behind the "Alert devices" picker (#256): the
// write path that mirrors `entity`/`entities`, the device-children exclusion
// in the entity list, and the aggregated device hints.
type EditorInternals = {
  _config: WeatherAlertsCardConfig;
  hass: HomeAssistant;
  _deviceChanged(ev: CustomEvent): void;
  _getMatchingEntityIds(): string[];
  _renderNoEntitiesHint(lang: string): unknown;
  render(): unknown;
  addEventListener(type: string, listener: (ev: Event) => void): void;
};

const DEVICE = '79aa726d100270b5cdd732f51662d4d0';
const OTHER_DEVICE = 'aa11bb22cc33dd44ee55ff6677889900';
const GONE_DEVICE = '00000000000000000000000000000000';

const CHILD_A = 'sensor.cap_alerts_zone_cap_alert_frost_aaa';
const CHILD_B = 'sensor.cap_alerts_gps_cap_alert_wind_bbb';
const NWS = 'sensor.nws_alerts';

function capAlertAttrs(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now();
  return {
    incident_platform_version: '1.0',
    id: 'urn:oid:2.49.0.1.276.0.abc',
    event: 'Frost',
    severity: 'Moderate',
    severity_normalized: 'moderate',
    sent: new Date(now - 3600_000).toISOString(),
    expires: new Date(now + 3600_000).toISOString(),
    ...extra,
  };
}

function entry(entity_id: string, device_id: string): EntityRegistryDisplayEntry {
  return { entity_id, device_id, platform: 'cap_alerts' };
}

function makeHass(opts: {
  states?: Record<string, { state: string; attributes: Record<string, unknown> }>;
  entities?: EntityRegistryDisplayEntry[];
  devices?: string[] | null;
} = {}): HomeAssistant {
  const reg: Record<string, EntityRegistryDisplayEntry> = {};
  for (const e of opts.entities || []) reg[e.entity_id] = e;
  const hass: Record<string, unknown> = {
    states: opts.states || {},
    locale: { language: 'en' },
    entities: reg,
  };
  // `devices: null` models a core too old to expose the device registry.
  if (opts.devices !== null) {
    hass.devices = Object.fromEntries((opts.devices || [DEVICE, OTHER_DEVICE]).map(id => [id, { id, name: id }]));
  }
  return hass as unknown as HomeAssistant;
}

function makeEditor(config: Partial<WeatherAlertsCardConfig>, hass: HomeAssistant = makeHass()): EditorInternals {
  const editor = new WeatherAlertsCardEditor() as unknown as EditorInternals;
  editor._config = { type: 'custom:weather-alerts-card', entity: '', ...config };
  editor.hass = hass;
  return editor;
}

function fireDevices(editor: EditorInternals, value: unknown): WeatherAlertsCardConfig | undefined {
  let emitted: WeatherAlertsCardConfig | undefined;
  editor.addEventListener('config-changed', (ev: Event) => {
    emitted = (ev as CustomEvent).detail.config;
  });
  editor._deviceChanged({ detail: { value } } as CustomEvent);
  return emitted;
}

function hintText(editor: EditorInternals): { warning: string[]; info: string[] } {
  const host = document.createElement('div');
  render(editor._renderNoEntitiesHint('en'), host);
  const of = (type: string): string[] =>
    [...host.querySelectorAll(`ha-alert[alert-type="${type}"]`)].map(el => (el.textContent || '').trim());
  return { warning: of('warning'), info: of('info') };
}

describe('_deviceChanged write path', () => {
  it('writes a single pick to `device` only, byte-identical to before `devices` existed', () => {
    const emitted = fireDevices(makeEditor({}), [DEVICE]);
    expect(emitted).toEqual({ type: 'custom:weather-alerts-card', entity: '', device: DEVICE });
    expect(emitted).not.toHaveProperty('devices');
  });

  it('writes the first pick to `device` and the rest to `devices`', () => {
    const emitted = fireDevices(makeEditor({}), [DEVICE, OTHER_DEVICE]);
    expect(emitted?.device).toBe(DEVICE);
    expect(emitted?.devices).toEqual([OTHER_DEVICE]);
  });

  it('drops `devices` again when the selection shrinks to one', () => {
    const emitted = fireDevices(makeEditor({ device: DEVICE, devices: [OTHER_DEVICE] }), [OTHER_DEVICE]);
    expect(emitted?.device).toBe(OTHER_DEVICE);
    expect(emitted).not.toHaveProperty('devices');
  });

  it('removes both keys when the selection is cleared', () => {
    const emitted = fireDevices(makeEditor({ device: DEVICE, devices: [OTHER_DEVICE] }), []);
    expect(emitted).not.toHaveProperty('device');
    expect(emitted).not.toHaveProperty('devices');
  });

  it('still accepts the legacy single-string value', () => {
    expect(fireDevices(makeEditor({}), DEVICE)?.device).toBe(DEVICE);
  });

  it('does not emit when the selection is unchanged', () => {
    expect(fireDevices(makeEditor({ device: DEVICE, devices: [OTHER_DEVICE] }), [DEVICE, OTHER_DEVICE])).toBeUndefined();
  });
});

describe('_getMatchingEntityIds with devices selected', () => {
  const hass = makeHass({
    states: {
      [NWS]: { state: '0', attributes: { Alerts: [] } },
      [CHILD_A]: { state: 'moderate', attributes: capAlertAttrs() },
      [CHILD_B]: { state: 'moderate', attributes: capAlertAttrs() },
    },
    entities: [entry(CHILD_A, DEVICE), entry(CHILD_B, OTHER_DEVICE)],
  });

  it('lists device children when no device is selected', () => {
    expect(makeEditor({ entity: NWS }, hass)._getMatchingEntityIds().sort()).toEqual([CHILD_A, CHILD_B, NWS].sort());
  });

  it('keeps a selected device\'s children out of the entity list', () => {
    expect(makeEditor({ entity: NWS, device: DEVICE }, hass)._getMatchingEntityIds().sort()).toEqual([CHILD_B, NWS].sort());
  });

  it('excludes the children of every configured device', () => {
    expect(makeEditor({ entity: NWS, device: DEVICE, devices: [OTHER_DEVICE] }, hass)._getMatchingEntityIds()).toEqual([NWS]);
  });

  it('still lists a hand-configured entity even when its device is selected', () => {
    // The user must be able to see (and remove) what they listed; only the
    // device's OTHER children stay out.
    const sibling = 'sensor.cap_alerts_zone_cap_alert_wind_a2';
    const local = makeHass({
      states: {
        [CHILD_A]: { state: 'moderate', attributes: capAlertAttrs() },
        [sibling]: { state: 'moderate', attributes: capAlertAttrs() },
      },
      entities: [entry(CHILD_A, DEVICE), entry(sibling, DEVICE)],
    });
    const ids = makeEditor({ entity: CHILD_A, device: DEVICE }, local)._getMatchingEntityIds();
    expect(ids).toContain(CHILD_A);
    expect(ids).not.toContain(sibling);
  });

  it('re-evaluates when the device set changes under an unchanged hass', () => {
    const editor = makeEditor({ entity: NWS }, hass);
    expect(editor._getMatchingEntityIds()).toContain(CHILD_A);
    editor._config = { ...editor._config, device: DEVICE };
    expect(editor._getMatchingEntityIds()).not.toContain(CHILD_A);
  });
});

describe('_renderNoEntitiesHint with devices', () => {
  it('shows the no-alerts hint only when every device resolves to zero', () => {
    const idle = makeHass({ entities: [entry(CHILD_A, DEVICE), entry(CHILD_B, OTHER_DEVICE)] });
    expect(hintText(makeEditor({ device: DEVICE, devices: [OTHER_DEVICE] }, idle)).info).toHaveLength(1);

    const oneBusy = makeHass({
      states: { [CHILD_B]: { state: 'moderate', attributes: capAlertAttrs() } },
      entities: [entry(CHILD_A, DEVICE), entry(CHILD_B, OTHER_DEVICE)],
    });
    expect(hintText(makeEditor({ device: DEVICE, devices: [OTHER_DEVICE] }, oneBusy)).info).toHaveLength(0);
  });

  it('warns by id for a device the registry no longer knows', () => {
    const hass = makeHass({
      states: { [CHILD_A]: { state: 'moderate', attributes: capAlertAttrs() } },
      entities: [entry(CHILD_A, DEVICE)],
    });
    const { warning, info } = hintText(makeEditor({ device: DEVICE, devices: [GONE_DEVICE] }, hass));
    expect(warning).toHaveLength(1);
    expect(warning[0]).toContain(GONE_DEVICE);
    expect(warning[0]).not.toContain(DEVICE);
    expect(info).toHaveLength(0);
  });

  it('lists every missing device in one warning', () => {
    const { warning } = hintText(makeEditor({ device: GONE_DEVICE, devices: ['1111'] }, makeHass()));
    expect(warning).toHaveLength(1);
    expect(warning[0]).toContain(`${GONE_DEVICE}, 1111`);
  });

  it('drops the no-alerts hint when every device is missing: the warning says why', () => {
    const { warning, info } = hintText(makeEditor({ device: GONE_DEVICE }, makeHass()));
    expect(warning).toHaveLength(1);
    expect(info).toHaveLength(0);
  });

  it('never warns on a core without a device registry', () => {
    const { warning, info } = hintText(makeEditor({ device: GONE_DEVICE }, makeHass({ devices: null })));
    expect(warning).toHaveLength(0);
    expect(info).toHaveLength(1);
  });
});

describe('rendered device picker', () => {
  function devicePicker(editor: EditorInternals): { selector?: Record<string, unknown>; value?: unknown; label?: string } | undefined {
    const host = document.createElement('div');
    render(editor.render(), host);
    const selectors = [...host.querySelectorAll('ha-selector')] as unknown as {
      selector?: Record<string, unknown>; value?: unknown; label?: string;
    }[];
    return selectors.find(s => s.selector && 'device' in s.selector);
  }

  it('is multi-select, filtered to cap_alerts and nina, and shows every configured device', () => {
    const picker = devicePicker(makeEditor({ device: DEVICE, devices: [OTHER_DEVICE] }));
    expect(picker?.selector).toEqual({
      device: { multiple: true, filter: [{ integration: 'cap_alerts' }, { integration: 'nina' }] },
    });
    expect(picker?.value).toEqual([DEVICE, OTHER_DEVICE]);
    expect(picker?.label).toBe('Alert devices (optional)');
  });

  it('presents an empty list when nothing is configured', () => {
    expect(devicePicker(makeEditor({}))?.value).toEqual([]);
  });
});
