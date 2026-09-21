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
      // make a PR pass. Each sits one whole point under the last measured
      // run (2026-09-21, after the swipe-dismiss tests: 88.27 / 83.95 /
      // 87.98 / 90.41).
      thresholds: {
        statements: 87,
        branches: 83,
        functions: 87,
        lines: 89,
      },
    },
  },
});
