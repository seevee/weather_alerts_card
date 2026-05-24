import { describe, it, expect } from 'vitest';
import {
  getWeatherIcon,
  getCertaintyIcon,
  getNwsEventColor,
  getMeteoAlarmColor,
  getEcccColor,
  resolveContrastMode,
  computeAlertProgress,
  normalizeSeverity,
  sortAlerts,
  alertMatchesZones,
  deduplicateAlerts,
  formatRelativeTime,
  parseTimestamp,
  getDisplayHeadline,
  reflowAlertText,
} from '../src/utils';
import type { WeatherAlert, AlertProvider } from '../src/types';

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
    severityInferred: false,
    certaintyInferred: false,
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

  // DWD German event names
  it('returns lightning icon for GEWITTER (thunderstorm)', () => {
    expect(getWeatherIcon('GEWITTER')).toBe('mdi:weather-lightning');
  });

  it('returns snowflake icon for GLÄTTE (ice/slippery)', () => {
    expect(getWeatherIcon('GLÄTTE')).toBe('mdi:snowflake');
  });

  it('returns snowflake icon for GLATTEIS (black ice)', () => {
    expect(getWeatherIcon('GLATTEIS')).toBe('mdi:snowflake');
  });

  it('returns wind icon for WINDBÖEN (wind gusts)', () => {
    expect(getWeatherIcon('WINDBÖEN')).toBe('mdi:weather-windy');
  });

  it('returns wind icon for STURM (storm)', () => {
    expect(getWeatherIcon('STURM')).toBe('mdi:weather-windy');
  });

  it('returns wind icon for ORKAN (hurricane-force wind)', () => {
    expect(getWeatherIcon('ORKAN')).toBe('mdi:weather-windy');
  });

  it('returns fog icon for NEBEL (fog)', () => {
    expect(getWeatherIcon('NEBEL')).toBe('mdi:weather-fog');
  });

  it('returns heat icon for HITZE (heat)', () => {
    expect(getWeatherIcon('HITZE')).toBe('mdi:weather-sunny-alert');
  });

  it('returns snow icon for SCHNEE (snow)', () => {
    expect(getWeatherIcon('SCHNEE')).toBe('mdi:weather-snowy-heavy');
  });

  it('returns rain icon for STARKREGEN (heavy rain)', () => {
    expect(getWeatherIcon('STARKREGEN')).toBe('mdi:weather-pouring');
  });

  it('returns rain icon for DAUERREGEN (persistent rain)', () => {
    expect(getWeatherIcon('DAUERREGEN')).toBe('mdi:weather-pouring');
  });

  it('returns hail icon for HAGEL (hail)', () => {
    expect(getWeatherIcon('HAGEL')).toBe('mdi:weather-hail');
  });

  it('returns flood icon for HOCHWASSER (flood)', () => {
    expect(getWeatherIcon('HOCHWASSER')).toBe('mdi:home-flood');
  });

  it('returns fire icon for WALDBRAND (wildfire)', () => {
    expect(getWeatherIcon('WALDBRAND')).toBe('mdi:fire');
  });

  // MeteoAlarm awareness_type labels (English, used via iconHint)
  it('returns heat icon for "Extreme high temperature"', () => {
    expect(getWeatherIcon('Extreme high temperature')).toBe('mdi:weather-sunny-alert');
  });

  it('returns cold icon for "Extreme low temperature"', () => {
    expect(getWeatherIcon('Extreme low temperature')).toBe('mdi:thermometer-low');
  });

  it('returns fire icon for "Forest Fire"', () => {
    expect(getWeatherIcon('Forest Fire')).toBe('mdi:fire');
  });

  it('returns landslide icon for "Avalanches"', () => {
    expect(getWeatherIcon('Avalanches')).toBe('mdi:landslide');
  });

  it('returns waves icon for "Coastal Event"', () => {
    expect(getWeatherIcon('Coastal Event')).toBe('mdi:waves');
  });

  it('returns flood icon for "Rain-Flood"', () => {
    expect(getWeatherIcon('Rain-Flood')).toBe('mdi:home-flood');
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

  it('picks badge text to match card background (knockout) when contrast allows', () => {
    // Tornado Warning (#FF0000) vs white card: 4.0:1 >= 1.9 → white text
    // vs dark card: 4.42:1 >= 1.9 → dark text
    expect(getNwsEventColor('Tornado Warning').textColorLight).toBe('#ffffff');
    expect(getNwsEventColor('Tornado Warning').textColorDark).toBe('#1c1c1e');
    // Freeze Warning (#483D8B darkslateblue, L≈0.062) vs dark card: 1.30:1 < 1.9
    // → flip to light text so dark-on-dark doesn't disappear
    expect(getNwsEventColor('Freeze Warning').textColorDark).toBe('#f5f5f5');
  });

  it('flips badge text when card-bg would collapse into the badge bg', () => {
    // Wind Advisory (#D2B48C tan, L≈0.482) vs white: 1.97:1 — above 1.9,
    // so we keep the knockout (white text on tan)
    expect(getNwsEventColor('Wind Advisory').textColorLight).toBe('#ffffff');
    // But a very-close-to-white pale shade would fall below 1.9 and flip
    // to dark — no such entry exists in the help-map fixture, so this is
    // covered by the unit above rather than a specific event.
  });

  it('matches event names case-insensitively against the help-map table', () => {
    // Help-map includes these full event names — lookup must resolve them
    // directly rather than falling through to the pattern-match fallback.
    expect(getNwsEventColor('WINTER STORM WARNING').color).toBe('#FF69B4');
    expect(getNwsEventColor('coastal flood watch').color).toBe('#66CDAA');
    expect(getNwsEventColor('Gale Warning').color).toBe('#DDA0DD');
  });

  it('sets boostLight (text tier, 2.0:1) for middling-contrast hues on white', () => {
    // Severe Thunderstorm Warning (#FFA500 orange, ~1.97:1) — fails text tier
    expect(getNwsEventColor('Severe Thunderstorm Warning').boostLight).toBe(true);
    // Tornado Warning (#FF0000 red, ~4.0:1) — passes both tiers
    expect(getNwsEventColor('Tornado Warning').boostLight).toBe(false);
  });

  it('sets boostDark (text tier, 2.0:1) for dark hues on dark card', () => {
    // Freeze Warning (#483D8B darkslateblue) — fails text tier on dark
    expect(getNwsEventColor('Freeze Warning').boostDark).toBe(true);
    expect(getNwsEventColor('Tornado Warning').boostDark).toBe(false);
  });

  it('only flags progressBoostLight for near-invisible tints (1.3:1 tier)', () => {
    // Tornado Watch (#FFFF00 yellow, ~1.07:1) — progress bar truly invisible
    expect(getNwsEventColor('Tornado Watch').progressBoostLight).toBe(true);
    // Heat Advisory (#FF7F50 coral, ~2.47:1) — boostLight false too, never fires
    expect(getNwsEventColor('Heat Advisory').progressBoostLight).toBe(false);
    // Winter Storm Warning (#FF69B4 hotpink, ~2.63:1) — progress fine at this contrast
    expect(getNwsEventColor('Winter Storm Warning').progressBoostLight).toBe(false);
    // Severe Thunderstorm Warning — text tier fires, progress tier does not
    expect(getNwsEventColor('Severe Thunderstorm Warning').boostLight).toBe(true);
    expect(getNwsEventColor('Severe Thunderstorm Warning').progressBoostLight).toBe(false);
  });

  it('progressBoostDark is rare — saturated hues pass easily on dark card', () => {
    expect(getNwsEventColor('Tornado Warning').progressBoostDark).toBe(false);
    expect(getNwsEventColor('Freeze Warning').progressBoostDark).toBe(false);
  });

  it('computes all four boost tags for pattern-match fallbacks too', () => {
    const result = getNwsEventColor('Blast Wave Flood Advisory');
    expect(result.color).toBe('#228B22');
    expect(typeof result.boostLight).toBe('boolean');
    expect(typeof result.boostDark).toBe('boolean');
    expect(typeof result.progressBoostLight).toBe('boolean');
    expect(typeof result.progressBoostDark).toBe('boolean');
  });

  it('mode="off" zeroes every boost tag regardless of contrast', () => {
    // Severe Thunderstorm Warning normally boosts on light; Freeze Warning
    // normally boosts on dark. 'off' must suppress both.
    const stw = getNwsEventColor('Severe Thunderstorm Warning', 'off');
    expect(stw.boostLight).toBe(false);
    expect(stw.boostDark).toBe(false);
    expect(stw.progressBoostLight).toBe(false);
    expect(stw.progressBoostDark).toBe(false);
    const fw = getNwsEventColor('Freeze Warning', 'off');
    expect(fw.boostDark).toBe(false);
    expect(fw.progressBoostDark).toBe(false);
  });

  it('mode="strict" catches middling hues that subtle lets through', () => {
    // Heat Advisory (#FF7F50, crLight ~2.50) — passes subtle (>=2.0), fails strict (<3.0)
    expect(getNwsEventColor('Heat Advisory', 'subtle').boostLight).toBe(false);
    expect(getNwsEventColor('Heat Advisory', 'strict').boostLight).toBe(true);
    // Winter Storm Warning (#FF69B4, crLight ~2.65) — same pattern
    expect(getNwsEventColor('Winter Storm Warning', 'subtle').boostLight).toBe(false);
    expect(getNwsEventColor('Winter Storm Warning', 'strict').boostLight).toBe(true);
    // Severe Thunderstorm Warning (crLight ~1.97) — strict progress tier (2.0) now
    // fires where subtle's 1.3 tier let it pass
    expect(getNwsEventColor('Severe Thunderstorm Warning', 'subtle').progressBoostLight).toBe(false);
    expect(getNwsEventColor('Severe Thunderstorm Warning', 'strict').progressBoostLight).toBe(true);
  });

  it('mode="strict" does not falsely flag well-contrasted hues', () => {
    // Tornado Warning (#FF0000, crLight ~4.0, crDark ~4.26) — passes even strict's 3.0 text tier
    const tw = getNwsEventColor('Tornado Warning', 'strict');
    expect(tw.boostLight).toBe(false);
    expect(tw.boostDark).toBe(false);
  });
});

