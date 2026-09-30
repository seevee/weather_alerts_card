import { configDefaults, defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { mouseDrag, mouseUp, setReducedMotion } from './tests/browser-commands';

// Every suite that mounts the card or the editor, plus the one whose subject
// is localStorage. These run in headless Chromium: real layout, real
// matchMedia, real pointer capture, real storage. jsdom lacks all four and
// the stubs that papered over them hid what the browser actually does (#300).
// Everything else (adapters, utils, geometry, localize, styles) is pure and
// stays on jsdom, which is far cheaper to spin up.
const BROWSER_SUITES = [
  'tests/card-details.test.ts',
  'tests/card-filter.test.ts',
  'tests/card-geometry-fetch.test.ts',
  'tests/card-geometry.test.ts',
  'tests/card-radius.test.ts',
  'tests/card-swipe-dismiss.test.ts',
  'tests/card-tap-action.test.ts',
  'tests/color-theme.test.ts',
  'tests/device-mode.test.ts',
  'tests/dismissal.test.ts',
  'tests/editor-*.test.ts',
  'tests/progress-decoration.test.ts',
  'tests/source-mode.test.ts',
];

export default defineConfig({
  define: {
    __CARD_VERSION__: JSON.stringify('test'),
  },
  test: {
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary'],
      // Floors are ratchets: raise them as gaps close, never lower one to
      // make a PR pass. Each sits one whole point under the last measured
      // run (2026-09-29, first run with the browser project, jsdom and
      // Chromium merged: 92.77 / 86.26 / 92.29 / 95.30).
      thresholds: {
        statements: 91,
        branches: 85,
        functions: 91,
        lines: 94,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          // One jsdom per worker instead of one per file: the environment
          // was two thirds of the suite's wall time. vmThreads keeps
          // per-file isolation in a fresh VM context.
          pool: 'vmThreads',
          include: ['tests/**/*.test.ts'],
          exclude: [...configDefaults.exclude, ...BROWSER_SUITES],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: BROWSER_SUITES,
          // Each file gets its own iframe, but every iframe shares the
          // origin's localStorage. Run the files one at a time so a
          // suite's storage teardown never races another's setup.
          fileParallelism: false,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            // A failure screenshot is noise in CI and a stray file locally.
            screenshotFailures: false,
            commands: { mouseDrag, mouseUp, setReducedMotion },
          },
        },
      },
    ],
  },
});
