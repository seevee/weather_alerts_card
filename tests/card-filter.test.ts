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

describe('unavailable banner', () => {
  // A cap_alerts per-alert sensor can report state "unknown" while its
  // attributes carry a fully valid alert. It must render the alert, not be
  // dropped as a broken data source.
  function capUnknownStateHass(): HomeAssistant {
    return {
      states: {
        'sensor.cap_alerts_beach_hazards': {
          state: 'unknown',
          attributes: {
            incident_platform_version: '1.0',
            id: 'fefdc9427295',
            event: 'Beach Hazards Statement',
            severity: 'Moderate',
            certainty: 'Likely',
            urgency: 'Expected',
            description: 'High wave action and dangerous swimming conditions.',
            headline: 'Beach Hazards Statement',
          },
        },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
  }

  it('renders a CAP alert whose sensor sits at state "unknown"', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.cap_alerts_beach_hazards' } as WeatherAlertsCardConfig,
      capUnknownStateHass(),
    );
    const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
    if (!root) throw new Error('no shadowRoot');
    expect(alertTitles(card)).toContain('Beach Hazards Statement');
    // The broken-sensor banner must NOT appear when valid alert data is present.
    expect(root.querySelector('.sensor-unavailable')).toBeNull();
    cleanup();
  });

  it('still shows the broken-sensor banner when an unknown sensor has no alert data', async () => {
    const hass = {
      states: { 'sensor.nws_alerts': { state: 'unavailable', attributes: {} } },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts' } as WeatherAlertsCardConfig,
      hass,
    );
    const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
    if (!root) throw new Error('no shadowRoot');
    expect(root.querySelector('.sensor-unavailable')).not.toBeNull();
    cleanup();
  });

  // A single broken sensor with empty attrs — the reporter's scenario (#187).
  function brokenSensorHass(): HomeAssistant {
    return {
      states: { 'sensor.nws_alerts': { state: 'unavailable', attributes: {} } },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
  }

  it('all-broken + hide fully suppresses the card', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', unavailableBehavior: 'hide' } as WeatherAlertsCardConfig,
      brokenSensorHass(),
    );
    const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
    if (!root) throw new Error('no shadowRoot');
    expect((card as unknown as HTMLElement).style.display).toBe('none');
    expect(root.querySelector('.sensor-unavailable')).toBeNull();
    cleanup();
  });

  it('all-broken + compact renders the muted one-liner', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', unavailableBehavior: 'compact' } as WeatherAlertsCardConfig,
      brokenSensorHass(),
    );
    const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
    if (!root) throw new Error('no shadowRoot');
    expect(root.querySelector('.sensor-unavailable.compact')).not.toBeNull();
    cleanup();
  });

  it('all-broken + default (message) renders the full notice without the compact class', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts' } as WeatherAlertsCardConfig,
      brokenSensorHass(),
    );
    const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
    if (!root) throw new Error('no shadowRoot');
    expect(root.querySelector('.sensor-unavailable')).not.toBeNull();
    expect(root.querySelector('.sensor-unavailable.compact')).toBeNull();
    cleanup();
  });

  // Guard the all-broken predicate: 'hide' must NOT fire when only some
  // entities are broken (a working sensor must never be masked). Partial
  // breakage falls through to normal rendering here; richer partial handling
  // is tracked in issue #201.
  it('hide does not suppress the card when only some entities are broken', async () => {
    const hass = {
      states: {
        'sensor.nws_broken': { state: 'unavailable', attributes: {} },
        'sensor.nws_quiet': { state: '0', attributes: { Alerts: [] } },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
    const { card, cleanup } = await mountCard(
      {
        type: 'custom:weather-alerts-card',
        entity: 'sensor.nws_broken',
        entities: ['sensor.nws_quiet'],
        unavailableBehavior: 'hide',
      } as WeatherAlertsCardConfig,
      hass,
    );
    expect((card as unknown as HTMLElement).style.display).not.toBe('none');
    cleanup();
  });
});