describe('getMeteoAlarmColor', () => {
  it('returns the official awareness-level colors', () => {
    expect(getMeteoAlarmColor('extreme').color).toBe('#D8001E');
    expect(getMeteoAlarmColor('severe').color).toBe('#FF9900');
    expect(getMeteoAlarmColor('moderate').color).toBe('#FFC800');
    expect(getMeteoAlarmColor('minor').color).toBe('#88C840');
  });

  it('falls back to gray for unrecognized severity', () => {
    expect(getMeteoAlarmColor('unknown').color).toBe('#808080');
  });

  it('flags only palest MeteoAlarm hue for text-tier boost on light (2.0:1)', () => {
    // moderate (#FFC800 yellow, ~1.55:1) fails; the rest squeak past 2.0:1.
    expect(getMeteoAlarmColor('moderate').boostLight).toBe(true);
    expect(getMeteoAlarmColor('severe').boostLight).toBe(false);
    expect(getMeteoAlarmColor('minor').boostLight).toBe(false);
    expect(getMeteoAlarmColor('extreme').boostLight).toBe(false);
  });

  it('does not flag MeteoAlarm hues for dark-mode boost', () => {
    // All four pass 3:1 against the dark card bg.
    for (const sev of ['extreme', 'severe', 'moderate', 'minor']) {
      expect(getMeteoAlarmColor(sev).boostDark).toBe(false);
    }
  });

  it('progress-tier boost (1.3:1) is never triggered by MeteoAlarm hues', () => {
    // Even the palest (moderate #FFC800, ~1.55:1) clears the 1.3:1 progress
    // threshold, so the progress bar never gets re-tinted on MeteoAlarm.
    for (const sev of ['extreme', 'severe', 'moderate', 'minor']) {
      expect(getMeteoAlarmColor(sev).progressBoostLight).toBe(false);
      expect(getMeteoAlarmColor(sev).progressBoostDark).toBe(false);
    }
  });

  it('mode="off" suppresses the MeteoAlarm text-tier boost on moderate', () => {
    // moderate normally fires boostLight under 'subtle' — 'off' must suppress it.
    expect(getMeteoAlarmColor('moderate', 'off').boostLight).toBe(false);
  });

  it('mode="strict" flags severe and minor on light where subtle does not', () => {
    // severe (#FF9900, ~2.31) and minor (#88C840, ~2.14) pass subtle (2.0)
    // but fail strict (3.0). moderate fails both; extreme passes both.
    expect(getMeteoAlarmColor('severe', 'subtle').boostLight).toBe(false);
    expect(getMeteoAlarmColor('severe', 'strict').boostLight).toBe(true);
    expect(getMeteoAlarmColor('minor', 'subtle').boostLight).toBe(false);
    expect(getMeteoAlarmColor('minor', 'strict').boostLight).toBe(true);
    expect(getMeteoAlarmColor('extreme', 'strict').boostLight).toBe(false);
  });
});

