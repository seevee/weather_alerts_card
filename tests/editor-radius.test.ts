import { describe, it, expect } from 'vitest';
import { render } from 'lit';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import type { HomeAssistant, WeatherAlertsCardConfig } from '../src/types';

// Reach into the private helpers behind the radius control — this suite pins
// down the capability gate and the unit-aware write path.
type EditorInternals = {
  _config: WeatherAlertsCardConfig;
  hass: HomeAssistant;
  _lengthUnit(): 'km' | 'mi';
  _showsRadiusControl(): boolean;
  _maxDistanceChanged(ev: Event): void;
  render(): unknown;
  addEventListener(type: string, listener: (ev: Event) => void): void;
};

const RFS_SOURCE = 'nsw_rural_fire_service_feed';

const rfsAttributes = {
  source: RFS_SOURCE,
  category: 'Advice',
  status: 'Being controlled',
  responsible_agency: 'Rural Fire Service',
  type: 'Bush Fire',
  latitude: -33.7,
  longitude: 150.3,
};

const nwsAttributes = { Alerts: [] };

function makeHass(
  states: Record<string, { state: string; attributes: Record<string, unknown> }> = {
    'sensor.nws_alerts': { state: '0', attributes: nwsAttributes },
  },
  unitSystem?: { length?: string },
): HomeAssistant {
  const hass: Record<string, unknown> = { states, locale: { language: 'en' } };
  if (unitSystem) hass.config = { unit_system: unitSystem };
  return hass as unknown as HomeAssistant;
}

function makeEditor(
  config: Partial<WeatherAlertsCardConfig>,
  hass: HomeAssistant = makeHass(),
): EditorInternals {
  const editor = new WeatherAlertsCardEditor() as unknown as EditorInternals;
  editor._config = { type: 'custom:weather-alerts-card', entity: '', ...config } as WeatherAlertsCardConfig;
  editor.hass = hass;
  return editor;
}

/** Runs a change and returns the emitted config, or undefined if none fired. */
function fireChange(editor: EditorInternals, value: string): WeatherAlertsCardConfig | undefined {
  let emitted: WeatherAlertsCardConfig | undefined;
  editor.addEventListener('config-changed', (ev: Event) => {
    emitted = (ev as CustomEvent).detail.config;
  });
  editor._maxDistanceChanged({ target: { value } } as unknown as Event);
  return emitted;
}

describe('_showsRadiusControl', () => {
  it('is hidden for a plain NWS card', () => {
    expect(makeEditor({ entity: 'sensor.nws_alerts' })._showsRadiusControl()).toBe(false);
  });

  it('is shown when the provider is explicitly point-capable', () => {
    expect(makeEditor({ provider: 'nsw_rfs' })._showsRadiusControl()).toBe(true);
  });

  it('is shown when a point-capable feed source is collected', () => {
    expect(makeEditor({ sources: [RFS_SOURCE] })._showsRadiusControl()).toBe(true);
  });

  it('is shown when a point-carrying entity is hand-listed', () => {
    const hass = makeHass({ 'geo_location.fire_a': { state: '12', attributes: rfsAttributes } });
    expect(makeEditor({ entity: 'geo_location.fire_a' }, hass)._showsRadiusControl()).toBe(true);
  });

  it('is shown for a hand-listed entity in the `entities` list', () => {
    const hass = makeHass({
      'sensor.nws_alerts': { state: '0', attributes: nwsAttributes },
      'geo_location.fire_a': { state: '12', attributes: rfsAttributes },
    });
    const editor = makeEditor({ entity: 'sensor.nws_alerts', entities: ['geo_location.fire_a'] }, hass);
    expect(editor._showsRadiusControl()).toBe(true);
  });

  it('is shown whenever a value is already set, whatever the provider', () => {
    expect(makeEditor({ entity: 'sensor.nws_alerts', maxDistanceKm: 25 })._showsRadiusControl()).toBe(true);
  });
});

describe('_lengthUnit', () => {
  it('falls back to km when hass.config is absent', () => {
    expect(makeEditor({})._lengthUnit()).toBe('km');
  });

  it('falls back to km when unit_system is absent', () => {
    const hass = makeHass();
    (hass as unknown as { config: Record<string, unknown> }).config = {};
    expect(makeEditor({}, hass)._lengthUnit()).toBe('km');
  });

  it('is km for a metric core and for an unrecognised value', () => {
    expect(makeEditor({}, makeHass(undefined, { length: 'km' }))._lengthUnit()).toBe('km');
    expect(makeEditor({}, makeHass(undefined, { length: 'furlong' }))._lengthUnit()).toBe('km');
  });

  it('is mi only for an explicitly US-customary core', () => {
    expect(makeEditor({}, makeHass(undefined, { length: 'mi' }))._lengthUnit()).toBe('mi');
  });
});

