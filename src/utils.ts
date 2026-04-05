import DOMPurify from 'dompurify';
import { WeatherAlert, AlertProgress } from './types';
import { t } from './localize';

const ALERT_HTML_TAGS = ['a', 'b', 'br', 'em', 'i', 'li', 'ol', 'p', 'strong', 'ul'];

// Enforce safe link attributes after sanitization
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function sanitizeAlertHtml(text: string): string {
  if (!text) return '';
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: ALERT_HTML_TAGS,
    ALLOWED_ATTR: ['href'],
  }) as string;
}

const WEATHER_ICONS: [readonly string[], string][] = [
  // Severe — specific phrases first
  [['tornado'], 'mdi:weather-tornado'],
  [['tsunami'], 'mdi:tsunami'],
  [['hurricane', 'tropical', 'typhoon', 'cyclone'], 'mdi:weather-hurricane'],
  [['thunderstorm', 't-storm', 'gewitter'], 'mdi:weather-lightning'],
  [['hail', 'hagel'], 'mdi:weather-hail'],
  // Flooding & rain
  [['flood', 'hydrologic', 'storm surge', 'hochwasser'], 'mdi:home-flood'],
  [['rain', 'shower', 'precipitation', 'starkregen', 'dauerregen'], 'mdi:weather-pouring'],
  // Winter weather
  [['snow', 'blizzard', 'winter', 'schnee', 'schneesturm'], 'mdi:weather-snowy-heavy'],
  [['sleet'], 'mdi:weather-snowy-rainy'],
  [['ice', 'freeze', 'frost', 'glätte', 'glatteis'], 'mdi:snowflake'],
  [['cold', 'chill', 'low temperature', 'kälte'], 'mdi:thermometer-low'],
  // Geologic
  [['landslide', 'avalanche', 'lawine'], 'mdi:landslide'],
  [['volcano', 'ashfall', 'vog'], 'mdi:volcano'],
  // Airborne hazards
  [['dust', 'sand'], 'mdi:weather-dust'],
  [['smoke'], 'mdi:smoke'],
  [['air quality', 'air stagnation'], 'mdi:air-filter'],
  // Fire & heat
  [['fire', 'red flag', 'waldbrand'], 'mdi:fire'],
  [['heat', 'high temperature', 'hitze'], 'mdi:weather-sunny-alert'],
  [['drought', 'trockenheit'], 'mdi:water-off'],
  [['fog', 'nebel'], 'mdi:weather-fog'],
  // Wind — "cold"/"chill"/"kälte" must precede "wind" so "Wind Chill" gets thermometer
  [['sheep', 'grazier'], 'mdi:weather-windy-variant'],
  [['gale', 'squall'], 'mdi:weather-windy'],
  [['wind', 'sturm', 'orkan', 'böen'], 'mdi:weather-windy'],
  // Marine & coastal
  [['small craft'], 'mdi:sail-boat'],
  [['rip current'], 'mdi:wave'],
  [['surf', 'marine', 'coastal', 'seas'], 'mdi:waves'],
];

export function getWeatherIcon(event: string): string {
  const e = event.toLowerCase();
  for (const [patterns, icon] of WEATHER_ICONS) {
    if (patterns.some(p => e.includes(p))) return icon;
  }
  return 'mdi:alert-circle-outline';
}

const CERTAINTY_ICONS: [readonly string[], string][] = [
  [['likely'], 'mdi:check-decagram'],
  [['observed'], 'mdi:eye-check'],
  [['possible', 'unlikely'], 'mdi:help-circle-outline'],
];

export function getCertaintyIcon(certainty: string): string {
  const c = certainty.toLowerCase();
  for (const [patterns, icon] of CERTAINTY_ICONS) {
    if (patterns.some(p => c.includes(p))) return icon;
  }
  return 'mdi:bullseye-arrow';
}