describe('getEcccColor', () => {
  it('returns palette hex for each ECCC color', () => {
    expect(getEcccColor(makeAlert({ colorHint: 'red' })).color).toBe('#D10000');
    expect(getEcccColor(makeAlert({ colorHint: 'orange' })).color).toBe('#FF9500');
    expect(getEcccColor(makeAlert({ colorHint: 'yellow' })).color).toBe('#FFFF00');
    expect(getEcccColor(makeAlert({ colorHint: 'grey' })).color).toBe('#656565');
  });

  it('is case-insensitive on colorHint', () => {
    expect(getEcccColor(makeAlert({ colorHint: 'YELLOW' })).color).toBe('#FFFF00');
    expect(getEcccColor(makeAlert({ colorHint: 'Red' })).color).toBe('#D10000');
  });

  it('falls back to severity table when colorHint is missing', () => {
    expect(getEcccColor(makeAlert({ severity: 'extreme' })).color).toBe('#D10000');
    expect(getEcccColor(makeAlert({ severity: 'severe' })).color).toBe('#FF9500');
    expect(getEcccColor(makeAlert({ severity: 'moderate' })).color).toBe('#FFFF00');
    expect(getEcccColor(makeAlert({ severity: 'minor' })).color).toBe('#656565');
    expect(getEcccColor(makeAlert({ severity: 'unknown' })).color).toBe('#656565');
  });

  it('falls back to severity table when colorHint is unrecognised', () => {
    expect(getEcccColor(makeAlert({ colorHint: 'fuchsia', severity: 'severe' })).color).toBe('#FF9500');
  });

  it('populates EventColor shape (rgb, text, boost flags)', () => {
    const result = getEcccColor(makeAlert({ colorHint: 'red' }));
    expect(result.color).toBe('#D10000');
    expect(result.rgb).toBe('209, 0, 0');
    expect(result.textColorLight).toBeTruthy();
    expect(result.textColorDark).toBeTruthy();
    expect(typeof result.boostLight).toBe('boolean');
    expect(typeof result.boostDark).toBe('boolean');
    expect(typeof result.progressBoostLight).toBe('boolean');
    expect(typeof result.progressBoostDark).toBe('boolean');
  });

  it('flags yellow for text-tier boost on light (pure yellow vs white is ~1.07:1)', () => {
    expect(getEcccColor(makeAlert({ colorHint: 'yellow' })).boostLight).toBe(true);
  });
});

