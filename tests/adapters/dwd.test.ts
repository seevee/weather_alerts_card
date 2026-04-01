import { describe, it, expect } from 'vitest';
import { DwdAdapter } from '../../src/adapters/dwd';
import type { DwdWarning } from '../../src/types';

function makeDwdWarning(overrides: Partial<DwdWarning> = {}): DwdWarning {
  return {
    headline: 'Amtliche WARNUNG vor WINDBÖEN',
    description: 'Es treten Windböen mit Geschwindigkeiten bis 60 km/h auf.',
    instruction: 'Schließen Sie Fenster und Türen.',
    start_time: '2026-04-01T08:00:00+02:00',
    end_time: '2026-04-01T18:00:00+02:00',
    event: 'WINDBÖEN',
    event_code: 31,
    level: 1,
    color: '#FFFF00',
    parameters: { Windgeschwindigkeit: '≥ 40 km/h' },
    ...overrides,
  };
}

function makeDwdAttributes(warnings: Partial<DwdWarning>[] = [{}]): Record<string, unknown> {
  const attrs: Record<string, unknown> = {
    warning_count: warnings.length,
    region_name: 'Stadt Hamburg',
    region_id: '813073047',
    last_update: '2026-04-01T10:00:00+02:00',
  };
  warnings.forEach((w, i) => {
    const full = makeDwdWarning(w);
    attrs[`warning_${i + 1}`] = full;
    // Flat keys (for completeness, not used by adapter)
    attrs[`warning_${i + 1}_name`] = full.event;
    attrs[`warning_${i + 1}_level`] = full.level;
    attrs[`warning_${i + 1}_headline`] = full.headline;
  });
  return attrs;
}

