import { translations } from './translations';

export function t(key: string, lang: string, params?: Record<string, string | number>): string {
  const baseLang = lang.split('-')[0].toLowerCase();
  const map = translations[baseLang] || translations.en;
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
