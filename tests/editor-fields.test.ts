import { describe, it, expect } from 'vitest';
import { render } from 'lit';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import {
  DETAIL_SECTIONS, FIELDS, PANELS, SELECT_FIELDS, TOGGLE_FIELDS,
  effectiveValue, isDefault, isOn, withKey,
  type Field, type SimpleKey, type SimpleValue,
} from '../src/editor-fields';
import { translations } from '../src/translations';
import type { HomeAssistant, WeatherAlertsCardConfig } from '../src/types';

// Table-driven round trip over every registry entry. This is the coverage the
// removed per-handler tests implicitly gave: for each simple key, a non-default
// value is written, the default deletes the key, and an unchanged value fires
// nothing. The editor's `_writeKey` is exercised through the rendered control
// so the label → key → handler wiring is what is under test, not the registry
// in isolation.
type EditorInternals = {
  _config: WeatherAlertsCardConfig;
  hass: HomeAssistant;
  _writeKey(key: SimpleKey, value: SimpleValue): void;
  render(): unknown;
  addEventListener(type: string, listener: (ev: Event) => void): void;
};

const ALL: readonly Field[] = [...TOGGLE_FIELDS, ...SELECT_FIELDS];

function base(extra: Partial<WeatherAlertsCardConfig> = {}): WeatherAlertsCardConfig {
  return { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', ...extra } as WeatherAlertsCardConfig;
}

/** A value that is not the field's default: the `on` side of a toggle whose
 *  default is off, the `off` side otherwise; the first non-default option of
 *  a select. */
function nonDefault(field: Field): SimpleValue {
  if (field.kind === 'toggle') return field.on === field.default ? field.off : field.on;
  return field.options.find(o => o.value !== field.default)!.value;
}

function makeEditor(config: WeatherAlertsCardConfig): { editor: EditorInternals; events: WeatherAlertsCardConfig[] } {
  const editor = new WeatherAlertsCardEditor() as unknown as EditorInternals;
  editor._config = config;
  editor.hass = {
    states: { 'sensor.nws_alerts': { state: '0', attributes: { Alerts: [] } } },
    locale: { language: 'en' },
  } as unknown as HomeAssistant;
  const events: WeatherAlertsCardConfig[] = [];
  editor.addEventListener('config-changed', (ev) => events.push((ev as CustomEvent).detail.config));
  return { editor, events };
}

/** A config in which every gated control is rendered: details on, geometry
 *  on, dismissal on with a button trigger. Collapsed panels are undefined
 *  elements in jsdom, so their children stay ordinary light DOM. */
function everythingVisible(): WeatherAlertsCardConfig {
  return base({ showGeometry: true, allowDismiss: true });
}

// The five detail-section toggles render as options of one list selector
// rather than switches; their round trip is pinned in editor-panels.test.ts.
const LIST_KEYS: readonly string[] = DETAIL_SECTIONS;
const SWITCH_FIELDS = TOGGLE_FIELDS.filter(f => !LIST_KEYS.includes(f.key));

type Control = { kind: 'toggle' | 'select'; el: Element; label: string };
function renderControls(editor: EditorInternals): Control[] {
  const host = document.createElement('div');
  render(editor.render() as never, host, { host: editor });
  const out: Control[] = [];
  for (const f of host.querySelectorAll('ha-formfield')) {
    const sw = f.querySelector('ha-switch');
    if (sw) out.push({ kind: 'toggle', el: sw, label: (f as unknown as { label: string }).label });
  }
  for (const sel of host.querySelectorAll('ha-select')) {
    out.push({ kind: 'select', el: sel, label: (sel as unknown as { label: string }).label });
  }
  const list = [...host.querySelectorAll('ha-selector')]
    .map(el => el as unknown as { label?: string; selector?: { select?: { options?: { label: string }[] } } })
    .find(el => el.label === 'Sections');
  for (const o of list?.selector?.select?.options ?? []) {
    // A customised section carries a " •" suffix; the registry label is the rest.
    out.push({ kind: 'toggle', el: list as unknown as Element, label: o.label.replace(/ •$/, '') });
  }
  return out;
}

describe('registry shape', () => {
  it('holds 18 toggles and 12 selects with unique keys', () => {
    expect(TOGGLE_FIELDS).toHaveLength(18);
    expect(SELECT_FIELDS).toHaveLength(12);
    expect(new Set(ALL.map(f => f.key)).size).toBe(ALL.length);
    expect(Object.keys(FIELDS)).toHaveLength(ALL.length);
  });

  it('assigns every registry key to exactly one panel', () => {
    const owners = new Map<string, string[]>();
    for (const [panel, keys] of Object.entries(PANELS)) {
      for (const k of keys) owners.set(k, [...(owners.get(k) ?? []), panel]);
    }
    for (const f of ALL) {
      expect(owners.get(f.key), f.key).toEqual([f.panel]);
    }
  });

  it('uses English labels that exist for every field and option', () => {
    const en = translations.en;
    for (const f of ALL) {
      expect(en[f.label], f.label).toBeDefined();
      if (f.kind === 'select') {
        for (const o of f.options) expect(en[o.label], o.label).toBeDefined();
      }
    }
  });

  it('lists the select default among its options', () => {
    for (const f of SELECT_FIELDS) {
      expect(f.options.map(o => o.value), f.key).toContain(f.default);
    }
  });
});

describe('withKey', () => {
  it.each(ALL.map(f => [f.key, f] as const))('%s: sets a non-default, deletes on default, no-ops when unchanged', (key, f) => {
    const value = nonDefault(f);
    const absent = base();
    const written = withKey(absent, key, value);
    expect(written).not.toBe(absent);
    expect(written[key]).toBe(value);
    expect(isDefault(written, key)).toBe(false);
    expect(effectiveValue(written, key)).toBe(value);

    // Returning to the default deletes the key rather than writing it.
    const cleared = withKey(written, key, f.default);
    expect(cleared).not.toBe(written);
    expect(key in cleared).toBe(false);
    expect(isDefault(cleared, key)).toBe(true);

    // Unchanged effective value: same object back, even when the key is
    // stored explicitly at its default.
    expect(withKey(absent, key, f.default)).toBe(absent);
    expect(withKey(written, key, value)).toBe(written);
    const explicit = base({ [key]: f.default });
    expect(withKey(explicit, key, f.default)).toBe(explicit);
  });

  it('never mutates its input', () => {
    const cfg = base({ showDetails: false });
    const frozen = Object.freeze({ ...cfg });
    expect(withKey(frozen, 'showDetails', true)).toEqual(base());
    expect(frozen).toEqual(cfg);
  });

  it('reads a toggle as on only when the effective value equals `on`', () => {
    const layout = FIELDS.layout;
    expect(layout.kind).toBe('toggle');
    if (layout.kind !== 'toggle') return;
    expect(isOn(base(), layout)).toBe(false);
    expect(isOn(base({ layout: 'compact' }), layout)).toBe(true);
    expect(isOn(base({ layout: 'default' }), layout)).toBe(false);
    expect(withKey(base({ layout: 'compact' }), 'layout', 'default')).toEqual(base());
  });
});

describe('rendered controls', () => {
  it('renders one control per registry field, labelled from the registry', () => {
    const { editor } = makeEditor(everythingVisible());
    const labels = renderControls(editor).map(c => `${c.kind}:${c.label}`);
    for (const f of ALL) {
      expect(labels, f.key).toContain(`${f.kind}:${translations.en[f.label]}`);
    }
  });

  it.each(SWITCH_FIELDS.map(f => [f.key, f] as const))('%s switch writes through _writeKey', (key, f) => {
    const { editor, events } = makeEditor(everythingVisible());
    const control = renderControls(editor).find(c => c.kind === 'toggle' && c.label === translations.en[f.label])!;
    const sw = control.el as unknown as { checked: boolean };
    const before = editor._config;
    // Flip the switch away from its rendered state: one event, the key moves
    // to the other side of its default.
    const wasOn = sw.checked;
    expect(wasOn).toBe(isOn(before, f));
    sw.checked = !wasOn;
    control.el.dispatchEvent(new Event('change'));
    expect(events).toHaveLength(1);
    expect(effectiveValue(events[0], key)).toBe(wasOn ? f.off : f.on);

    // Dispatching the rendered state again is a no-op.
    sw.checked = wasOn;
    editor._config = before;
    control.el.dispatchEvent(new Event('change'));
    expect(events).toHaveLength(1);
  });

  it.each(SELECT_FIELDS.map(f => [f.key, f] as const))('%s dropdown writes through _writeKey', (key, f) => {
    const { editor, events } = makeEditor(everythingVisible());
    const control = renderControls(editor).find(c => c.kind === 'select' && c.label === translations.en[f.label])!;
    const items = [...control.el.querySelectorAll('ha-dropdown-item')].map(i => i.getAttribute('value'));
    expect(items).toEqual(f.options.map(o => o.value));

    const value = nonDefault(f);
    control.el.dispatchEvent(new CustomEvent('selected', { detail: { value } }));
    expect(events).toHaveLength(1);
    expect(events[0][key]).toBe(value);

    control.el.dispatchEvent(new CustomEvent('selected', { detail: { value: f.default } }));
    expect(events).toHaveLength(2);
    expect(key in events[1]).toBe(false);

    control.el.dispatchEvent(new CustomEvent('selected', { detail: { value: f.default } }));
    expect(events).toHaveLength(2);
  });
});
