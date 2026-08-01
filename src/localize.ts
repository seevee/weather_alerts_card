import { translations, type TranslationMap } from './translations';

// Resolves a Home Assistant language code to a translation map, most specific
// match first: exact code, case-insensitive code, base subtag, then any
// registered locale sharing that base subtag.
//
// That last step is the point of the chain. A zh-Hant reader is better served
// Simplified than English, and pt-PT better served pt-BR — same language, so a
// script or region mismatch is closer to what the user asked for than dropping
// to the source language. CLDR/ICU locale matching scores it the same way.
// Registry order breaks ties if several locales ever share a base subtag.
function resolveMap(lang: string): TranslationMap {
  const lower = lang.toLowerCase();
  const base = lower.split('-')[0];

  if (translations[lang]) return translations[lang];
  if (translations[lower]) return translations[lower];
  if (translations[base]) return translations[base];

  const sibling = Object.keys(translations).find((code) => code.toLowerCase().split('-')[0] === base);
  return sibling ? translations[sibling] : translations.en;
}

export function t(key: string, lang: string, params?: Record<string, string | number>): string {
  const map = resolveMap(lang);
  let value = map[key] ?? translations.en[key] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      // split/join replaces every occurrence — String.replace(str, …) only
      // replaces the first, which would leave repeated placeholders intact.
      value = value.split(`{${k}}`).join(String(v));
    }
  }

  return value;
}
