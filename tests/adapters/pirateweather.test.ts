import { describe, it, expect } from 'vitest';
import { PirateWeatherAdapter } from '../../src/adapters/pirateweather';

function makeSingleAlertAttributes(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    attribution: 'Powered by Pirate Weather',
    title: 'Wind Advisory',
    description: 'Winds 25 to 35 mph with gusts up to 50 mph.',
    severity: 'Moderate',
    regions: ['Denver County', 'CO'],
    uri: 'https://alerts.weather.gov/cap/wwacapget.php?x=CO123',
    time: '2024-03-21T10:00:00-06:00',
    expires: '2024-03-21T22:00:00-06:00',
    ...overrides,
  };
}

function makeMultiAlertAttributes(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    attribution: 'Powered by Pirate Weather',
    title_0: 'Wind Advisory',
    description_0: 'Winds 25 to 35 mph.',
    severity_0: 'Moderate',
    regions_0: ['Denver County', 'CO'],
    uri_0: 'https://example.com/alert0',
    time_0: '2024-03-21T10:00:00-06:00',
    expires_0: '2024-03-21T22:00:00-06:00',
    title_1: 'Freeze Warning',
    description_1: 'Sub-zero temperatures expected.',
    severity_1: 'Severe',
    regions_1: ['Boulder County', 'CO'],
    uri_1: 'https://example.com/alert1',
    time_1: '2024-03-21T11:00:00-06:00',
    expires_1: '2024-03-22T01:00:00-06:00',
    ...overrides,
  };
}

