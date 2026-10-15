import { describe, it, expect } from 'vitest';
import { InmetAdapter } from '../../src/adapters/inmet';
import { parseTimestamp, reflowAlertText, summarizeAreaDesc } from '../../src/utils';
import type { InmetAlert } from '../../src/types';

function makeAlert(overrides: Partial<InmetAlert> = {}): Record<string, unknown> {
  const defaults: InmetAlert = {
    source: 'inmet',
    alert_id: '12345',
    description: 'Chuvas Intensas',
    severity: 'Perigo',
    risks: ['Risco de corte de energia elétrica.', 'Risco de queda de galhos de árvores.'],
    instructions: ['Não se abrigue debaixo de árvores.', 'Evite usar aparelhos eletrônicos ligados à tomada.'],
    color: 'Laranja',
    updated: false,
    updated_at: '2026-01-08T09:00:00.000Z',
    finished: false,
    future: false,
    start_date: '2026-01-08T10:00:00',
    end_date: '2026-01-08T23:59:00',
    sequence: 42,
    url: 'https://avisos.inmet.gov.br/12345',
    area: 'SP',
    bbox: [-47.0608, -23.1056, -46.9056, -22.9056],
  };
  return { ...defaults, ...overrides };
}

describe('InmetAdapter', () => {
  const adapter = new InmetAdapter();

  describe('canHandle', () => {
    it('returns true for INMET geo_location attributes', () => {
      expect(adapter.canHandle(makeAlert())).toBe(true);
    });

    it('returns true when INMET publishes a numeric alert id', () => {
      expect(adapter.canHandle(makeAlert({ alert_id: 12345 }))).toBe(true);
    });

    it('returns false without the INMET source marker', () => {
      expect(adapter.canHandle(makeAlert({ source: 'other' }))).toBe(false);
    });

    it('returns false without the alert id', () => {
      const attrs = makeAlert();
      delete attrs['alert_id'];
      expect(adapter.canHandle(attrs)).toBe(false);
    });
  });

  describe('severity mapping', () => {
    const cases: Array<[string, string, string, boolean]> = [
      ['Grande Perigo', 'Vermelho', 'extreme', false],
      ['Perigo', 'Laranja', 'severe', false],
      ['Perigo Potencial', 'Amarelo', 'moderate', false],
      ['', 'Laranja', 'severe', true],
    ];

    for (const [severity, color, expected, inferred] of cases) {
      it(`maps "${severity || color}" to ${expected}`, () => {
        const [alert] = adapter.parseAlerts(makeAlert({ severity, color }));
        expect(alert.severity).toBe(expected);
        expect(alert.severityInferred).toBe(inferred);
      });
    }

    it('does not use severity_id to classify INMET severity', () => {
      const [alert] = adapter.parseAlerts(makeAlert({
        severity: 'Perigo Potencial',
        severity_id: 999,
        color: 'Vermelho',
      } as Record<string, unknown>));
      expect(alert.severity).toBe('moderate');
      expect(alert.severityLabel).toBe('Perigo Potencial');
      expect(alert.severityInferred).toBe(false);
    });
  });

  describe('parseAlerts', () => {
    it('normalizes one INMET geolocation entity into one alert', () => {
      const [alert] = adapter.parseAlerts(makeAlert());
      expect(alert.provider).toBe('inmet');
      expect(alert.id).toBe('12345');
      expect(alert.event).toBe('Chuvas Intensas');
      expect(alert.headline).toBe('Chuvas Intensas');
      expect(alert.severityLabel).toBe('Perigo');
      expect(alert.sentTs).toBe(parseTimestamp('2026-01-08T09:00:00.000Z'));
      expect(alert.onsetTs).toBe(parseTimestamp('2026-01-08T10:00:00-03:00'));
      expect(alert.endsTs).toBe(parseTimestamp('2026-01-08T23:59:00-03:00'));
      expect(alert.url).toBe('https://avisos.inmet.gov.br/12345');
      // `sequence` (42 in the fixture) is an update counter, not an event code.
      expect(alert.eventCode).toBe('');
      expect(alert.providerIcon).toBe('mdi:alert');
      expect(alert.colorHint).toBe('Laranja');
      expect(alert.areaDesc).toBe('SP');
      expect(alert.bbox).toEqual([-47.0608, -23.1056, -46.9056, -22.9056]);
      expect('point' in alert).toBe(false);
    });

    it('normalizes numeric ids from current INMET attributes', () => {
      const [alert] = adapter.parseAlerts(makeAlert({
        alert_id: 12345,
      }));
      expect(alert.id).toBe('12345');
      expect(alert.severity).toBe('severe');
    });

    it('uses risks as description and instructions as instruction text', () => {
      const [alert] = adapter.parseAlerts(makeAlert());
      expect(alert.description).toContain('Risco de corte de energia elétrica.');
      expect(alert.instruction).toContain('Não se abrigue debaixo de árvores.');
      expect(reflowAlertText(alert.description)).not.toMatch(/elétrica\. Risco/);
    });

    it('accepts scalar risk and instruction text', () => {
      const [alert] = adapter.parseAlerts(makeAlert({
        risks: 'Risco de alagamentos.',
        instructions: 'Evite enfrentar o mau tempo.',
      }));
      expect(alert.description).toBe('Risco de alagamentos.');
      expect(alert.instruction).toBe('Evite enfrentar o mau tempo.');
    });

    it('sets a lifecycle phase from INMET flags', () => {
      expect(adapter.parseAlerts(makeAlert({ updated: true }))[0].phase).toBe('Update');
      expect(adapter.parseAlerts(makeAlert({ future: true }))[0].phase).toBe('Future');
      expect(adapter.parseAlerts(makeAlert({ finished: true, updated: true }))[0].phase).toBe('Final');
    });

    it('does not use the configured city as an alert point', () => {
      const [alert] = adapter.parseAlerts(makeAlert({
        latitude: -22.9056,
        longitude: -47.0608,
      } as Record<string, unknown>));
      expect('point' in alert).toBe(false);
    });

    it('falls back for an older INMET integration without card metadata', () => {
      const attributes = makeAlert();
      delete attributes['updated_at'];
      delete attributes['area'];
      delete attributes['bbox'];
      const [alert] = adapter.parseAlerts(attributes);
      expect(alert.sentTs).toBe(parseTimestamp('2026-01-08T10:00:00-03:00'));
      expect(alert.areaDesc).toBe('Brazil');
      expect('bbox' in alert).toBe(false);
    });

    it('reads the sigrist/inmet 1.2.0 attribute shape as published', () => {
      // 1.2.0 attaches America/Sao_Paulo to start/end, so HA serialises them
      // with an offset; `updated_at` is INMET's own stamp, which on the live
      // feed is a midnight-UTC date; `area` is `estados`, comma-joined with
      // no spaces; `bbox` is the multi-state polygon's extent (alert 56070,
      // 2026-10-15, 19 states).
      const [alert] = adapter.parseAlerts(makeAlert({
        start_date: '2026-10-15T00:01:00-03:00',
        end_date: '2026-10-15T23:59:00-03:00',
        updated_at: '2026-10-14T00:00:00.000Z',
        area: 'Goiás,Minas Gerais,Bahia,Paraná,Santa Catarina,Tocantins,Mato Grosso,Acre,São Paulo,Espírito Santo,Mato Grosso do Sul,Rio Grande do Sul,Rondônia,Pará,Maranhão,Amazonas,Rio de Janeiro,Distrito Federal,Mato Grosso',
        bbox: [-73.6, -33.7, -38.7, -0.2],
      }));
      // The offset is honoured, not re-pinned.
      expect(alert.onsetTs).toBe(parseTimestamp('2026-10-15T03:01:00Z'));
      expect(alert.endsTs).toBe(parseTimestamp('2026-10-16T02:59:00Z'));
      expect(alert.sentTs).toBe(parseTimestamp('2026-10-14T00:00:00Z'));
      expect(alert.sentTs).toBeLessThan(alert.onsetTs);
      // The state list reaches the area row verbatim and collapses there.
      expect(alert.areaDesc.startsWith('Goiás,Minas Gerais')).toBe(true);
      expect(summarizeAreaDesc(alert.areaDesc)).toEqual({ first: 'Goiás', more: 18 });
      expect(alert.bbox).toEqual([-73.6, -33.7, -38.7, -0.2]);
    });

    it('omits malformed INMET bounding boxes', () => {
      const [wrongLength] = adapter.parseAlerts(makeAlert({
        bbox: [-47, -23, -46] as unknown as [number, number, number, number],
      }));
      const [reversed] = adapter.parseAlerts(makeAlert({
        bbox: [-46, -23, -47, -22],
      }));
      expect('bbox' in wrongLength).toBe(false);
      expect('bbox' in reversed).toBe(false);
    });

    it('returns [] for attributes that do not satisfy canHandle', () => {
      expect(adapter.parseAlerts({ source: 'inmet' })).toEqual([]);
    });
  });

  describe('adapter capabilities', () => {
    it('declares source collection but not the radius control', () => {
      expect(adapter.feedSources).toEqual(['inmet']);
      // An INMET bbox is an area extent, never an incident point.
      expect((adapter as { carriesPoint?: boolean }).carriesPoint).toBeFalsy();
      expect(adapter.stableIds).toBe(true);
    });
  });
});