describe('resolveContrastMode', () => {
  it('defaults undefined to "subtle"', () => {
    expect(resolveContrastMode(undefined)).toBe('subtle');
  });
  it('passes explicit modes through unchanged', () => {
    expect(resolveContrastMode('off')).toBe('off');
    expect(resolveContrastMode('subtle')).toBe('subtle');
    expect(resolveContrastMode('strict')).toBe('strict');
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
    // Merged alerts get a stable synthetic id derived from the merge key, not
    // the first member's id (which depends on emission order).
    expect(result[0].id.startsWith('merged:')).toBe(true);
    expect(result[0].zones).toContain('COZ039');
    expect(result[0].zones).toContain('COZ040');
    expect(result[0].areaDesc).toBe('Zone A; Zone B');
    expect(result[0].mergedCount).toBe(2);
  });

  it('gives merged alerts an id invariant to member order', () => {
    // Regression: the representative id must not flip when the upstream
    // integration reorders zone-split alerts, or browser-local dismissals
    // (keyed on id) would resurface on every reorder.
    const a = makeAlert({ id: 'a', zones: ['COZ039'], areaDesc: 'Zone A' });
    const b = makeAlert({ id: 'b', zones: ['COZ040'], areaDesc: 'Zone B' });
    const forward = deduplicateAlerts([a, b]);
    const reversed = deduplicateAlerts([b, a]);
    expect(forward[0].id).toBe(reversed[0].id);
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
    // Unmerged single alert keeps its real id; the merged flood group follows
    // in first-occurrence order with a stable synthetic id.
    expect(result[0].id).toBe('t');
    expect(result[1].event).toBe('Flood Warning');
    expect(result[1].mergedCount).toBe(2);
    expect(result[1].id.startsWith('merged:')).toBe(true);
  });
});

