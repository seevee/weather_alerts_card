import { describe, it, expect } from 'vitest';
import { MeteoSwissAdapter } from '../../src/adapters/meteoswiss';
import type { MeteoSwissWarning } from '../../src/types';

function makeMeteoSwissWarning(overrides: Partial<MeteoSwissWarning> = {}): MeteoSwissWarning {
  return {
    type: 'Wind',
    levelLabel: 'Severe hazard',
    level: 4,
    validFrom: '2026-06-04T08:00:00+00:00',
    validTo: '2026-06-04T18:00:00+00:00',
    text: 'Strong wind gusts up to 100 km/h expected.',
    ...overrides,
  };
}

function makeMeteoSwissAttributes(warnings: Partial<MeteoSwissWarning>[] = [{}]): Record<string, unknown> {
  const full = warnings.map(makeMeteoSwissWarning);
  return {
    attribution: 'Source: MeteoSwiss',
    warning_types: full.map(w => w.type),
    warning_levels: full.map(w => w.levelLabel),
    warning_levels_numeric: full.map(w => w.level),
    warning_valid_from: full.map(w => w.validFrom),
    warning_valid_to: full.map(w => w.validTo),
    warning_texts: full.map(w => w.text),
    warning_links: ['https://www.meteoswiss.admin.ch/some/link'],
  };
}

