import { describe, it, expect } from 'vitest';
import { NinaAdapter } from '../../src/adapters/nina';
import { getDisplayHeadline, getWeatherIcon, parseTimestamp } from '../../src/utils';

// Verbatim attributes of an active `binary_sensor` warning slot, contributed by
// @duczz on #234 (region name redacted upstream). Real DWD heat warning routed
// through NINA; `affected_areas` is truncated by the integration exactly as
// shown.
const SAMPLE: Record<string, unknown> = {
  headline: 'Amtliche WARNUNG vor extremer HITZE',
  description: 'Am Dienstag wird eine extreme Wärmebelastung erwartet.',
  sender: 'Zentrum für Medizin-Meteorologische Forschung',
  severity: 'Severe',
  recommended_actions: 'Hitzebelastung kann für den menschlichen Körper gefährlich werden und zu einer Vielzahl von gesundheitlichen Problemen führen. Vermeiden Sie nach Möglichkeit die Hitze, trinken Sie ausreichend Wasser und halten Sie die Innenräume kühl.',
  affected_areas: 'gemeindefreies Gebiet Zerzabelshofer Forst, gemeindefreies Gebiet Winkelhaid, Stadt Roßwein, Gemeinde Rossau, Stadt Weismain, Gemeinde Striegistal und 1144 weitere.',
  web: 'https://dwd.de/warnungen',
  id: 'dwd.2.49.0.0.276.0.DWD.PVW.1785741840000.081e027b-8b91-4e98-8c8d-ecbca01b9952.MUL',
  sent: '2026-08-03T09:23:29+02:00',
  start: '2026-08-03T09:24:00+02:00',
  expires: '2026-08-04T19:00:00+02:00',
  device_class: 'safety',
  friendly_name: 'xxxx Warnung 1',
};

function makeWarning(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...SAMPLE, ...overrides };
}

