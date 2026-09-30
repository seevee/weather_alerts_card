import { readFileSync } from 'fs';
import { defineConfig } from 'rolldown';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  input: 'src/weather-alerts-card.ts',
  transform: {
    // Minify AND downlevel the merged bundle (including Lit's own dist) to a
    // syntax floor old Android WebViews can parse — e.g. Shelly Wall Displays
    // that choke on ES2021 logical-assignment / ES2022 private fields (#194).
    // Rolldown applies the target to dependencies too, so Lit comes out at
    // ES2019 as well.
    target: 'es2019',
    // Top-level `define` and `output.target` are silently ignored (a warning,
    // not an error), which leaves __CARD_VERSION__ unreplaced. Keep both here.
    define: {
      __CARD_VERSION__: JSON.stringify(pkg.version),
    },
  },
  output: {
    file: 'dist/weather-alerts-card.js',
    format: 'es',
    minify: true,
  },
});
