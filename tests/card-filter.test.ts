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

describe('degraded badge (#201)', () => {
  const root = (card: CardInternals): ShadowRoot => {
    const r = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
    if (!r) throw new Error('no shadowRoot');
    return r;
  };
  const badgeText = (card: CardInternals): string =>
    (root(card).querySelector('.degraded-badge')?.textContent || '').trim();

  // A cap_alerts per-alert sensor can report state "unknown" while its
  // attributes carry a fully valid alert. It must render the alert and NOT be
  // counted as a broken data source.
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

  it('renders a CAP alert whose sensor sits at state "unknown" and shows no badge', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.cap_alerts_beach_hazards' } as WeatherAlertsCardConfig,
      capUnknownStateHass(),
    );
    expect(alertTitles(card)).toContain('Beach Hazards Statement');
    // The unknown-with-valid-alert sensor is not broken → no degraded badge.
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    cleanup();
  });

  // A single broken sensor with empty attrs — the reporter's scenario (#187).
  function brokenSensorHass(): HomeAssistant {
    return {
      states: { 'sensor.nws_alerts': { state: 'unavailable', attributes: {} } },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
  }

  it('all-broken + default (message) shows the badge, card visible, no all-clear', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts' } as WeatherAlertsCardConfig,
      brokenSensorHass(),
    );
    expect(root(card).querySelector('.degraded-badge')).not.toBeNull();
    expect(root(card).querySelector('.degraded-badge.icon-only')).toBeNull();
    expect(root(card).querySelector('.no-alerts')).toBeNull();
    expect((card as unknown as HTMLElement).style.display).not.toBe('none');
    cleanup();
  });

  it('all-broken + compact shows an icon-only badge with no visible text', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', unavailableBehavior: 'compact' } as WeatherAlertsCardConfig,
      brokenSensorHass(),
    );
    const badge = root(card).querySelector('.degraded-badge.icon-only');
    expect(badge).not.toBeNull();
    expect(badge!.querySelector('span')).toBeNull();
    // The accessible label is still carried on the icon.
    expect(badge!.querySelector('ha-icon')?.getAttribute('title')).toBeTruthy();
    cleanup();
  });

  it('all-broken + hide alone does NOT hide the card (needs hideNoAlerts too)', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', unavailableBehavior: 'hide' } as WeatherAlertsCardConfig,
      brokenSensorHass(),
    );
    // Badge suppressed, but hideNoAlerts is off → the empty state shows.
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    expect((card as unknown as HTMLElement).style.display).not.toBe('none');
    expect(root(card).querySelector('.no-alerts')).not.toBeNull();
    cleanup();
  });

  it('all-broken + hide + hideNoAlerts fully hides the card', async () => {
    const { card, cleanup } = await mountCard(
      {
        type: 'custom:weather-alerts-card',
        entity: 'sensor.nws_alerts',
        unavailableBehavior: 'hide',
        hideNoAlerts: true,
      } as WeatherAlertsCardConfig,
      brokenSensorHass(),
    );
    expect((card as unknown as HTMLElement).style.display).toBe('none');
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    cleanup();
  });

  // Partial breakage: one source down, one quiet. The working source must never
  // be masked, and the badge must warn a source is dark.
  function partialHass(): HomeAssistant {
    return {
      states: {
        'sensor.nws_broken': { state: 'unavailable', attributes: {} },
        'sensor.nws_quiet': { state: '0', attributes: { Alerts: [] } },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
  }
  const partialConfig = (extra: Partial<WeatherAlertsCardConfig>): WeatherAlertsCardConfig => ({
    type: 'custom:weather-alerts-card',
    entity: 'sensor.nws_broken',
    entities: ['sensor.nws_quiet'],
    ...extra,
  } as WeatherAlertsCardConfig);

  it('partial (0 alerts) + default shows the badge and suppresses the all-clear', async () => {
    const { card, cleanup } = await mountCard(partialConfig({}), partialHass());
    expect(root(card).querySelector('.degraded-badge')).not.toBeNull();
    expect(root(card).querySelector('.no-alerts')).toBeNull();
    expect((card as unknown as HTMLElement).style.display).not.toBe('none');
    cleanup();
  });

  it('partial + hideNoAlerts still shows the badge (breakage overrides the hide)', async () => {
    const { card, cleanup } = await mountCard(partialConfig({ hideNoAlerts: true }), partialHass());
    expect(root(card).querySelector('.degraded-badge')).not.toBeNull();
    expect((card as unknown as HTMLElement).style.display).not.toBe('none');
    cleanup();
  });

  it('partial + hide restores prior behavior (no badge, all-clear shown)', async () => {
    const { card, cleanup } = await mountCard(partialConfig({ unavailableBehavior: 'hide' }), partialHass());
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    expect(root(card).querySelector('.no-alerts')).not.toBeNull();
    cleanup();
  });

  it('partial + hide + hideNoAlerts hides the card', async () => {
    const { card, cleanup } = await mountCard(
      partialConfig({ unavailableBehavior: 'hide', hideNoAlerts: true }),
      partialHass(),
    );
    expect((card as unknown as HTMLElement).style.display).toBe('none');
    cleanup();
  });

  it('partial with an active alert shows the badge above the rendered alert', async () => {
    const hass = {
      states: {
        'sensor.nws_broken': { state: 'unavailable', attributes: {} },
        'sensor.nws_active': { state: '1', attributes: { Alerts: [nwsAlert('Tornado Warning', 'Extreme')] } },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
    const { card, cleanup } = await mountCard(
      partialConfig({ entity: 'sensor.nws_broken', entities: ['sensor.nws_active'] }),
      hass,
    );
    expect(root(card).querySelector('.degraded-badge')).not.toBeNull();
    expect(alertTitles(card)).toContain('Tornado Warning');
    cleanup();
  });

  it('row 4 (all up, 0 alerts) shows no badge and the normal empty state', async () => {
    const hass = {
      states: {
        'sensor.nws_quiet': { state: '0', attributes: { Alerts: [] } },
        'sensor.nws_quiet_2': { state: '0', attributes: { Alerts: [] } },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_quiet', entities: ['sensor.nws_quiet_2'] } as WeatherAlertsCardConfig,
      hass,
    );
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    expect(root(card).querySelector('.no-alerts')).not.toBeNull();
    cleanup();
  });

  it('names the broken source by friendly_name, else the entity id', async () => {
    const named = {
      states: {
        'sensor.nws_broken': { state: 'unavailable', attributes: { friendly_name: 'NWS Boulder' } },
        'sensor.nws_quiet': { state: '0', attributes: { Alerts: [] } },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
    const r1 = await mountCard(partialConfig({}), named);
    expect(badgeText(r1.card)).toContain('NWS Boulder');
    r1.cleanup();

    // Empty attrs (#187) → fall back to the entity id.
    const r2 = await mountCard(partialConfig({}), partialHass());
    expect(badgeText(r2.card)).toContain('sensor.nws_broken');
    r2.cleanup();
  });

  it('counts broken sources when more than one is down', async () => {
    const hass = {
      states: {
        'sensor.nws_broken': { state: 'unavailable', attributes: {} },
        'sensor.dwd_broken': { state: 'unknown', attributes: {} },
        'sensor.nws_quiet': { state: '0', attributes: { Alerts: [] } },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
    const { card, cleanup } = await mountCard(
      partialConfig({ entities: ['sensor.dwd_broken', 'sensor.nws_quiet'] }),
      hass,
    );
    expect(badgeText(card)).toContain('2');
    cleanup();
  });
});
