import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __CARD_VERSION__: JSON.stringify('test'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary'],
      // Floors are ratchets: raise them as gaps close, never lower one to
      // make a PR pass. Each sits one whole point under the first measured
      // run (2026-09-21: 84.25 / 80.82 / 84.88 / 86.52).
      thresholds: {
        statements: 84,
        branches: 80,
        functions: 84,
        lines: 86,
      },
    },
  },
});
