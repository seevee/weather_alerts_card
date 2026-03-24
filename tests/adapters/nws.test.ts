import { describe, it, expect } from 'vitest';
import { NwsAdapter } from '../../src/adapters/nws';
import type { NwsAlert } from '../../src/types';

function makeNwsAttributes(alerts: Partial<NwsAlert>[] = []): Record<string, unknown> {
  const defaults: NwsAlert = {
    ID: 'urn:oid:2.49.0.1.840.0.test',
    Event: 'Tornado Warning',
    Severity: 'Extreme',
    Certainty: 'Observed',
    Urgency: 'Immediate',
    Sent: '2026-03-06T10:00:00-07:00',
    Onset: '2026-03-06T12:00:00-07:00',
    Ends: '2026-03-06T18:00:00-07:00',
    Expires: '',
    Description: 'A tornado has been sighted.',
    Instruction: 'Take shelter immediately.',
    URL: 'https://alerts.weather.gov/test',
    Headline: 'Tornado Warning issued March 6',
    AreaDesc: 'Denver County',
    AffectedZones: ['https://api.weather.gov/zones/forecast/COZ039'],
    Geocode: { UGC: ['COZ039'], SAME: ['008059'] },
  };

  return {
    Alerts: alerts.map(a => ({ ...defaults, ...a })),
  };
}

describe('NwsAdapter', () => {
  const adapter = new NwsAdapter();

  describe('canHandle', () => {
    it('returns true for attributes with Alerts array containing NWS-shaped objects', () => {
      expect(adapter.canHandle(makeNwsAttributes([{}]))).toBe(true);
    });

    it('returns true for empty Alerts array', () => {
      expect(adapter.canHandle({ Alerts: [] })).toBe(true);
    });

    it('returns false for non-array Alerts', () => {
      expect(adapter.canHandle({ Alerts: 'none' })).toBe(false);
    });

    it('returns false for missing Alerts', () => {
      expect(adapter.canHandle({})).toBe(false);
    });

    it('returns false for BoM-shaped warnings', () => {
      expect(adapter.canHandle({
        warnings: [{ warning_group_type: 'major', issue_time: '2026-03-06T10:00:00Z' }],
      })).toBe(false);
    });
  });

  describe('parseAlerts', () => {
    it('normalizes NWS alerts to WeatherAlert format', () => {
      const attrs = makeNwsAttributes([{ ID: 'test-1', Event: 'Tornado Warning', Severity: 'Extreme' }]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts).toHaveLength(1);
      const a = alerts[0];
      expect(a.id).toBe('test-1');
      expect(a.event).toBe('Tornado Warning');
      expect(a.severity).toBe('extreme');
      expect(a.severityLabel).toBe('Extreme');
      expect(a.provider).toBe('nws');
      expect(a.phase).toBe('');
    });

    it('preserves original Severity casing in severityLabel', () => {
      const attrs = makeNwsAttributes([{ Severity: 'Moderate' }]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severityLabel).toBe('Moderate');
    });

    it('falls back to title-cased enum when Severity is invalid', () => {
      const attrs = makeNwsAttributes([{ Severity: 'bogus' }]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severity).toBe('unknown');
      expect(alerts[0].severityLabel).toBe('Unknown');
    });

    it('falls back to title-cased enum when Severity is empty', () => {
      const attrs = makeNwsAttributes([{ Severity: '' }]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severity).toBe('unknown');
      expect(alerts[0].severityLabel).toBe('Unknown');
    });

    it('collects zones from AffectedZones and Geocode.UGC', () => {
      const attrs = makeNwsAttributes([{
        AffectedZones: ['https://api.weather.gov/zones/forecast/COZ039'],
        Geocode: { UGC: ['COC059', 'COZ039'] },
      }]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].zones).toContain('COZ039');
      expect(alerts[0].zones).toContain('COC059');
      // COZ039 should not be duplicated
      expect(alerts[0].zones.filter(z => z === 'COZ039')).toHaveLength(1);
    });

    it('parses timestamps to Unix seconds', () => {
      const attrs = makeNwsAttributes([{
        Sent: '2026-03-06T10:00:00Z',
        Onset: '2026-03-06T12:00:00Z',
        Ends: '2026-03-06T18:00:00Z',
      }]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].sentTs).toBeGreaterThan(0);
      expect(alerts[0].onsetTs).toBeGreaterThan(0);
      expect(alerts[0].endsTs).toBeGreaterThan(0);
      expect(alerts[0].onsetTs).toBeGreaterThan(alerts[0].sentTs);
    });

    it('falls back to Expires when Ends is empty', () => {
      const attrs = makeNwsAttributes([{
        Ends: '',
        Expires: '2026-03-06T20:00:00Z',
      }]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].endsTs).toBeGreaterThan(0);
    });

    it('returns empty array for missing Alerts attribute', () => {
      expect(adapter.parseAlerts({})).toEqual([]);
    });

    describe('nws_alerts integration compatibility (optional fields)', () => {
      it('falls back to AreasAffected when AreaDesc is absent', () => {
        const attrs = makeNwsAttributes([{
          AreaDesc: undefined,
          AreasAffected: 'Denver County; Adams County',
        }]);
        const alerts = adapter.parseAlerts(attrs);
        expect(alerts[0].areaDesc).toBe('Denver County; Adams County');
      });

      it('prefers AreaDesc over AreasAffected when both are present', () => {
        const attrs = makeNwsAttributes([{
          AreaDesc: 'Denver County',
          AreasAffected: 'Denver County; Adams County',
        }]);
        const alerts = adapter.parseAlerts(attrs);
        expect(alerts[0].areaDesc).toBe('Denver County');
      });

      it('returns empty areaDesc when both AreaDesc and AreasAffected are absent', () => {
        const attrs = makeNwsAttributes([{
          AreaDesc: undefined,
          AreasAffected: undefined,
        }]);
        const alerts = adapter.parseAlerts(attrs);
        expect(alerts[0].areaDesc).toBe('');
      });

      it('handles missing Certainty and Urgency', () => {
        const attrs = makeNwsAttributes([{
          Certainty: undefined,
          Urgency: undefined,
        }]);
        const alerts = adapter.parseAlerts(attrs);
        expect(alerts[0].certainty).toBe('');
        expect(alerts[0].urgency).toBe('');
      });

      it('passes through NWSCode as eventCode (v6.6+)', () => {
        const attrs = makeNwsAttributes([{ NWSCode: 'TOW' }]);
        const alerts = adapter.parseAlerts(attrs);
        expect(alerts[0].eventCode).toBe('TOW');
      });

      it('returns empty eventCode when NWSCode is absent (pre-v6.6)', () => {
        const attrs = makeNwsAttributes([{ NWSCode: undefined }]);
        const alerts = adapter.parseAlerts(attrs);
        expect(alerts[0].eventCode).toBe('');
      });

      it('returns empty zones when AffectedZones and Geocode are absent', () => {
        const attrs = makeNwsAttributes([{
          AffectedZones: undefined,
          Geocode: undefined,
        }]);
        const alerts = adapter.parseAlerts(attrs);
        expect(alerts[0].zones).toEqual([]);
      });
    });
  });
});
