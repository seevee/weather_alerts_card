import { describe, it, expect } from 'vitest';
import { cachedDateTimeFormat, cachedNumberFormat } from '../src/utils';

// The cache replaced every toLocaleDateString / toLocaleTimeString call with a
// reused Intl.DateTimeFormat. That swap is only sound if the two produce the
// same text, so this pins the equivalence over the shapes the card formats.

const LOCALES = ['en', 'en-GB', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'pt-BR', 'zh-Hans', 'sr', 'sr-Latn'];
const ZONES = [undefined, 'America/Denver', 'Europe/Berlin', 'Asia/Kolkata', 'Pacific/Chatham'];
// A summer instant, a winter one and a DST-change morning, so offsets and
// abbreviations vary across the run.
const INSTANTS = [Date.UTC(2026, 6, 4, 18, 5), Date.UTC(2026, 0, 15, 3, 45), Date.UTC(2026, 2, 8, 9, 30)].map(t => new Date(t));

describe('cached formatters match the toLocale*String calls they replaced', () => {
  it('date with only a time zone equals toLocaleDateString', () => {
    for (const lang of LOCALES) for (const timeZone of ZONES) for (const d of INSTANTS) {
      expect(cachedDateTimeFormat(lang, { timeZone }).format(d)).toBe(d.toLocaleDateString(lang, { timeZone }));
    }
  });

  it('hour and minute equal toLocaleTimeString, for every hour field and 12/24 h choice', () => {
    for (const lang of LOCALES) for (const timeZone of ZONES) for (const d of INSTANTS) {
      for (const hour of ['2-digit', 'numeric'] as const) for (const hour12 of [undefined, true, false]) {
        const opts: Intl.DateTimeFormatOptions = { hour, minute: '2-digit', timeZone };
        if (hour12 !== undefined) opts.hour12 = hour12;
        expect(cachedDateTimeFormat(lang, opts).format(d)).toBe(d.toLocaleTimeString(lang, opts));
      }
    }
  });
});

describe('the formatter cache', () => {
  it('hands back one instance per locale and options', () => {
    const a = cachedDateTimeFormat('de', { hour: 'numeric', timeZone: 'Europe/Berlin' });
    expect(cachedDateTimeFormat('de', { hour: 'numeric', timeZone: 'Europe/Berlin' })).toBe(a);
    expect(cachedDateTimeFormat('fr', { hour: 'numeric', timeZone: 'Europe/Berlin' })).not.toBe(a);
    expect(cachedDateTimeFormat('de', { hour: '2-digit', timeZone: 'Europe/Berlin' })).not.toBe(a);
    expect(cachedNumberFormat('de', { maximumFractionDigits: 1 })).toBe(cachedNumberFormat('de', { maximumFractionDigits: 1 }));
  });

  it('treats an undefined option as absent, as Intl does', () => {
    expect(cachedDateTimeFormat('en', { timeZone: undefined })).toBe(cachedDateTimeFormat('en', {}));
  });

  it('still throws on a zone Intl rejects, every time, and caches nothing for it', () => {
    // Callers catch this (tzOffsetSeconds falls back to the browser offset),
    // so a bad zone must keep throwing rather than come back cached.
    for (let i = 0; i < 2; i++) {
      expect(() => cachedDateTimeFormat('en', { timeZone: 'Not/AZone' })).toThrow(RangeError);
    }
  });

  it('keeps working past its size backstop', () => {
    for (let i = 0; i < 300; i++) cachedNumberFormat('en', { maximumFractionDigits: i % 21 });
    expect(cachedNumberFormat('en', { maximumFractionDigits: 2 }).format(1.234)).toBe('1.23');
  });
});
