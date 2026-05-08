import { describe, it, expect } from 'vitest';
import { EcccAdapter } from '../../src/adapters/eccc';

const SAMPLE_TEXT = `What: Rain, at times heavy.

When: Late this evening through tomorrow morning.

Additional information: Don't drive through flooded roadways.`;

function makeEcccAlert(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Rainfall Warning',
    issued: '2026-04-27T19:46:24.386Z',
    color: 'yellow',
    expiry: '2026-04-28T11:46:24.386Z',
    text: SAMPLE_TEXT,
    area: 'Marathon - Schreiber',
    status: 'continued',
    confidence: 'Moderate',
    impact: 'High',
    alert_code: 'RFW',
    type: 'warning',
    ...overrides,
  };
}

function makeEcccAttributes(
  alertOverrides: Record<string, unknown> = {},
  attrOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    location: 'Marathon',
    station: 'Marathon Airport',
    alerts: [makeEcccAlert(alertOverrides)],
    attribution: 'Data provided by Environment Canada',
    friendly_name: 'Marathon Alerts',
    ...attrOverrides,
  };
}

describe('EcccAdapter', () => {
  const adapter = new EcccAdapter();

  describe('canHandle', () => {
    it('returns true for English attribution', () => {
      expect(adapter.canHandle({
        attribution: 'Data provided by Environment Canada',
      })).toBe(true);
    });

    it('returns true for French attribution', () => {
      expect(adapter.canHandle({
        attribution: 'Données fournies par Environnement Canada',
      })).toBe(true);
    });

    it('returns true for case-insensitive English variants', () => {
      expect(adapter.canHandle({ attribution: 'environment canada' })).toBe(true);
      expect(adapter.canHandle({ attribution: 'ENVIRONMENT CANADA' })).toBe(true);
    });

    it('returns true for case-insensitive French variants', () => {
      expect(adapter.canHandle({ attribution: 'environnement canada' })).toBe(true);
    });

    it('returns true even when alerts array is empty (zero-alert state)', () => {
      expect(adapter.canHandle({
        attribution: 'Data provided by Environment Canada',
        alerts: [],
      })).toBe(true);
    });

    it('returns false for NWS-shaped attributes', () => {
      expect(adapter.canHandle({
        Alerts: [{ Event: 'Tornado', Severity: 'Extreme' }],
      })).toBe(false);
    });

    it('returns false for BoM-shaped attributes', () => {
      expect(adapter.canHandle({
        warnings: [{ warning_group_type: 'major' }],
        attribution: 'Bureau of Meteorology',
      })).toBe(false);
    });

    it('returns false for PirateWeather attribution', () => {
      expect(adapter.canHandle({
        attribution: 'Powered by Pirate Weather',
      })).toBe(false);
    });

    it('returns false for empty attributes', () => {
      expect(adapter.canHandle({})).toBe(false);
    });
  });

  describe('parseAlerts — user sample (single alert)', () => {
    const alerts = adapter.parseAlerts(makeEcccAttributes());
    const a = alerts[0];

    it('returns one alert', () => {
      expect(alerts).toHaveLength(1);
    });

    it('event and headline are the alert title', () => {
      expect(a.event).toBe('Rainfall Warning');
      expect(a.headline).toBe('Rainfall Warning');
    });

    it('provider is eccc', () => {
      expect(a.provider).toBe('eccc');
    });

    it('severity is severe (warning + impact High flooring at severe)', () => {
      expect(a.severity).toBe('severe');
    });

    it('severityLabel is the title-cased type', () => {
      expect(a.severityLabel).toBe('Warning');
    });

    it('eventCode is the EC short code', () => {
      expect(a.eventCode).toBe('RFW');
    });

    it('certainty maps confidence to CAP token (Moderate → Possible)', () => {
      expect(a.certainty).toBe('Possible');
    });

    it('severityBadgeLabel is the title-cased raw impact', () => {
      expect(a.severityBadgeLabel).toBe('High');
    });

    it('phase is mapped from status', () => {
      expect(a.phase).toBe('Continued');
    });

    it('areaDesc is the area string', () => {
      expect(a.areaDesc).toBe('Marathon - Schreiber');
    });

    it('description is the full text body', () => {
      expect(a.description).toBe(SAMPLE_TEXT);
    });

    it('instruction is empty', () => {
      expect(a.instruction).toBe('');
    });

    it('zones is empty', () => {
      expect(a.zones).toEqual([]);
    });

    it('severityInferred is true', () => {
      expect(a.severityInferred).toBe(true);
    });

    it('certaintyInferred is true (mapped from confidence)', () => {
      expect(a.certaintyInferred).toBe(true);
    });

    it('sentTs equals onsetTs and is a positive number', () => {
      expect(a.sentTs).toBeGreaterThan(0);
      expect(a.sentTs).toBe(a.onsetTs);
    });

    it('endsTs is greater than sentTs', () => {
      expect(a.endsTs).toBeGreaterThan(a.sentTs);
    });

    it('url falls back to English overview when alert url absent', () => {
      expect(a.url).toBe('https://weather.gc.ca/index_e.html');
    });

    it('colorHint is the lower-cased color field', () => {
      expect(a.colorHint).toBe('yellow');
    });
  });

  describe('parseAlerts — url handling', () => {
    it('preserves verbatim url when present on the alert', () => {
      const alerts = adapter.parseAlerts(makeEcccAttributes({
        url: 'https://weather.gc.ca/warnings/details_e.html?abc',
      }));
      expect(alerts[0].url).toBe('https://weather.gc.ca/warnings/details_e.html?abc');
    });

    it('falls back to English overview with English attribution', () => {
      const alerts = adapter.parseAlerts(makeEcccAttributes({}, {
        attribution: 'Data provided by Environment Canada',
      }));
      expect(alerts[0].url).toBe('https://weather.gc.ca/index_e.html');
    });

    it('falls back to French overview with French attribution', () => {
      const alerts = adapter.parseAlerts(makeEcccAttributes({}, {
        attribution: 'Données fournies par Environnement Canada',
      }));
      expect(alerts[0].url).toBe('https://meteo.gc.ca/index_f.html');
    });
  });

  describe('parseAlerts — multiple alerts', () => {
    it('produces distinct ids for two alerts', () => {
      const attributes = {
        attribution: 'Data provided by Environment Canada',
        alerts: [
          makeEcccAlert({ alert_code: 'RFW', area: 'Region A' }),
          makeEcccAlert({ alert_code: 'WCW', area: 'Region B', title: 'Wind Chill Warning' }),
        ],
      };
      const alerts = adapter.parseAlerts(attributes);
      expect(alerts).toHaveLength(2);
      expect(alerts[0].id).not.toBe(alerts[1].id);
    });
  });

  describe('parseAlerts — severity tier mapping', () => {
    function severity(overrides: Record<string, unknown>): string {
      return adapter.parseAlerts(makeEcccAttributes(overrides))[0].severity;
    }

    it.each([
      ['red', { color: 'red', type: undefined, impact: undefined }, 'extreme'],
      ['orange', { color: 'orange', type: undefined, impact: undefined }, 'severe'],
      ['yellow', { color: 'yellow', type: undefined, impact: undefined }, 'moderate'],
      ['grey', { color: 'grey', type: undefined, impact: undefined }, 'minor'],
      ['green', { color: 'green', type: undefined, impact: undefined }, 'unknown'],
      ['watch + yellow', { color: 'yellow', type: 'watch', impact: undefined }, 'moderate'],
      ['advisory + grey', { color: 'grey', type: 'advisory', impact: undefined }, 'minor'],
      ['warning + yellow + High', { color: 'yellow', type: 'warning', impact: 'High' }, 'severe'],
      ['warning + red', { color: 'red', type: 'warning', impact: undefined }, 'extreme'],
      ['all empty', { color: undefined, type: undefined, impact: undefined }, 'unknown'],
    ])('severity %s', (_label, overrides, expected) => {
      expect(severity(overrides)).toBe(expected);
    });
  });

  describe('parseAlerts — phase mapping', () => {
    function phase(status: string | undefined): string {
      return adapter.parseAlerts(makeEcccAttributes({ status }))[0].phase;
    }

    it('new → New', () => expect(phase('new')).toBe('New'));
    it('issued → New', () => expect(phase('issued')).toBe('New'));
    it('continued → Continued', () => expect(phase('continued')).toBe('Continued'));
    it('updated → Updated', () => expect(phase('updated')).toBe('Updated'));
    it('extended → Updated', () => expect(phase('extended')).toBe('Updated'));
    it('ended → Final', () => expect(phase('ended')).toBe('Final'));
    it('expired → Final', () => expect(phase('expired')).toBe('Final'));
    it('unknown status → title-cased raw value', () => expect(phase('something')).toBe('Something'));
  });

  describe('parseAlerts — certainty mapping (confidence → CAP)', () => {
    function certainty(confidence: string | undefined): string {
      return adapter.parseAlerts(makeEcccAttributes({ confidence }))[0].certainty;
    }

    it('High → Likely', () => expect(certainty('High')).toBe('Likely'));
    it('Moderate → Possible', () => expect(certainty('Moderate')).toBe('Possible'));
    it('Medium → Possible', () => expect(certainty('Medium')).toBe('Possible'));
    it('Low → Unlikely', () => expect(certainty('Low')).toBe('Unlikely'));
    it('Élevée → Likely', () => expect(certainty('Élevée')).toBe('Likely'));
    it('Modérée → Possible', () => expect(certainty('Modérée')).toBe('Possible'));
    it('Faible → Unlikely', () => expect(certainty('Faible')).toBe('Unlikely'));
    it('unknown confidence → empty', () => expect(certainty('something')).toBe(''));
    it('missing confidence → empty', () => expect(certainty(undefined)).toBe(''));
  });

  describe('parseAlerts — severityBadgeLabel (raw impact)', () => {
    function badgeLabel(impact: string | undefined): string | undefined {
      return adapter.parseAlerts(makeEcccAttributes({ impact }))[0].severityBadgeLabel;
    }

    it('English impact "High" → "High"', () => expect(badgeLabel('High')).toBe('High'));
    it('English impact "Moderate" → "Moderate"', () => expect(badgeLabel('Moderate')).toBe('Moderate'));
    it('French impact "Élevée" → "Élevée"', () => expect(badgeLabel('Élevée')).toBe('Élevée'));
    it('lowercase impact is title-cased', () => expect(badgeLabel('low')).toBe('Low'));
    it('missing impact → undefined', () => expect(badgeLabel(undefined)).toBeUndefined());
  });

  describe('parseAlerts — filtering', () => {
    it('drops cancelled entries', () => {
      const attributes = {
        attribution: 'Data provided by Environment Canada',
        alerts: [
          makeEcccAlert({ status: 'cancelled', alert_code: 'RFW' }),
          makeEcccAlert({ status: 'continued', alert_code: 'WCW' }),
        ],
      };
      const alerts = adapter.parseAlerts(attributes);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].eventCode).toBe('WCW');
    });

    it('drops cancelled case-insensitively', () => {
      const attributes = {
        attribution: 'Data provided by Environment Canada',
        alerts: [makeEcccAlert({ status: 'CANCELLED' })],
      };
      expect(adapter.parseAlerts(attributes)).toHaveLength(0);
    });

    it('keeps ending entries (severity unknown via type mapping)', () => {
      const attributes = {
        attribution: 'Data provided by Environment Canada',
        alerts: [makeEcccAlert({
          type: 'ending', color: 'green', impact: undefined, status: 'ended',
        })],
      };
      const alerts = adapter.parseAlerts(attributes);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('unknown');
      expect(alerts[0].phase).toBe('Final');
    });
  });

  describe('parseAlerts — French locale', () => {
    const FR_ATTR = { attribution: 'Données fournies par Environnement Canada' };

    it('color "Rouge" maps to severity extreme', () => {
      const alerts = adapter.parseAlerts(makeEcccAttributes(
        { color: 'Rouge', type: undefined, impact: undefined },
        FR_ATTR,
      ));
      expect(alerts[0].severity).toBe('extreme');
    });

    it('impact "Élevée" contributes severity severe', () => {
      const alerts = adapter.parseAlerts(makeEcccAttributes(
        { color: undefined, type: undefined, impact: 'Élevée' },
        FR_ATTR,
      ));
      expect(alerts[0].severity).toBe('severe');
    });

    it('status "Maintenu" maps phase to Continued', () => {
      const alerts = adapter.parseAlerts(makeEcccAttributes(
        { status: 'Maintenu' },
        FR_ATTR,
      ));
      expect(alerts[0].phase).toBe('Continued');
    });

    it('status "annulé" filters the alert out', () => {
      const attributes = {
        ...FR_ATTR,
        alerts: [
          makeEcccAlert({ status: 'annulé', alert_code: 'RFW' }),
          makeEcccAlert({ status: 'maintenu', alert_code: 'WCW' }),
        ],
      };
      const alerts = adapter.parseAlerts(attributes);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].eventCode).toBe('WCW');
    });

    it('status "émis" maps phase to New', () => {
      const alerts = adapter.parseAlerts(makeEcccAttributes(
        { status: 'émis' },
        FR_ATTR,
      ));
      expect(alerts[0].phase).toBe('New');
    });

    it('French attribution falls back to meteo.gc.ca French URL', () => {
      const alerts = adapter.parseAlerts(makeEcccAttributes({}, FR_ATTR));
      expect(alerts[0].url).toBe('https://meteo.gc.ca/index_f.html');
    });
  });

  describe('parseAlerts — edge cases', () => {
    it('returns [] when alerts attribute is missing', () => {
      expect(adapter.parseAlerts({
        attribution: 'Data provided by Environment Canada',
      })).toEqual([]);
    });

    it('returns [] when alerts is empty', () => {
      expect(adapter.parseAlerts({
        attribution: 'Data provided by Environment Canada',
        alerts: [],
      })).toEqual([]);
    });

    it('handles alerts with only title and issued (other fields missing)', () => {
      const attributes = {
        attribution: 'Data provided by Environment Canada',
        alerts: [{
          title: 'Mystery Alert',
          issued: '2026-04-27T19:00:00.000Z',
        }],
      };
      const alerts = adapter.parseAlerts(attributes);
      expect(alerts).toHaveLength(1);
      const a = alerts[0];
      expect(a.event).toBe('Mystery Alert');
      expect(a.headline).toBe('Mystery Alert');
      expect(a.severity).toBe('unknown');
      expect(a.severityLabel).toBe('Unknown');
      expect(a.areaDesc).toBe('');
      expect(a.eventCode).toBe('');
      expect(a.description).toBe('');
      expect(a.certainty).toBe('');
      expect(a.phase).toBe('');
      expect(a.url).toBe('https://weather.gc.ca/index_e.html');
      expect(a.colorHint).toBeUndefined();
      expect(a.severityBadgeLabel).toBeUndefined();
    });
  });
});
