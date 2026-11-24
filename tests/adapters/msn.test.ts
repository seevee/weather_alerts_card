import { describe, it, expect } from 'vitest';
import { MsnAdapter } from '../../src/adapters/msn';

const SINGLE = {
  active: 'Wind - Moderate',
  highest_level: 'Moderate',
  alerts: [{
    title: 'Wind - Moderate',
    event: 'Wind',
    level: 'Moderate',
    significance: 'Y',
    severity: 'Moderate',
    status: 'Ongoing',
    start: '2026-11-23T09:00:00+03:00',
    end: '2026-11-25T18:00:00+03:00',
    description: 'Wind warning',
    safety_guide: 'Prepare for possible strong winds.',
    source: 'Hydrometcenter of Russia',
  }],
  attribution: 'Data provided by MSN Weather (Microsoft)',
};

describe('MsnAdapter', () => {
  const adapter = new MsnAdapter();

  it('detects the alerts sensor by attribution plus its alerts list', () => {
    expect(adapter.canHandle(SINGLE)).toBe(true);
    expect(adapter.canHandle({ attribution: SINGLE.attribution, alerts: [] })).toBe(true);
  });

  it('detects the alert-active binary sensor by its all_alerts list', () => {
    expect(adapter.canHandle({
      attribution: SINGLE.attribution,
      active: [],
      highest_level: null,
      all_alerts: [],
    })).toBe(true);
  });

  it('does not claim the integration\'s other entities', () => {
    // Every MSN Weather entity carries the attribution.
    expect(adapter.canHandle({
      attribution: SINGLE.attribution,
      unit_of_measurement: '°C',
      device_class: 'temperature',
    })).toBe(false);
  });

  it('does not claim another integration\'s alerts list', () => {
    expect(adapter.canHandle({
      attribution: 'Data provided by Pirate Weather',
      alerts: [],
    })).toBe(false);
    expect(adapter.canHandle({ alerts: SINGLE.alerts })).toBe(false);
  });

  it('is a relay, so the issuer\'s own copy wins a dedup group', () => {
    expect(adapter.relay).toBe(true);
  });

  it('parses the supplied single-alert shape', () => {
    const alerts = adapter.parseAlerts(SINGLE);
    expect(alerts).toHaveLength(1);
    const a = alerts[0];
    expect(a.provider).toBe('msn');
    expect(a.event).toBe('Wind - Moderate');
    expect(a.severity).toBe('moderate');
    expect(a.severityLabel).toBe('Moderate');
    expect(a.sentTs).toBe(0);
    expect(a.onsetTs).toBeGreaterThan(0);
    expect(a.endsTs).toBeGreaterThan(a.onsetTs);
    expect(a.description).toBe('Wind warning\n\nSource: Hydrometcenter of Russia');
    expect(a.matchText).toBe('Wind warning');
    expect(a.instruction).toBe('Prepare for possible strong winds.');
    expect(a.areaDesc).toBe('');
    // MSN's status is not a CAP phase, and phase is in the dismissal signature.
    expect(a.phase).toBe('');
    expect(a.url).toBe('');
  });

  it('parses multiple alerts from alerts', () => {
    const alerts = adapter.parseAlerts({
      ...SINGLE,
      alerts: [
        SINGLE.alerts[0],
        {
          title: 'Heat - Severe',
          event: 'Heat',
          level: 'Severe',
          severity: 'Severe',
          status: 'Upcoming',
          start: '2026-11-24T10:00:00+03:00',
          end: '2026-11-24T20:00:00+03:00',
          description: 'Heat warning',
          safety_guide: 'Stay hydrated.',
          source: 'Hydrometcenter of Russia',
        },
      ],
    });
    expect(alerts).toHaveLength(2);
    expect(alerts[0].severity).toBe('moderate');
    expect(alerts[1].severity).toBe('severe');
  });

  it('reads the same records from all_alerts', () => {
    const { alerts: list, ...rest } = SINGLE;
    expect(adapter.parseAlerts({ ...rest, all_alerts: list })).toEqual(adapter.parseAlerts(SINGLE));
  });

  it('keeps an alert\'s id when an earlier alert clears', () => {
    const heat = { ...SINGLE.alerts[0], title: 'Heat - Severe', event: 'Heat' };
    const both = adapter.parseAlerts({ ...SINGLE, alerts: [SINGLE.alerts[0], heat] });
    const alone = adapter.parseAlerts({ ...SINGLE, alerts: [heat] });
    expect(alone[0].id).toBe(both[1].id);
    expect(both[0].id).not.toBe(both[1].id);
  });

  it('leaves the description alone when no source is given', () => {
    const alerts = adapter.parseAlerts({
      ...SINGLE,
      alerts: [{ ...SINGLE.alerts[0], source: null }],
    });
    expect(alerts[0].description).toBe('Wind warning');
  });

  it('returns no alerts when alerts is absent or empty', () => {
    expect(adapter.parseAlerts({ attribution: SINGLE.attribution })).toEqual([]);
    expect(adapter.parseAlerts({ ...SINGLE, alerts: [] })).toEqual([]);
  });

  const withFields = (fields: Record<string, unknown>) =>
    adapter.parseAlerts({ ...SINGLE, alerts: [{ ...SINGLE.alerts[0], ...fields }] })[0];

  it.each([
    ['R', 'extreme'], ['O', 'severe'], ['Y', 'moderate'], ['B', 'minor'],
    ['W', 'severe'], ['A', 'moderate'], ['S', 'minor'],
  ])('maps significance %s to %s', (significance, severity) => {
    // Text no English ladder knows: what a non-English setup publishes.
    const a = withFields({ significance, severity: 'Orange', level: 'Warnung' });
    expect(a.severity).toBe(severity);
    expect(a.severityInferred).toBe(false);
    expect(a.severityLabel).toBe('Orange');
  });

  it('trusts significance over the display text', () => {
    expect(withFields({ significance: 'R', severity: 'Moderate' }).severity).toBe('extreme');
  });

  it('falls back to the severity text when significance is missing or unknown', () => {
    expect(withFields({ significance: null, severity: 'Severe' }).severity).toBe('severe');
    expect(withFields({ significance: 'Z', severity: 'Severe' }).severity).toBe('severe');
  });

  it('falls back to level when severity is absent', () => {
    const a = withFields({ significance: null, severity: '', level: 'Minor' });
    expect(a.severity).toBe('minor');
    expect(a.severityInferred).toBe(false);
  });

  it('marks the severity inferred when nothing is recognised', () => {
    const a = withFields({ significance: null, severity: 'Gelb', level: 'Gelb' });
    expect(a.severity).toBe('unknown');
    expect(a.severityInferred).toBe(true);
  });
});
