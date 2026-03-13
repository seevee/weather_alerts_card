import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/weather-alerts-card.ts',
  output: {
    file: 'dist/nws-alerts-card.js',
    format: 'es',
  },
  plugins: [
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
    terser(),
  ],
};
