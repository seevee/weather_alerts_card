import { describe, it, expect } from 'vitest';
import { MeteoAlarmAdapter } from '../../src/adapters/meteoalarm';

function makeMeteoAlarmAttributes(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    attribution: 'Information provided by MeteoAlarm',
    language: 'en-GB',
    category: 'Met',
    event: 'Severe forest-fire warning',
    responseType: 'Monitor',
    urgency: 'Immediate',
    severity: 'Severe',
    certainty: 'Likely',
    effective: '2026-03-06T12:00:00+01:00',
    onset: '2026-03-06T14:00:00+01:00',
    expires: '2026-03-07T06:00:00+01:00',
    senderName: 'AEMET',
    headline: 'Forest fire warning for Catalonia',
    description: 'High risk of forest fires due to extreme heat and dry conditions.',
    instruction: 'Avoid open fires. Follow local authority guidance.',
    awareness_level: '3; orange; Severe',
    awareness_type: '8; Forest Fire',
    ...overrides,
  };
}

describe('MeteoAlarmAdapter', () => {
  const adapter = new MeteoAlarmAdapter();

  describe('canHandle', () => {
    it('returns true for MeteoAlarm attribution', () => {
      expect(adapter.canHandle(makeMeteoAlarmAttributes())).toBe(true);
    });

    it('returns true for awareness_level + awareness_type without attribution', () => {
      expect(adapter.canHandle({
        awareness_level: '2; yellow; Moderate',
        awareness_type: '1; Wind',
      })).toBe(true);
    });

    it('returns false for NWS-shaped attributes', () => {
      expect(adapter.canHandle({
        Alerts: [{ Event: 'Tornado', Severity: 'Extreme' }],
      })).toBe(false);
    });

    it('returns false for BoM-shaped attributes', () => {
      expect(adapter.canHandle({
        warnings: [{ warning_group_type: 'major', issue_time: '2026-03-06T10:00:00Z' }],
        attribution: 'Data provided by the Australian Bureau of Meteorology',
      })).toBe(false);
    });

    it('returns false for empty attributes', () => {
      expect(adapter.canHandle({})).toBe(false);
    });
  });

  describe('parseAlerts', () => {
    it('normalizes MeteoAlarm attributes to a single WeatherAlert', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes());
      expect(alerts).toHaveLength(1);
      const a = alerts[0];
      expect(a.event).toBe('Severe forest-fire warning');
      expect(a.provider).toBe('meteoalarm');
      expect(a.certainty).toBe('Likely');
      expect(a.urgency).toBe('Immediate');
      expect(a.headline).toBe('Forest fire warning for Catalonia');
      expect(a.description).toBe('High risk of forest fires due to extreme heat and dry conditions.');
      expect(a.instruction).toBe('Avoid open fires. Follow local authority guidance.');
      expect(a.areaDesc).toBe('AEMET');
    });

    it('maps awareness_level 4 to extreme', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes({
        awareness_level: '4; red; Extreme',
      }));
      expect(alerts[0].severity).toBe('extreme');
    });

    it('maps awareness_level 3 to severe', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes({
        awareness_level: '3; orange; Severe',
      }));
      expect(alerts[0].severity).toBe('severe');
    });

    it('maps awareness_level 2 to moderate', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes({
        awareness_level: '2; yellow; Moderate',
      }));
      expect(alerts[0].severity).toBe('moderate');
    });

    it('maps awareness_level 1 to minor', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes({
        awareness_level: '1; green; Minor',
      }));
      expect(alerts[0].severity).toBe('minor');
    });

    it('falls back to severity attribute when awareness_level is missing', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes({
        awareness_level: undefined,
        severity: 'Moderate',
      }));
      expect(alerts[0].severity).toBe('moderate');
    });

    it('returns unknown severity when both awareness_level and severity are missing', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes({
        awareness_level: undefined,
        severity: undefined,
      }));
      expect(alerts[0].severity).toBe('unknown');
    });

    it('parses ISO timestamps correctly', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes());
      expect(alerts[0].onsetTs).toBeGreaterThan(0);
      expect(alerts[0].endsTs).toBeGreaterThan(alerts[0].onsetTs);
      expect(alerts[0].sentTs).toBeGreaterThan(0);
    });

    it('uses effective as onset fallback when onset is missing', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes({
        onset: undefined,
        effective: '2026-03-06T12:00:00+01:00',
      }));
      expect(alerts[0].onsetTs).toBeGreaterThan(0);
    });

    it('returns empty array when no event or headline', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes({
        event: undefined,
        headline: undefined,
      }));
      expect(alerts).toEqual([]);
    });

    it('uses awareness_type label as event fallback', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes({
        event: undefined,
        headline: 'Some headline',
        awareness_type: '1; Wind',
      }));
      expect(alerts[0].event).toBe('Wind');
    });

    it('uses headline as event when both event and awareness_type are missing', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes({
        event: undefined,
        awareness_type: undefined,
        headline: 'Wind warning for coastal areas',
      }));
      expect(alerts[0].event).toBe('Wind warning for coastal areas');
    });

    it('has empty zones array', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes());
      expect(alerts[0].zones).toEqual([]);
    });

    it('has empty phase', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes());
      expect(alerts[0].phase).toBe('');
    });

    it('has empty url', () => {
      const alerts = adapter.parseAlerts(makeMeteoAlarmAttributes());
      expect(alerts[0].url).toBe('');
    });
  });
});
