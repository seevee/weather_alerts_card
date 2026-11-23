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

  it('detects MSN Weather by attribution', () => {
    expect(adapter.canHandle(SINGLE)).toBe(true);
    expect(adapter.canHandle({
      attribution: 'Data provided by Pirate Weather',
      alerts: [],
    })).toBe(false);
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
    expect(a.description).toBe('Wind warning');
    expect(a.instruction).toBe('Prepare for possible strong winds.');
    expect(a.areaDesc).toBe('Hydrometcenter of Russia');
    expect(a.phase).toBe('Ongoing');
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

  it('returns no alerts when alerts is absent or empty', () => {
    expect(adapter.parseAlerts({ attribution: SINGLE.attribution })).toEqual([]);
    expect(adapter.parseAlerts({ ...SINGLE, alerts: [] })).toEqual([]);
  });

  it('falls back to level when severity is absent', () => {
    const alerts = adapter.parseAlerts({
      ...SINGLE,
      alerts: [{ ...SINGLE.alerts[0], severity: '', level: 'Minor' }],
    });
    expect(alerts[0].severity).toBe('minor');
    expect(alerts[0].severityInferred).toBe(false);
  });
});
