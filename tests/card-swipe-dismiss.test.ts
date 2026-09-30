import { describe, it, expect, afterEach } from 'vitest';
import { commands } from 'vitest/browser';

import '../src/weather-alerts-card';
import type { WeatherAlertsCard } from '../src/weather-alerts-card';
import { scopeHashForConfig, storageKey, saveDismissals, loadDismissals } from '../src/dismissal';
import type { DismissalRecord, HomeAssistant, WeatherAlertsCardConfig } from '../src/types';

const HOUR = 3600 * 1000;
const WIND = 'wind-severe';
const FLOOD = 'flood-severe';

type CardInternals = Omit<WeatherAlertsCard, never> & {
  _swipeState: { id: string; offset: number; locked: boolean; cardWidth: number } | null;
  _swipeExiting: string | null;
  _swipeJustDragged: boolean;
  _swipePointerId: number | null;
  _expandedAlerts: Map<string, boolean>;
  _dismissals: Map<string, DismissalRecord>;
};

// The reduced-motion cases emulate the OS preference on the tester page;
// put it back so the next test starts from the default.
afterEach(async () => {
  await commands.setReducedMotion(false);
});

function nwsHass(): HomeAssistant {
  const now = Date.now();
  const alert = (id: string, event: string) => ({
    ID: id,
    Event: event,
    Severity: 'Severe',
    Sent: new Date(now - 2 * HOUR).toISOString(),
    Onset: new Date(now - 1 * HOUR).toISOString(),
    Ends: new Date(now + 3 * HOUR).toISOString(),
    Expires: new Date(now + 3 * HOUR).toISOString(),
    Description: 'body',
    Instruction: '',
    URL: '',
    Headline: '',
  });
  return {
    states: {
      'sensor.nws_alerts': {
        state: '2',
        attributes: { Alerts: [alert(WIND, 'High Wind Warning'), alert(FLOOD, 'Flash Flood Warning')] },
      },
    },
    locale: { language: 'en' },
  } as unknown as HomeAssistant;
}

const BASE: WeatherAlertsCardConfig = { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', provider: 'nws' };
const SWIPE: WeatherAlertsCardConfig = { ...BASE, allowDismiss: true, dismissTrigger: 'swipe' };
const SCOPE = scopeHashForConfig(BASE);

async function mountCard(config: WeatherAlertsCardConfig, hass: HomeAssistant = nwsHass()) {
  const card = document.createElement('weather-alerts-card') as unknown as CardInternals;
  card.setConfig(config);
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return card;
}

function rows(card: CardInternals): HTMLElement[] {
  return Array.from(card.shadowRoot!.querySelectorAll<HTMLElement>('.alert-card'));
}

function row(card: CardInternals, index = 0): HTMLElement {
  return rows(card)[index];
}

// The 40 % threshold is measured against the row's laid-out width, so every
// drag distance is derived from it rather than a fixed pixel count.
const width = (el: HTMLElement) => el.getBoundingClientRect().width;
const shortOf = (el: HTMLElement) => Math.round(width(el) * 0.3);
const pastOf = (el: HTMLElement) => Math.round(width(el) * 0.5);

function pointer(el: HTMLElement, type: string, init: PointerEventInit & { clientX: number; clientY?: number }) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, pointerId: 1, clientY: 50, ...init }));
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// A left drag of `dx` px from x=START, through the lock and one animation
// frame. Returns the pointer's final x so the release lands at the same spot.
const START = 400;
async function drag(card: CardInternals, el: HTMLElement, dx: number, pointerId = 1): Promise<number> {
  pointer(el, 'pointerdown', { clientX: START, pointerId });
  pointer(el, 'pointermove', { clientX: START - dx, pointerId });
  await nextFrame();
  await card.updateComplete;
  return START - dx;
}

describe('swipe gating', () => {
  it('does nothing when the trigger is the button (default)', async () => {
    const card = await mountCard({ ...BASE, allowDismiss: true });
    const el = row(card);
    expect(el.classList.contains('swipe-enabled')).toBe(false);
    pointer(el, 'pointerdown', { clientX: 200 });
    expect(card._swipeState).toBeNull();
  });

  it('marks every row swipe-enabled under a swipe trigger, and under both', async () => {
    for (const trigger of ['swipe', 'both'] as const) {
      const card = await mountCard({ ...BASE, allowDismiss: true, dismissTrigger: trigger });
      expect(rows(card).every((r) => r.classList.contains('swipe-enabled'))).toBe(true);
      card.remove();
    }
  });

  it('ignores a non-primary button', async () => {
    const card = await mountCard(SWIPE);
    pointer(row(card), 'pointerdown', { clientX: 200, button: 2 });
    expect(card._swipeState).toBeNull();
  });

  it('ignores a second pointer while one gesture is in hand', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    pointer(el, 'pointerdown', { clientX: 200, pointerId: 1 });
    pointer(el, 'pointerdown', { clientX: 100, pointerId: 2 });
    expect(card._swipePointerId).toBe(1);
    pointer(el, 'pointermove', { clientX: 40, pointerId: 2 });
    expect(card._swipeState!.locked).toBe(false);
  });
});

