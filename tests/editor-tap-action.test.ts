import { describe, it, expect } from 'vitest';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import type { WeatherAlertsCardConfig } from '../src/types';

// Reach into the private tap-action handlers. This suite pins two contracts:
// the unset-vs-'none' distinction (tap_action is presence-based in the card),
// and that a YAML-authored payload is never rewritten by an editor interaction.
type EditorInternals = {
  _config: WeatherAlertsCardConfig;
  _tapActionChanged(ev: CustomEvent): void;
  _tapNavigationPathChanged(ev: Event): void;
  _tapUrlPathChanged(ev: Event): void;
};

function makeEditor(config: Partial<WeatherAlertsCardConfig> = {}): {
  editor: EditorInternals;
  events: WeatherAlertsCardConfig[];
} {
  const editor = new WeatherAlertsCardEditor() as unknown as EditorInternals;
  editor._config = { entity: 'sensor.nws_alerts', ...config } as WeatherAlertsCardConfig;
  const events: WeatherAlertsCardConfig[] = [];
  (editor as unknown as HTMLElement).addEventListener('config-changed', (e) => {
    events.push((e as CustomEvent).detail.config);
  });
  return { editor, events };
}

function sel(value: string): CustomEvent {
  return new CustomEvent('selected', { detail: { value } });
}

function text(value: string): Event {
  return { target: { value } } as unknown as Event;
}

describe('_tapActionChanged', () => {
  it('writes each supported action and emits config-changed', () => {
    for (const action of [
      'details', 'more-info', 'navigate', 'url', 'toggle',
      'perform-action', 'fire-dom-event', 'none',
    ]) {
      const { editor, events } = makeEditor();
      editor._tapActionChanged(sel(action));
      expect(editor._config.tap_action).toEqual({ action });
      expect(events).toHaveLength(1);
    }
  });

  it("deletes tap_action entirely on the 'default' sentinel", () => {
    const { editor, events } = makeEditor({ tap_action: { action: 'details' } });
    editor._tapActionChanged(sel('default'));
    expect(editor._config.tap_action).toBeUndefined();
    expect('tap_action' in events[0]).toBe(false);
  });

  it("distinguishes unset from 'none' (presence replaces the inline expand)", () => {
    const { editor } = makeEditor();
    editor._tapActionChanged(sel('none'));
    expect(editor._config.tap_action).toEqual({ action: 'none' });
    editor._tapActionChanged(sel('default'));
    expect(editor._config.tap_action).toBeUndefined();
  });

  it('drops navigation_path when switching away from navigate', () => {
    const { editor } = makeEditor({
      tap_action: { action: 'navigate', navigation_path: '#weather-alerts' },
    });
    editor._tapActionChanged(sel('more-info'));
    expect(editor._config.tap_action).toEqual({ action: 'more-info' });
  });

  it('drops url_path when switching away from url', () => {
    const { editor } = makeEditor({
      tap_action: { action: 'url', url_path: 'https://example.com' },
    });
    editor._tapActionChanged(sel('details'));
    expect(editor._config.tap_action).toEqual({ action: 'details' });
  });

  it('preserves entity across an action switch', () => {
    const { editor } = makeEditor({
      tap_action: { action: 'more-info', entity: 'sensor.other' },
    });
    editor._tapActionChanged(sel('toggle'));
    expect(editor._config.tap_action).toEqual({ action: 'toggle', entity: 'sensor.other' });
  });

  // R1: the one way this editor-only change can damage a working config.
  it('preserves a YAML-authored fire-dom-event payload across an action switch', () => {
    const browserMod = { service: 'browser_mod.popup', data: { title: 'Alert' } };
    const { editor } = makeEditor({
      tap_action: { action: 'fire-dom-event', browser_mod: browserMod },
    });
    editor._tapActionChanged(sel('details'));
    expect(editor._config.tap_action).toEqual({ action: 'details', browser_mod: browserMod });
  });

  it('preserves perform-action payload keys (data/target) across a switch', () => {
    const { editor } = makeEditor({
      tap_action: {
        action: 'perform-action',
        perform_action: 'light.turn_on',
        data: { brightness: 255 },
        target: { entity_id: 'light.kitchen' },
      },
    });
    editor._tapActionChanged(sel('none'));
    expect(editor._config.tap_action).toEqual({
      action: 'none',
      perform_action: 'light.turn_on',
      data: { brightness: 255 },
      target: { entity_id: 'light.kitchen' },
    });
  });

  // R1/D4: opening the editor must never normalize a legacy spelling.
  it('never rewrites a legacy call-service config on an unrelated read', () => {
    const { editor, events } = makeEditor({
      tap_action: { action: 'call-service', service: 'script.notify' },
    });
    editor._tapActionChanged(sel('call-service'));
    expect(events).toHaveLength(0);
    expect(editor._config.tap_action).toEqual({ action: 'call-service', service: 'script.notify' });
  });

  it('is a no-op when the action is unchanged (no event)', () => {
    const { editor, events } = makeEditor({ tap_action: { action: 'details' } });
    editor._tapActionChanged(sel('details'));
    expect(events).toHaveLength(0);
  });

  it("is a no-op when 'default' is re-selected with no tap_action set", () => {
    const { editor, events } = makeEditor();
    editor._tapActionChanged(sel('default'));
    expect(events).toHaveLength(0);
  });
});

describe('tap-action sub-fields', () => {
  it('writes navigation_path and keeps the action', () => {
    const { editor, events } = makeEditor({ tap_action: { action: 'navigate' } });
    editor._tapNavigationPathChanged(text('#weather-alerts'));
    expect(editor._config.tap_action).toEqual({
      action: 'navigate', navigation_path: '#weather-alerts',
    });
    expect(events).toHaveLength(1);
  });

  it('clears only navigation_path on an empty value, retaining tap_action', () => {
    const { editor } = makeEditor({
      tap_action: { action: 'navigate', navigation_path: '#x' },
    });
    editor._tapNavigationPathChanged(text(''));
    expect(editor._config.tap_action).toEqual({ action: 'navigate' });
  });

  it('writes and clears url_path', () => {
    const { editor } = makeEditor({ tap_action: { action: 'url' } });
    editor._tapUrlPathChanged(text('https://example.com'));
    expect(editor._config.tap_action).toEqual({
      action: 'url', url_path: 'https://example.com',
    });
    editor._tapUrlPathChanged(text(''));
    expect(editor._config.tap_action).toEqual({ action: 'url' });
  });

  it('is a no-op when the sub-field value is unchanged (no event)', () => {
    const { editor, events } = makeEditor({
      tap_action: { action: 'navigate', navigation_path: '#x' },
    });
    editor._tapNavigationPathChanged(text('#x'));
    expect(events).toHaveLength(0);
  });

  it('does nothing when no tap_action is configured', () => {
    const { editor, events } = makeEditor();
    editor._tapNavigationPathChanged(text('#x'));
    expect(events).toHaveLength(0);
    expect(editor._config.tap_action).toBeUndefined();
  });
});
