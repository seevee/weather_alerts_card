import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// jsdom lacks matchMedia; the card touches it during construction, so the
// polyfill must be installed before the card module loads.
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

import { WeatherAlertsCard } from '../src/weather-alerts-card';
import { handleTapAction, hasTapAction, fireEvent } from '../src/actions';
import type { ActionConfig, HomeAssistant, WeatherAlertsCardConfig } from '../src/types';

const HOUR = 3600 * 1000;

interface CardInternals {
  setConfig(config: WeatherAlertsCardConfig): void;
  hass: HomeAssistant;
  shadowRoot: ShadowRoot | null;
  remove(): void;
  _swipeJustDragged: boolean;
  _detailPopupAlertId: string | null;
}

// One aggregate NWS sensor — every parsed alert's sourceEntityId is this sensor.
function nwsHass(): HomeAssistant {
  const now = Date.now();
  return {
    states: {
      'sensor.nws_alerts': {
        state: '1',
        attributes: {
          Alerts: [{
            ID: 'wind-severe',
            Event: 'High Wind Warning',
            Severity: 'Severe',
            Sent: new Date(now - 2 * HOUR).toISOString(),
            Onset: new Date(now - 1 * HOUR).toISOString(),
            Ends: new Date(now + 3 * HOUR).toISOString(),
            Expires: new Date(now + 3 * HOUR).toISOString(),
            Description: 'Damaging winds.',
            Instruction: 'Take cover.',
            URL: 'https://example.test/wind',
            Headline: '',
          }],
        },
      },
    },
    locale: { language: 'en' },
  } as unknown as HomeAssistant;
}

// One aggregate NWS sensor holding TWO alerts. The decisive fixture for
// action:details — per-alert scoping here cannot come from entity granularity,
// because both alerts share a single source entity.
function nwsTwoAlertHass(): HomeAssistant {
  const now = Date.now();
  const alert = (id: string, event: string, description: string) => ({
    ID: id,
    Event: event,
    Severity: 'Severe',
    Sent: new Date(now - 2 * HOUR).toISOString(),
    Onset: new Date(now - 1 * HOUR).toISOString(),
    Ends: new Date(now + 3 * HOUR).toISOString(),
    Expires: new Date(now + 3 * HOUR).toISOString(),
    Description: description,
    Instruction: '',
    URL: '',
    Headline: '',
  });
  return {
    states: {
      'sensor.nws_alerts': {
        state: '2',
        attributes: {
          Alerts: [
            alert('wind-severe', 'High Wind Warning', 'Damaging winds.'),
            alert('flood-severe', 'Flash Flood Warning', 'Rapid rises expected.'),
          ],
        },
      },
    },
    locale: { language: 'en' },
  } as unknown as HomeAssistant;
}

// Two CAP per-alert sensors — each alert carries its own sourceEntityId.
function capAttrs(id: string, event: string): Record<string, unknown> {
  const now = Date.now();
  return {
    incident_platform_version: '1.0',
    id,
    event,
    severity: 'Moderate',
    severity_normalized: 'moderate',
    sent: new Date(now - 2 * HOUR).toISOString(),
    expires: new Date(now + 3 * HOUR).toISOString(),
  };
}

function capTwoEntityHass(): HomeAssistant {
  return {
    states: {
      'sensor.cap_frost': { state: 'moderate', attributes: capAttrs('urn:frost', 'Frost') },
      'sensor.cap_flood': { state: 'moderate', attributes: capAttrs('urn:flood', 'Flood') },
    },
    locale: { language: 'en' },
  } as unknown as HomeAssistant;
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
  return { card, cleanup: () => card.remove() };
}

function root(card: CardInternals): ShadowRoot {
  if (!card.shadowRoot) throw new Error('no shadowRoot');
  return card.shadowRoot;
}

beforeEach(() => {
  // The card persists per-alert expand state in a static map keyed by entity;
  // clear it so expansion from one test never leaks into the next.
  (WeatherAlertsCard as unknown as { _editorExpandedState: Map<string, unknown> })
    ._editorExpandedState.clear();

  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      get length() { return store.size; },
      clear: () => store.clear(),
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
    },
    configurable: true,
    writable: true,
  });
});

