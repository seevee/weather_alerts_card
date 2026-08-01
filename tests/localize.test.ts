import { describe, it, expect, afterEach } from 'vitest';
import { t } from '../src/localize';
import { translations, type TranslationMap } from '../src/translations';

describe('t()', () => {
  it('returns English string for known key', () => {
    expect(t('card.no_alerts', 'en')).toBe('No active alerts.');
  });

  it('returns French string for known key', () => {
    expect(t('card.no_alerts', 'fr')).toBe('Aucune alerte active.');
  });

  it('returns Spanish string for known key', () => {
    expect(t('card.no_alerts', 'es')).toBe('Sin alertas activas.');
  });

  it('falls back to English for unknown language', () => {
    expect(t('card.no_alerts', 'ja')).toBe('No active alerts.');
  });

  it('strips region subtag (fr-CA -> fr)', () => {
    expect(t('card.no_alerts', 'fr-CA')).toBe('Aucune alerte active.');
  });

  it('strips region subtag (es-MX -> es)', () => {
    expect(t('card.no_alerts', 'es-MX')).toBe('Sin alertas activas.');
  });

  it('returns the key itself for unknown key', () => {
    expect(t('unknown.key', 'en')).toBe('unknown.key');
  });

  it('interpolates named parameters', () => {
    expect(t('card.zones_count', 'en', { count: 3 })).toBe('3 zones');
  });

  it('replaces every occurrence of a repeated placeholder', () => {
    // An unknown key falls through to the raw key verbatim, letting us assert
    // multi-occurrence substitution without depending on a translation string.
    expect(t('{x} and {x}', 'en', { x: 'A' })).toBe('A and A');
  });

  it('interpolates named parameters in French', () => {
    expect(t('card.sources_unavailable_named', 'fr', { name: 'NWS Boulder' }))
      .toBe('NWS Boulder indisponible');
  });

  it('interpolates singular zone count', () => {
    expect(t('card.zone_count_singular', 'en', { count: 1 })).toBe('1 zone');
  });

  it('interpolates the degraded-badge named string (en + de)', () => {
    expect(t('card.sources_unavailable_named', 'en', { name: 'NWS Boulder' }))
      .toBe('NWS Boulder unavailable');
    expect(t('card.sources_unavailable_named', 'de', { name: 'NWS Boulder' }))
      .toBe('NWS Boulder nicht verfügbar');
  });

  it('interpolates the degraded-badge count string (en + fr)', () => {
    expect(t('card.sources_unavailable_count', 'en', { count: 2 }))
      .toBe('2 sources unavailable');
    expect(t('card.sources_unavailable_count', 'fr', { count: 2 }))
      .toBe('2 sources indisponibles');
  });

  it('handles case-insensitive language codes', () => {
    expect(t('card.no_alerts', 'FR')).toBe('Aucune alerte active.');
  });

  it('returns badge severity labels in English', () => {
    expect(t('badge.severity_extreme', 'en')).toBe('Extreme');
    expect(t('badge.severity_severe', 'en')).toBe('Severe');
    expect(t('badge.severity_moderate', 'en')).toBe('Moderate');
    expect(t('badge.severity_minor', 'en')).toBe('Minor');
    expect(t('badge.severity_unknown', 'en')).toBe('Unknown');
  });

  it('returns badge certainty labels in English', () => {
    expect(t('badge.certainty_observed', 'en')).toBe('Observed');
    expect(t('badge.certainty_likely', 'en')).toBe('Likely');
    expect(t('badge.certainty_possible', 'en')).toBe('Possible');
    expect(t('badge.certainty_unlikely', 'en')).toBe('Unlikely');
    expect(t('badge.certainty_unknown', 'en')).toBe('Unknown');
  });

  it('returns badge severity labels in French', () => {
    expect(t('badge.severity_extreme', 'fr')).toBe('Extrême');
    expect(t('badge.severity_severe', 'fr')).toBe('Grave');
    expect(t('badge.severity_moderate', 'fr')).toBe('Modérée');
    expect(t('badge.severity_minor', 'fr')).toBe('Mineure');
    expect(t('badge.severity_unknown', 'fr')).toBe('Inconnue');
  });

  it('returns badge certainty labels in French', () => {
    expect(t('badge.certainty_observed', 'fr')).toBe('Observée');
    expect(t('badge.certainty_likely', 'fr')).toBe('Probable');
    expect(t('badge.certainty_possible', 'fr')).toBe('Possible');
    expect(t('badge.certainty_unlikely', 'fr')).toBe('Improbable');
    expect(t('badge.certainty_unknown', 'fr')).toBe('Inconnue');
  });

  it('returns badge severity labels in Spanish', () => {
    expect(t('badge.severity_extreme', 'es')).toBe('Extrema');
    expect(t('badge.severity_severe', 'es')).toBe('Grave');
    expect(t('badge.severity_moderate', 'es')).toBe('Moderada');
    expect(t('badge.severity_minor', 'es')).toBe('Menor');
    expect(t('badge.severity_unknown', 'es')).toBe('Desconocida');
  });

  it('returns badge certainty labels in Spanish', () => {
    expect(t('badge.certainty_observed', 'es')).toBe('Observada');
    expect(t('badge.certainty_likely', 'es')).toBe('Probable');
    expect(t('badge.certainty_possible', 'es')).toBe('Posible');
    expect(t('badge.certainty_unlikely', 'es')).toBe('Improbable');
    expect(t('badge.certainty_unknown', 'es')).toBe('Desconocida');
  });

  it('returns Italian string for known key', () => {
    expect(t('card.no_alerts', 'it')).toBe('Nessuna allerta attiva.');
  });

  it('strips region subtag (it-IT -> it)', () => {
    expect(t('card.no_alerts', 'it-IT')).toBe('Nessuna allerta attiva.');
  });

  it('returns badge severity labels in Italian', () => {
    expect(t('badge.severity_extreme', 'it')).toBe('Estrema');
    expect(t('badge.severity_severe', 'it')).toBe('Grave');
    expect(t('badge.severity_moderate', 'it')).toBe('Moderata');
    expect(t('badge.severity_minor', 'it')).toBe('Lieve');
    expect(t('badge.severity_unknown', 'it')).toBe('Sconosciuta');
  });

  it('returns badge certainty labels in Italian', () => {
    expect(t('badge.certainty_observed', 'it')).toBe('Osservata');
    expect(t('badge.certainty_likely', 'it')).toBe('Probabile');
    expect(t('badge.certainty_possible', 'it')).toBe('Possibile');
    expect(t('badge.certainty_unlikely', 'it')).toBe('Improbabile');
    expect(t('badge.certainty_unknown', 'it')).toBe('Sconosciuta');
  });

  it('returns German string for known key', () => {
    expect(t('card.no_alerts', 'de')).toBe('Keine aktiven Warnungen.');
  });

  it('strips region subtag (de-DE -> de)', () => {
    expect(t('card.no_alerts', 'de-DE')).toBe('Keine aktiven Warnungen.');
  });

  it('returns badge severity labels in German', () => {
    expect(t('badge.severity_extreme', 'de')).toBe('Extrem');
    expect(t('badge.severity_severe', 'de')).toBe('Schwer');
    expect(t('badge.severity_moderate', 'de')).toBe('Mäßig');
    expect(t('badge.severity_minor', 'de')).toBe('Gering');
    expect(t('badge.severity_unknown', 'de')).toBe('Unbekannt');
  });

  it('returns badge certainty labels in German', () => {
    expect(t('badge.certainty_observed', 'de')).toBe('Beobachtet');
    expect(t('badge.certainty_likely', 'de')).toBe('Wahrscheinlich');
    expect(t('badge.certainty_possible', 'de')).toBe('Möglich');
    expect(t('badge.certainty_unlikely', 'de')).toBe('Unwahrscheinlich');
    expect(t('badge.certainty_unknown', 'de')).toBe('Unbekannt');
  });

  // No registered locale is script- or region-qualified yet, so these register
  // a stub to exercise those branches of the lookup. Safe to mutate: the parity
  // checks below snapshot the registry at collection time, before any test body
  // runs, so an injected locale never reaches them.
  describe('script and region fallback', () => {
    const stub = { 'card.no_alerts': 'STUB' } as TranslationMap;
    const register = () => {
      translations['pt-BR'] = stub;
    };

    afterEach(() => {
      delete translations['pt-BR'];
    });

    it('matches an exact locale code ahead of the base subtag', () => {
      register();
      expect(t('card.no_alerts', 'pt-BR')).toBe('STUB');
    });

    it('matches a locale code case-insensitively', () => {
      register();
      expect(t('card.no_alerts', 'pt-br')).toBe('STUB');
    });

    // A pt-PT reader is better served pt-BR than English: same language, and
    // closer to what they asked for than falling back to the source language.
    it('falls back to a sibling locale sharing the base subtag', () => {
      register();
      expect(t('card.no_alerts', 'pt-PT')).toBe('STUB');
    });

    it('falls back to a sibling locale for the bare base subtag', () => {
      register();
      expect(t('card.no_alerts', 'pt')).toBe('STUB');
    });

    // Sibling matching picks the map; per-key English fallback still applies
    // inside it, so an untranslated key is not left as a raw key name.
    it('still falls back to English per key within a matched sibling', () => {
      register();
      expect(t('card.dismiss', 'pt-PT')).toBe('Dismiss');
    });

    it('does not treat an unrelated language as a sibling', () => {
      register();
      expect(t('card.no_alerts', 'ja')).toBe('No active alerts.');
    });
  });

  // Parity is derived from the registry rather than a hardcoded key list. The
  // previous version repeated ~95 of the 166 keys across four near-identical
  // arrays, so every key added since drifted unguarded. Registering a locale in
  // src/translations/index.ts now covers it here automatically.
  const enKeys = Object.keys(translations.en);
  const otherLocales = Object.keys(translations).filter((lang) => lang !== 'en');

  it('discovers the locale registry', () => {
    // Without this the per-locale checks below would vacuously pass on an
    // empty list if the registry were moved or renamed.
    expect(enKeys.length).toBeGreaterThan(0);
    expect(otherLocales.length).toBeGreaterThan(0);
  });

  // Hard failure: a key absent from `en` is stale or misspelled, so it never
  // renders — and it is always fixable by whoever introduced it.
  it.each(otherLocales)('%s declares no keys unknown to en', (lang) => {
    const unknown = Object.keys(translations[lang]).filter((key) => !(key in translations.en));
    expect(
      unknown,
      `${lang}.ts declares keys absent from en.ts (stale or misspelled, and never rendered)`,
    ).toEqual([]);
  });

  // Hard failure, for the same reason as a stale key: a present-but-wrong
  // translation is invisible to both other checks. Drop the `{count}` from
  // `card.sources_unavailable_count` and the key still exists, so completeness
  // passes, but the string renders with no number in it. An invented token is
  // worse — `t()` interpolates by name, so an unmatched one renders literally
  // as `{foo}`. Either way it is fixable by whoever wrote the line.
  //
  // Compared as a set, not a sequence: a translation may legitimately use a
  // token once where English uses it twice, or reorder them.
  const placeholders = (value: string) =>
    [...new Set([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
  const fmt = (tokens: string[]) => (tokens.length ? tokens.map((tok) => `{${tok}}`).join(' ') : 'none');

  it.each(otherLocales)('%s preserves the placeholders en declares', (lang) => {
    const mismatched = Object.keys(translations[lang])
      .filter((key) => key in translations.en)
      .map((key) => ({ key, want: placeholders(translations.en[key]), got: placeholders(translations[lang][key]) }))
      .filter(({ want, got }) => want.join() !== got.join())
      .map(({ key, want, got }) => `${key}: en has ${fmt(want)}, ${lang} has ${fmt(got)}`);

    expect(
      mismatched,
      `${lang}.ts has values whose {placeholder} tokens differ from en.ts (renders a literal {token}, or silently drops one)`,
    ).toEqual([]);
  });

  // Warning, not failure: t() falls back to English per key, so a lagging
  // locale is cosmetic, and the author of a feature PR is usually not the
  // person able to translate it. Set I18N_STRICT=1 to promote to a failure for
  // an audit run.
  it.each(otherLocales)('%s is complete (drift warns, does not fail)', (lang) => {
    const missing = enKeys.filter((key) => !(key in translations[lang]));
    if (missing.length === 0) return;

    const message =
      `${lang}.ts is missing ${missing.length} key(s) present in en.ts: ${missing.join(', ')}`;
    if (process.env.I18N_STRICT) expect.fail(message);

    // Written straight to stderr, not console.warn: vitest's default reporter
    // buffers console output from *passing* tests and drops it when stdout is
    // not a TTY — i.e. exactly in CI, where this notice is the only signal.
    process.stderr.write(`[i18n drift] ${message}\n`);
  });
});
