import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'lit';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import type { WeatherAlertsCardConfig } from '../src/types';

// Component-system compatibility (#239). HA 2026.02 replaced MWC with
// WebAwesome; emitting only the new item element left every dropdown inert on
// older cores, and by 2026.09 `ha-textfield` was gone outright, so every text
// field rendered as nothing on a current core. 2026.11 then dropped
// `ha-formfield`, which left every switch without a label. These tests pin the detection,
// the event-shape fallback, and the element each renderer emits on each path.
//
// They cannot substitute for a real install — the test page has neither component set —
// but they do cover both branches, which is what regressed silently before.
type EditorInternals = {
  _config: WeatherAlertsCardConfig;
  readonly _useWebAwesome: boolean;
  readonly _useHaInput: boolean;
  readonly _useHaFormfield: boolean;
  _renderSwitch(label: string, checked: boolean, onChange: (ev: Event) => void): unknown;
  _selectValue(ev: Event): string;
  _renderSelectItem(value: string, label: string): unknown;
  _renderTextField(o: { label: string; value: string; helper?: string; type?: 'number'; min?: string; step?: string; onChange: (ev: Event) => void }): unknown;
  _tapActionChanged(ev: Event): void;
};

type EditorStatics = { _webAwesome: boolean | undefined; _haInput: boolean | undefined; _haFormfield: boolean | undefined };

function makeEditor(): EditorInternals {
  const editor = new WeatherAlertsCardEditor() as unknown as EditorInternals;
  editor._config = { entity: 'sensor.nws_alerts' } as WeatherAlertsCardConfig;
  return editor;
}

// Render an item template to markup so the assertion is on the emitted tag
// rather than on Lit internals.
function markupOf(template: unknown): string {
  const host = document.createElement('div');
  render(template, host);
  return host.innerHTML;
}

// Detection reads the registry, which the test page shares across the whole file.
// Stubbing `get` keeps each case independent and leaves the registry untouched.
function registryHas(...defined: string[]): void {
  vi.spyOn(customElements, 'get').mockImplementation(
    (name: string) => (defined.includes(name) ? (class extends HTMLElement {}) : undefined),
  );
}