describe('MeteoSwissAdapter', () => {
  const adapter = new MeteoSwissAdapter();

  describe('canHandle', () => {
    it('returns true for the array-triple shape', () => {
      expect(adapter.canHandle(makeMeteoSwissAttributes([{}]))).toBe(true);
    });

    it('returns true at zero warnings (empty arrays present)', () => {
      expect(adapter.canHandle({
        attribution: 'Source: MeteoSwiss',
        warning_types: [],
        warning_levels: [],
        warning_levels_numeric: [],
        warning_valid_from: [],
        warning_valid_to: [],
        warning_texts: [],
        warning_links: [],
      })).toBe(true);
    });

    it('returns false for attribution alone without the arrays', () => {
      expect(adapter.canHandle({ attribution: 'Source: MeteoSwiss' })).toBe(false);
    });

    it('returns false for NWS-shaped attributes', () => {
      expect(adapter.canHandle({
        Alerts: [{ Event: 'Tornado Warning', Severity: 'Extreme' }],
      })).toBe(false);
    });

    it('returns false for BoM-shaped attributes', () => {
      expect(adapter.canHandle({
        warnings: [{ warning_group_type: 'major', issue_time: '2026-03-06T10:00:00Z' }],
      })).toBe(false);
    });

    it('returns false for MeteoAlarm-shaped attributes', () => {
      expect(adapter.canHandle({
        awareness_level: '3; orange; Severe',
        awareness_type: '1; Wind',
      })).toBe(false);
    });

    it('returns false for DWD-shaped attributes', () => {
      expect(adapter.canHandle({
        warning_count: 1,
        region_name: 'Stadt Hamburg',
        warning_1: { level: 1, color: '#FFFF00' },
      })).toBe(false);
    });

    it('returns false for PirateWeather-shaped attributes', () => {
      expect(adapter.canHandle({
        attribution: 'Data provided by Pirate Weather',
        title: 'Wind Advisory',
      })).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(adapter.canHandle({})).toBe(false);
    });
  });

  describe('parseAlerts', () => {
    it('normalizes a single warning', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([{}]));
      expect(alerts).toHaveLength(1);
      const a = alerts[0];
      expect(a.event).toBe('Wind');
      expect(a.eventCode).toBe('Wind');
      expect(a.iconHint).toBe('Wind');
      expect(a.headline).toBe('');
      expect(a.provider).toBe('meteoswiss');
      expect(a.severityInferred).toBe(false);
      expect(a.certaintyInferred).toBe(false);
      expect(a.certainty).toBe('');
      expect(a.urgency).toBe('');
      expect(a.phase).toBe('');
      expect(a.areaDesc).toBe('');
      expect(a.url).toContain('meteoswiss.admin.ch');
    });

    it('normalizes multiple warnings', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([
        { type: 'Wind', level: 4 },
        { type: 'Thunderstorms', level: 2 },
      ]));
      expect(alerts).toHaveLength(2);
      expect(alerts[0].event).toBe('Wind');
      expect(alerts[1].event).toBe('Thunderstorms');
    });

    it('maps level 5 to extreme', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([
        { level: 5, levelLabel: 'Very severe hazard' },
      ]));
      expect(alerts[0].severity).toBe('extreme');
      expect(alerts[0].severityLabel).toBe('Very severe hazard');
    });

    it('maps level 4 to extreme', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([
        { level: 4, levelLabel: 'Severe hazard' },
      ]));
      expect(alerts[0].severity).toBe('extreme');
      expect(alerts[0].severityLabel).toBe('Severe hazard');
    });

    it('maps level 3 to severe', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([
        { level: 3, levelLabel: 'Significant hazard' },
      ]));
      expect(alerts[0].severity).toBe('severe');
      expect(alerts[0].severityLabel).toBe('Significant hazard');
    });

    it('maps level 2 to moderate', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([
        { level: 2, levelLabel: 'Moderate hazard' },
      ]));
      expect(alerts[0].severity).toBe('moderate');
      expect(alerts[0].severityLabel).toBe('Moderate hazard');
    });

    it('maps level 1 to minor', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([
        { level: 1, levelLabel: 'No or minimal hazard' },
      ]));
      expect(alerts[0].severity).toBe('minor');
      expect(alerts[0].severityLabel).toBe('No or minimal hazard');
    });

    it('skips level 0 warnings', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([{ level: 0 }]));
      expect(alerts).toHaveLength(0);
    });

    it('falls back to tier label when warning_levels string is missing', () => {
      const attrs = makeMeteoSwissAttributes([{ level: 4 }]);
      delete attrs['warning_levels'];
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severityLabel).toBe('Extreme');
    });

    it('returns unknown severity for a non-numeric level', () => {
      const attrs = makeMeteoSwissAttributes([{}]);
      attrs['warning_levels_numeric'] = ['not-a-number'];
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severity).toBe('unknown');
    });

    it('parses ISO timestamps with timezone offsets', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([{}]));
      expect(alerts[0].onsetTs).toBeGreaterThan(0);
      expect(alerts[0].endsTs).toBeGreaterThan(alerts[0].onsetTs);
    });

    it('handles null validFrom/validTo as zero timestamps', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([
        { validFrom: null, validTo: null },
      ]));
      expect(alerts[0].onsetTs).toBe(0);
      expect(alerts[0].endsTs).toBe(0);
    });

    it('carries warning_texts through verbatim (plain prose)', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([
        { text: 'Strong wind gusts up to 100 km/h expected.' },
      ]));
      expect(alerts[0].description).toBe('Strong wind gusts up to 100 km/h expected.');
    });

    it('carries warning_texts through verbatim (inline HTML, no adapter sanitizing)', () => {
      const html = 'Gusts up to <b>120 km/h</b>. See <a href="https://example.ch">details</a>.';
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([{ text: html }]));
      expect(alerts[0].description).toBe(html);
    });

    it('uses the fixed MeteoSwiss warnings page as url', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([{}]));
      expect(alerts[0].url).toBe(
        'https://www.meteoswiss.admin.ch/services-and-publications/service/warnings.html',
      );
    });

    it('returns empty array for empty arrays', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([]));
      expect(alerts).toHaveLength(0);
    });

    it('returns empty array when arrays are missing', () => {
      const alerts = adapter.parseAlerts({ attribution: 'Source: MeteoSwiss' });
      expect(alerts).toHaveLength(0);
    });

    it('handles length-mismatched arrays gracefully', () => {
      const attrs = makeMeteoSwissAttributes([{ type: 'Wind', level: 4 }]);
      // Drop the parallel detail arrays so only types/levels remain.
      attrs['warning_levels'] = [];
      attrs['warning_valid_from'] = [];
      attrs['warning_valid_to'] = [];
      attrs['warning_texts'] = [];
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].event).toBe('Wind');
      expect(alerts[0].onsetTs).toBe(0);
      expect(alerts[0].description).toBe('');
    });

    it('generates id with the meteoswiss prefix', () => {
      const alerts = adapter.parseAlerts(makeMeteoSwissAttributes([{}]));
      expect(alerts[0].id).toMatch(/^meteoswiss_/);
    });
  });
});