describe('gesture intent', () => {
  it('abandons a vertical scroll before locking', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    pointer(el, 'pointerdown', { clientX: 200 });
    pointer(el, 'pointermove', { clientX: 195, clientY: 90 });
    expect(card._swipeState).toBeNull();
  });

  it('abandons a rightward drag', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    pointer(el, 'pointerdown', { clientX: 200 });
    pointer(el, 'pointermove', { clientX: 240 });
    expect(card._swipeState).toBeNull();
  });

  it('locks a leftward drag and paints the offset on the next frame', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    pointer(el, 'pointerdown', { clientX: 200 });
    pointer(el, 'pointermove', { clientX: 150 });
    expect(card._swipeState).toMatchObject({ id: WIND, locked: true, offset: 0, cardWidth: width(el) });
    await nextFrame();
    await card.updateComplete;
    expect(card._swipeState!.offset).toBe(-50);
    const painted = row(card);
    expect(painted.classList.contains('swiping')).toBe(true);
    expect(painted.style.transform).toBe('translateX(-50px)');
    expect(painted.style.opacity).toBe((1 - 50 / width(el)).toFixed(2));
  });

  it('coalesces moves within one frame and never paints a positive offset', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    pointer(el, 'pointerdown', { clientX: 200 });
    pointer(el, 'pointermove', { clientX: 150 });
    pointer(el, 'pointermove', { clientX: 120 });
    pointer(el, 'pointermove', { clientX: 230 });
    await nextFrame();
    expect(card._swipeState!.offset).toBe(0);
  });
});

describe('release', () => {
  it('snaps back when released short of 40 % of the row width', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    const x = await drag(card, el, shortOf(el));
    pointer(el, 'pointerup', { clientX: x });
    expect(card._swipeState).toBeNull();
    expect(card._swipeExiting).toBeNull();
    await card.updateComplete;
    expect(rows(card)).toHaveLength(2);
    expect(row(card).style.transform).toBe('');
    expect(localStorage.getItem(storageKey(SCOPE))).toBeNull();
  });

  it('dismisses after the exit animation when released past the threshold', async () => {
    const card = await mountCard(SWIPE);
    const toasts: CustomEvent[] = [];
    card.addEventListener('hass-notification', (e) => toasts.push(e as CustomEvent));
    const el = row(card);
    const x = await drag(card, el, pastOf(el));
    pointer(el, 'pointerup', { clientX: x });
    expect(card._swipeExiting).toBe(WIND);
    await card.updateComplete;
    expect(row(card).classList.contains('swipe-exit')).toBe(true);
    expect(rows(card)).toHaveLength(2);
    expect(card._dismissals.size).toBe(0);

    await sleep(250);
    await card.updateComplete;
    expect(card._swipeExiting).toBeNull();
    expect(rows(card)).toHaveLength(1);
    expect(card._dismissals.has(WIND)).toBe(true);
    expect(loadDismissals(SCOPE).has(WIND)).toBe(true);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].detail.message).toContain('High Wind Warning');
  });

  it('skips the exit delay under prefers-reduced-motion', async () => {
    await commands.setReducedMotion(true);
    const card = await mountCard(SWIPE);
    const el = row(card);
    const x = await drag(card, el, pastOf(el));
    pointer(el, 'pointerup', { clientX: x });
    await sleep(0);
    await card.updateComplete;
    expect(rows(card)).toHaveLength(1);
    expect(card._dismissals.has(WIND)).toBe(true);
  });

  it('fires no toast when showDismissUndo is off', async () => {
    await commands.setReducedMotion(true);
    const card = await mountCard({ ...SWIPE, showDismissUndo: false });
    const toasts: Event[] = [];
    card.addEventListener('hass-notification', (e) => toasts.push(e));
    const el = row(card);
    const x = await drag(card, el, pastOf(el));
    pointer(el, 'pointerup', { clientX: x });
    await sleep(0);
    expect(card._dismissals.has(WIND)).toBe(true);
    expect(toasts).toHaveLength(0);
  });

  it('restores the alert through the toast undo action', async () => {
    await commands.setReducedMotion(true);
    const card = await mountCard(SWIPE);
    const toasts: CustomEvent[] = [];
    card.addEventListener('hass-notification', (e) => toasts.push(e as CustomEvent));
    const el = row(card);
    const x = await drag(card, el, pastOf(el));
    pointer(el, 'pointerup', { clientX: x });
    await sleep(0);
    await card.updateComplete;
    expect(rows(card)).toHaveLength(1);

    toasts[0].detail.action.action();
    await card.updateComplete;
    expect(rows(card)).toHaveLength(2);
    expect(card._dismissals.size).toBe(0);
    expect(localStorage.getItem(storageKey(SCOPE))).toBeNull();
    // A second undo of the same id is a no-op that leaves the map untouched.
    const before = card._dismissals;
    toasts[0].detail.action.action();
    expect(card._dismissals).toBe(before);
  });

  it('drops the pending dismissal when the card unmounts mid-exit', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    const x = await drag(card, el, pastOf(el));
    pointer(el, 'pointerup', { clientX: x });
    expect(card._swipeExiting).toBe(WIND);
    card.remove();
    expect(card._swipeExiting).toBeNull();
    await sleep(250);
    expect(card._dismissals.size).toBe(0);
    expect(localStorage.getItem(storageKey(SCOPE))).toBeNull();
  });

  it('resets on pointercancel', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    const x = await drag(card, el, pastOf(el));
    pointer(el, 'pointercancel', { clientX: x });
    expect(card._swipeState).toBeNull();
    expect(card._swipePointerId).toBeNull();
    await card.updateComplete;
    expect(rows(card)).toHaveLength(2);
    expect(card._dismissals.size).toBe(0);
  });

  it('ignores up and cancel from a pointer that did not start the gesture', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    const x = await drag(card, el, pastOf(el));
    pointer(el, 'pointerup', { clientX: x, pointerId: 2 });
    pointer(el, 'pointercancel', { clientX: x, pointerId: 2 });
    expect(card._swipeState).toMatchObject({ id: WIND, locked: true });
  });

  it('ignores move, up and cancel aimed at a different row', async () => {
    const card = await mountCard(SWIPE);
    const first = row(card, 0);
    const second = row(card, 1);
    pointer(first, 'pointerdown', { clientX: 200 });
    pointer(second, 'pointermove', { clientX: 60 });
    pointer(second, 'pointerup', { clientX: 60 });
    pointer(second, 'pointercancel', { clientX: 60 });
    expect(card._swipeState).toMatchObject({ id: WIND, locked: false });
  });
});