describe('getDisplayHeadline', () => {
  it('returns empty string when headline is empty', () => {
    expect(getDisplayHeadline(makeAlert({ headline: '' }))).toBe('');
    expect(getDisplayHeadline(makeAlert({ headline: '' }), false)).toBe('');
  });

  it('smart: filters headline that matches event name', () => {
    expect(getDisplayHeadline(makeAlert({ event: 'Flood Warning', headline: 'Flood Warning' }))).toBe('');
  });

  it('smart: filters NWS boilerplate (headline starts with event name)', () => {
    expect(getDisplayHeadline(makeAlert({
      event: 'Flood Warning',
      headline: 'Flood Warning issued March 25 at 1:45PM CDT by NWS Chicago',
    }))).toBe('');
    expect(getDisplayHeadline(makeAlert({
      event: 'Flood Warning',
      headline: 'FLOOD WARNING REMAINS IN EFFECT UNTIL WEDNESDAY, APRIL 01',
    }))).toBe('');
    expect(getDisplayHeadline(makeAlert({
      event: 'Small Craft Advisory',
      headline: 'SMALL CRAFT ADVISORY THROUGH LATE TONIGHT',
    }))).toBe('');
  });

  it('smart: filters BoM reverse redundancy (event starts with headline)', () => {
    expect(getDisplayHeadline(makeAlert({
      event: 'Flood Warning for Bokhara River',
      headline: 'Flood Warning',
    }))).toBe('');
    expect(getDisplayHeadline(makeAlert({
      event: 'Sheep Graziers Warning for Upper Western forecast district',
      headline: 'Sheep Graziers Warning',
    }))).toBe('');
  });

  it('smart: shows genuinely additive headlines verbatim', () => {
    expect(getDisplayHeadline(makeAlert({
      event: 'Special Weather Statement',
      headline: 'INCREASED THREAT FOR GRASS AND BRUSH FIRE SPREAD THIS AFTERNOON',
    }))).toBe('INCREASED THREAT FOR GRASS AND BRUSH FIRE SPREAD THIS AFTERNOON');
    expect(getDisplayHeadline(makeAlert({
      event: 'Moderate Wind warning',
      headline: 'Wind - Warnings for Texel - The Netherlands',
    }))).toBe('Wind - Warnings for Texel - The Netherlands');
  });

  it('raw: shows all headlines verbatim regardless of overlap', () => {
    expect(getDisplayHeadline(makeAlert({
      event: 'Flood Warning',
      headline: 'FLOOD WARNING REMAINS IN EFFECT UNTIL WEDNESDAY, APRIL 01',
    }), false)).toBe('FLOOD WARNING REMAINS IN EFFECT UNTIL WEDNESDAY, APRIL 01');
    expect(getDisplayHeadline(makeAlert({
      event: 'Flood Warning for Bokhara River',
      headline: 'Flood Warning',
    }), false)).toBe('Flood Warning');
  });
});

