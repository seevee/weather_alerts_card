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
