import type { TranslationMap } from './types';
import { en } from './en';
import { fr } from './fr';
import { es } from './es';
import { it } from './it';
import { de } from './de';

// Keyed by base language subtag — `t()` strips any region before lookup.
// Adding a locale means adding a file and one line here; the parity test
// iterates this map, so a new translation is covered the moment it lands.
export const translations: Record<string, TranslationMap> = { en, fr, es, it, de };

export type { TranslationMap };