describe('NinaAdapter', () => {
  const adapter = new NinaAdapter();

  describe('canHandle', () => {
    it('accepts the contributed sample', () => {
      expect(adapter.canHandle(SAMPLE)).toBe(true);
    });

    it('accepts a warning with empty recommended_actions', () => {
      expect(adapter.canHandle(makeWarning({ recommended_actions: '' }))).toBe(true);
    });

    it('rejects an idle slot (empty attributes)', () => {
      // The integration returns {} from extra_state_attributes when is_on is
      // False — this is the guard that keeps an idle NINA region reading as
      // "no active alerts" rather than a degraded source.
      expect(adapter.canHandle({})).toBe(false);
    });

    it('rejects a slot missing affected_areas', () => {
      const attrs = makeWarning();
      delete attrs['affected_areas'];
      expect(adapter.canHandle(attrs)).toBe(false);
    });

    it('rejects a slot missing recommended_actions', () => {
      const attrs = makeWarning();
      delete attrs['recommended_actions'];
      expect(adapter.canHandle(attrs)).toBe(false);
    });

    it('rejects a NINA per-field diagnostic sensor', () => {
      // sensor.<region>_headline_1 and friends sit on the same device but hold
      // a single value with no alert attributes; device-mode collection must
      // skip them.
      expect(adapter.canHandle({ friendly_name: 'xxxx Headline 1' })).toBe(false);
    });

    it('rejects a CAP Alerts entity', () => {
      expect(adapter.canHandle({
        incident_platform_version: '1.0',
        id: 'urn:oid:2.49.0.1.276.0',
        instruction: 'Take shelter',
        area_desc: 'Berlin',
      })).toBe(false);
    });
  });

  describe('parseAlerts', () => {
    it('returns nothing for an idle slot', () => {
      expect(adapter.parseAlerts({})).toEqual([]);
    });

    it('returns nothing when id is empty', () => {
      expect(adapter.parseAlerts(makeWarning({ id: '' }))).toEqual([]);
    });

    it('normalizes the contributed sample', () => {
      const [alert] = adapter.parseAlerts(SAMPLE);
      expect(alert.id).toBe(SAMPLE['id']);
      expect(alert.provider).toBe('nina');
      expect(alert.severity).toBe('severe');
      expect(alert.severityLabel).toBe('Severe');
      expect(alert.severityInferred).toBe(false);
      expect(alert.certainty).toBe('');
      expect(alert.urgency).toBe('');
      expect(alert.eventCode).toBe('');
      expect(alert.phase).toBe('');
      expect(alert.zones).toEqual([]);
      expect(alert.url).toBe('https://dwd.de/warnungen');
      expect(alert.areaDesc).toBe(SAMPLE['affected_areas']);
      expect(alert.instruction).toBe(SAMPLE['recommended_actions']);
    });

    it('maps sent/start/expires onto the progress timestamps', () => {
      const [alert] = adapter.parseAlerts(SAMPLE);
      expect(alert.sentTs).toBe(parseTimestamp('2026-08-03T09:23:29+02:00'));
      expect(alert.onsetTs).toBe(parseTimestamp('2026-08-03T09:24:00+02:00'));
      expect(alert.endsTs).toBe(parseTimestamp('2026-08-04T19:00:00+02:00'));
      expect(alert.endsTs).toBeGreaterThan(alert.onsetTs);
    });

    it('falls back to sent when start is empty', () => {
      // The integration writes '' (not null) when the message omits start.
      const [alert] = adapter.parseAlerts(makeWarning({ start: '' }));
      expect(alert.onsetTs).toBe(alert.sentTs);
      expect(alert.onsetTs).toBeGreaterThan(0);
    });

    it('leaves endsTs at 0 when expires is empty', () => {
      // 0 → hasEndTime false → the card's honest "ongoing", no fabricated bar.
      const [alert] = adapter.parseAlerts(makeWarning({ expires: '' }));
      expect(alert.endsTs).toBe(0);
    });

    it('appends the sender as an attribution paragraph', () => {
      const [alert] = adapter.parseAlerts(SAMPLE);
      expect(alert.description).toBe(
        'Am Dienstag wird eine extreme Wärmebelastung erwartet.'
        + '\n\nHerausgeber: Zentrum für Medizin-Meteorologische Forschung',
      );
    });

    it('emits the attribution alone when the message has no description', () => {
      const [alert] = adapter.parseAlerts(makeWarning({ description: '' }));
      expect(alert.description).toBe('Herausgeber: Zentrum für Medizin-Meteorologische Forschung');
    });

    it('leaves the description untouched when sender is empty', () => {
      const [alert] = adapter.parseAlerts(makeWarning({ sender: '' }));
      expect(alert.description).toBe('Am Dienstag wird eine extreme Wärmebelastung erwartet.');
    });

    it('drops a non-http web value', () => {
      expect(adapter.parseAlerts(makeWarning({ web: '' }))[0].url).toBe('');
      expect(adapter.parseAlerts(makeWarning({ web: 'javascript:alert(1)' }))[0].url).toBe('');
    });

    it('maps every NINA severity onto the card tiers', () => {
      const cases: [string, string, string][] = [
        ['Extreme', 'extreme', 'Extreme'],
        ['Severe', 'severe', 'Severe'],
        ['Moderate', 'moderate', 'Moderate'],
        ['Minor', 'minor', 'Minor'],
        ['Unknown', 'unknown', 'Unknown'],
      ];
      for (const [raw, severity, label] of cases) {
        const [alert] = adapter.parseAlerts(makeWarning({ severity: raw }));
        expect(alert.severity).toBe(severity);
        expect(alert.severityLabel).toBe(label);
        // The integration substitutes 'Unknown' itself, so nothing here is
        // adapter-inferred — the badge must never render the tilde.
        expect(alert.severityInferred).toBe(false);
      }
    });
  });

  describe('event derivation', () => {
    it('strips the DWD headline template down to the hazard', () => {
      const [alert] = adapter.parseAlerts(SAMPLE);
      expect(alert.event).toBe('Extremer Hitze');
      expect(alert.headline).toBe('Amtliche WARNUNG vor extremer HITZE');
    });

    it('keeps the full headline as the secondary line', () => {
      // event and headline differ, so the smart-dedup filter must not swallow
      // the headline row.
      const [alert] = adapter.parseAlerts(SAMPLE);
      expect(getDisplayHeadline(alert)).toBe('Amtliche WARNUNG vor extremer HITZE');
    });

    it.each([
      ['Amtliche UNWETTERWARNUNG vor SCHWEREM GEWITTER', 'Schwerem Gewitter'],
      ['Amtliche EXTREME UNWETTERWARNUNG vor ORKANBÖEN', 'Orkanböen'],
      ['Amtliche WARNUNG vor GLATTEIS', 'Glatteis'],
      ['Vorabinformation SCHWERES GEWITTER', 'Schweres Gewitter'],
      ['Warnung vor Waldbrandgefahr', 'Waldbrandgefahr'],
    ])('strips %s', (headline, expected) => {
      expect(adapter.parseAlerts(makeWarning({ headline }))[0].event).toBe(expected);
    });

    it('passes non-DWD sender headlines through verbatim', () => {
      // NINA also carries LHP, MoWaS, KATWARN and BIWAPP messages, whose
      // headlines are free prose with no template to strip.
      const headline = 'Bombenfund in der Innenstadt - Evakuierung';
      const [alert] = adapter.parseAlerts(makeWarning({ headline }));
      expect(alert.event).toBe(headline);
      // event === headline, so the headline row collapses instead of repeating.
      expect(getDisplayHeadline(alert)).toBe('');
    });

    it('keeps the headline when the template leaves nothing behind', () => {
      const [alert] = adapter.parseAlerts(makeWarning({ headline: 'Amtliche WARNUNG' }));
      expect(alert.event).toBe('Amtliche WARNUNG');
    });

    it('falls back to a generic event when the headline is empty', () => {
      const [alert] = adapter.parseAlerts(makeWarning({ headline: '' }));
      expect(alert.event).toBe('Warnung');
    });
  });

  describe('icon resolution', () => {
    it.each([
      ['Amtliche WARNUNG vor extremer HITZE', 'mdi:weather-sunny-alert'],
      ['Amtliche UNWETTERWARNUNG vor SCHWEREM GEWITTER', 'mdi:weather-lightning'],
      ['Amtliche WARNUNG vor GLATTEIS', 'mdi:snowflake'],
      ['Amtliche WARNUNG vor HOCHWASSER', 'mdi:home-flood'],
      ['Amtliche WARNUNG vor ORKANBÖEN', 'mdi:weather-windy'],
    ])('resolves %s via the German keyword dictionary', (headline, icon) => {
      // No providerIcon is set — the derived event has to hit the dictionary's
      // German keywords, which the DWD adapter already seeded.
      const [alert] = adapter.parseAlerts(makeWarning({ headline }));
      expect(alert.providerIcon).toBeUndefined();
      expect(getWeatherIcon(alert.iconHint || alert.event)).toBe(icon);
    });

    it('falls back to the generic icon for a civil-protection message', () => {
      const [alert] = adapter.parseAlerts(makeWarning({ headline: 'Bombenfund - Evakuierung' }));
      expect(getWeatherIcon(alert.event)).toBe('mdi:alert-circle-outline');
    });
  });
});
