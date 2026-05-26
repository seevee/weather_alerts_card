import DOMPurify from 'dompurify';
import { WeatherAlert, AlertProgress, AlertProvider, ContrastMode } from './types';
import { t } from './localize';
import { NWS_EVENT_COLORS } from './nws-colors';

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
  [['thunderstorm', 'gewitter'], 'mdi:weather-lightning'],
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
  // Normalize separators to spaces so MeteoAlarm awareness_type labels —
  // which arrive hyphenated/slashed (e.g. "high-temperature", "snow/ice") —
  // match our space-separated keywords.
  const e = event.toLowerCase().replace(/[-/]/g, ' ');
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

// Broad substring-match fallbacks for NWS event names not present in
// NWS_EVENT_COLORS (the help-map-sourced lookup in ./nws-colors.ts).
// Priority-ordered: more specific phrases before broad fallbacks.
// Used only when the full event name doesn't match a help-map entry.
const NWS_COLOR_FALLBACKS: [readonly string[], string][] = [
  [['tornado'],                                '#FF0000'],
  [['hurricane', 'typhoon', 'tropical storm'], '#DC143C'],
  [['flood'],                                  '#228B22'],
  [['blizzard', 'ice storm'],                  '#FF4500'],
  [['snow', 'winter'],                         '#1E90FF'],
  [['freeze', 'frost', 'ice'],                 '#6495ED'],
  [['wind'],                                   '#D2B48C'],
  [['heat'],                                   '#FF7F50'],
  [['fire', 'red flag'],                       '#FF4500'],
  [['fog'],                                    '#708090'],
  [['tsunami'],                                '#FD6347'],
];

// Reference HA card backgrounds used for computing contrast ratios.
// Matches scripts/generate-nws-colors.mjs — the generated table in
// src/nws-colors.ts stores crLight/crDark computed against these values.
const LIGHT_BG = '#ffffff';
const DARK_BG = '#1c1c1e';

// Contrast mode thresholds. Each mode defines a text tier (drives --wac-fg
// for icon/label/countdown, where font weight backstops legibility) and a
// stricter progress tier (drives --wac-progress-fg for the progress-bar
// fill, which has no weight and only needs help when the tint is nearly
// invisible against the card, e.g. yellow Tornado Watch vs white).
// 'subtle' is the default; 'strict' biases toward WCAG AA for users who
// want stronger guarantees; 'off' disables the whole system.
export const CONTRAST_MODE_THRESHOLDS: Record<Exclude<ContrastMode, 'off'>, { text: number; progress: number }> = {
  subtle: { text: 2.0, progress: 1.3 },
  strict: { text: 3.0, progress: 2.0 },
};

export const DEFAULT_CONTRAST_MODE: ContrastMode = 'subtle';

