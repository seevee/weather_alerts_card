import { describe, it, expect } from 'vitest';
import {
  getWeatherIcon,
  getCertaintyIcon,
  getNwsEventColor,
  computeAlertProgress,
  normalizeSeverity,
  sortAlerts,
  extractZoneCode,
  alertMatchesZones,
  formatRelativeTime,
} from '../src/utils';
import type { NwsAlert } from '../src/types';

function makeAlert(overrides: Partial<NwsAlert> = {}): NwsAlert {
  return {
    ID: 'test-1',
    Event: 'Test Alert',
    Severity: 'Moderate',
    Certainty: 'Likely',
    Urgency: 'Immediate',
    Sent: '2026-03-06T10:00:00-07:00',
    Onset: '2026-03-06T12:00:00-07:00',
    Ends: '2026-03-06T18:00:00-07:00',
    Expires: '',
    Description: 'Test description',
    Instruction: 'Test instruction',
    URL: 'https://alerts.weather.gov/test',
    Headline: 'Test Headline',
    AreaDesc: 'Test Area',
    AffectedZones: ['https://api.weather.gov/zones/forecast/COZ039'],
    Geocode: { UGC: ['COZ039'], SAME: ['008059'] },
    ...overrides,
  };
}

describe('getWeatherIcon', () => {
  it('returns tornado icon for tornado events', () => {
    expect(getWeatherIcon('Tornado Warning')).toBe('mdi:weather-tornado');
  });

  it('returns flood icon for flood events', () => {
    expect(getWeatherIcon('Flash Flood Watch')).toBe('mdi:home-flood');
  });

  it('returns fire icon for fire events', () => {
    expect(getWeatherIcon('Red Flag Warning')).toBe('mdi:fire');
  });

  it('returns default icon for unknown events', () => {
    expect(getWeatherIcon('Unknown Event')).toBe('mdi:alert-circle-outline');
  });
});

describe('getCertaintyIcon', () => {
  it('returns check icon for Likely', () => {
    expect(getCertaintyIcon('Likely')).toBe('mdi:check-decagram');
  });

  it('returns eye icon for Observed', () => {
    expect(getCertaintyIcon('Observed')).toBe('mdi:eye-check');
  });

  it('returns help icon for Possible', () => {
    expect(getCertaintyIcon('Possible')).toBe('mdi:help-circle-outline');
  });

  it('returns default icon for unknown certainty', () => {
    expect(getCertaintyIcon('Something Else')).toBe('mdi:bullseye-arrow');
  });
});

describe('getNwsEventColor', () => {
  it('returns red for tornado warning', () => {
    const result = getNwsEventColor('Tornado Warning');
    expect(result.color).toBe('#FF0000');
  });

  it('returns specific color for severe thunderstorm warning', () => {
    const result = getNwsEventColor('Severe Thunderstorm Warning');
    expect(result.color).toBe('#FFA500');
  });

  it('returns gray for unknown event', () => {
    const result = getNwsEventColor('Unknown Event');
    expect(result.color).toBe('#808080');
  });

  it('includes textColor based on luminance', () => {
    const dark = getNwsEventColor('Tornado Warning'); // bright red
    const light = getNwsEventColor('Dense Fog Advisory'); // gray
    expect(dark.textColor).toBeDefined();
    expect(light.textColor).toBeDefined();
  });
});

describe('normalizeSeverity', () => {
  it('normalizes known severities', () => {
    expect(normalizeSeverity('Extreme')).toBe('extreme');
    expect(normalizeSeverity('Severe')).toBe('severe');
    expect(normalizeSeverity('Moderate')).toBe('moderate');
    expect(normalizeSeverity('Minor')).toBe('minor');
  });

  it('returns unknown for unrecognized values', () => {
    expect(normalizeSeverity('foo')).toBe('unknown');
    expect(normalizeSeverity(undefined)).toBe('unknown');
    expect(normalizeSeverity('')).toBe('unknown');
  });
});