function resetDetection(): void {
  const statics = WeatherAlertsCardEditor as unknown as EditorStatics;
  statics._webAwesome = undefined;
  statics._haInput = undefined;
  statics._haFormfield = undefined;
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

describe('_useHaInput', () => {
  it('detects ha-input, falls back to ha-textfield, assumes current HA when neither is registered', () => {
    registryHas('ha-input');
    expect(makeEditor()._useHaInput).toBe(true);
    resetDetection();
    registryHas('ha-textfield');
    expect(makeEditor()._useHaInput).toBe(false);
    resetDetection();
    registryHas();
    expect(makeEditor()._useHaInput).toBe(true);
  });

  it('is independent of the dropdown detection', () => {
    // An old core registers MWC items *and* ha-textfield; a mid-2026 core may
    // have swapped the dropdowns before the text field. Neither flag may
    // decide the other.
    registryHas('ha-dropdown-item', 'ha-textfield');
    const editor = makeEditor();
    expect(editor._useWebAwesome).toBe(true);
    expect(editor._useHaInput).toBe(false);
  });

  it('does not cache the ambiguous answer, but caches a definite one', () => {
    registryHas();
    expect(makeEditor()._useHaInput).toBe(true);
    registryHas('ha-textfield');
    expect(makeEditor()._useHaInput).toBe(false);
    registryHas('ha-input');
    expect(makeEditor()._useHaInput).toBe(false);
  });
});

type RenderedField = { label?: string; value?: string; hint?: string; helper?: string; helperPersistent?: boolean };
function fieldOf(template: unknown): { tag: string; el: RenderedField & Element } {
  const host = document.createElement('div');
  render(template, host);
  // The control sits inside its `.field` row wrapper.
  const el = host.querySelector('ha-input, ha-textfield')!;
  return { tag: el.localName, el: el };
}

describe('_renderTextField', () => {
  const opts = { label: 'Zones', value: 'A, B', helper: 'Comma-separated', onChange: () => {} };

  it('emits ha-input with the helper on .hint on the current path', () => {
    registryHas('ha-input');
    const { tag, el } = fieldOf(makeEditor()._renderTextField(opts));
    expect(tag).toBe('ha-input');
    expect(el.label).toBe('Zones');
    expect(el.value).toBe('A, B');
    expect(el.hint).toBe('Comma-separated');
    expect(el.hasAttribute('type')).toBe(false);
  });

  it('emits ha-textfield with a persistent .helper on the legacy path', () => {
    registryHas('ha-textfield');
    const { tag, el } = fieldOf(makeEditor()._renderTextField(opts));
    expect(tag).toBe('ha-textfield');
    expect(el.helper).toBe('Comma-separated');
    expect(el.helperPersistent).toBe(true);
  });

  it('passes number-field attributes through on both paths', () => {
    for (const registered of ['ha-input', 'ha-textfield']) {
      resetDetection();
      registryHas(registered);
      const { el } = fieldOf(makeEditor()._renderTextField({ ...opts, type: 'number', min: '1', step: '1' }));
      expect(el.getAttribute('type')).toBe('number');
      expect(el.getAttribute('min')).toBe('1');
      expect(el.getAttribute('step')).toBe('1');
    }
  });

  it('delivers change through the target value on both paths', () => {
    for (const registered of ['ha-input', 'ha-textfield']) {
      resetDetection();
      registryHas(registered);
      let seen: string | undefined;
      const { el } = fieldOf(makeEditor()._renderTextField({
        ...opts, onChange: (ev) => { seen = (ev.target as HTMLInputElement).value; },
      }));
      (el as unknown as { value: string }).value = 'C';
      el.dispatchEvent(new Event('change'));
      expect(seen).toBe('C');
    }
  });
});

describe('_useHaFormfield', () => {
  it('takes the legacy wrapper only when ha-formfield is registered', () => {
    registryHas('ha-formfield', 'ha-switch');
    expect(makeEditor()._useHaFormfield).toBe(true);
    resetDetection();
    // ha-switch exists on both sides of the swap, so it decides nothing.
    registryHas('ha-switch');
    expect(makeEditor()._useHaFormfield).toBe(false);
    resetDetection();
    registryHas();
    expect(makeEditor()._useHaFormfield).toBe(false);
  });

  it('re-checks while ha-formfield is absent, and caches it once seen', () => {
    // An old core may lazy-load ha-formfield after the first render.
    registryHas();
    expect(makeEditor()._useHaFormfield).toBe(false);
    registryHas('ha-formfield');
    expect(makeEditor()._useHaFormfield).toBe(true);
    registryHas();
    expect(makeEditor()._useHaFormfield).toBe(true);
  });
});

describe('_renderSwitch', () => {
  function switchOf(template: unknown): { host: HTMLElement; sw: Element & { checked?: boolean } } {
    const host = document.createElement('div');
    render(template, host);
    return { host, sw: host.querySelector('ha-switch')! };
  }

  it('slots the label inside ha-switch when ha-formfield is gone (2026.11+)', () => {
    registryHas('ha-switch');
    const { host, sw } = switchOf(makeEditor()._renderSwitch('Show provider label', true, () => {}));
    expect(host.querySelector('ha-formfield')).toBeNull();
    expect(sw.querySelector('.switch-label')?.textContent?.trim()).toBe('Show provider label');
    expect(sw.checked).toBe(true);
  });

  it('wraps ha-switch in a labelled ha-formfield on older cores', () => {
    registryHas('ha-formfield');
    const { host, sw } = switchOf(makeEditor()._renderSwitch('Show provider label', false, () => {}));
    const ff = host.querySelector<Element & { label?: string }>('ha-formfield');
    expect(ff?.label).toBe('Show provider label');
    expect(sw.parentElement).toBe(ff);
    expect(sw.childElementCount).toBe(0);
    expect(sw.checked).toBe(false);
  });

  it('delivers change from the switch on both paths', () => {
    for (const registered of ['ha-switch', 'ha-formfield']) {
      resetDetection();
      registryHas(registered);
      let seen: boolean | undefined;
      const { sw } = switchOf(makeEditor()._renderSwitch('X', false, (ev) => {
        seen = (ev.target as HTMLInputElement).checked;
      }));
      sw.checked = true;
      sw.dispatchEvent(new Event('change'));
      expect(seen, registered).toBe(true);
    }
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