export function resolveContrastMode(v: ContrastMode | undefined): ContrastMode {
  return v ?? DEFAULT_CONTRAST_MODE;
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

interface BoostTags {
  boostLight: boolean;
  boostDark: boolean;
  progressBoostLight: boolean;
  progressBoostDark: boolean;
}

const NO_BOOST: BoostTags = {
  boostLight: false,
  boostDark: false,
  progressBoostLight: false,
  progressBoostDark: false,
};

function tagsFromCrs(crLight: number, crDark: number, mode: ContrastMode): BoostTags {
  if (mode === 'off') return NO_BOOST;
  const { text, progress } = CONTRAST_MODE_THRESHOLDS[mode];
  return {
    boostLight: crLight < text,
    boostDark: crDark < text,
    progressBoostLight: crLight < progress,
    progressBoostDark: crDark < progress,
  };
}

function hexToRgbString(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

// Saturated color pills read cleanest when the label inherits the card
// background color ("knockout" effect) rather than whichever pure black/white
// happens to win the WCAG luminance match. The only case where that falls
// apart is when the badge hex and card bg are nearly the same luminance
// (e.g. yellow on white, dark red on dark), which would collapse the text
// into the background. This threshold of 1.9 keeps tan (~1.97:1 vs white)
// and dark red (~1.7:1 vs dark card) on the "use card-bg" side while
// yanking yellow / near-monochrome cases back to the opposite color.
const BADGE_CARDBG_THRESHOLD = 1.9;

function pickBadgeText(bgHex: string, cardBg: string, opposite: string): string {
  return contrastRatio(bgHex, cardBg) >= BADGE_CARDBG_THRESHOLD ? cardBg : opposite;
}

function getBadgeTextColors(hex: string): { light: string; dark: string } {
  return {
    light: pickBadgeText(hex, LIGHT_BG, '#1a1a1a'),
    dark: pickBadgeText(hex, DARK_BG, '#f5f5f5'),
  };
}

export interface EventColor {
  color: string;
  rgb: string;
  textColorLight: string;
  textColorDark: string;
  boostLight: boolean;
  boostDark: boolean;
  progressBoostLight: boolean;
  progressBoostDark: boolean;
}

function buildEventColor(hex: string, rgb: string, crLight: number, crDark: number, mode: ContrastMode): EventColor {
  const badge = getBadgeTextColors(hex);
  return {
    color: hex,
    rgb,
    textColorLight: badge.light,
    textColorDark: badge.dark,
    ...tagsFromCrs(crLight, crDark, mode),
  };
}

export function getNwsEventColor(event: string, mode: ContrastMode = DEFAULT_CONTRAST_MODE): EventColor {
  const e = event.toLowerCase();
  const direct = NWS_EVENT_COLORS[e];
  if (direct) {
    return buildEventColor(direct.hex, direct.rgb, direct.crLight, direct.crDark, mode);
  }
  for (const [patterns, hex] of NWS_COLOR_FALLBACKS) {
    if (patterns.some(p => e.includes(p))) {
      return buildEventColor(
        hex,
        hexToRgbString(hex),
        contrastRatio(hex, LIGHT_BG),
        contrastRatio(hex, DARK_BG),
        mode,
      );
    }
  }
  const fallback = '#808080';
  return buildEventColor(
    fallback,
    hexToRgbString(fallback),
    contrastRatio(fallback, LIGHT_BG),
    contrastRatio(fallback, DARK_BG),
    mode,
  );
}

// MeteoAlarm official awareness level colors
const METEOALARM_SEVERITY_COLORS: Record<string, string> = {
  extreme: '#D8001E',   // Red
  severe:  '#FF9900',   // Orange
  moderate: '#FFC800',  // Yellow
  minor:   '#88C840',   // Green
};

export function getMeteoAlarmColor(severity: string, mode: ContrastMode = DEFAULT_CONTRAST_MODE): EventColor {
  const hex = METEOALARM_SEVERITY_COLORS[severity] ?? '#808080';
  return buildEventColor(
    hex,
    hexToRgbString(hex),
    contrastRatio(hex, LIGHT_BG),
    contrastRatio(hex, DARK_BG),
    mode,
  );
}

// ECCC public-alert palette (matches the `--alert-*-bg` palette on
// weather.gc.ca, defined in `/204/css/base.css`).
const ECCC_COLOR_PALETTE: Record<string, string> = {
  red:    '#D10000',
  orange: '#FF9500',
  yellow: '#FFFF00',
  grey:   '#656565',
};

// Fallback when colorHint is missing (e.g. non-ECCC alert displayed under
// the eccc theme): pick a reasonable hex from the canonical severity tier.
const ECCC_SEVERITY_FALLBACK: Record<string, string> = {
  extreme:  '#D10000',
  severe:   '#FF9500',
  moderate: '#FFFF00',
  minor:    '#656565',
  unknown:  '#656565',
};

export function getEcccColor(alert: WeatherAlert, mode: ContrastMode = DEFAULT_CONTRAST_MODE): EventColor {
  const hint = alert.colorHint?.toLowerCase();
  const hex = (hint && ECCC_COLOR_PALETTE[hint])
    ?? ECCC_SEVERITY_FALLBACK[alert.severity]
    ?? '#808080';
  return buildEventColor(
    hex,
    hexToRgbString(hex),
    contrastRatio(hex, LIGHT_BG),
    contrastRatio(hex, DARK_BG),
    mode,
  );
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

export const SEVERITY_RANK: Record<string, number> = {
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

export function deduplicateAlerts(
  alerts: WeatherAlert[],
  providerPriority?: AlertProvider[],
): WeatherAlert[] {
  // Phase 1: merge zone-split alerts within the same provider
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

  let result = order.map(key => {
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
    // Use a stable id derived from the merge key rather than group[0].id.
    // The group key (event/severity/onset/ends/provider) is invariant to the
    // order in which the integration emits zone-split alerts, so browser-local
    // dismissals keyed on this id survive upstream array reordering and
    // zone-set churn (zones are intentionally excluded from the dismissal
    // signature, so identity must not depend on them either).
    representative.id = `merged:${key}`;
    return representative;
  });

  // Phase 2: collapse duplicates across providers (e.g., NWS + PirateWeather).
  // Alerts with endsTs === 0 are excluded — can't match without an expiry.
  if (providerPriority && providerPriority.length > 1) {
    const rank = new Map<AlertProvider, number>();
    for (let i = 0; i < providerPriority.length; i++) {
      if (!rank.has(providerPriority[i])) rank.set(providerPriority[i], i);
    }

    const bestProvider = new Map<string, AlertProvider>();
    for (const alert of result) {
      if (alert.endsTs === 0) continue;
      const key = `${alert.event}\0${alert.endsTs}`;
      const current = bestProvider.get(key);
      if (!current || (rank.get(alert.provider) ?? Infinity) < (rank.get(current) ?? Infinity)) {
        bestProvider.set(key, alert.provider);
      }
    }

    result = result.filter(alert => {
      if (alert.endsTs === 0) return true;
      const key = `${alert.event}\0${alert.endsTs}`;
      return alert.provider === bestProvider.get(key);
    });
  }

  return result;
}

