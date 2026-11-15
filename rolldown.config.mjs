import { readFileSync } from 'fs';
import { defineConfig } from 'rolldown';
import { stripCssCommentsPlugin } from './scripts/strip-css-comments.mjs';
import { dropEditorKeysPlugin } from './scripts/drop-editor-keys.mjs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

const transform = {
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
};

// The card's `import('./weather-alerts-card-editor')` stays a runtime import
// of the second file. The version query busts the browser cache on update,
// the way the dashboard resource's own cache tag does for the card.
const EDITOR_FILE = 'weather-alerts-card-editor.js';
const externalEditorPlugin = {
  name: 'external-editor',
  resolveId(source) {
    return source === './weather-alerts-card-editor'
      ? { id: `./${EDITOR_FILE}?v=${pkg.version}`, external: true }
      : null;
  },
};

// Two builds, two self-contained files (#394). A dashboard loads only the
// card; the editor loads when a card is edited. They share no chunk on
// purpose: Home Assistant loads the card under a cache-tagged URL, so a chunk
// importing back from `./weather-alerts-card.js` would evaluate the card a
// second time and fail on the duplicate element registration. The editor
// carries its own Lit and adapters instead.
//
// The minifier leaves template text alone, so comments in the css`` blocks
// would ship verbatim (~26 KB). Source and tests keep them.
export default defineConfig([
  {
    input: 'src/weather-alerts-card.ts',
    plugins: [stripCssCommentsPlugin(), dropEditorKeysPlugin(), externalEditorPlugin],
    transform,
    output: { file: 'dist/weather-alerts-card.js', format: 'es', minify: true },
  },
  {
    input: 'src/weather-alerts-card-editor.ts',
    plugins: [stripCssCommentsPlugin()],
    transform,
    output: { file: `dist/${EDITOR_FILE}`, format: 'es', minify: true },
  },
]);
