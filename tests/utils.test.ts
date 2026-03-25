import { describe, it, expect } from 'vitest';
import {
  getWeatherIcon,
  getCertaintyIcon,
  getNwsEventColor,
  computeAlertProgress,
  normalizeSeverity,
  sortAlerts,
  alertMatchesZones,
  deduplicateAlerts,
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

  it('returns tsunami icon', () => {
    expect(getWeatherIcon('Tsunami Warning')).toBe('mdi:tsunami');
  });

  it('returns hurricane icon for typhoon', () => {
    expect(getWeatherIcon('Typhoon Warning')).toBe('mdi:weather-hurricane');
  });

  it('returns hail icon', () => {
    expect(getWeatherIcon('Hail Storm Warning')).toBe('mdi:weather-hail');
  });

  it('returns rain icon for rain events', () => {
    expect(getWeatherIcon('Heavy Rain Warning')).toBe('mdi:weather-pouring');
  });

  it('returns sleet icon', () => {
    expect(getWeatherIcon('Sleet Advisory')).toBe('mdi:weather-snowy-rainy');
  });

  it('returns thermometer icon for wind chill (not wind)', () => {
    expect(getWeatherIcon('Wind Chill Warning')).toBe('mdi:thermometer-low');
  });

  it('returns thermometer icon for extreme cold', () => {
    expect(getWeatherIcon('Extreme Cold Warning')).toBe('mdi:thermometer-low');
  });

  it('returns dust icon', () => {
    expect(getWeatherIcon('Dust Storm Warning')).toBe('mdi:weather-dust');
  });

  it('returns smoke icon', () => {
    expect(getWeatherIcon('Dense Smoke Advisory')).toBe('mdi:smoke');
  });

  it('returns volcano icon', () => {
    expect(getWeatherIcon('Ashfall Advisory')).toBe('mdi:volcano');
  });

  it('returns air filter icon for air quality', () => {
    expect(getWeatherIcon('Air Quality Alert')).toBe('mdi:air-filter');
  });

  it('returns sailboat icon for small craft advisory', () => {
    expect(getWeatherIcon('Small Craft Advisory')).toBe('mdi:sail-boat');
  });

  it('returns wave icon for rip current', () => {
    expect(getWeatherIcon('Rip Current Statement')).toBe('mdi:wave');
  });

  it('returns waves icon for hazardous seas', () => {
    expect(getWeatherIcon('Hazardous Seas Warning')).toBe('mdi:waves');
  });

  it('returns flood icon for storm surge', () => {
    expect(getWeatherIcon('Storm Surge Warning')).toBe('mdi:home-flood');
  });

  it('returns wind icon for gale', () => {
    expect(getWeatherIcon('Gale Warning')).toBe('mdi:weather-windy');
  });

  it('returns drought icon', () => {
    expect(getWeatherIcon('Drought Warning')).toBe('mdi:water-off');
  });

  it('returns hurricane icon for cyclone', () => {
    expect(getWeatherIcon('Severe Cyclone Warning')).toBe('mdi:weather-hurricane');
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

  it('does not produce 60m at minute/hour boundaries', () => {
    // 3599s = 59m 59s — should be "59m", not "60m"
    expect(formatRelativeTime(now + 3599, now)).toBe('in 59m');
    // 7199s = 1h 59m 59s — should be "1h 59m", not "1h 60m"
    expect(formatRelativeTime(now + 7199, now)).toBe('in 1h 59m');
  });

  it('returns days for long durations', () => {
    expect(formatRelativeTime(now + 172800, now)).toBe('in 2d');
  });

  it('returns French relative time', () => {
    expect(formatRelativeTime(now - 30, now, 'fr')).toBe("a l'instant");
    expect(formatRelativeTime(now + 300, now, 'fr')).toBe('dans 5m');
    expect(formatRelativeTime(now - 300, now, 'fr')).toBe('il y a 5m');
    expect(formatRelativeTime(now + 5400, now, 'fr')).toBe('dans 1h 30m');
    expect(formatRelativeTime(now + 172800, now, 'fr')).toBe('dans 2j');
  });

  it('returns Spanish relative time', () => {
    expect(formatRelativeTime(now - 30, now, 'es')).toBe('ahora mismo');
    expect(formatRelativeTime(now + 300, now, 'es')).toBe('en 5m');
    expect(formatRelativeTime(now - 300, now, 'es')).toBe('hace 5m');
    expect(formatRelativeTime(now + 5400, now, 'es')).toBe('en 1h 30m');
    expect(formatRelativeTime(now + 172800, now, 'es')).toBe('en 2d');
  });
});

describe('deduplicateAlerts', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateAlerts([])).toEqual([]);
  });

  it('returns single alert unchanged', () => {
    const alert = makeAlert();
    const result = deduplicateAlerts([alert]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test-1');
  });

  it('does not merge alerts with different events', () => {
    const a = makeAlert({ id: 'a', event: 'Tornado Warning' });
    const b = makeAlert({ id: 'b', event: 'Flood Warning' });
    const result = deduplicateAlerts([a, b]);
    expect(result).toHaveLength(2);
  });

  it('does not merge alerts with different onsetTs', () => {
    const a = makeAlert({ id: 'a', onsetTs: 1000 });
    const b = makeAlert({ id: 'b', onsetTs: 2000 });
    const result = deduplicateAlerts([a, b]);
    expect(result).toHaveLength(2);
  });

  it('does not merge alerts with different severity', () => {
    const a = makeAlert({ id: 'a', severity: 'severe' });
    const b = makeAlert({ id: 'b', severity: 'moderate' });
    const result = deduplicateAlerts([a, b]);
    expect(result).toHaveLength(2);
  });

  it('merges two alerts with same key', () => {
    const a = makeAlert({ id: 'a', zones: ['COZ039'], areaDesc: 'Zone A' });
    const b = makeAlert({ id: 'b', zones: ['COZ040'], areaDesc: 'Zone B' });
    const result = deduplicateAlerts([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
    expect(result[0].zones).toContain('COZ039');
    expect(result[0].zones).toContain('COZ040');
    expect(result[0].areaDesc).toBe('Zone A; Zone B');
    expect(result[0].mergedCount).toBe(2);
  });

  it('merges three alerts with same key', () => {
    const a = makeAlert({ id: 'a', zones: ['Z1'], areaDesc: 'Area 1' });
    const b = makeAlert({ id: 'b', zones: ['Z2'], areaDesc: 'Area 2' });
    const c = makeAlert({ id: 'c', zones: ['Z3'], areaDesc: 'Area 3' });
    const result = deduplicateAlerts([a, b, c]);
    expect(result).toHaveLength(1);
    expect(result[0].zones).toHaveLength(3);
    expect(result[0].areaDesc).toBe('Area 1; Area 2; Area 3');
    expect(result[0].mergedCount).toBe(3);
  });

  it('deduplicates zones across merged alerts', () => {
    const a = makeAlert({ id: 'a', zones: ['COZ039', 'COZ040'] });
    const b = makeAlert({ id: 'b', zones: ['coz039', 'COZ041'] });
    const result = deduplicateAlerts([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].zones).toHaveLength(3);
  });

  it('deduplicates identical areaDesc values', () => {
    const a = makeAlert({ id: 'a', areaDesc: 'Same Area' });
    const b = makeAlert({ id: 'b', areaDesc: 'Same Area' });
    const result = deduplicateAlerts([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].areaDesc).toBe('Same Area');
  });

  it('sets mergedCount when zones are empty', () => {
    const a = makeAlert({ id: 'a', zones: [], areaDesc: 'Area A' });
    const b = makeAlert({ id: 'b', zones: [], areaDesc: 'Area B' });
    const result = deduplicateAlerts([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].mergedCount).toBe(2);
    expect(result[0].zones).toHaveLength(0);
  });

  it('does not set mergedCount for non-merged alerts', () => {
    const a = makeAlert();
    const result = deduplicateAlerts([a]);
    expect(result[0].mergedCount).toBeUndefined();
  });

  it('preserves first-occurrence order', () => {
    const tornado = makeAlert({ id: 't', event: 'Tornado Warning', zones: ['Z1'] });
    const flood1 = makeAlert({ id: 'f1', event: 'Flood Warning', zones: ['Z1'] });
    const flood2 = makeAlert({ id: 'f2', event: 'Flood Warning', zones: ['Z2'] });
    const result = deduplicateAlerts([tornado, flood1, flood2]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('t');
    expect(result[1].id).toBe('f1');
  });
});

