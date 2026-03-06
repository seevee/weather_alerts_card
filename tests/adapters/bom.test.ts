import { describe, it, expect } from 'vitest';
import { BomAdapter } from '../../src/adapters/bom';
import type { BomWarning } from '../../src/types';

function makeBomAttributes(warnings: Partial<BomWarning>[] = []): Record<string, unknown> {
  const defaults: BomWarning = {
    id: 'NSW_IDN12345',
    type: 'severe_thunderstorm_warning',
    title: 'Severe Thunderstorm Warning for Metropolitan',
    short_title: 'Severe Thunderstorm',
    state: 'NSW',
    warning_group_type: 'major',
    issue_time: '2026-03-06T14:30:00Z',
    expiry_time: '2026-03-06T20:00:00Z',
    phase: 'new',
  };

  return {
    warnings: warnings.map(w => ({ ...defaults, ...w })),
    attribution: 'Data provided by the Australian Bureau of Meteorology',
    metadata: { response_timestamp: '2026-03-06T15:00:00Z' },
  };
}

describe('BomAdapter', () => {
  const adapter = new BomAdapter();

  describe('canHandle', () => {
    it('returns true for attributes with BoM-shaped warnings', () => {
      expect(adapter.canHandle(makeBomAttributes([{}]))).toBe(true);
    });

    it('returns true for empty warnings with BoM attribution', () => {
      expect(adapter.canHandle({
        warnings: [],
        attribution: 'Data provided by the Australian Bureau of Meteorology',
      })).toBe(true);
    });

    it('returns false for empty warnings without BoM attribution', () => {
      expect(adapter.canHandle({ warnings: [] })).toBe(false);
    });

    it('returns false for NWS-shaped attributes', () => {
      expect(adapter.canHandle({
        Alerts: [{ Event: 'Tornado', Severity: 'Extreme' }],
      })).toBe(false);
    });

    it('returns false for missing warnings', () => {
      expect(adapter.canHandle({})).toBe(false);
    });
  });

  describe('parseAlerts', () => {
    it('normalizes BoM warnings to WeatherAlert format', () => {
      const attrs = makeBomAttributes([{}]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts).toHaveLength(1);
      const a = alerts[0];
      expect(a.id).toBe('NSW_IDN12345');
      expect(a.event).toBe('Severe Thunderstorm Warning for Metropolitan');
      expect(a.provider).toBe('bom');
      expect(a.phase).toBe('New');
    });

    it('maps severity from title keywords', () => {
      const attrs = makeBomAttributes([
        { id: '1', title: 'Major Flood Warning for the Georgina River' },
        { id: '2', title: 'Minor Flood Warning for the Paroo River' },
        { id: '3', title: 'Moderate Flood Warning for the Diamantina River' },
        { id: '4', title: 'Severe Thunderstorm Warning for Metropolitan' },
        { id: '5', title: 'Initial Minor Flood Warning for the Herbert River' },
      ]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severity).toBe('severe');     // "Major" in title
      expect(alerts[1].severity).toBe('minor');      // "Minor" in title
      expect(alerts[2].severity).toBe('moderate');   // "Moderate" in title
      expect(alerts[3].severity).toBe('severe');     // "Severe" in title
      expect(alerts[4].severity).toBe('minor');      // "Minor" in title
    });

    it('maps severity from title for tropical cyclone', () => {
      const attrs = makeBomAttributes([
        { id: '1', title: 'Tropical Cyclone Warning for Cairns' },
      ]);
      expect(adapter.parseAlerts(attrs)[0].severity).toBe('extreme');
    });

    it('falls back to type when title has no severity keyword', () => {
      const attrs = makeBomAttributes([
        { id: '1', title: 'Flood Warning for the Nicholson and Albert Rivers', type: 'flood_warning', warning_group_type: 'major' },
        { id: '2', title: 'Flood Warning for the Inland Rivers SA', type: 'flood_warning', warning_group_type: 'minor' },
      ]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severity).toBe('moderate');   // no keyword in title, major group fallback
      expect(alerts[1].severity).toBe('minor');      // no keyword in title, minor group fallback
    });

    it('falls back to type field for severity when title is empty', () => {
      const attrs = makeBomAttributes([
        { id: '1', title: '', short_title: '', type: 'severe_thunderstorm_warning', warning_group_type: 'major' },
        { id: '2', title: '', short_title: '', type: 'fire_weather_warning', warning_group_type: 'major' },
        { id: '3', title: '', short_title: '', type: 'tropical_cyclone_warning', warning_group_type: 'major' },
        { id: '4', title: '', short_title: '', type: 'frost_warning', warning_group_type: 'minor' },
      ]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].severity).toBe('severe');     // "severe" in type-derived title
      expect(alerts[1].severity).toBe('severe');     // "fire_weather" in type fallback
      expect(alerts[2].severity).toBe('extreme');    // "tropical cyclone" in type-derived title
      expect(alerts[3].severity).toBe('minor');      // minor group fallback
    });

    it('parses ISO 8601 timestamps with timezone offsets', () => {
      const attrs = makeBomAttributes([{
        issue_time: '2026-03-06T14:30:00+10:00',
        expiry_time: '2026-03-06T20:00:00+10:00',
      }]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].sentTs).toBeGreaterThan(0);
      expect(alerts[0].onsetTs).toBe(alerts[0].sentTs); // BoM: onset = issue time
      expect(alerts[0].endsTs).toBeGreaterThan(alerts[0].sentTs);
    });

    it('filters out cancelled warnings', () => {
      const attrs = makeBomAttributes([
        { id: 'active', phase: 'new' },
        { id: 'cancelled', phase: 'cancelled' },
      ]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe('active');
    });

    it('constructs BoM state-specific URL', () => {
      const attrs = makeBomAttributes([{ state: 'NSW' }]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].url).toBe('https://www.bom.gov.au/nsw/warnings/');
    });

    it('handles missing expiry_time', () => {
      const attrs = makeBomAttributes([{ expiry_time: '' }]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].endsTs).toBe(0);
    });

    it('returns empty array for missing warnings attribute', () => {
      expect(adapter.parseAlerts({})).toEqual([]);
    });

    it('uses title fallback chain', () => {
      const attrs = makeBomAttributes([{ title: '', short_title: 'Short', type: 'flood_watch' }]);
      const alerts = adapter.parseAlerts(attrs);
      expect(alerts[0].event).toBe('Short');

      const attrs2 = makeBomAttributes([{ title: '', short_title: '', type: 'flood_watch' }]);
      const alerts2 = adapter.parseAlerts(attrs2);
      expect(alerts2[0].event).toBe('flood watch');
    });
  });
});