// Priority-ordered: more specific phrases before broad fallbacks
const NWS_EVENT_COLORS: [readonly string[], string, string][] = [
  [['tornado warning'],                          '#FF0000', '255, 0, 0'],
  [['tornado watch'],                            '#FFFF00', '255, 255, 0'],
  [['extreme wind warning'],                     '#FF8C00', '255, 140, 0'],
  [['hurricane warning'],                        '#DC143C', '220, 20, 60'],
  [['excessive heat warning'],                   '#C71585', '199, 21, 133'],
  [['flash flood warning', 'flash flood stmt'],  '#8B0000', '139, 0, 0'],
  [['flash flood watch'],                        '#2E8B57', '46, 139, 87'],
  [['flash flood advisory'],                     '#00FF7F', '0, 255, 127'],
  [['severe thunderstorm warning'],              '#FFA500', '255, 165, 0'],
  [['severe thunderstorm watch'],                '#DB7093', '219, 112, 147'],
  [['blizzard warning'],                         '#FF4500', '255, 69, 0'],
  [['ice storm warning'],                        '#8B008B', '139, 0, 139'],
  [['winter storm warning'],                     '#FF69B4', '255, 105, 180'],
  [['winter storm watch'],                       '#4682B4', '70, 130, 180'],
  [['high wind warning'],                        '#DAA520', '218, 165, 32'],
  [['wind chill warning'],                       '#B0C4DE', '176, 196, 222'],
  [['red flag warning', 'fire weather watch'],   '#FF4500', '255, 69, 0'],
  [['tsunami warning'],                          '#FD6347', '253, 99, 71'],
  [['heat advisory'],                            '#FF7F50', '255, 127, 80'],
  [['dense fog advisory'],                       '#708090', '112, 128, 144'],
  [['frost advisory'],                           '#6495ED', '100, 149, 237'],
  [['freeze warning'],                           '#483D8B', '72, 61, 139'],
  [['wind advisory'],                            '#D2B48C', '210, 180, 140'],
  [['winter weather advisory'],                  '#7B68EE', '123, 104, 238'],
  // Broad fallbacks
  [['tornado'],                                  '#FF0000', '255, 0, 0'],
  [['hurricane', 'typhoon', 'tropical storm'],   '#DC143C', '220, 20, 60'],
  [['flood'],                                    '#228B22', '34, 139, 34'],
  [['blizzard', 'ice storm'],                    '#FF4500', '255, 69, 0'],
  [['snow', 'winter', 'blizzard'],               '#1E90FF', '30, 144, 255'],
  [['freeze', 'frost', 'ice'],                   '#6495ED', '100, 149, 237'],
  [['wind'],                                     '#D2B48C', '210, 180, 140'],
  [['heat'],                                     '#FF7F50', '255, 127, 80'],
  [['fire', 'red flag'],                         '#FF4500', '255, 69, 0'],
  [['fog'],                                      '#708090', '112, 128, 144'],
  [['tsunami'],                                  '#FD6347', '253, 99, 71'],
];

function getBadgeTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.18 ? '#1a1a1a' : 'var(--text-primary-color, white)';
}

export function getNwsEventColor(event: string): { color: string; rgb: string; textColor: string } {
  const e = event.toLowerCase();
  for (const [patterns, color, rgb] of NWS_EVENT_COLORS) {
    if (patterns.some(p => e.includes(p))) return { color, rgb, textColor: getBadgeTextColor(color) };
  }
  return { color: '#808080', rgb: '128, 128, 128', textColor: getBadgeTextColor('#808080') };
}

// MeteoAlarm official awareness level colors
const METEOALARM_SEVERITY_COLORS: Record<string, [string, string]> = {
  extreme: ['#D8001E', '216, 0, 30'],   // Red
  severe:  ['#FF9900', '255, 153, 0'],   // Orange
  moderate:['#FFC800', '255, 200, 0'],   // Yellow
  minor:   ['#88C840', '136, 200, 64'],  // Green
};

export function getMeteoAlarmColor(severity: string): { color: string; rgb: string; textColor: string } {
  const entry = METEOALARM_SEVERITY_COLORS[severity];
  if (entry) return { color: entry[0], rgb: entry[1], textColor: getBadgeTextColor(entry[0]) };
  return { color: '#808080', rgb: '128, 128, 128', textColor: getBadgeTextColor('#808080') };
}