describe('PirateWeatherAdapter', () => {
  const adapter = new PirateWeatherAdapter();

  describe('canHandle', () => {
    it('returns true for Pirate Weather attribution', () => {
      expect(adapter.canHandle({ attribution: 'Powered by Pirate Weather' })).toBe(true);
    });

    it('returns true for case-insensitive attribution', () => {
      expect(adapter.canHandle({ attribution: 'pirate weather api' })).toBe(true);
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

    it('returns false for MeteoAlarm-shaped attributes', () => {
      expect(adapter.canHandle({
        attribution: 'Information provided by MeteoAlarm',
      })).toBe(false);
    });

    it('returns false for empty attributes', () => {
      expect(adapter.canHandle({})).toBe(false);
    });
  });

  describe('parseAlerts — single alert (unindexed)', () => {
    it('parses a single unindexed alert', () => {
      const alerts = adapter.parseAlerts(makeSingleAlertAttributes());
      expect(alerts).toHaveLength(1);
      const a = alerts[0];
      expect(a.event).toBe('Wind Advisory');
      expect(a.provider).toBe('pirateweather');
      expect(a.severity).toBe('moderate');
      expect(a.severityLabel).toBe('Moderate');
      expect(a.description).toBe('Winds 25 to 35 mph with gusts up to 50 mph.');
      expect(a.areaDesc).toBe('Denver County, CO');
      expect(a.url).toBe('https://alerts.weather.gov/cap/wwacapget.php?x=CO123');
      expect(a.headline).toBe('Wind Advisory');
      expect(a.severityInferred).toBe(false);
      expect(a.certaintyInferred).toBe(false);
    });

    it('parses ISO timestamps correctly', () => {
      const alerts = adapter.parseAlerts(makeSingleAlertAttributes());
      expect(alerts[0].sentTs).toBeGreaterThan(0);
      expect(alerts[0].onsetTs).toBe(alerts[0].sentTs);
      expect(alerts[0].endsTs).toBeGreaterThan(alerts[0].sentTs);
    });

    it('has empty certainty, urgency, instruction, zones, phase', () => {
      const alerts = adapter.parseAlerts(makeSingleAlertAttributes());
      const a = alerts[0];
      expect(a.certainty).toBe('');
      expect(a.urgency).toBe('');
      expect(a.instruction).toBe('');
      expect(a.zones).toEqual([]);
      expect(a.phase).toBe('');
    });
  });

  describe('parseAlerts — multiple alerts (indexed)', () => {
    it('parses multiple indexed alerts', () => {
      const alerts = adapter.parseAlerts(makeMultiAlertAttributes());
      expect(alerts).toHaveLength(2);
      expect(alerts[0].event).toBe('Wind Advisory');
      expect(alerts[1].event).toBe('Freeze Warning');
    });

    it('maps severity per alert', () => {
      const alerts = adapter.parseAlerts(makeMultiAlertAttributes());
      expect(alerts[0].severity).toBe('moderate');
      expect(alerts[1].severity).toBe('severe');
    });

    it('parses timestamps per alert', () => {
      const alerts = adapter.parseAlerts(makeMultiAlertAttributes());
      expect(alerts[0].sentTs).toBeGreaterThan(0);
      expect(alerts[1].sentTs).toBeGreaterThan(0);
      expect(alerts[1].sentTs).toBeGreaterThan(alerts[0].sentTs);
    });
  });

  describe('parseAlerts — regions handling', () => {
    it('joins array regions into areaDesc', () => {
      const alerts = adapter.parseAlerts(makeSingleAlertAttributes({
        regions: ['Denver County', 'Boulder County', 'CO'],
      }));
      expect(alerts[0].areaDesc).toBe('Denver County, Boulder County, CO');
    });

    it('handles string regions as fallback', () => {
      const alerts = adapter.parseAlerts(makeSingleAlertAttributes({
        regions: 'Denver County, CO',
      }));
      expect(alerts[0].areaDesc).toBe('Denver County, CO');
    });
  });

  describe('parseAlerts — severity mapping', () => {
    it.each([
      ['Extreme', 'extreme'],
      ['Severe', 'severe'],
      ['Moderate', 'moderate'],
      ['Minor', 'minor'],
      ['Unknown', 'unknown'],
      ['', 'unknown'],
    ])('maps "%s" to %s', (input, expected) => {
      const alerts = adapter.parseAlerts(makeSingleAlertAttributes({ severity: input }));
      expect(alerts[0].severity).toBe(expected);
    });

    it('title-cases the severity label', () => {
      const alerts = adapter.parseAlerts(makeSingleAlertAttributes({ severity: 'extreme' }));
      expect(alerts[0].severityLabel).toBe('Extreme');
    });

    it('marks severity as inferred when raw severity is empty', () => {
      const alerts = adapter.parseAlerts(makeSingleAlertAttributes({ severity: '' }));
      expect(alerts[0].severityInferred).toBe(true);
    });

    it('marks severity as not inferred when raw severity is valid', () => {
      const alerts = adapter.parseAlerts(makeSingleAlertAttributes({ severity: 'Moderate' }));
      expect(alerts[0].severityInferred).toBe(false);
    });
  });

  describe('parseAlerts — edge cases', () => {
    it('returns empty array when no title attributes exist', () => {
      const alerts = adapter.parseAlerts({
        attribution: 'Powered by Pirate Weather',
      });
      expect(alerts).toEqual([]);
    });

    it('returns empty array when title is empty string', () => {
      const alerts = adapter.parseAlerts(makeSingleAlertAttributes({ title: '' }));
      expect(alerts).toEqual([]);
    });

    it('does not double-count when both unindexed and indexed exist', () => {
      const attrs = {
        ...makeSingleAlertAttributes(),
        title_0: 'Wind Advisory',
        description_0: 'Winds 25 to 35 mph.',
        severity_0: 'Moderate',
        regions_0: ['Denver County', 'CO'],
        uri_0: 'https://example.com/alert0',
        time_0: '2024-03-21T10:00:00-06:00',
        expires_0: '2024-03-21T22:00:00-06:00',
      };
      const alerts = adapter.parseAlerts(attrs);
      // Should use indexed only, not unindexed
      expect(alerts).toHaveLength(1);
    });

    it('handles missing optional fields gracefully', () => {
      const alerts = adapter.parseAlerts({
        attribution: 'Powered by Pirate Weather',
        title: 'Test Alert',
      });
      expect(alerts).toHaveLength(1);
      const a = alerts[0];
      expect(a.description).toBe('');
      expect(a.areaDesc).toBe('');
      expect(a.url).toBe('');
      expect(a.sentTs).toBe(0);
      expect(a.endsTs).toBe(0);
    });
  });
});
