import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'lit';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import type { WeatherAlertsCardConfig } from '../src/types';

// Component-system compatibility (#239). HA 2026.02 replaced MWC with
// WebAwesome; emitting only the new item element left every dropdown inert on
// older cores. These tests pin the detection, the event-shape fallback, and the
// element the item renderer emits on each path.
//
// They cannot substitute for a real install — jsdom has neither component set —
// but they do cover both branches, which is what regressed silently before.
type EditorInternals = {
  _config: WeatherAlertsCardConfig;
  readonly _useWebAwesome: boolean;
  _selectValue(ev: Event): string;
  _renderSelectItem(value: string, label: string): unknown;
  _tapActionChanged(ev: Event): void;
};

type EditorStatics = { _webAwesome?: boolean };

function makeEditor(): EditorInternals {
  const editor = new WeatherAlertsCardEditor() as unknown as EditorInternals;
  editor._config = { entity: 'sensor.nws_alerts' } as WeatherAlertsCardConfig;
  return editor;
}

// Render an item template to markup so the assertion is on the emitted tag
// rather than on Lit internals.
function markupOf(template: unknown): string {
  const host = document.createElement('div');
  render(template as never, host);
  return host.innerHTML;
}

// Detection reads the registry, which jsdom shares across the whole file.
// Stubbing `get` keeps each case independent and leaves the registry untouched.
function registryHas(...defined: string[]): void {
  vi.spyOn(customElements, 'get').mockImplementation(
    (name: string) => (defined.includes(name) ? (class extends HTMLElement {}) : undefined),
  );
}

function resetDetection(): void {
  (WeatherAlertsCardEditor as unknown as EditorStatics)._webAwesome = undefined;
}

beforeEach(resetDetection);

afterEach(() => {
  vi.restoreAllMocks();
  resetDetection();
});

describe('_useWebAwesome', () => {
  it('detects WebAwesome from a registered ha-dropdown-item', () => {
    registryHas('ha-dropdown-item');
    expect(makeEditor()._useWebAwesome).toBe(true);
  });

  it('detects MWC from a registered ha-list-item', () => {
    registryHas('ha-list-item');
    expect(makeEditor()._useWebAwesome).toBe(false);
  });

  it('assumes current HA while neither element is registered', () => {
    registryHas();
    expect(makeEditor()._useWebAwesome).toBe(true);
  });

  it('does not cache the ambiguous answer', () => {
    registryHas();
    expect(makeEditor()._useWebAwesome).toBe(true);
    // HA lazy-loads components: a later render must still be able to settle on
    // MWC, or an old core stays broken for the rest of the session.
    registryHas('ha-list-item');
    expect(makeEditor()._useWebAwesome).toBe(false);
  });

  it('caches a definite answer across instances', () => {
    registryHas('ha-list-item');
    expect(makeEditor()._useWebAwesome).toBe(false);
    registryHas('ha-dropdown-item');
    expect(makeEditor()._useWebAwesome).toBe(false);
  });
});

describe('_renderSelectItem', () => {
  it('emits ha-dropdown-item on the WebAwesome path', () => {
    registryHas('ha-dropdown-item');
    const markup = markupOf(makeEditor()._renderSelectItem('severity', 'Severity'));
    expect(markup).toContain('<ha-dropdown-item value="severity">');
    expect(markup).toContain('Severity');
    expect(markup).not.toContain('ha-list-item');
  });

  it('emits ha-list-item on the MWC path', () => {
    registryHas('ha-list-item');
    const markup = markupOf(makeEditor()._renderSelectItem('severity', 'Severity'));
    expect(markup).toContain('<ha-list-item value="severity">');
    expect(markup).toContain('Severity');
    expect(markup).not.toContain('ha-dropdown-item');
  });
});

describe('_selectValue', () => {
  it('reads ev.detail.value (WebAwesome)', () => {
    const ev = new CustomEvent('selected', { detail: { value: 'onset' } });
    expect(makeEditor()._selectValue(ev)).toBe('onset');
  });

  it('falls back to the target value (MWC)', () => {
    // MWC fires `selected` with a detail object carrying only an index, so a
    // plain "does detail exist" test would read undefined here.
    const target = document.createElement('select');
    Object.defineProperty(target, 'value', { value: 'onset', configurable: true });
    const ev = new CustomEvent('selected', { detail: { index: 1 } });
    Object.defineProperty(ev, 'target', { value: target, configurable: true });
    expect(makeEditor()._selectValue(ev)).toBe('onset');
  });

  it('returns an empty string when neither shape carries a value', () => {
    expect(makeEditor()._selectValue(new CustomEvent('selected'))).toBe('');
  });
});

describe('handlers on the MWC event shape', () => {
  it('applies a target-carried value like a detail-carried one', () => {
    const editor = makeEditor();
    const target = document.createElement('select');
    Object.defineProperty(target, 'value', { value: 'details', configurable: true });
    const ev = new CustomEvent('selected', { detail: { index: 1 } });
    Object.defineProperty(ev, 'target', { value: target, configurable: true });
    editor._tapActionChanged(ev);
    expect(editor._config.tap_action).toEqual({ action: 'details' });
  });
});
