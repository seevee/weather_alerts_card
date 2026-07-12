import { describe, it, expect, beforeAll } from 'vitest';

// jsdom lacks matchMedia; the card touches it during construction, so polyfill
// before the card module loads (mirrors device-mode.test.ts).
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
import { scopeHashForConfig } from '../src/dismissal';
import type { HomeAssistant, WeatherAlertsCardConfig, WeatherAlert } from '../src/types';

const RFS_SOURCE = 'nsw_rural_fire_service_feed';

// One nsw_rural_fire_service_feed geo_location incident, as HA exposes it.
function rfsIncident(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source: RFS_SOURCE,
    external_id: `https://incidents.rfs.nsw.gov.au/api/v1/incidents/${Math.random()}`,
    category: 'Advice',
    status: 'Being controlled',
    type: 'Bush Fire',
    location: 'Somewhere, NSW',
    council_area: 'Somewhere',
    size: '5 ha',
    fire: true,
    responsible_agency: 'Rural Fire Service',
    publication_date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function makeHass(states: Record<string, { state: string; attributes: Record<string, unknown> }>): HomeAssistant {
  return { states, locale: { language: 'en' }, entities: {} } as unknown as HomeAssistant;
}

type CardInternals = WeatherAlertsCard & {
  _config?: WeatherAlertsCardConfig;
  _getAllEntities(): string[];
  _getAlerts(): WeatherAlert[];
};

function makeCard(): CardInternals {
  return new WeatherAlertsCard() as unknown as CardInternals;
}

describe('source-based auto-collection', () => {
  it('setConfig accepts a source-only config (no entity/device)', () => {
    const card = makeCard();
    expect(() =>
      card.setConfig({
        type: 'custom:weather-alerts-card',
        provider: 'nsw_rfs',
        sources: [RFS_SOURCE],
      } as WeatherAlertsCardConfig),
    ).not.toThrow();
  });

  it('collects every entity carrying the configured source, sorted, ignoring others', () => {
    const card = makeCard();
    card.setConfig({
      type: 'custom:weather-alerts-card',
      sources: [RFS_SOURCE],
    } as WeatherAlertsCardConfig);
    card.hass = makeHass({
      'geo_location.fire_b': { state: '12', attributes: rfsIncident() },
      'geo_location.fire_a': { state: '3', attributes: rfsIncident() },
      // Different source → excluded.
      'geo_location.other_feed': { state: '1', attributes: { source: 'some_other_feed' } },
      // Matching source but not parseable by any adapter → excluded (guard).
      'geo_location.bogus': { state: '1', attributes: { source: RFS_SOURCE } },
      // Unrelated sensor → excluded.
      'sensor.temperature': { state: '20', attributes: {} },
    });
    // Sorted, source-matched, canHandle-passing only.
    expect(card._getAllEntities()).toEqual(['geo_location.fire_a', 'geo_location.fire_b']);
  });

  it('merges explicit entities first, then source-collected ids, without duplicates', () => {
    const card = makeCard();
    card.setConfig({
      type: 'custom:weather-alerts-card',
      entity: 'geo_location.fire_a',
      sources: [RFS_SOURCE],
    } as WeatherAlertsCardConfig);
    card.hass = makeHass({
      'geo_location.fire_a': { state: '3', attributes: rfsIncident() },
      'geo_location.fire_b': { state: '12', attributes: rfsIncident() },
    });
    // fire_a is explicit (first) and must not be duplicated by the source scan.
    expect(card._getAllEntities()).toEqual(['geo_location.fire_a', 'geo_location.fire_b']);
  });

  it('parses source-collected incidents end-to-end into alerts', () => {
    const card = makeCard();
    card.setConfig({
      type: 'custom:weather-alerts-card',
      provider: 'nsw_rfs',
      sources: [RFS_SOURCE],
    } as WeatherAlertsCardConfig);
    card.hass = makeHass({
      'geo_location.fire_a': { state: '3', attributes: rfsIncident({ category: 'Advice' }) },
      'geo_location.fire_b': { state: '12', attributes: rfsIncident({ category: 'Emergency Warning' }) },
    });
    const alerts = card._getAlerts();
    expect(alerts.length).toBe(2);
    expect(alerts.every(a => a.provider === 'nsw_rfs')).toBe(true);
    expect(new Set(alerts.map(a => a.severity))).toEqual(new Set(['moderate', 'extreme']));
  });

  it('decouples collection from the provider override: a source-collected feed and a hand-added foreign entity each auto-detect their own adapter', () => {
    // The core multi-provider guarantee: sources collect RFS incidents, an
    // explicit BoM sensor is merged, and with provider UNSET each entity routes
    // to its correct adapter (this is exactly what forcing provider would break).
    const card = makeCard();
    card.setConfig({
      type: 'custom:weather-alerts-card',
      entity: 'sensor.bom_x_warnings',
      sources: [RFS_SOURCE],
      // provider intentionally omitted → auto-detect per entity
    } as WeatherAlertsCardConfig);
    card.hass = makeHass({
      'sensor.bom_x_warnings': {
        state: '1',
        attributes: {
          warnings: [{
            id: '1', type: 'flood_warning', title: 'Flood Warning for the Paroo River',
            warning_group_type: 'minor', phase: '', issue_time: new Date(Date.now() - 3600e3).toISOString(),
          }],
        },
      },
      'geo_location.fire_a': { state: '3', attributes: rfsIncident({ category: 'Emergency Warning' }) },
    });
    const alerts = card._getAlerts();
    const byProvider = new Set(alerts.map(a => a.provider));
    expect(byProvider.has('nsw_rfs')).toBe(true);
    expect(byProvider.has('bom')).toBe(true);
  });

  it('keys the dismissal scope on the stable source token, not the churning entity ids', () => {
    // Same source, entirely different incident entity ids across two polls →
    // identical scope hash, so browser-local dismissals survive feed churn.
    const a = scopeHashForConfig({ sources: [RFS_SOURCE] });
    const b = scopeHashForConfig({ sources: [RFS_SOURCE] });
    expect(a).toBe(b);
    expect(a).not.toBe('');
    // Different source → different scope.
    expect(scopeHashForConfig({ sources: ['other'] })).not.toBe(a);
  });
});
