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

// A MeteoSwiss aggregate warning sensor. sentTs is always absent (no issued
// time in the feed); validTo:null models an open-ended ("Ongoing") warning.
function meteoSwissHass(validFrom: string, validTo: string | null): HomeAssistant {
  return {
    states: {
      'sensor.weather_warnings': {
        state: '1',
        attributes: {
          attribution: 'Source: MeteoSwiss',
          warning_types: ['Forest fire'],
          warning_levels: ['Significant hazard'],
          warning_levels_numeric: [3],
          warning_valid_from: [validFrom],
          warning_valid_to: [validTo],
          warning_texts: ['Elevated forest-fire danger.'],
          warning_links: ['https://www.meteoswiss.admin.ch/forest-fire'],
        },
      },
    },
    locale: { language: 'en' },
  } as unknown as HomeAssistant;
}

// An NWS alert carries full timing (Sent/Onset/Ends) — the seam's untouched path.
function nwsFullTimingHass(): HomeAssistant {
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
            Instruction: '',
            URL: '',
            Headline: '',
          }],
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

// Map each meta-grid item's label → value text for deterministic assertions.
function metaGrid(card: CardInternals): Record<string, string> {
  const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
  if (!root) throw new Error('no shadowRoot');
  const out: Record<string, string> = {};
  for (const item of root.querySelectorAll('.meta-item')) {
    const label = (item.querySelector('.meta-label')?.textContent || '').trim();
    const value = (item.querySelector('.meta-value')?.textContent || '').trim();
    out[label] = value;
  }
  return out;
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

describe('metadata-grid seam', () => {
  const baseConfig = (entity: string): WeatherAlertsCardConfig => ({
    type: 'custom:weather-alerts-card',
    entity,
    expandDetails: true,
  } as WeatherAlertsCardConfig);

  it('omits the Issued row when there is no issued time', async () => {
    const from = new Date(Date.now() - HOUR).toISOString();
    const { card, cleanup } = await mountCard(
      baseConfig('sensor.weather_warnings'),
      meteoSwissHass(from, null),
    );
    const grid = metaGrid(card);
    expect(grid).not.toHaveProperty('Issued');
    expect(grid).toHaveProperty('Onset');
    cleanup();
  });

  it('renders an active open-ended warning as "Ongoing", not N/A', async () => {
    const from = new Date(Date.now() - HOUR).toISOString();
    const { card, cleanup } = await mountCard(
      baseConfig('sensor.weather_warnings'),
      meteoSwissHass(from, null),
    );
    expect(metaGrid(card)['Expires']).toBe('Ongoing');
    cleanup();
  });

  it('renders an upcoming open-ended warning as "TBD"', async () => {
    const from = new Date(Date.now() + HOUR).toISOString();
    const { card, cleanup } = await mountCard(
      baseConfig('sensor.weather_warnings'),
      meteoSwissHass(from, null),
    );
    expect(metaGrid(card)['Expires']).toBe('TBD');
    cleanup();
  });

  it('renders both Issued and Expires rows with timestamps for full-timing alerts', async () => {
    const { card, cleanup } = await mountCard(
      baseConfig('sensor.nws_alerts'),
      nwsFullTimingHass(),
    );
    const grid = metaGrid(card);
    expect(grid).toHaveProperty('Issued');
    expect(grid['Issued']).not.toBe('');
    // The End row carries a real timestamp, not the open-ended placeholders.
    expect(grid['Expires']).not.toBe('Ongoing');
    expect(grid['Expires']).not.toBe('TBD');
    expect(grid['Expires']).not.toBe('');
    cleanup();
  });
});
