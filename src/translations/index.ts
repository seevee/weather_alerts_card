import type { TranslationMap } from './types';
import { en } from './en';
import { fr } from './fr';
import { es } from './es';
import { it } from './it';
import { de } from './de';
import { zh } from './zh';

// Keyed by Home Assistant locale code. Use the bare language subtag when there
// is only one variant (`fr`, `de`) and the full code when the script or region
// matters (`zh-Hans`, `pt-BR`); `t()` matches the most specific entry and falls
// back within the language before it falls back to English.
//
// Adding a locale means adding a file and one line here; the parity test
// iterates this map, so a new translation is covered the moment it lands.
export const translations: Record<string, TranslationMap> = { en, fr, es, it, de, zh };

export type { TranslationMap };