describe('real pointer', () => {
  // Chromium only captures an active pointer, which a synthesized PointerEvent
  // never is, so the capture/release contract is proven with the real mouse.
  it('captures the mouse on lock and releases it on pointerup', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    await commands.mouseDrag(0, shortOf(el));
    await card.updateComplete;
    expect(card._swipeState).toMatchObject({ id: WIND, locked: true });
    expect(el.hasPointerCapture(1)).toBe(true);
    await commands.mouseUp();
    await card.updateComplete;
    expect(card._swipeState).toBeNull();
    expect(el.hasPointerCapture(1)).toBe(false);
    expect(rows(card)).toHaveLength(2);
  });
});

describe('click after a drag', () => {
  it('swallows the synthesized click so the row does not expand, then clears the guard', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    const x = await drag(card, el, shortOf(el));
    pointer(el, 'pointerup', { clientX: x });
    expect(card._swipeJustDragged).toBe(true);

    el.querySelector<HTMLElement>('.details-summary')!.click();
    expect(card._expandedAlerts.get(WIND) ?? false).toBe(false);
    expect(card._swipeJustDragged).toBe(false);

    // A genuine click now toggles.
    el.querySelector<HTMLElement>('.details-summary')!.click();
    expect(card._expandedAlerts.get(WIND)).toBe(true);
  });

  it('clears the guard on its own when no click follows', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    const x = await drag(card, el, shortOf(el));
    pointer(el, 'pointerup', { clientX: x });
    expect(card._swipeJustDragged).toBe(true);
    await sleep(0);
    expect(card._swipeJustDragged).toBe(false);
  });

  it('leaves the guard down after an unlocked release', async () => {
    const card = await mountCard(SWIPE);
    const el = row(card);
    pointer(el, 'pointerdown', { clientX: 200 });
    pointer(el, 'pointerup', { clientX: 200 });
    expect(card._swipeJustDragged).toBe(false);
  });
});

describe('dismissal reconcile on render', () => {
  it('drops a stored record whose signature no longer matches and persists the pruned map', async () => {
    const stale = new Map<string, DismissalRecord>([[WIND, { sig: 'stale', dismissedAt: 1, lastSeenAt: Math.floor(Date.now() / 1000) }]]);
    saveDismissals(SCOPE, stale);
    const card = await mountCard({ ...BASE, allowDismiss: true });
    // The write is deferred to a microtask after render.
    await Promise.resolve();
    await card.updateComplete;
    expect(rows(card)).toHaveLength(2);
    expect(card._dismissals.has(WIND)).toBe(false);
    expect(localStorage.getItem(storageKey(SCOPE))).toBeNull();
  });
});