// ---------------------------------------------------------------------------
// Dispatcher unit tests
// ---------------------------------------------------------------------------

describe('handleTapAction dispatcher', () => {
  const node = () => document.createElement('div');

  function fakeHass(): { hass: HomeAssistant; calls: unknown[][] } {
    const calls: unknown[][] = [];
    const hass = {
      callService: (...args: unknown[]) => { calls.push(args); return Promise.resolve(); },
    } as unknown as HomeAssistant;
    return { hass, calls };
  }

  it('more-info fires hass-more-info with action.entity, else defaultEntity, else nothing', () => {
    const n = node();
    const seen: string[] = [];
    n.addEventListener('hass-more-info', (e) => seen.push((e as CustomEvent).detail.entityId));

    handleTapAction(n, undefined, { action: 'more-info', entity: 'light.explicit' }, 'sensor.default');
    handleTapAction(n, undefined, { action: 'more-info' }, 'sensor.default');
    handleTapAction(n, undefined, { action: 'more-info' }); // neither → no event

    expect(seen).toEqual(['light.explicit', 'sensor.default']);
  });

  it('navigate pushes state and fires location-changed; honors navigation_replace', () => {
    const push = vi.spyOn(history, 'pushState');
    const replace = vi.spyOn(history, 'replaceState');
    const events: boolean[] = [];
    const onNav = (e: Event) => events.push((e as CustomEvent).detail.replace);
    window.addEventListener('location-changed', onNav);

    handleTapAction(node(), undefined, { action: 'navigate', navigation_path: '#alerts' });
    handleTapAction(node(), undefined, { action: 'navigate', navigation_path: '#x', navigation_replace: true });

    expect(push).toHaveBeenCalledWith(null, '', '#alerts');
    expect(replace).toHaveBeenCalledWith(null, '', '#x');
    expect(events).toEqual([false, true]);

    window.removeEventListener('location-changed', onNav);
    push.mockRestore();
    replace.mockRestore();
  });

  it('url opens window with url_path', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    handleTapAction(node(), undefined, { action: 'url', url_path: 'https://example.test/' });
    expect(open).toHaveBeenCalledWith('https://example.test/', '_blank', 'noopener');
    open.mockRestore();
  });

  it('toggle calls homeassistant.toggle with the resolved entity', () => {
    const { hass, calls } = fakeHass();
    handleTapAction(node(), hass, { action: 'toggle' }, 'switch.fan');
    expect(calls).toEqual([['homeassistant', 'toggle', { entity_id: 'switch.fan' }]]);
  });

  it('call-service and perform-action both split the service and pass data/target', () => {
    const a = fakeHass();
    handleTapAction(node(), a.hass, {
      action: 'call-service', service: 'notify.mobile', data: { message: 'hi' }, target: { x: 1 },
    });
    expect(a.calls).toEqual([['notify', 'mobile', { message: 'hi' }, { x: 1 }]]);

    const b = fakeHass();
    handleTapAction(node(), b.hass, {
      action: 'perform-action', perform_action: 'light.turn_on', service_data: { brightness: 5 },
    });
    expect(b.calls).toEqual([['light', 'turn_on', { brightness: 5 }, undefined]]);
  });

  it('fire-dom-event fires ll-custom carrying the whole config', () => {
    const n = node();
    let detail: unknown;
    n.addEventListener('ll-custom', (e) => { detail = (e as CustomEvent).detail; });
    const cfg: ActionConfig = { action: 'fire-dom-event', browser_mod: { service: 'popup' } };
    handleTapAction(n, undefined, cfg);
    expect(detail).toEqual(cfg);
  });

  it('none and unknown actions fire nothing', () => {
    const n = node();
    let fired = false;
    ['hass-more-info', 'll-custom', 'location-changed'].forEach(
      t => n.addEventListener(t, () => { fired = true; }),
    );
    handleTapAction(n, undefined, { action: 'none' });
    handleTapAction(n, undefined, { action: 'bogus' } as unknown as ActionConfig);
    expect(fired).toBe(false);
  });

  it('hasTapAction is presence-based (true even for action:none)', () => {
    expect(hasTapAction(undefined)).toBe(false);
    expect(hasTapAction({})).toBe(false);
    expect(hasTapAction({ tap_action: { action: 'none' } })).toBe(true);
    expect(hasTapAction({ tap_action: { action: 'more-info' } })).toBe(true);
  });

  it('fireEvent dispatches a composed bubbling CustomEvent', () => {
    const n = node();
    let ev: CustomEvent | undefined;
    n.addEventListener('x-test', (e) => { ev = e as CustomEvent; });
    fireEvent(n, 'x-test', { a: 1 });
    expect(ev?.bubbles).toBe(true);
    expect(ev?.composed).toBe(true);
    expect(ev?.detail).toEqual({ a: 1 });
  });
});