describe('deduplicateAlerts cross-provider', () => {
  const priority: AlertProvider[] = ['nws', 'pirateweather', 'bom'];

  it('returns empty array for empty input', () => {
    expect(deduplicateAlerts([], priority)).toEqual([]);
  });

  it('single alert passes through unchanged', () => {
    const alert = makeAlert({ provider: 'nws' });
    const result = deduplicateAlerts([alert], priority);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test-1');
  });

  it('keeps higher-priority provider when event + endsTs match across providers', () => {
    const nws = makeAlert({ id: 'nws-1', provider: 'nws', event: 'Flood Warning', endsTs: 5000 });
    const pw = makeAlert({ id: 'pw-1', provider: 'pirateweather', event: 'Flood Warning', endsTs: 5000 });
    const result = deduplicateAlerts([nws, pw], priority);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('nws-1');
  });

  it('keeps both when event matches but endsTs differs', () => {
    const a = makeAlert({ id: 'a', provider: 'nws', event: 'Flood Warning', endsTs: 5000 });
    const b = makeAlert({ id: 'b', provider: 'pirateweather', event: 'Flood Warning', endsTs: 6000 });
    const result = deduplicateAlerts([a, b], priority);
    expect(result).toHaveLength(2);
  });

  it('keeps both when endsTs matches but event differs', () => {
    const a = makeAlert({ id: 'a', provider: 'nws', event: 'Flood Warning', endsTs: 5000 });
    const b = makeAlert({ id: 'b', provider: 'pirateweather', event: 'Wind Advisory', endsTs: 5000 });
    const result = deduplicateAlerts([a, b], priority);
    expect(result).toHaveLength(2);
  });

  it('never matches alerts with endsTs === 0', () => {
    const a = makeAlert({ id: 'a', provider: 'nws', event: 'Flood Warning', endsTs: 0 });
    const b = makeAlert({ id: 'b', provider: 'pirateweather', event: 'Flood Warning', endsTs: 0 });
    const result = deduplicateAlerts([a, b], priority);
    expect(result).toHaveLength(2);
  });

  it('three providers, two matching — keeps highest priority', () => {
    const bom = makeAlert({ id: 'bom-1', provider: 'bom', event: 'Flood Warning', endsTs: 5000 });
    const pw = makeAlert({ id: 'pw-1', provider: 'pirateweather', event: 'Flood Warning', endsTs: 5000 });
    const nws = makeAlert({ id: 'nws-1', provider: 'nws', event: 'Flood Warning', endsTs: 5000 });
    const result = deduplicateAlerts([bom, pw, nws], priority);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('nws-1');
  });

  it('preserves all alerts from same provider with different within-provider keys', () => {
    const a = makeAlert({ id: 'a', provider: 'nws', event: 'Flood Warning', endsTs: 5000, severity: 'severe' });
    const b = makeAlert({ id: 'b', provider: 'nws', event: 'Flood Warning', endsTs: 5000, severity: 'moderate' });
    const result = deduplicateAlerts([a, b], priority);
    expect(result).toHaveLength(2);
  });

  it('mixed: some match cross-provider, some do not — correct filtering and ordering', () => {
    const nwsFlood = makeAlert({ id: 'nws-flood', provider: 'nws', event: 'Flood Warning', endsTs: 5000 });
    const pwFlood = makeAlert({ id: 'pw-flood', provider: 'pirateweather', event: 'Flood Warning', endsTs: 5000 });
    const nwsWind = makeAlert({ id: 'nws-wind', provider: 'nws', event: 'Wind Advisory', endsTs: 7000 });
    const result = deduplicateAlerts([nwsFlood, pwFlood, nwsWind], priority);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('nws-flood');
    expect(result[1].id).toBe('nws-wind');
  });

  it('second entity provider loses to first entity provider', () => {
    const pwFirst: AlertProvider[] = ['pirateweather', 'nws'];
    const nws = makeAlert({ id: 'nws-1', provider: 'nws', event: 'Flood Warning', endsTs: 5000 });
    const pw = makeAlert({ id: 'pw-1', provider: 'pirateweather', event: 'Flood Warning', endsTs: 5000 });
    const result = deduplicateAlerts([nws, pw], pwFirst);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('pw-1');
  });

  it('is a no-op when only one provider in priority list', () => {
    const a = makeAlert({ id: 'a', provider: 'nws', event: 'Flood Warning', endsTs: 5000, severity: 'severe' });
    const b = makeAlert({ id: 'b', provider: 'nws', event: 'Flood Warning', endsTs: 5000, severity: 'moderate' });
    const result = deduplicateAlerts([a, b], ['nws']);
    expect(result).toHaveLength(2);
  });
});

