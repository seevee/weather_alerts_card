import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

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

import '../src/weather-alerts-card';
import type { HomeAssistant, WeatherAlertsCardConfig } from '../src/types';

interface CardInternals {
  setConfig(config: WeatherAlertsCardConfig): void;
  hass: HomeAssistant;
  remove(): void;
}

const HOUR = 3600 * 1000;

// Four NWS alerts, one per temporal phase. Ongoing has no Ends/Expires (endsTs
// resolves to 0). Expired is in the past (needs hideExpired:false to render).
function phasedHass(): HomeAssistant {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const base = { Severity: 'Moderate', Description: 'x', Instruction: '', URL: '', Headline: '' };
  return {
    states: {
      'sensor.nws_alerts': {
        state: '4',
        attributes: {
          Alerts: [
            { ...base, ID: 'prep', Event: 'Prep Warning', Sent: iso(now - HOUR), Onset: iso(now + 2 * HOUR), Ends: iso(now + 4 * HOUR), Expires: iso(now + 4 * HOUR) },
            { ...base, ID: 'active', Event: 'Active Warning', Sent: iso(now - 2 * HOUR), Onset: iso(now - HOUR), Ends: iso(now + 2 * HOUR), Expires: iso(now + 2 * HOUR) },
            { ...base, ID: 'ongoing', Event: 'Ongoing Warning', Sent: iso(now - 2 * HOUR), Onset: iso(now - HOUR), Ends: '', Expires: '' },
            { ...base, ID: 'expired', Event: 'Expired Warning', Sent: iso(now - 4 * HOUR), Onset: iso(now - 3 * HOUR), Ends: iso(now - HOUR), Expires: iso(now - HOUR) },
          ],
        },
      },
    },
    locale: { language: 'en' },
  } as unknown as HomeAssistant;
}

async function mountCard(config: WeatherAlertsCardConfig, hass: HomeAssistant): Promise<{ card: CardInternals; cleanup: () => void }> {
  const card = document.createElement('weather-alerts-card') as unknown as CardInternals;
  card.setConfig(config);
  card.hass = hass;
  document.body.appendChild(card);
  await (card as unknown as { updateComplete: Promise<void> }).updateComplete;
  return { card, cleanup: () => card.remove() };
}

// Map each rendered .alert-card's title → its DOMTokenList of classes.
function cardClassesByTitle(card: CardInternals): Record<string, DOMTokenList> {
  const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
  if (!root) throw new Error('no shadowRoot');
  const out: Record<string, DOMTokenList> = {};
  for (const el of root.querySelectorAll('.alert-card')) {
    const title = (el.querySelector('.alert-title')?.textContent || '').trim();
    out[title] = (el as HTMLElement).classList;
  }
  return out;
}

const BASE: WeatherAlertsCardConfig = { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', hideExpired: false };

beforeEach(() => {
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

describe('per-phase decoration class resolution', () => {
  it('emits the default decoration + icon-border class per phase, none for expired', async () => {
    const { card, cleanup } = await mountCard(BASE, phasedHass());
    const classes = cardClassesByTitle(card);

    // Preparation → striped fill, dashed ring
    expect(classes['Prep Warning'].contains('deco-striped')).toBe(true);
    expect(classes['Prep Warning'].contains('icon-border-dashed')).toBe(true);

    // Active → shimmer fill, solid ring
    expect(classes['Active Warning'].contains('deco-shimmer')).toBe(true);
    expect(classes['Active Warning'].contains('icon-border-solid')).toBe(true);

    // Ongoing → pulse fill, solid ring
    expect(classes['Ongoing Warning'].contains('deco-pulse')).toBe(true);
    expect(classes['Ongoing Warning'].contains('icon-border-solid')).toBe(true);

    // Expired → carries no deco-* / icon-border-* class
    const expired = Array.from(classes['Expired Warning']);
    expect(expired.some(c => c.startsWith('deco-'))).toBe(false);
    expect(expired.some(c => c.startsWith('icon-border-'))).toBe(false);

    cleanup();
  });

  it('honors progressStyle + iconBorderStyle overrides per phase', async () => {
    const { card, cleanup } = await mountCard({
      ...BASE,
      progressStyle: { preparation: 'shimmer', active: 'striped' },
      iconBorderStyle: { active: 'dashed', preparation: 'solid' },
    }, phasedHass());
    const classes = cardClassesByTitle(card);

    expect(classes['Prep Warning'].contains('deco-shimmer')).toBe(true);
    expect(classes['Prep Warning'].contains('icon-border-solid')).toBe(true);
    expect(classes['Active Warning'].contains('deco-striped')).toBe(true);
    expect(classes['Active Warning'].contains('icon-border-dashed')).toBe(true);
    // Ongoing untouched → defaults
    expect(classes['Ongoing Warning'].contains('deco-pulse')).toBe(true);

    cleanup();
  });
});

describe('ongoing progress-fill regression', () => {
  it('no longer emits an inline animation on the ongoing fill (motion via deco-pulse)', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, expandDetails: true }, phasedHass());
    const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot!;
    // Locate the ongoing alert-card and read its progress-fill inline style.
    const ongoingCard = Array.from(root.querySelectorAll('.alert-card'))
      .find(el => (el.querySelector('.alert-title')?.textContent || '').trim() === 'Ongoing Warning');
    expect(ongoingCard).toBeTruthy();
    const fill = ongoingCard!.querySelector('.progress-fill') as HTMLElement;
    expect(fill).toBeTruthy();
    expect(fill.getAttribute('style') || '').not.toContain('animation');
    // But the card still carries deco-pulse, which supplies the motion in CSS.
    expect((ongoingCard as HTMLElement).classList.contains('deco-pulse')).toBe(true);
    cleanup();
  });
});