// ---------------------------------------------------------------------------
// Render / behavior tests
// ---------------------------------------------------------------------------

function baseFull(extra: Partial<WeatherAlertsCardConfig> = {}): WeatherAlertsCardConfig {
  return {
    type: 'custom:weather-alerts-card',
    entity: 'sensor.nws_alerts',
    ...extra,
  } as WeatherAlertsCardConfig;
}

describe('back-compat (no tap_action)', () => {
  it('compact row keeps the chevron and toggles expand on click', async () => {
    const { card, cleanup } = await mountCard(
      baseFull({ layout: 'compact' }), nwsHass(),
    );
    const r = root(card);
    expect(r.querySelector('.compact-chevron')).not.toBeNull();
    expect(r.querySelector('.alert-card.tappable')).toBeNull();
    expect(r.querySelector('.alert-expanded')).toBeNull();

    r.querySelector<HTMLElement>('.compact-row')!.click();
    await (card as unknown as { updateComplete: Promise<void> }).updateComplete;
    expect(r.querySelector('.alert-expanded')).not.toBeNull();
    cleanup();
  });

  it('full row keeps the Read details toggle', async () => {
    const { card, cleanup } = await mountCard(baseFull(), nwsHass());
    expect(root(card).querySelector('.details-summary')).not.toBeNull();
    expect(root(card).querySelector('.alert-card.tappable')).toBeNull();
    cleanup();
  });
});

describe('compact + tap_action', () => {
  it('drops the chevron, does not expand, and fires the action on click', async () => {
    const { card, cleanup } = await mountCard(
      baseFull({ layout: 'compact', tap_action: { action: 'more-info' } }), nwsHass(),
    );
    const r = root(card);
    expect(r.querySelector('.compact-chevron')).toBeNull();

    const seen: string[] = [];
    window.addEventListener('hass-more-info', (e) => seen.push((e as CustomEvent).detail.entityId));

    r.querySelector<HTMLElement>('.compact-row')!.click();
    await (card as unknown as { updateComplete: Promise<void> }).updateComplete;

    expect(r.querySelector('.alert-expanded')).toBeNull();
    // Aggregate provider → the alert's sourceEntityId is the aggregate sensor.
    expect(seen).toEqual(['sensor.nws_alerts']);
    cleanup();
  });
});

