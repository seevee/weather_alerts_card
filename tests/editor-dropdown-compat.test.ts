import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'lit';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import type { WeatherAlertsCardConfig } from '../src/types';

// Component-system compatibility. The card's floor is HA 2026.7 (#384), so the
// 2026.02 MWC dropdown path (#239) is gone and only WebAwesome items remain.
// Two swaps still straddle the floor: 2026.09 removed `ha-textfield`, so every
// text field rendered as nothing on a current core, and 2026.11 dropped
// `ha-formfield`, which left every switch without a label. These tests pin the
// detection and the element each renderer emits on each path.
//
// They cannot substitute for a real install — the test page has neither component set —
// but they do cover both branches, which is what regressed silently before.
type EditorInternals = {
  _config: WeatherAlertsCardConfig;
  readonly _useHaInput: boolean;
  readonly _useHaFormfield: boolean;
  _renderSwitch(label: string, checked: boolean, onChange: (ev: Event) => void): unknown;
  _selectValue(ev: Event): string;
  _renderSelectItem(value: string, label: string): unknown;
  _renderTextField(o: { label: string; value: string; helper?: string; type?: 'number'; min?: string; step?: string; onChange: (ev: Event) => void }): unknown;
};

type EditorStatics = { _haInput: boolean | undefined; _haFormfield: boolean | undefined };

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
  statics._haInput = undefined;
  statics._haFormfield = undefined;
}

beforeEach(resetDetection);

afterEach(() => {
  vi.restoreAllMocks();
  resetDetection();
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
  it('emits ha-dropdown-item', () => {
    const markup = markupOf(makeEditor()._renderSelectItem('severity', 'Severity'));
    expect(markup).toContain('<ha-dropdown-item value="severity">');
    expect(markup).toContain('Severity');
    expect(markup).not.toContain('ha-list-item');
  });
});

describe('_selectValue', () => {
  it('reads ev.detail.value', () => {
    const ev = new CustomEvent('selected', { detail: { value: 'onset' } });
    expect(makeEditor()._selectValue(ev)).toBe('onset');
  });

  it('returns an empty string when the event carries no value', () => {
    expect(makeEditor()._selectValue(new CustomEvent('selected'))).toBe('');
  });
});