describe('reflowAlertText', () => {
  it('joins single newlines within a paragraph', () => {
    const input = 'The National Weather Service in Denver has issued a\nRed Flag Warning for wind and low relative humidity.';
    expect(reflowAlertText(input)).toBe(
      'The National Weather Service in Denver has issued a Red Flag Warning for wind and low relative humidity.',
    );
  });

  it('preserves paragraph breaks (double newlines)', () => {
    const input = 'First paragraph line one\nline two.\n\nSecond paragraph line one\nline two.';
    expect(reflowAlertText(input)).toBe(
      'First paragraph line one line two.\n\nSecond paragraph line one line two.',
    );
  });

  it('preserves NWS bullet structure separated by blank lines', () => {
    const input = '* AFFECTED AREA...Fire Weather Zones 238, 239,\n240, 241, 242.\n\n* TIMING...From 8 AM to 7 PM MDT Friday.';
    expect(reflowAlertText(input)).toBe(
      '* AFFECTED AREA...Fire Weather Zones 238, 239, 240, 241, 242.\n\n* TIMING...From 8 AM to 7 PM MDT Friday.',
    );
  });

  it('collapses multiple spaces after join', () => {
    const input = 'word   one\n  word two';
    expect(reflowAlertText(input)).toBe('word one word two');
  });

  it('returns empty string for empty/whitespace input', () => {
    expect(reflowAlertText('')).toBe('');
    expect(reflowAlertText('   ')).toBe('');
  });

  it('leaves already-clean text unchanged', () => {
    const input = 'A clean single-line paragraph.\n\nAnother paragraph.';
    expect(reflowAlertText(input)).toBe(input);
  });

  it('preserves DWD bullet lists with · markers and indentation', () => {
    const input = 'Hinweis auf:\n · mögliche Frostschäden\n\nHandlungsempfehlungen:\n · ggf. Frostschutzmaßnahmen ergreifen';
    expect(reflowAlertText(input)).toBe(
      'Hinweis auf:\n · mögliche Frostschäden\n\nHandlungsempfehlungen:\n · ggf. Frostschutzmaßnahmen ergreifen',
    );
  });

  it('preserves lines after a colon-terminated header', () => {
    const input = 'Section header:\nsome detail on next line';
    expect(reflowAlertText(input)).toBe('Section header:\nsome detail on next line');
  });

  it('preserves dash bullet lists', () => {
    const input = 'Actions:\n- Stay indoors\n- Close windows';
    expect(reflowAlertText(input)).toBe('Actions:\n- Stay indoors\n- Close windows');
  });

  it('preserves NWS period forecast lines (.TONIGHT... .SUN... etc)', () => {
    const input =
      '.TONIGHT...NW wind 25 kt. Seas 6 ft. Freezing spray.\n' +
      '.SUN...W wind 25 kt. Seas 5 ft. Freezing spray.\n' +
      '.SUN NIGHT...W wind 25 kt. Seas 6 ft. Freezing spray.\n' +
      '.MON AND MON NIGHT...W wind 15 kt. Seas 4 ft.';
    expect(reflowAlertText(input)).toBe(input);
  });

  it('reflows prose above NWS period forecast lines', () => {
    const input =
      'Wind forecasts reflect the predominant speed and\n' +
      'direction expected.\n\n' +
      '.TONIGHT...NW wind 25 kt.\n' +
      '.SUN...W wind 25 kt.';
    expect(reflowAlertText(input)).toBe(
      'Wind forecasts reflect the predominant speed and direction expected.\n\n' +
      '.TONIGHT...NW wind 25 kt.\n' +
      '.SUN...W wind 25 kt.',
    );
  });
});