export function parseTimestamp(raw: string | undefined | null): number {
  if (!raw || raw === 'None' || raw.trim() === '') return 0;
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? 0 : d.getTime() / 1000;
}

export function computeAlertProgress(alert: WeatherAlert): AlertProgress {
  const nowTs = Date.now() / 1000;

  const sentTs = alert.sentTs;
  const onsetTsDefault = sentTs > 0 ? sentTs : nowTs;
  let onsetTs = alert.onsetTs;
  if (onsetTs === 0) onsetTs = onsetTsDefault;

  const endsTsDefault = onsetTs + 3600;
  let endsTs = alert.endsTs;
  if (endsTs === 0) endsTs = endsTsDefault;

  const hasEndTime = alert.endsTs > 0;
  const isActive = nowTs >= onsetTs;
  const isExpired = hasEndTime && nowTs >= endsTs;

  let lowTs: number, highTs: number, progressTs: number, phaseText: string;
  if (isExpired) {
    lowTs = onsetTs;
    highTs = endsTs;
    progressTs = endsTs;
    phaseText = 'Expired';
  } else if (isActive) {
    lowTs = onsetTs;
    highTs = endsTs;
    progressTs = nowTs;
    phaseText = 'Active';
  } else {
    lowTs = nowTs;
    highTs = endsTs;
    progressTs = onsetTs;
    phaseText = 'Preparation';
  }

  const rawDuration = highTs - lowTs;
  const safeDuration = rawDuration > 0 ? rawDuration : 1;
  const elapsedSec = progressTs - lowTs;
  const rawPct = (elapsedSec / safeDuration) * 100;
  const progressPct = Math.max(0, Math.min(100, Math.round(rawPct * 10) / 10));

  const remainingHours = Math.round(((endsTs - nowTs) / 3600) * 10) / 10;
  const onsetHours = Math.round(((onsetTs - nowTs) / 3600) * 10) / 10;
  const onsetMinutes = Math.round((onsetTs - nowTs) / 60);

  return {
    isActive,
    isExpired,
    phaseText,
    progressPct,
    remainingHours,
    onsetHours,
    onsetMinutes,
    onsetTs,
    endsTs,
    sentTs,
    nowTs,
    hasEndTime,
  };
}

interface HaLocale {
  language: string;
  time_format: 'language' | '12' | '24';
  date_format?: 'language' | 'DMY' | 'MDY' | 'YMD';
  timeZone?: string;  // IANA tz name, e.g. "America/Denver"
}

function timeFormatOptions(locale?: HaLocale): { locale: string | undefined; hour12?: boolean } {
  if (!locale) return { locale: undefined };
  const lang = locale.language;
  if (locale.time_format === '12') return { locale: lang, hour12: true };
  if (locale.time_format === '24') return { locale: lang, hour12: false };
  return { locale: lang };
}

function isSameDay(d1: Date, d2: Date, timeZone?: string): boolean {
  // en-CA gives YYYY-MM-DD, reliable for equality without string parsing
  const fmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone,
  });
  return fmt.format(d1) === fmt.format(d2);
}

function getTzAbbr(d: Date, locale?: HaLocale): string {
  if (!locale?.timeZone) return '';
  const parts = new Intl.DateTimeFormat(locale.language, {
    timeZoneName: 'short',
    timeZone: locale.timeZone,
  }).formatToParts(d);
  return parts.find(p => p.type === 'timeZoneName')?.value ?? '';
}

