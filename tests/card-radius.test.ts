import { describe, it, expect, beforeAll } from 'vitest';

// jsdom lacks matchMedia; the card touches it during construction, so polyfill
// before the card module loads (mirrors source-mode.test.ts).
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false, media: '', onchange: null,
        addEventListener: () => {}, removeEventListener: () => {},
        addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
      }),
    });
  }
});

import { WeatherAlertsCard } from '../src/weather-alerts-card';
import { haversineKm } from '../src/utils';
import type { HomeAssistant, WeatherAlertsCardConfig, WeatherAlert } from '../src/types';

const RFS_SOURCE = 'nsw_rural_fire_service_feed';

// Home: Sydney. The fixtures below are placed relative to it.
const HOME_LAT = -33.8688;
const HOME_LON = 151.2093;

// ~40 km west of the Sydney home point.
const NEAR = { latitude: -33.8688, longitude: 150.7776 };
// Melbourne — ~713 km away.
const FAR = { latitude: -37.8136, longitude: 144.9631 };

let seq = 0;

function rfsIncident(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source: RFS_SOURCE,
    external_id: `https://incidents.rfs.nsw.gov.au/api/v1/incidents/${++seq}`,
    category: 'Advice',
    status: 'Being controlled',
    type: 'Bush Fire',
    location: `Incident ${seq}`,
    council_area: 'Somewhere',
    size: '5 ha',
    fire: true,
    responsible_agency: 'Rural Fire Service',
    publication_date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function nwsAlert(): Record<string, unknown> {
  const now = Date.now();
  return {
    ID: 'nws-1',
    Event: 'Tornado Warning',
    Severity: 'Extreme',
    Sent: new Date(now - 2 * 3600 * 1000).toISOString(),
    Onset: new Date(now - 3600 * 1000).toISOString(),
    Ends: new Date(now + 3 * 3600 * 1000).toISOString(),
    Expires: new Date(now + 3 * 3600 * 1000).toISOString(),
    Description: 'd',
    Instruction: '',
    URL: '',
    Headline: '',
  };
}

// `null` means "no hass.config at all" — an explicit `undefined` would fall
// through to the default home point.
function makeHass(
  states: Record<string, { state: string; attributes: Record<string, unknown> }>,
  config: Record<string, unknown> | null = { latitude: HOME_LAT, longitude: HOME_LON },
): HomeAssistant {
  const hass: Record<string, unknown> = { states, locale: { language: 'en' }, entities: {} };
  if (config !== null) hass.config = config;
  return hass as unknown as HomeAssistant;
}

type CardInternals = WeatherAlertsCard & {
  _config?: WeatherAlertsCardConfig;
  _getAlerts(reconcile?: boolean): WeatherAlert[];
};

function makeCard(config: Partial<WeatherAlertsCardConfig>, hass: HomeAssistant): CardInternals {
  const card = new WeatherAlertsCard() as unknown as CardInternals;
  card.setConfig({
    type: 'custom:weather-alerts-card',
    provider: 'nsw_rfs',
    sources: [RFS_SOURCE],
    ...config,
  } as WeatherAlertsCardConfig);
  card.hass = hass;
  return card;
}

// Distinct publication_date values keep these two out of each other's dedup
// key, so a test that expects both to survive is measuring the radius filter
// and not dedup. The pre-dedup ordering test deliberately collides them.
const rfsStates = () => ({
  'geo_location.fire_near': {
    state: '40',
    attributes: rfsIncident({ ...NEAR, location: 'Near Fire', publication_date: '2026-01-08T03:30:00Z' }),
  },
  'geo_location.fire_far': {
    state: '713',
    attributes: rfsIncident({ ...FAR, location: 'Far Fire', publication_date: '2026-01-08T04:45:00Z' }),
  },
});

const headlines = (card: CardInternals): string[] => card._getAlerts(false).map(a => a.headline || a.event);

describe('maxDistanceKm filter', () => {
  it('drops incidents beyond the radius and keeps those inside it', () => {
    const card = makeCard({ maxDistanceKm: 100 }, makeHass(rfsStates()));
    expect(headlines(card)).toEqual(['Near Fire']);
  });

  it('filters nothing when no radius is configured', () => {
    const card = makeCard({}, makeHass(rfsStates()));
    expect(headlines(card).sort()).toEqual(['Far Fire', 'Near Fire']);
  });

  it('never filters an alert with no point (the #105 area-warning guardrail)', () => {
    const card = makeCard(
      { entity: 'sensor.nws_alerts', provider: undefined, maxDistanceKm: 1 },
      makeHass({
        ...rfsStates(),
        'sensor.nws_alerts': { state: '1', attributes: { Alerts: [nwsAlert()] } },
      }),
    );
    // Both RFS incidents are outside 1 km; the NWS area warning is untouched.
    expect(headlines(card)).toContain('Tornado Warning');
    expect(headlines(card)).not.toContain('Near Fire');
    expect(headlines(card)).not.toContain('Far Fire');
  });

  it('fails open when the home location is unknown', () => {
    const card = makeCard({ maxDistanceKm: 10 }, makeHass(rfsStates(), {}));
    expect(headlines(card).sort()).toEqual(['Far Fire', 'Near Fire']);
  });

  it('fails open when hass.config is absent entirely', () => {
    const card = makeCard({ maxDistanceKm: 10 }, makeHass(rfsStates(), null));
    expect(headlines(card).sort()).toEqual(['Far Fire', 'Near Fire']);
  });

  const invalid: Array<[string, unknown]> = [
    ['zero', 0],
    ['negative', -5],
    ['NaN', NaN],
    ['a numeric string', '50'],
  ];
  for (const [label, value] of invalid) {
    it(`filters nothing for ${label}`, () => {
      const card = makeCard(
        { maxDistanceKm: value as number },
        makeHass(rfsStates()),
      );
      expect(headlines(card).sort()).toEqual(['Far Fire', 'Near Fire']);
    });
  }

  it('keeps an incident sitting exactly on the radius', () => {
    const oneDegNorth = { latitude: HOME_LAT + 1, longitude: HOME_LON };
    const exact = haversineKm(oneDegNorth.longitude, oneDegNorth.latitude, HOME_LON, HOME_LAT);
    const card = makeCard(
      { maxDistanceKm: exact }, // the boundary is inclusive (<=)
      makeHass({
        'geo_location.fire_edge': { state: '111', attributes: rfsIncident({ ...oneDegNorth, location: 'Edge Fire' }) },
      }),
    );
    expect(headlines(card)).toEqual(['Edge Fire']);
  });

  it('runs before dedup, so same-key incidents are judged individually', () => {
    // Identical event/severity/onset/ends/provider ⇒ one dedup key. Without the
    // pre-dedup ordering, the merged representative would carry group[0]'s
    // point and the pair would stand or fall together.
    const published = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const card = makeCard(
      { maxDistanceKm: 100 },
      makeHass({
        'geo_location.fire_near': {
          state: '40',
          attributes: rfsIncident({ ...NEAR, location: 'Near Fire', publication_date: published }),
        },
        'geo_location.fire_far': {
          state: '713',
          attributes: rfsIncident({ ...FAR, location: 'Far Fire', publication_date: published }),
        },
      }),
    );
    const alerts = card._getAlerts(false);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].headline).toBe('Near Fire');
    expect(alerts[0].mergedCount).toBeUndefined();
  });

  it('never filters an incident whose coordinates are malformed', () => {
    const card = makeCard(
      { maxDistanceKm: 1 },
      makeHass({
        'geo_location.fire_bad': {
          state: '40',
          attributes: rfsIncident({ latitude: 'abc', longitude: null, location: 'Coordless Fire' }),
        },
      }),
    );
    expect(headlines(card)).toEqual(['Coordless Fire']);
  });
});
