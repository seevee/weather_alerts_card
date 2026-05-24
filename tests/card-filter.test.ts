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

function nwsAlert(event: string, severity: string): Record<string, unknown> {
  const now = Date.now();
  return {
    ID: `${event}-${severity}`,
    Event: event,
    Severity: severity,
    Sent: new Date(now - 2 * 3600 * 1000).toISOString(),
    Onset: new Date(now - 1 * 3600 * 1000).toISOString(),
    Ends: new Date(now + 3 * 3600 * 1000).toISOString(),
    Expires: new Date(now + 3 * 3600 * 1000).toISOString(),
    Description: 'd',
    Instruction: '',
    URL: '',
    Headline: '',
  };
}

function makeHass(alerts: Record<string, unknown>[]): HomeAssistant {
  return {
    states: { 'sensor.nws_alerts': { state: String(alerts.length), attributes: { Alerts: alerts } } },
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

function alertTitles(card: CardInternals): string[] {
  const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
  if (!root) throw new Error('no shadowRoot');
  return [...root.querySelectorAll('.alert-title')].map(el => (el.textContent || '').trim());
}

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

describe('minSeverity filter', () => {
  it('keeps unknown-severity alerts but drops below-threshold classified ones', async () => {
    const hass = makeHass([
      nwsAlert('Mystery Alert', ''),            // → severity 'unknown'
      nwsAlert('Small Craft Advisory', 'Minor'), // → 'minor'
      nwsAlert('Tornado Warning', 'Extreme'),    // → 'extreme'
    ]);
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', minSeverity: 'severe' } as WeatherAlertsCardConfig,
      hass,
    );
    const titles = alertTitles(card);
    // 'extreme' passes the floor; 'unknown' is never silently dropped; 'minor'
    // is below 'severe' and is filtered.
    expect(titles).toContain('Tornado Warning');
    expect(titles).toContain('Mystery Alert');
    expect(titles).not.toContain('Small Craft Advisory');
    cleanup();
  });
});