function formatDate(d: Date, locale?: HaLocale): string {
  const lang = locale?.language;
  const fmt = locale?.date_format;
  const tz = locale?.timeZone;

  if (!fmt || fmt === 'language') {
    return d.toLocaleDateString(lang, { timeZone: tz });
  }

  const parts = new Intl.DateTimeFormat(lang, {
    day: 'numeric', month: 'numeric', year: 'numeric',
    timeZone: tz,
  }).formatToParts(d);

  const day = parts.find(p => p.type === 'day')?.value ?? '';
  const month = parts.find(p => p.type === 'month')?.value ?? '';
  const year = parts.find(p => p.type === 'year')?.value ?? '';

  switch (fmt) {
    case 'DMY': return `${day}/${month}/${year}`;
    case 'MDY': return `${month}/${day}/${year}`;
    case 'YMD': return `${year}/${month}/${day}`;
    default: return d.toLocaleDateString(lang, { timeZone: tz });
  }
}

function formatTime(d: Date, locale: HaLocale | undefined, hour: '2-digit' | 'numeric'): string {
  const fmt = timeFormatOptions(locale);
  const opts: Intl.DateTimeFormatOptions = { hour, minute: '2-digit', timeZone: locale?.timeZone };
  if (fmt.hour12 !== undefined) opts.hour12 = fmt.hour12;
  return d.toLocaleTimeString(fmt.locale, opts);
}

export function formatProgressTimestamp(ts: number, locale?: HaLocale, lang = 'en'): string {
  if (ts <= 0) return t('progress.na', lang);
  const d = new Date(ts * 1000);
  const now = new Date();
  const tzAbbr = getTzAbbr(d, locale);
  const time = formatTime(d, locale, '2-digit');
  const timeWithTz = tzAbbr ? `${time} ${tzAbbr}` : time;
  if (isSameDay(d, now, locale?.timeZone)) return timeWithTz;
  return `${timeWithTz} (${formatDate(d, locale)})`;
}

export function formatLocalTimestamp(ts: number, locale?: HaLocale, lang = 'en'): string {
  if (ts <= 100) return t('progress.na', lang);
  const d = new Date(ts * 1000);
  const tzAbbr = getTzAbbr(d, locale);
  const time = formatTime(d, locale, 'numeric');
  const timeStr = tzAbbr ? `${time} ${tzAbbr}` : time;
  return `${formatDate(d, locale)}, ${timeStr}`;
}

export function formatRelativeTime(ts: number, nowTs: number = Date.now() / 1000, lang = 'en'): string {
  const diff = ts - nowTs;
  const abs = Math.abs(diff);
  const past = diff < 0;

  if (abs < 60) return past ? t('time.just_now', lang) : t('time.in_less_than_1m', lang);
  if (abs < 3600) {
    const m = Math.floor(abs / 60);
    return past ? t('time.minutes_ago', lang, { m }) : t('time.in_minutes', lang, { m });
  }
  if (abs < 86400) {
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const dur = m > 0 ? `${h}h ${m}m` : `${h}h`;
    return past ? t('time.hours_ago', lang, { dur }) : t('time.in_hours', lang, { dur });
  }
  const d = Math.floor(abs / 86400);
  return past ? t('time.days_ago', lang, { d }) : t('time.in_days', lang, { d });
}