describe('computeAlertProgress', () => {
  it('returns active when now is past onset', () => {
    const alert = makeAlert({
      Onset: new Date(Date.now() - 3600_000).toISOString(),
      Ends: new Date(Date.now() + 3600_000).toISOString(),
    });
    const progress = computeAlertProgress(alert);
    expect(progress.isActive).toBe(true);
    expect(progress.phaseText).toBe('Active');
    expect(progress.progressPct).toBeGreaterThan(0);
    expect(progress.progressPct).toBeLessThanOrEqual(100);
  });

  it('returns preparation when now is before onset', () => {
    const alert = makeAlert({
      Onset: new Date(Date.now() + 7200_000).toISOString(),
      Ends: new Date(Date.now() + 14400_000).toISOString(),
    });
    const progress = computeAlertProgress(alert);
    expect(progress.isActive).toBe(false);
    expect(progress.phaseText).toBe('Preparation');
  });

  it('handles missing Ends by falling back to Expires', () => {
    const alert = makeAlert({
      Ends: '',
      Expires: new Date(Date.now() + 3600_000).toISOString(),
    });
    const progress = computeAlertProgress(alert);
    expect(progress.hasEndTime).toBe(true);
  });

  it('handles no end time', () => {
    const alert = makeAlert({ Ends: '', Expires: '' });
    const progress = computeAlertProgress(alert);
    expect(progress.hasEndTime).toBe(false);
  });
});

describe('sortAlerts', () => {
  it('sorts by onset time', () => {
    const early = makeAlert({ ID: 'early', Onset: '2026-03-06T10:00:00Z' });
    const late = makeAlert({ ID: 'late', Onset: '2026-03-06T14:00:00Z' });
    const sorted = sortAlerts([late, early], 'onset');
    expect(sorted[0].ID).toBe('early');
    expect(sorted[1].ID).toBe('late');
  });

  it('sorts by severity', () => {
    const minor = makeAlert({ ID: 'minor', Severity: 'Minor' });
    const extreme = makeAlert({ ID: 'extreme', Severity: 'Extreme' });
    const sorted = sortAlerts([minor, extreme], 'severity');
    expect(sorted[0].ID).toBe('extreme');
    expect(sorted[1].ID).toBe('minor');
  });

  it('returns original order for default', () => {
    const a = makeAlert({ ID: 'a' });
    const b = makeAlert({ ID: 'b' });
    const sorted = sortAlerts([a, b], 'default');
    expect(sorted[0].ID).toBe('a');
  });
});

describe('extractZoneCode', () => {
  it('extracts zone code from NWS API URL', () => {
    expect(extractZoneCode('https://api.weather.gov/zones/forecast/COZ039')).toBe('COZ039');
  });

  it('uppercases the result', () => {
    expect(extractZoneCode('https://api.weather.gov/zones/forecast/coz039')).toBe('COZ039');
  });
});

describe('alertMatchesZones', () => {
  it('matches via AffectedZones', () => {
    const alert = makeAlert({
      AffectedZones: ['https://api.weather.gov/zones/forecast/COZ039'],
      Geocode: {},
    });
    expect(alertMatchesZones(alert, new Set(['COZ039']))).toBe(true);
  });

  it('matches via Geocode.UGC', () => {
    const alert = makeAlert({
      AffectedZones: [],
      Geocode: { UGC: ['COC059'] },
    });
    expect(alertMatchesZones(alert, new Set(['COC059']))).toBe(true);
  });

  it('returns false when no match', () => {
    const alert = makeAlert({
      AffectedZones: ['https://api.weather.gov/zones/forecast/COZ039'],
      Geocode: { UGC: ['COZ039'] },
    });
    expect(alertMatchesZones(alert, new Set(['NYZ001']))).toBe(false);
  });
});

describe('formatRelativeTime', () => {
  const now = 1709737200; // fixed reference

  it('returns "just now" for recent past', () => {
    expect(formatRelativeTime(now - 30, now)).toBe('just now');
  });

  it('returns minutes for short durations', () => {
    expect(formatRelativeTime(now + 300, now)).toBe('in 5m');
    expect(formatRelativeTime(now - 300, now)).toBe('5m ago');
  });

  it('returns hours and minutes', () => {
    expect(formatRelativeTime(now + 5400, now)).toBe('in 1h 30m');
  });

  it('returns days for long durations', () => {
    expect(formatRelativeTime(now + 172800, now)).toBe('in 2d');
  });
});
