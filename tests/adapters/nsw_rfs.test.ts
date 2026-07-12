import { describe, it, expect } from 'vitest';
import { NswRfsAdapter } from '../../src/adapters/nsw_rfs';
import { parseTimestamp, reflowAlertText } from '../../src/utils';
import type { NswRfsIncident } from '../../src/types';

function makeIncident(overrides: Partial<NswRfsIncident> = {}): Record<string, unknown> {
  const defaults: NswRfsIncident = {
    external_id: 'https://www.rfs.nsw.gov.au/incident/1234',
    category: 'Advice',
    status: 'Being controlled',
    type: 'Bush Fire',
    location: 'Wollemi National Park',
    council_area: 'Blue Mountains',
    size: '150 ha',
    fire: true,
    responsible_agency: 'Rural Fire Service',
    publication_date: '2026-01-08T03:30:00Z',
  };
  return { ...defaults, ...overrides } as Record<string, unknown>;
}

describe('NswRfsAdapter', () => {
  const adapter = new NswRfsAdapter();

  describe('canHandle', () => {
    it('returns true when category, status, and responsible_agency are strings', () => {
      expect(adapter.canHandle(makeIncident())).toBe(true);
    });

    it('returns false when responsible_agency is missing', () => {
      const attrs = makeIncident();
      delete attrs['responsible_agency'];
      expect(adapter.canHandle(attrs)).toBe(false);
    });

    it('returns false when category is missing', () => {
      const attrs = makeIncident();
      delete attrs['category'];
      expect(adapter.canHandle(attrs)).toBe(false);
    });

    it('returns false when status is non-string', () => {
      expect(adapter.canHandle(makeIncident({ status: undefined }))).toBe(false);
    });

    it('returns false for a generic geo_location quake entity', () => {
      expect(adapter.canHandle({ external_id: 'us7000abcd', magnitude: 5.1 })).toBe(false);
    });
  });

  describe('severity mapping', () => {
    const cases: Array<[string, string, string, boolean]> = [
      ['Emergency Warning', 'extreme', 'Emergency Warning', false],
      ['Watch and Act', 'severe', 'Watch and Act', false],
      ['Advice', 'moderate', 'Advice', false],
      ['Planned Burn', 'minor', 'Planned Burn', false],
      ['Not Applicable', 'unknown', 'Not Applicable', true],
      ['', 'unknown', 'Unknown', true],
    ];
    for (const [category, severity, label, inferred] of cases) {
      it(`maps "${category || '(empty)'}" → ${severity}`, () => {
        const [alert] = adapter.parseAlerts(makeIncident({ category }));
        expect(alert.severity).toBe(severity);
        expect(alert.severityLabel).toBe(label);
        expect(alert.severityInferred).toBe(inferred);
      });
    }

    it('matches case-insensitively on substring', () => {
      const [alert] = adapter.parseAlerts(makeIncident({ category: 'EMERGENCY WARNING' }));
      expect(alert.severity).toBe('extreme');
      expect(alert.severityInferred).toBe(false);
    });
  });

  describe('parseAlerts', () => {
    it('returns a single-element array with RFS invariants', () => {
      const alerts = adapter.parseAlerts(makeIncident());
      expect(alerts).toHaveLength(1);
      const [alert] = alerts;
      expect(alert.provider).toBe('nsw_rfs');
      expect(alert.providerIcon).toBe('mdi:fire');
      expect(alert.endsTs).toBe(0);
      expect(alert.sentTs).toBe(parseTimestamp('2026-01-08T03:30:00Z'));
      expect(alert.onsetTs).toBe(alert.sentTs);
      expect(alert.certainty).toBe('');
      expect(alert.url).toBe('https://www.fire.nsw.gov.au/firesnearme/');
    });

    it('titlecases the type into event', () => {
      const [alert] = adapter.parseAlerts(makeIncident({ type: 'grass fire' }));
      expect(alert.event).toBe('Grass Fire');
    });

    it('uses external_id as the id when present', () => {
      const [alert] = adapter.parseAlerts(makeIncident());
      expect(alert.id).toBe('https://www.rfs.nsw.gov.au/incident/1234');
    });

    it('synthesizes an id from location + sentTs when external_id is absent', () => {
      const [alert] = adapter.parseAlerts(makeIncident({ external_id: undefined, location: 'Wollemi National Park' }));
      const ts = parseTimestamp('2026-01-08T03:30:00Z');
      expect(alert.id).toBe(`nsw_rfs_wollemi_national_park_${ts}`);
    });

    it('returns [] for attributes that do not satisfy canHandle', () => {
      expect(adapter.parseAlerts({})).toEqual([]);
    });

    it('has no bbox and no geometryRef (silent-degrade contract for showGeometry)', () => {
      const [alert] = adapter.parseAlerts(makeIncident());
      expect(alert.bbox).toBeUndefined();
      expect(alert.geometryRef).toBeUndefined();
    });
  });

  describe('description', () => {
    it('contains one line per present field', () => {
      const [alert] = adapter.parseAlerts(makeIncident());
      expect(alert.description).toContain('Status: Being controlled');
      expect(alert.description).toContain('Type: Bush Fire');
      expect(alert.description).toContain('Location: Wollemi National Park');
      expect(alert.description).toContain('Council area: Blue Mountains');
      expect(alert.description).toContain('Size: 150 ha');
      expect(alert.description).toContain('Responsible agency: Rural Fire Service');
    });

    it('omits lines for absent fields', () => {
      const [alert] = adapter.parseAlerts(makeIncident({ council_area: undefined, size: undefined }));
      expect(alert.description).not.toContain('Council area:');
      expect(alert.description).not.toContain('Size:');
    });

    it('appends " ha" to a numeric size', () => {
      const [alert] = adapter.parseAlerts(makeIncident({ size: 42 }));
      expect(alert.description).toContain('Size: 42 ha');
    });

    it('passes through a size string that already carries a unit', () => {
      const [alert] = adapter.parseAlerts(makeIncident({ size: '5 ha' }));
      expect(alert.description).toContain('Size: 5 ha');
    });

    it('keeps each field on its own line through a reflow round-trip', () => {
      const [alert] = adapter.parseAlerts(makeIncident());
      const reflowed = reflowAlertText(alert.description);
      expect(reflowed).toContain('Status: Being controlled');
      expect(reflowed).toContain('Responsible agency: Rural Fire Service');
      // Field labels must not be merged onto a single line
      expect(reflowed).not.toMatch(/Being controlled Type:/);
    });
  });

  describe('area + headline', () => {
    it('prefers council_area for areaDesc, falling back to location then NSW', () => {
      expect(adapter.parseAlerts(makeIncident())[0].areaDesc).toBe('Blue Mountains');
      expect(adapter.parseAlerts(makeIncident({ council_area: undefined }))[0].areaDesc).toBe('Wollemi National Park');
      expect(adapter.parseAlerts(makeIncident({ council_area: undefined, location: undefined }))[0].areaDesc).toBe('NSW');
    });

    it('uses location as the headline when present', () => {
      expect(adapter.parseAlerts(makeIncident())[0].headline).toBe('Wollemi National Park');
    });
  });
});
