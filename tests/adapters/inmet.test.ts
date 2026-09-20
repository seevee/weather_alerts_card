import { describe, it, expect } from 'vitest';
import { InmetAdapter } from '../../src/adapters/inmet';
import { parseTimestamp, reflowAlertText } from '../../src/utils';
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
    finished: false,
    future: false,
    start_date: '2026-01-08T10:00:00',
    end_date: '2026-01-08T23:59:00',
    sequence: 42,
    url: 'https://avisos.inmet.gov.br/12345',
    latitude: -22.9056,
    longitude: -47.0608,
  };
  return { ...defaults, ...overrides } as Record<string, unknown>;
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
      expect(alert.sentTs).toBe(parseTimestamp('2026-01-08T10:00:00-03:00'));
      expect(alert.onsetTs).toBe(parseTimestamp('2026-01-08T10:00:00-03:00'));
      expect(alert.endsTs).toBe(parseTimestamp('2026-01-08T23:59:00-03:00'));
      expect(alert.url).toBe('https://avisos.inmet.gov.br/12345');
      expect(alert.eventCode).toBe('42');
      expect(alert.providerIcon).toBe('mdi:alert');
      expect(alert.colorHint).toBe('Laranja');
      expect(alert.point).toEqual([-47.0608, -22.9056]);
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

    it('omits the point when coordinates are malformed', () => {
      const [alert] = adapter.parseAlerts(makeAlert({ latitude: 999 }));
      expect('point' in alert).toBe(false);
    });

    it('returns [] for attributes that do not satisfy canHandle', () => {
      expect(adapter.parseAlerts({ source: 'inmet' })).toEqual([]);
    });
  });

  describe('adapter capabilities', () => {
    it('declares source collection and point support', () => {
      expect(adapter.feedSources).toEqual(['inmet']);
      expect(adapter.carriesPoint).toBe(true);
      expect(adapter.stableIds).toBe(true);
    });
  });
});
