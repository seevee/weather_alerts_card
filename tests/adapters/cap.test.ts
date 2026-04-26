import { describe, it, expect } from 'vitest';
import { CapAdapter } from '../../src/adapters/cap';

function makeCapAttributes(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    incident_platform_version: '1.0',
    id: 'urn:oid:2.49.0.1.840.0.abc',
    event: 'Tornado Warning',
    severity: 'Severe',
    severity_normalized: 'severe',
    certainty: 'Likely',
    urgency: 'Immediate',
    sent: '2026-04-25T10:00:00+00:00',
    onset: '2026-04-25T10:05:00+00:00',
    expires: '2026-04-25T11:00:00+00:00',
    description: 'A confirmed tornado is on the ground.',
    instruction: 'Take shelter immediately.',
    headline: 'Tornado Warning issued for Boulder County',
    area_desc: 'Boulder; Larimer',
    affected_zones: ['COC013', 'COC069'],
    geocode_ugc: ['COC013', 'COC069'],
    url: 'https://api.weather.gov/alerts/urn:oid:abc',
    event_code_nws: 'TOR',
    provider: 'nws',
    phase: 'new',
    msg_type: 'Alert',
    ...overrides,
  };
}

describe('CapAdapter', () => {
  const adapter = new CapAdapter();

  describe('canHandle', () => {
    it('returns true when incident_platform_version + id are present', () => {
      expect(adapter.canHandle({
        incident_platform_version: '1.0',
        id: 'urn:oid:abc',
      })).toBe(true);
    });

    it('returns false without incident_platform_version', () => {
      expect(adapter.canHandle({ id: 'urn:oid:abc' })).toBe(false);
    });

    it('returns false without id', () => {
      expect(adapter.canHandle({ incident_platform_version: '1.0' })).toBe(false);
    });

    it('returns false for NWS-shaped attributes', () => {
      expect(adapter.canHandle({
        Alerts: [{ Event: 'Tornado', Severity: 'Severe' }],
      })).toBe(false);
    });

    it('returns false for empty attributes', () => {
      expect(adapter.canHandle({})).toBe(false);
    });
  });

  describe('parseAlerts', () => {
    it('returns a single normalised WeatherAlert', () => {
      const alerts = adapter.parseAlerts(makeCapAttributes());
      expect(alerts).toHaveLength(1);
      const a = alerts[0];
      expect(a.id).toBe('urn:oid:2.49.0.1.840.0.abc');
      expect(a.event).toBe('Tornado Warning');
      expect(a.provider).toBe('cap');
      expect(a.severity).toBe('severe');
      expect(a.severityLabel).toBe('Severe');
      expect(a.certainty).toBe('Likely');
      expect(a.urgency).toBe('Immediate');
      expect(a.description).toBe('A confirmed tornado is on the ground.');
      expect(a.instruction).toBe('Take shelter immediately.');
      expect(a.headline).toBe('Tornado Warning issued for Boulder County');
      expect(a.areaDesc).toBe('Boulder; Larimer');
      expect(a.url).toBe('https://api.weather.gov/alerts/urn:oid:abc');
      expect(a.eventCode).toBe('TOR');
      expect(a.phase).toBe('New');
      expect(a.severityInferred).toBe(false);
      expect(a.certaintyInferred).toBe(false);
    });

    it('parses ISO timestamps', () => {
      const alerts = adapter.parseAlerts(makeCapAttributes());
      const a = alerts[0];
      expect(a.sentTs).toBeGreaterThan(0);
      expect(a.onsetTs).toBeGreaterThanOrEqual(a.sentTs);
      expect(a.endsTs).toBeGreaterThan(a.onsetTs);
    });

    it('returns empty array when id is missing', () => {
      const attrs = makeCapAttributes();
      delete attrs.id;
      expect(adapter.parseAlerts(attrs)).toEqual([]);
    });

    it('falls back to severity_normalized when raw severity is missing', () => {
      const attrs = makeCapAttributes({ severity: '' });
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severity).toBe('severe');
      expect(alerts[0].severityInferred).toBe(false);
    });

    it('marks severity inferred when both severity and severity_normalized are absent', () => {
      const attrs = makeCapAttributes({ severity: '', severity_normalized: '' });
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severity).toBe('unknown');
      expect(alerts[0].severityInferred).toBe(true);
    });

    it('falls back to expires when ends is absent', () => {
      const attrs = makeCapAttributes();
      delete attrs.ends;
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].endsTs).toBeGreaterThan(0);
    });

    it('prefers ends over expires when both are present', () => {
      const attrs = makeCapAttributes({
        ends: '2026-04-25T12:00:00+00:00',
        expires: '2026-04-25T11:00:00+00:00',
      });
      const alerts = adapter.parseAlerts(attrs);
      const expiresTs = Date.parse('2026-04-25T11:00:00+00:00') / 1000;
      expect(alerts[0].endsTs).toBeGreaterThan(expiresTs);
    });

    it('falls back to effective when sent is absent', () => {
      const attrs = makeCapAttributes({ effective: '2026-04-25T09:30:00+00:00' });
      delete attrs.sent;
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].sentTs).toBeGreaterThan(0);
    });

    it('uses sent for onsetTs when onset is absent', () => {
      const attrs = makeCapAttributes();
      delete attrs.onset;
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].onsetTs).toBe(alerts[0].sentTs);
    });

    it('collects zones from affected_zones and dedups against geocode_ugc', () => {
      const alerts = adapter.parseAlerts(makeCapAttributes());
      expect(alerts[0].zones).toEqual(['COC013', 'COC069']);
    });

    it('uppercases zone codes', () => {
      const alerts = adapter.parseAlerts(makeCapAttributes({
        affected_zones: ['coc013'],
        geocode_ugc: [],
      }));
      expect(alerts[0].zones).toEqual(['COC013']);
    });

    it('falls back to geocode_ugc when affected_zones is empty', () => {
      const alerts = adapter.parseAlerts(makeCapAttributes({
        affected_zones: [],
        geocode_ugc: ['COC013'],
      }));
      expect(alerts[0].zones).toEqual(['COC013']);
    });

    it('falls back to event_code_same when event_code_nws is absent', () => {
      const attrs = makeCapAttributes({ event_code_same: 'TOR' });
      delete attrs.event_code_nws;
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].eventCode).toBe('TOR');
    });

    it('falls back to web when url is absent', () => {
      const attrs = makeCapAttributes({ web: 'https://example.org/alert' });
      delete attrs.url;
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].url).toBe('https://example.org/alert');
    });

    it('maps phase strings to capitalised labels', () => {
      const cases: Array<[string, string]> = [
        ['new', 'New'],
        ['update', 'Update'],
        ['cancel', 'Cancel'],
        ['expired', 'Expired'],
      ];
      for (const [phase, label] of cases) {
        const alerts = adapter.parseAlerts(makeCapAttributes({ phase }));
        expect(alerts[0].phase).toBe(label);
      }
    });

    it('returns empty phase for unknown phase strings', () => {
      const alerts = adapter.parseAlerts(makeCapAttributes({ phase: 'mystery' }));
      expect(alerts[0].phase).toBe('');
    });

    it('handles missing optional fields gracefully', () => {
      const alerts = adapter.parseAlerts({
        incident_platform_version: '1.0',
        id: 'urn:oid:minimal',
      });
      expect(alerts).toHaveLength(1);
      const a = alerts[0];
      expect(a.event).toBe('Unknown');
      expect(a.severity).toBe('unknown');
      expect(a.description).toBe('');
      expect(a.areaDesc).toBe('');
      expect(a.url).toBe('');
      expect(a.zones).toEqual([]);
      expect(a.eventCode).toBe('');
      expect(a.sentTs).toBe(0);
      expect(a.endsTs).toBe(0);
    });
  });
});