describe('full + tap_action', () => {
  it('with no expandDetails: no toggle, row click fires the action', async () => {
    const { card, cleanup } = await mountCard(
      baseFull({ tap_action: { action: 'more-info' } }), nwsHass(),
    );
    const r = root(card);
    expect(r.querySelector('.details-summary')).toBeNull();
    expect(r.querySelector('.details-content')).toBeNull();
    expect(r.querySelector('.alert-card.tappable')).not.toBeNull();

    const seen: string[] = [];
    window.addEventListener('hass-more-info', (e) => seen.push((e as CustomEvent).detail.entityId));
    r.querySelector<HTMLElement>('.alert-card')!.click();
    expect(seen).toEqual(['sensor.nws_alerts']);
    cleanup();
  });

  it('with expandDetails: static panel shows; clicking a link inside it does not fire the row action', async () => {
    const { card, cleanup } = await mountCard(
      baseFull({ tap_action: { action: 'more-info' }, expandDetails: true }), nwsHass(),
    );
    const r = root(card);
    expect(r.querySelector('.details-summary')).toBeNull(); // no toggle
    const panel = r.querySelector<HTMLElement>('.details-content');
    expect(panel).not.toBeNull();

    const seen: string[] = [];
    window.addEventListener('hass-more-info', (e) => seen.push((e as CustomEvent).detail.entityId));

    panel!.click(); // stopPropagation guard → no row action
    expect(seen).toEqual([]);

    r.querySelector<HTMLElement>('.alert-header-row')!.click(); // the row → action
    expect(seen).toEqual(['sensor.nws_alerts']);
    cleanup();
  });
});

describe('per-alert entity resolution', () => {
  it('each CAP row fires more-info for its own source sensor', async () => {
    const { card, cleanup } = await mountCard(
      {
        type: 'custom:weather-alerts-card',
        entity: 'sensor.cap_frost',
        entities: ['sensor.cap_flood'],
        tap_action: { action: 'more-info' },
      } as WeatherAlertsCardConfig,
      capTwoEntityHass(),
    );
    const r = root(card);
    const cards = r.querySelectorAll<HTMLElement>('.alert-card');
    expect(cards.length).toBe(2);

    const seen: string[] = [];
    window.addEventListener('hass-more-info', (e) => seen.push((e as CustomEvent).detail.entityId));
    cards.forEach(c => c.click());

    expect(seen.sort()).toEqual(['sensor.cap_flood', 'sensor.cap_frost']);
    cleanup();
  });

  it('explicit tap_action.entity overrides the per-alert source', async () => {
    const { card, cleanup } = await mountCard(
      {
        type: 'custom:weather-alerts-card',
        entity: 'sensor.cap_frost',
        entities: ['sensor.cap_flood'],
        tap_action: { action: 'more-info', entity: 'sensor.override' },
      } as WeatherAlertsCardConfig,
      capTwoEntityHass(),
    );
    const r = root(card);
    const seen: string[] = [];
    window.addEventListener('hass-more-info', (e) => seen.push((e as CustomEvent).detail.entityId));
    r.querySelectorAll<HTMLElement>('.alert-card').forEach(c => c.click());
    expect(seen).toEqual(['sensor.override', 'sensor.override']);
    cleanup();
  });
});

describe('action: none (inert chip)', () => {
  it('removes the expand affordance but is not tappable and fires nothing', async () => {
    const { card, cleanup } = await mountCard(
      baseFull({ tap_action: { action: 'none' } }), nwsHass(),
    );
    const r = root(card);
    expect(r.querySelector('.details-summary')).toBeNull();
    expect(r.querySelector('.alert-card.tappable')).toBeNull();
    expect(r.querySelector('.alert-card')!.getAttribute('role')).toBeNull();

    const seen: string[] = [];
    window.addEventListener('hass-more-info', () => seen.push('x'));
    r.querySelector<HTMLElement>('.alert-card')!.click();
    expect(seen).toEqual([]);
    cleanup();
  });
});

describe('swipe guard', () => {
  it('a click after a swipe drag fires no action and resets the flag', async () => {
    const { card, cleanup } = await mountCard(
      baseFull({ tap_action: { action: 'more-info' } }), nwsHass(),
    );
    const r = root(card);
    const seen: string[] = [];
    window.addEventListener('hass-more-info', (e) => seen.push((e as CustomEvent).detail.entityId));

    card._swipeJustDragged = true;
    r.querySelector<HTMLElement>('.alert-card')!.click();
    expect(seen).toEqual([]);
    expect(card._swipeJustDragged).toBe(false);

    // A subsequent genuine click now fires.
    r.querySelector<HTMLElement>('.alert-card')!.click();
    expect(seen).toEqual(['sensor.nws_alerts']);
    cleanup();
  });
});