describe('DwdAdapter', () => {
  const adapter = new DwdAdapter();

  describe('canHandle', () => {
    it('returns true for DWD attributes with warnings', () => {
      expect(adapter.canHandle(makeDwdAttributes([{}]))).toBe(true);
    });

    it('returns true for zero warnings with region_name', () => {
      expect(adapter.canHandle({
        warning_count: 0,
        region_name: 'Stadt Hamburg',
        region_id: '813073047',
      })).toBe(true);
    });

    it('returns false when warning_count is missing', () => {
      expect(adapter.canHandle({ region_name: 'Stadt Hamburg' })).toBe(false);
    });

    it('returns false when region_name is missing', () => {
      expect(adapter.canHandle({ warning_count: 0 })).toBe(false);
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

    it('returns false for PirateWeather-shaped attributes', () => {
      expect(adapter.canHandle({
        attribution: 'Data provided by Pirate Weather',
        title: 'Wind Advisory',
      })).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(adapter.canHandle({})).toBe(false);
    });

    it('returns false when warning_count > 0 but warning_1 lacks level/color', () => {
      expect(adapter.canHandle({
        warning_count: 1,
        region_name: 'Stadt Hamburg',
        warning_1: { headline: 'Test' }, // missing level and color
      })).toBe(false);
    });
  });

  describe('parseAlerts', () => {
    it('normalizes a single warning', () => {
      const alerts = adapter.parseAlerts(makeDwdAttributes([{}]));
      expect(alerts).toHaveLength(1);
      const a = alerts[0];
      expect(a.event).toBe('WINDBÖEN');
      expect(a.headline).toBe('Amtliche WARNUNG vor WINDBÖEN');
      expect(a.description).toBe('Es treten Windböen mit Geschwindigkeiten bis 60 km/h auf.');
      expect(a.instruction).toBe('Schließen Sie Fenster und Türen.');
      expect(a.provider).toBe('dwd');
      expect(a.severityInferred).toBe(false);
      expect(a.certaintyInferred).toBe(false);
      expect(a.certainty).toBe('');
      expect(a.urgency).toBe('');
      expect(a.phase).toBe('');
      expect(a.url).toContain('dwd.de');
    });

    it('normalizes multiple warnings', () => {
      const alerts = adapter.parseAlerts(makeDwdAttributes([
        { event: 'WINDBÖEN', event_code: 31, level: 1 },
        { event: 'GEWITTER', event_code: 95, level: 3 },
      ]));
      expect(alerts).toHaveLength(2);
      expect(alerts[0].event).toBe('WINDBÖEN');
      expect(alerts[1].event).toBe('GEWITTER');
    });

    it('maps level 1 to minor', () => {
      const alerts = adapter.parseAlerts(makeDwdAttributes([{ level: 1 }]));
      expect(alerts[0].severity).toBe('minor');
      expect(alerts[0].severityLabel).toBe('Minor');
    });

    it('maps level 2 to moderate', () => {
      const alerts = adapter.parseAlerts(makeDwdAttributes([{ level: 2 }]));
      expect(alerts[0].severity).toBe('moderate');
      expect(alerts[0].severityLabel).toBe('Moderate');
    });

    it('maps level 3 to severe', () => {
      const alerts = adapter.parseAlerts(makeDwdAttributes([{ level: 3 }]));
      expect(alerts[0].severity).toBe('severe');
      expect(alerts[0].severityLabel).toBe('Severe');
    });

    it('maps level 4 to extreme', () => {
      const alerts = adapter.parseAlerts(makeDwdAttributes([{ level: 4 }]));
      expect(alerts[0].severity).toBe('extreme');
      expect(alerts[0].severityLabel).toBe('Extreme');
    });

    it('skips level 0 warnings', () => {
      const alerts = adapter.parseAlerts(makeDwdAttributes([{ level: 0 }]));
      expect(alerts).toHaveLength(0);
    });

    it('populates eventCode from event_code', () => {
      const alerts = adapter.parseAlerts(makeDwdAttributes([{ event_code: 95 }]));
      expect(alerts[0].eventCode).toBe('95');
    });

    it('uses region_name for areaDesc', () => {
      const alerts = adapter.parseAlerts(makeDwdAttributes([{}]));
      expect(alerts[0].areaDesc).toBe('Stadt Hamburg');
    });

    it('handles missing description and instruction', () => {
      const attrs = makeDwdAttributes([{}]);
      const w = attrs['warning_1'] as Record<string, unknown>;
      delete w['description'];
      delete w['instruction'];
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].description).toBe('');
      expect(alerts[0].instruction).toBe('');
    });

    it('parses ISO timestamps with timezone offsets', () => {
      const alerts = adapter.parseAlerts(makeDwdAttributes([{
        start_time: '2026-04-01T08:00:00+02:00',
        end_time: '2026-04-01T18:00:00+02:00',
      }]));
      expect(alerts[0].onsetTs).toBeGreaterThan(0);
      expect(alerts[0].endsTs).toBeGreaterThan(alerts[0].onsetTs);
    });

    it('returns empty array for warning_count 0', () => {
      const alerts = adapter.parseAlerts({
        warning_count: 0,
        region_name: 'Stadt Hamburg',
      });
      expect(alerts).toHaveLength(0);
    });

    it('returns empty array when attributes lack warning_count', () => {
      const alerts = adapter.parseAlerts({ region_name: 'Stadt Hamburg' });
      expect(alerts).toHaveLength(0);
    });

    it('falls back to color hex when level is absent', () => {
      const attrs = makeDwdAttributes([{}]);
      const w = attrs['warning_1'] as Record<string, unknown>;
      delete w['level'];
      w['color'] = '#FF0000';
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severity).toBe('severe');
      expect(alerts[0].severityLabel).toBe('Severe');
    });

    it('falls back to color hex when level is unrecognized', () => {
      const attrs = makeDwdAttributes([{}]);
      const w = attrs['warning_1'] as Record<string, unknown>;
      w['level'] = 99;
      w['color'] = '#FF9900';
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severity).toBe('moderate');
      expect(alerts[0].severityLabel).toBe('Moderate');
    });

    it('returns unknown severity when both level and color are unrecognized', () => {
      const attrs = makeDwdAttributes([{}]);
      const w = attrs['warning_1'] as Record<string, unknown>;
      w['level'] = 99;
      w['color'] = '#123456';
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severity).toBe('unknown');
    });

    it('generates id from event_code and onsetTs', () => {
      const alerts = adapter.parseAlerts(makeDwdAttributes([{ event_code: 31 }]));
      expect(alerts[0].id).toMatch(/^dwd_31_/);
    });

    it('generates id from event name when event_code is absent', () => {
      const attrs = makeDwdAttributes([{ event: 'STURM' }]);
      const w = attrs['warning_1'] as Record<string, unknown>;
      delete w['event_code'];
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].id).toMatch(/^dwd_STURM_/);
    });
  });
});
