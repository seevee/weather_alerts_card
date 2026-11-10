import { describe, it, expect, afterEach, vi } from 'vitest';

import '../src/weather-alerts-card';
import type { HomeAssistant, HassEntity, WeatherAlertsCardConfig } from '../src/types';
import type { Overrides } from './types';

// The card clock (#393): countdowns, progress and expiry move on their own,
// not only when an unrelated hass push happens to land. Runs in Chromium for
// real visibility and resize events.

interface CardInternals extends HTMLElement {
  setConfig(config: WeatherAlertsCardConfig): void;
  hass: HomeAssistant;
  shadowRoot: ShadowRoot | null;
  updateComplete: Promise<boolean>;
  requestUpdate(): void;
  render(): unknown;
  _clockTimer: ReturnType<typeof setTimeout> | null;
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const NWS = 'sensor.nws_alerts';
const iso = (ms: number) => new Date(ms).toISOString();

function nwsAlert(id: string, event: string, endsInMs: number): Record<string, unknown> {
  const now = Date.now();
  return {
    ID: id, Event: event, Severity: 'Moderate', Description: 'x', Instruction: '', URL: '', Headline: '',
    Sent: iso(now - HOUR), Onset: iso(now - HOUR), Ends: iso(now + endsInMs), Expires: iso(now + endsInMs),
  };
}

function nwsState(alerts: Record<string, unknown>[]): HassEntity {
  return { state: String(alerts.length), attributes: { Alerts: alerts } };
}

function makeHass(states: Record<string, HassEntity>, extra: Partial<HomeAssistant> = {}): HomeAssistant {
  return {
    states,
    locale: { language: 'en' },
    config: { time_zone: 'UTC', latitude: 0, longitude: 0 },
    themes: { darkMode: false },
    ...extra,
  } as unknown as HomeAssistant;
}

const BASE: WeatherAlertsCardConfig = { type: 'custom:weather-alerts-card', entity: NWS, animations: false };

const mounted: CardInternals[] = [];

async function mount(config: Overrides<WeatherAlertsCardConfig>, hass: HomeAssistant): Promise<CardInternals> {
  const card = document.createElement('weather-alerts-card') as unknown as CardInternals;
  card.setConfig({ ...BASE, ...config } as WeatherAlertsCardConfig);
  card.hass = hass;
  document.body.appendChild(card);
  mounted.push(card);
  await card.updateComplete;
  return card;
}

// Counts renders from here on.
function renders(card: CardInternals): () => number {
  const spy = vi.spyOn(card, 'render');
  return () => spy.mock.calls.length;
}

const titles = (card: CardInternals) =>
  [...card.shadowRoot!.querySelectorAll('.alert-title')].map(el => (el.textContent || '').trim());

afterEach(() => {
  while (mounted.length) mounted.pop()!.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('card clock', () => {
  it.each(['default', 'compact', 'timeline'] as const)('arms for the %s layout and clears on disconnect', async (layout) => {
    const card = await mount({ layout }, makeHass({ [NWS]: nwsState([nwsAlert('a', 'Wind Advisory', HOUR)]) }));
    expect(card._clockTimer).not.toBeNull();
    card.remove();
    expect(card._clockTimer).toBeNull();
  });

  it('stays off with nothing time-driven on screen', async () => {
    const card = await mount({}, makeHass({ [NWS]: nwsState([]) }));
    expect(card._clockTimer).toBeNull();
  });

  it('removes an alert at its end under hideExpired, with the house quiet', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const card = await mount({}, makeHass({ [NWS]: nwsState([nwsAlert('a', 'Wind Advisory', HOUR), nwsAlert('b', 'Brief Warning', 90 * 1000)]) }));
    expect(titles(card)).toEqual(['Wind Advisory', 'Brief Warning']);
    await vi.advanceTimersByTimeAsync(91 * 1000);
    await card.updateComplete;
    expect(titles(card)).toEqual(['Wind Advisory']);
  });

  it('ticks a countdown over at its minute boundary', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    // 30.5 minutes left: reads 30m now, 29m half a minute later.
    const card = await mount({ layout: 'compact' }, makeHass({ [NWS]: nwsState([nwsAlert('a', 'Wind Advisory', 30.5 * MIN)]) }));
    const label = () => (card.shadowRoot!.querySelector('.compact-time')!.textContent || '').trim();
    expect(label()).toContain('30m');
    await vi.advanceTimersByTimeAsync(31 * 1000);
    await card.updateComplete;
    expect(label()).toContain('29m');
  });

  it('pauses while the page is hidden and renders the moment it is visible', async () => {
    const card = await mount({}, makeHass({ [NWS]: nwsState([nwsAlert('a', 'Wind Advisory', HOUR)]) }));
    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    try {
      setHidden(true);
      expect(card._clockTimer).toBeNull();
      const count = renders(card);
      setHidden(false);
      await card.updateComplete;
      expect(count()).toBe(1);
      expect(card._clockTimer).not.toBeNull();
    } finally {
      delete (document as unknown as { hidden?: boolean }).hidden;
    }
  });
});