describe('_maxDistanceChanged', () => {
  it('writes the typed value verbatim on a metric core', () => {
    const editor = makeEditor({ provider: 'nsw_rfs' });
    expect(fireChange(editor, '50')?.maxDistanceKm).toBe(50);
  });

  it('converts miles to km on a US-customary core', () => {
    const editor = makeEditor({ provider: 'nsw_rfs' }, makeHass(undefined, { length: 'mi' }));
    expect(fireChange(editor, '30')?.maxDistanceKm).toBe(48.28);
  });

  it('removes the key when the field is cleared', () => {
    const editor = makeEditor({ provider: 'nsw_rfs', maxDistanceKm: 50 });
    const emitted = fireChange(editor, '');
    expect(emitted).toBeDefined();
    expect('maxDistanceKm' in emitted!).toBe(false);
  });

  it('does not fire when clearing an already-absent value', () => {
    const editor = makeEditor({ provider: 'nsw_rfs' });
    expect(fireChange(editor, '')).toBeUndefined();
  });

  const rejected = ['0', '-5', 'abc'];
  for (const raw of rejected) {
    it(`rejects "${raw}" without touching the saved config (metric)`, () => {
      const editor = makeEditor({ provider: 'nsw_rfs', maxDistanceKm: 50 });
      expect(fireChange(editor, raw)).toBeUndefined();
      expect(editor._config.maxDistanceKm).toBe(50);
    });

    it(`rejects "${raw}" without touching the saved config (miles)`, () => {
      const editor = makeEditor({ provider: 'nsw_rfs', maxDistanceKm: 50 }, makeHass(undefined, { length: 'mi' }));
      expect(fireChange(editor, raw)).toBeUndefined();
      expect(editor._config.maxDistanceKm).toBe(50);
    });
  }

  it('does not re-fire when the converted value matches the stored one', () => {
    const editor = makeEditor({ provider: 'nsw_rfs', maxDistanceKm: 48.28 }, makeHass(undefined, { length: 'mi' }));
    expect(fireChange(editor, '30')).toBeUndefined();
  });
});

describe('rendered control', () => {
  // Renders the editor template into a detached host so the assertion is on the
  // property bindings the widget actually receives.
  function radiusField(editor: EditorInternals): { label?: string; value?: string } | undefined {
    const host = document.createElement('div');
    render(editor.render() as never, host);
    const fields = [...host.querySelectorAll('ha-textfield')] as unknown as {
      label?: string; value?: string;
    }[];
    return fields.find(f => (f.label ?? '').startsWith('Maximum distance'));
  }

  it('labels the field in km and shows the stored value verbatim on a metric core', () => {
    const field = radiusField(makeEditor({ provider: 'nsw_rfs', maxDistanceKm: 47 }));
    expect(field?.label).toBe('Maximum distance (km)');
    expect(field?.value).toBe('47');
  });

  it('labels the field in mi and converts the stored km for display', () => {
    const field = radiusField(
      makeEditor({ provider: 'nsw_rfs', maxDistanceKm: 48.28 }, makeHass(undefined, { length: 'mi' })),
    );
    expect(field?.label).toBe('Maximum distance (mi)');
    expect(field?.value).toBe('30');
  });

  it('leaves the field empty when no radius is set', () => {
    expect(radiusField(makeEditor({ provider: 'nsw_rfs' }))?.value).toBe('');
  });

  it('is absent from the template for a plain NWS card', () => {
    expect(radiusField(makeEditor({ entity: 'sensor.nws_alerts' }))).toBeUndefined();
  });

  it('does not rewrite config merely by rendering', () => {
    const editor = makeEditor(
      { provider: 'nsw_rfs', maxDistanceKm: 47 },
      makeHass(undefined, { length: 'mi' }),
    );
    let fired = false;
    editor.addEventListener('config-changed', () => { fired = true; });
    radiusField(editor);
    expect(fired).toBe(false);
    expect(editor._config.maxDistanceKm).toBe(47);
  });
});
