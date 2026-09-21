import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __CARD_VERSION__: JSON.stringify('test'),
  },
  test: {
    environment: 'jsdom',
    // One jsdom per worker instead of one per file: the environment was
    // two thirds of the suite's wall time (38 creations, ~34 s). vmThreads
    // keeps per-file isolation in a fresh VM context.
    pool: 'vmThreads',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary'],
      // Floors are ratchets: raise them as gaps close, never lower one to
      // make a PR pass. Each sits one whole point under the last measured
      // run (2026-09-21, after the editor change-handler tests: 92.93 /
      // 86.76 / 92.05 / 95.47).
      thresholds: {
        statements: 91,
        branches: 85,
        functions: 91,
        lines: 94,
      },
    },
  },
});
