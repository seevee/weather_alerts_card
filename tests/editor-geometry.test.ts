import { describe, it, expect } from 'vitest';
import { render } from 'lit';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import type { HomeAssistant, WeatherAlertsCardConfig } from '../src/types';

// The my-location controls: a switch inside the geometry block, and a
// reference-entity picker in the filtering section. This suite pins the
// visibility gate and the config round-trips (including key deletion).
type EditorInternals = {
  _config: WeatherAlertsCardConfig;
  hass: HomeAssistant;
  _showsMyLocationEntityControl(): boolean;
  _writeKey(key: 'showMyLocation', value: boolean): void;
  _myLocationEntityChanged(ev: CustomEvent): void;
  render(): unknown;
  addEventListener(type: string, listener: (ev: Event) => void): void;
};

const RFS_SOURCE = 'nsw_rural_fire_service_feed';

function makeEditor(config: Partial<WeatherAlertsCardConfig>): EditorInternals {
  const editor = new WeatherAlertsCardEditor() as unknown as EditorInternals;
  editor._config = { type: 'custom:weather-alerts-card', entity: '', ...config };
  editor.hass = {
    states: { 'sensor.nws_alerts': { state: '0', attributes: { Alerts: [] } } },
    locale: { language: 'en' },
  } as unknown as HomeAssistant;
  return editor;
}

function capture(editor: EditorInternals): () => WeatherAlertsCardConfig | undefined {
  let emitted: WeatherAlertsCardConfig | undefined;
  editor.addEventListener('config-changed', (ev: Event) => {
    emitted = (ev as CustomEvent).detail.config;
  });
  return () => emitted;
}

type Rendered = { selectors: { label?: string; value?: unknown; selector?: unknown }[]; switches: { label: string; checked?: boolean | undefined }[] };
function renderEditor(editor: EditorInternals): Rendered {
  const host = document.createElement('div');
  render(editor.render(), host);
  const selectors = [...host.querySelectorAll('ha-selector')] as unknown as Rendered['selectors'];
  const switches = [...host.querySelectorAll('ha-formfield')].map(f => ({
    label: (f as unknown as { label?: string }).label ?? '',
    checked: (f.querySelector('ha-switch') as unknown as { checked?: boolean } | null)?.checked,
  }));
  return { selectors, switches };
}

const locationPicker = (r: Rendered) => r.selectors.find(s => s.label === 'My location');
const locationSwitch = (r: Rendered) => r.switches.find(s => s.label === 'Show my location on the map');

describe('_showsMyLocationEntityControl', () => {
  it('is hidden for a plain NWS card with geometry off', () => {
    expect(makeEditor({ entity: 'sensor.nws_alerts' })._showsMyLocationEntityControl()).toBe(false);
  });

  it('follows the radius gate (point-capable provider / feed)', () => {
    expect(makeEditor({ provider: 'nsw_rfs' })._showsMyLocationEntityControl()).toBe(true);
    expect(makeEditor({ sources: [RFS_SOURCE] })._showsMyLocationEntityControl()).toBe(true);
  });

  it('is shown for any card once showGeometry is on', () => {
    expect(makeEditor({ entity: 'sensor.nws_alerts', showGeometry: true })._showsMyLocationEntityControl()).toBe(true);
  });
});

describe('rendered controls', () => {
  it('renders no my-location control on a plain NWS card', () => {
    const r = renderEditor(makeEditor({ entity: 'sensor.nws_alerts' }));
    expect(locationPicker(r)).toBeUndefined();
    expect(locationSwitch(r)).toBeUndefined();
  });

  it('renders the picker (restricted to tracker/person/zone) for an RFS card with no radius set', () => {
    const r = renderEditor(makeEditor({ provider: 'nsw_rfs' }));
    const picker = locationPicker(r);
    expect(picker).toBeDefined();
    expect(picker!.selector).toEqual({ entity: { domain: ['device_tracker', 'person', 'zone'] } });
    expect(picker!.value).toBe('');
    // The switch lives inside the geometry block, which is closed here.
    expect(locationSwitch(r)).toBeUndefined();
  });

  it('renders the switch once showGeometry is on, reflecting the stored value', () => {
    expect(locationSwitch(renderEditor(makeEditor({ entity: 'sensor.nws_alerts', showGeometry: true })))?.checked).toBe(false);
    expect(locationSwitch(renderEditor(makeEditor({ entity: 'sensor.nws_alerts', showGeometry: true, showMyLocation: true })))?.checked).toBe(true);
  });

  it('shows the stored entity in the picker', () => {
    const r = renderEditor(makeEditor({ provider: 'nsw_rfs', myLocationEntity: 'zone.work' }));
    expect(locationPicker(r)?.value).toBe('zone.work');
  });

  it('does not rewrite config merely by rendering', () => {
    const editor = makeEditor({ provider: 'nsw_rfs', showGeometry: true, showMyLocation: true, myLocationEntity: 'zone.work' });
    const emitted = capture(editor);
    renderEditor(editor);
    expect(emitted()).toBeUndefined();
  });
});

describe('showMyLocation write path', () => {
  it('writes showMyLocation: true when switched on', () => {
    const editor = makeEditor({ provider: 'nsw_rfs', showGeometry: true });
    const emitted = capture(editor);
    editor._writeKey('showMyLocation', true);
    expect(emitted()?.showMyLocation).toBe(true);
  });

  it('deletes the key (never writes false) when switched off', () => {
    const editor = makeEditor({ provider: 'nsw_rfs', showGeometry: true, showMyLocation: true });
    const emitted = capture(editor);
    editor._writeKey('showMyLocation', false);
    expect(emitted()).toBeDefined();
    expect('showMyLocation' in emitted()!).toBe(false);
  });

  it('does not fire on a no-op', () => {
    const editor = makeEditor({ provider: 'nsw_rfs', showGeometry: true });
    const emitted = capture(editor);
    editor._writeKey('showMyLocation', false);
    expect(emitted()).toBeUndefined();
  });
});

describe('_myLocationEntityChanged', () => {
  const ev = (value: unknown) => ({ detail: { value } } as unknown as CustomEvent);

  it('writes the picked entity', () => {
    const editor = makeEditor({ provider: 'nsw_rfs' });
    const emitted = capture(editor);
    editor._myLocationEntityChanged(ev('device_tracker.phone'));
    expect(emitted()?.myLocationEntity).toBe('device_tracker.phone');
  });

  it('deletes the key when cleared (empty string, whitespace, or undefined)', () => {
    for (const cleared of ['', '   ', undefined]) {
      const editor = makeEditor({ provider: 'nsw_rfs', myLocationEntity: 'zone.work' });
      const emitted = capture(editor);
      editor._myLocationEntityChanged(ev(cleared));
      expect(emitted()).toBeDefined();
      expect('myLocationEntity' in emitted()!).toBe(false);
    }
  });

  it('does not fire when the value is unchanged or when clearing an absent key', () => {
    const same = makeEditor({ provider: 'nsw_rfs', myLocationEntity: 'zone.work' });
    const emittedSame = capture(same);
    same._myLocationEntityChanged(ev('zone.work'));
    expect(emittedSame()).toBeUndefined();

    const absent = makeEditor({ provider: 'nsw_rfs' });
    const emittedAbsent = capture(absent);
    absent._myLocationEntityChanged(ev(''));
    expect(emittedAbsent()).toBeUndefined();
  });
});
