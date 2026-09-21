/**
 * Overrides that may set a field to `undefined` on purpose.
 *
 * `Partial<T>` forbids that under `exactOptionalPropertyTypes`, but a test that
 * checks how a parser copes with a missing field needs to write exactly that.
 */
export type Overrides<T> = { [K in keyof T]?: T[K] | undefined };

import type { WeatherAlertsCardConfig } from '../src/types';

/**
 * A config as device- and source-mode tests write it: no `entity`. The card
 * accepts that at runtime (those modes resolve their own entities), but the
 * config type declares `entity` required, so tests that call `setConfig`
 * with such a literal type it through here.
 */
export type LooseConfig = Omit<WeatherAlertsCardConfig, 'entity'> & { entity?: string };