describe('dismiss button', () => {
  it('clicking × does not fire the row action', async () => {
    const { card, cleanup } = await mountCard(
      baseFull({ tap_action: { action: 'more-info' }, allowDismiss: true }), nwsHass(),
    );
    const r = root(card);
    const seen: string[] = [];
    window.addEventListener('hass-more-info', (e) => seen.push((e as CustomEvent).detail.entityId));

    const btn = r.querySelector<HTMLElement>('.dismiss-button');
    expect(btn).not.toBeNull();
    btn!.click();
    expect(seen).toEqual([]);
    cleanup();
  });
});

describe('tap_action action:details', () => {
  const settle = (card: CardInternals) =>
    (card as unknown as { updateComplete: Promise<void> }).updateComplete;

  const dialog = (card: CardInternals) => root(card).querySelector<HTMLDialogElement>('dialog.detail-dialog');

  // expandDetails keeps the description panel open inside the dialog, so the
  // assertions can read the alert's own text rather than a collapsed toggle.
  const detailsConfig = (extra: Partial<WeatherAlertsCardConfig> = {}) =>
    baseFull({ tap_action: { action: 'details' }, expandDetails: true, ...extra });

  it('opens a dialog carrying only the tapped alert (full layout)', async () => {
    const { card, cleanup } = await mountCard(detailsConfig(), nwsHass());
    expect(dialog(card)).toBeNull();

    root(card).querySelector<HTMLElement>('.alert-card')!.click();
    await settle(card);

    expect(card._detailPopupAlertId).toBe('wind-severe');
    const d = dialog(card)!;
    expect(d).not.toBeNull();
    // The whole alert body renders inside, so the alert's own title is on
    // screen (the reason the expanded-sub-block-only version was wrong).
    expect(d.querySelector('.alert-title')!.textContent!.trim())
      .toBe('High Wind Warning');
    expect(d.querySelector('.alert-header-row')).not.toBeNull();
    expect(d.querySelector('.icon-box')).not.toBeNull();
    expect(d.querySelector('.progress-section')).not.toBeNull();
    expect(d.textContent).toContain('Damaging winds.');
    cleanup();
  });

  it('opens the dialog from the compact layout too', async () => {
    const { card, cleanup } = await mountCard(
      detailsConfig({ layout: 'compact' }), nwsHass(),
    );
    // Presence of tap_action still removes the inline expand affordance.
    expect(root(card).querySelector('.compact-chevron')).toBeNull();

    root(card).querySelector<HTMLElement>('.compact-row')!.click();
    await settle(card);

    expect(card._detailPopupAlertId).toBe('wind-severe');
    expect(dialog(card)).not.toBeNull();
    cleanup();
  });

  // The decisive case: one aggregate sensor, two alerts. Scoping comes from the
  // in-hand alert object, not from per-alert entities.
  it('scopes to the tapped alert on an aggregate sensor holding two alerts', async () => {
    const { card, cleanup } = await mountCard(detailsConfig(), nwsTwoAlertHass());
    const rows = root(card).querySelectorAll<HTMLElement>('.alert-card');
    expect(rows.length).toBe(2);

    rows[1].click();
    await settle(card);

    expect(card._detailPopupAlertId).toBe('flood-severe');
    const d = dialog(card)!;
    expect(d.querySelector('.alert-title')!.textContent!.trim())
      .toBe('Flash Flood Warning');
    expect(d.textContent).toContain('Rapid rises expected.');
    expect(d.textContent).not.toContain('Damaging winds.');

    // Re-tapping the first row swaps the dialog over to it, not adds a second.
    rows[0].click();
    await settle(card);
    expect(card._detailPopupAlertId).toBe('wind-severe');
    expect(root(card).querySelectorAll('dialog.detail-dialog').length).toBe(1);
    expect(dialog(card)!.textContent).toContain('Damaging winds.');
    cleanup();
  });

  it('the close button clears the state and removes the dialog', async () => {
    const { card, cleanup } = await mountCard(detailsConfig(), nwsHass());
    root(card).querySelector<HTMLElement>('.alert-card')!.click();
    await settle(card);

    root(card).querySelector<HTMLElement>('.detail-dialog-close')!.click();
    await settle(card);

    expect(card._detailPopupAlertId).toBeNull();
    expect(dialog(card)).toBeNull();
    cleanup();
  });

  // Esc and the scrim both surface as the native dialog's `close` event, the
  // single path through which the pop-up state is cleared.
  it('native dialog close (Esc / scrim) clears the state', async () => {
    const { card, cleanup } = await mountCard(detailsConfig(), nwsHass());
    root(card).querySelector<HTMLElement>('.alert-card')!.click();
    await settle(card);

    dialog(card)!.dispatchEvent(new Event('close'));
    await settle(card);

    expect(card._detailPopupAlertId).toBeNull();
    expect(dialog(card)).toBeNull();
    cleanup();
  });

  it('Enter and Space open the dialog from the keyboard', async () => {
    for (const key of ['Enter', ' ']) {
      const { card, cleanup } = await mountCard(detailsConfig(), nwsHass());
      root(card).querySelector<HTMLElement>('.alert-card')!
        .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await settle(card);

      expect(card._detailPopupAlertId, key).toBe('wind-severe');
      expect(dialog(card), key).not.toBeNull();
      cleanup();
    }
  });

  it('fires no HA action — the dispatcher is never reached', async () => {
    const { card, cleanup } = await mountCard(detailsConfig(), nwsHass());
    const seen: string[] = [];
    const onMoreInfo = () => seen.push('more-info');
    const onCustom = () => seen.push('ll-custom');
    const onNav = () => seen.push('location-changed');
    window.addEventListener('hass-more-info', onMoreInfo);
    window.addEventListener('ll-custom', onCustom);
    window.addEventListener('location-changed', onNav);

    root(card).querySelector<HTMLElement>('.alert-card')!.click();
    await settle(card);

    expect(seen).toEqual([]);
    expect(card._detailPopupAlertId).toBe('wind-severe');

    window.removeEventListener('hass-more-info', onMoreInfo);
    window.removeEventListener('ll-custom', onCustom);
    window.removeEventListener('location-changed', onNav);
    cleanup();
  });

  it('a click synthesized after a swipe drag does not open it', async () => {
    const { card, cleanup } = await mountCard(detailsConfig(), nwsHass());
    card._swipeJustDragged = true;
    root(card).querySelector<HTMLElement>('.alert-card')!.click();
    await settle(card);

    expect(card._detailPopupAlertId).toBeNull();
    expect(dialog(card)).toBeNull();
    expect(card._swipeJustDragged).toBe(false);

    // The next genuine click still opens it.
    root(card).querySelector<HTMLElement>('.alert-card')!.click();
    await settle(card);
    expect(card._detailPopupAlertId).toBe('wind-severe');
    cleanup();
  });

  it('auto-closes when the open alert churns out of the feed', async () => {
    const { card, cleanup } = await mountCard(detailsConfig(), nwsTwoAlertHass());
    root(card).querySelectorAll<HTMLElement>('.alert-card')[1].click();
    await settle(card);
    expect(card._detailPopupAlertId).toBe('flood-severe');

    // The feed drops the open alert; the remaining one must not inherit the dialog.
    card.hass = nwsHass();
    await settle(card);

    expect(dialog(card)).toBeNull();
    expect(card._detailPopupAlertId).toBeNull();
    cleanup();
  });
});

describe('accessibility', () => {
  it('actionable row is a keyboard-operable button and Enter fires the action', async () => {
    const { card, cleanup } = await mountCard(
      baseFull({ tap_action: { action: 'more-info' } }), nwsHass(),
    );
    const el = root(card).querySelector<HTMLElement>('.alert-card')!;
    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('tabindex')).toBe('0');

    const seen: string[] = [];
    window.addEventListener('hass-more-info', (e) => seen.push((e as CustomEvent).detail.entityId));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(seen).toEqual(['sensor.nws_alerts']);
    cleanup();
  });
});
