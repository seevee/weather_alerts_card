import { readFileSync } from 'fs';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import esbuild from 'rollup-plugin-esbuild';
import replace from '@rollup/plugin-replace';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

export default {
  input: 'src/weather-alerts-card.ts',
  output: {
    file: 'dist/weather-alerts-card.js',
    format: 'es',
  },
  plugins: [
    replace({
      __CARD_VERSION__: JSON.stringify(pkg.version),
      preventAssignment: true,
    }),
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      tsconfigOverride: {
        compilerOptions: {
          noEmit: false,
          declaration: false,
        },
      },
    }),
    // Minify AND downlevel the merged bundle (including Lit's own dist) to a
    // syntax floor old Android WebViews can parse — e.g. Shelly Wall Displays
    // that choke on ES2021 logical-assignment / ES2022 private fields (#194).
    esbuild({ minify: true, target: 'es2019' }),
  ],
};
