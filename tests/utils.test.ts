import { describe, it, expect } from 'vitest';
import {
  getWeatherIcon,
  getCertaintyIcon,
  getNwsEventColor,
  computeAlertProgress,
  normalizeSeverity,
  sortAlerts,
  alertMatchesZones,
  formatRelativeTime,
  parseTimestamp,
} from '../src/utils';
import type { WeatherAlert } from '../src/types';

function makeAlert(overrides: Partial<WeatherAlert> = {}): WeatherAlert {
  return {
    id: 'test-1',
    event: 'Test Alert',
    severity: 'moderate',
    certainty: 'Likely',
    urgency: 'Immediate',
    sentTs: parseTimestamp('2026-03-06T10:00:00-07:00'),
    onsetTs: parseTimestamp('2026-03-06T12:00:00-07:00'),
    endsTs: parseTimestamp('2026-03-06T18:00:00-07:00'),
    description: 'Test description',
    instruction: 'Test instruction',
    url: 'https://alerts.weather.gov/test',
    headline: 'Test Headline',
    areaDesc: 'Test Area',
    zones: ['COZ039'],
    provider: 'nws',
    phase: '',
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

  it('returns wave icon for marine/surf events', () => {
    expect(getWeatherIcon('Hazardous Surf Warning')).toBe('mdi:waves');
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
      onsetTs: Date.now() / 1000 - 3600,
      endsTs: Date.now() / 1000 + 3600,
    });
    const progress = computeAlertProgress(alert);
    expect(progress.isActive).toBe(true);
    expect(progress.phaseText).toBe('Active');
    expect(progress.progressPct).toBeGreaterThan(0);
    expect(progress.progressPct).toBeLessThanOrEqual(100);
  });

  it('returns preparation when now is before onset', () => {
    const alert = makeAlert({
      onsetTs: Date.now() / 1000 + 7200,
      endsTs: Date.now() / 1000 + 14400,
    });
    const progress = computeAlertProgress(alert);
    expect(progress.isActive).toBe(false);
    expect(progress.phaseText).toBe('Preparation');
  });

  it('handles present endsTs', () => {
    const alert = makeAlert({
      endsTs: Date.now() / 1000 + 3600,
    });
    const progress = computeAlertProgress(alert);
    expect(progress.hasEndTime).toBe(true);
  });

  it('handles no end time', () => {
    const alert = makeAlert({ endsTs: 0 });
    const progress = computeAlertProgress(alert);
    expect(progress.hasEndTime).toBe(false);
  });
});

describe('sortAlerts', () => {
  it('sorts by onset time', () => {
    const early = makeAlert({ id: 'early', onsetTs: parseTimestamp('2026-03-06T10:00:00Z') });
    const late = makeAlert({ id: 'late', onsetTs: parseTimestamp('2026-03-06T14:00:00Z') });
    const sorted = sortAlerts([late, early], 'onset');
    expect(sorted[0].id).toBe('early');
    expect(sorted[1].id).toBe('late');
  });

  it('sorts by severity', () => {
    const minor = makeAlert({ id: 'minor', severity: 'minor' });
    const extreme = makeAlert({ id: 'extreme', severity: 'extreme' });
    const sorted = sortAlerts([minor, extreme], 'severity');
    expect(sorted[0].id).toBe('extreme');
    expect(sorted[1].id).toBe('minor');
  });

  it('returns original order for default', () => {
    const a = makeAlert({ id: 'a' });
    const b = makeAlert({ id: 'b' });
    const sorted = sortAlerts([a, b], 'default');
    expect(sorted[0].id).toBe('a');
  });
});

describe('alertMatchesZones', () => {
  it('matches when alert has matching zone', () => {
    const alert = makeAlert({ zones: ['COZ039'] });
    expect(alertMatchesZones(alert, new Set(['COZ039']))).toBe(true);
  });

  it('matches case-insensitively', () => {
    const alert = makeAlert({ zones: ['coz039'] });
    expect(alertMatchesZones(alert, new Set(['COZ039']))).toBe(true);
  });

  it('returns false when no match', () => {
    const alert = makeAlert({ zones: ['COZ039'] });
    expect(alertMatchesZones(alert, new Set(['NYZ001']))).toBe(false);
  });

  it('returns false for empty zones', () => {
    const alert = makeAlert({ zones: [] });
    expect(alertMatchesZones(alert, new Set(['COZ039']))).toBe(false);
  });
});

describe('parseTimestamp', () => {
  it('parses ISO 8601 timestamps', () => {
    const ts = parseTimestamp('2026-03-06T12:00:00Z');
    expect(ts).toBeGreaterThan(0);
  });

  it('returns 0 for None', () => {
    expect(parseTimestamp('None')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parseTimestamp('')).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(parseTimestamp(undefined)).toBe(0);
  });

  it('parses timestamps with timezone offsets', () => {
    const ts = parseTimestamp('2026-03-06T14:30:00+10:00');
    expect(ts).toBeGreaterThan(0);
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