export function formatDuration(ts: number, nowTs: number = Date.now() / 1000): string {
  const abs = Math.abs(ts - nowTs);
  if (abs < 60) return '<1m';
  if (abs < 3600) {
    const m = Math.floor(abs / 60);
    return `${m}m`;
  }
  if (abs < 86400) {
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(abs / 86400);
  const h = Math.floor((abs % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

/**
 * Extract a meaningful headline for display. Returns empty string if the
 * headline doesn't add useful context beyond the event name.
 *
 * @param smart - When true (default), filters out redundant headlines:
 *   - headline starts with event name (NWS boilerplate like "FLOOD WARNING REMAINS IN EFFECT...")
 *   - event name starts with headline (BoM reverse redundancy like headline="Flood Warning",
 *     event="Flood Warning for Bokhara River")
 *   When false, returns all non-empty headlines verbatim.
 */
export function getDisplayHeadline(alert: WeatherAlert, smart = true): string {
  const raw = (alert.headline || '').trim();
  if (!raw) return '';
  if (!smart) return raw;

  const hLower = raw.toLowerCase().replace(/[.\s]+$/, '');
  const eLower = alert.event.toLowerCase();

  // headline starts with event name → NWS boilerplate (timing/status suffix)
  if (hLower.startsWith(eLower)) return '';
  // event starts with headline → reverse redundancy (BoM: less-specific headline)
  if (eLower.startsWith(hLower)) return '';

  return raw;
}

/**
 * Strip hard line wraps (69-char teletype breaks) from NWS-style alert text
 * while preserving paragraph breaks (double newlines) and structured content
 * (bullet lists with · • - markers, section headers ending with ':').
 *
 * NWS uses '* HEADING...' as section bullets with continuation lines — these
 * are joined. Short-form bullets (· • -) used by DWD/others are kept separate.
 */
export function reflowAlertText(text: string): string {
  if (!text) return '';
  // Short bullet: line starts with optional whitespace then · • or - (not * which NWS uses for headings)
  const shortBullet = /^\s*[·•\-]\s/;
  // NWS period forecast: line starts with .UPPERCASE (e.g. ".TONIGHT...NW wind 25 kt.")
  const nwsPeriod = /^\.[A-Z]/;
  return text
    .split(/\n{2,}/)
    .map(para => {
      const lines = para.split('\n');
      const merged: string[] = [];
      for (const line of lines) {
        if (merged.length === 0) {
          merged.push(line.trimStart());
        } else if (shortBullet.test(line) || nwsPeriod.test(line.trimStart()) || merged[merged.length - 1].trimEnd().endsWith(':')) {
          // Current line is a bullet item or NWS period forecast, or previous line is a header — keep separate
          merged.push(line);
        } else {
          // Join with previous line (strip hard wrap)
          merged[merged.length - 1] += ' ' + line.trimStart();
        }
      }
      return merged.map(l => l.replace(/ {2,}/g, ' ')).map(l => l.trimEnd()).filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

export function normalizeSeverity(severity: string | undefined): string {
  const s = (severity || '').toLowerCase().replace(/\s/g, '');
  if (['extreme', 'severe', 'moderate', 'minor'].includes(s)) return s;
  return 'unknown';
}

const SEVERITY_RANK: Record<string, number> = {
  extreme: 0, severe: 1, moderate: 2, minor: 3, unknown: 4,
};

export function sortAlerts(alerts: WeatherAlert[], order: string): WeatherAlert[] {
  if (order === 'onset') {
    return [...alerts].sort((a, b) => (a.onsetTs || Infinity) - (b.onsetTs || Infinity));
  }
  if (order === 'severity') {
    return [...alerts].sort((a, b) => {
      const diff = (SEVERITY_RANK[a.severity] ?? 4)
                 - (SEVERITY_RANK[b.severity] ?? 4);
      if (diff !== 0) return diff;
      return (a.onsetTs || Infinity) - (b.onsetTs || Infinity);
    });
  }
  return alerts;
}

export function alertMatchesZones(alert: WeatherAlert, zones: Set<string>): boolean {
  return alert.zones.some(z => zones.has(z.toUpperCase()));
}

export function deduplicateAlerts(alerts: WeatherAlert[]): WeatherAlert[] {
  const groups = new Map<string, WeatherAlert[]>();
  const order: string[] = [];

  for (const alert of alerts) {
    const key = `${alert.event}\0${alert.severity}\0${alert.onsetTs}\0${alert.endsTs}\0${alert.provider}`;
    const group = groups.get(key);
    if (group) {
      group.push(alert);
    } else {
      groups.set(key, [alert]);
      order.push(key);
    }
  }

  return order.map(key => {
    const group = groups.get(key)!;
    if (group.length === 1) return group[0];

    const representative = { ...group[0] };
    const zoneSet = new Set<string>();
    const areaDescs = new Set<string>();

    for (const alert of group) {
      for (const z of alert.zones) zoneSet.add(z.toUpperCase());
      if (alert.areaDesc) areaDescs.add(alert.areaDesc);
    }

    representative.zones = [...zoneSet];
    representative.areaDesc = [...areaDescs].join('; ');
    representative.mergedCount = group.length;
    return representative;
  });
}

