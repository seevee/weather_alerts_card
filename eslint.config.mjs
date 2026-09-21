// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import lit from 'eslint-plugin-lit';
import globals from 'globals';

export default tseslint.config(
  // Build output, generated docs, and the standalone dev scripts (plain
  // CommonJS/ESM node scripts, not part of the shipped card).
  { ignores: ['dist/', 'docs/', 'node_modules/', 'coverage/', 'scripts/'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  lit.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: { project: './tsconfig.eslint.json', tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser },
    },
    rules: {
      // Match tsc's noUnusedParameters convention: a leading underscore marks
      // a parameter that is intentionally unused.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // Lit template event bindings (`@change=${this._onChange}`) are invoked
      // with `this` bound to the host element, so the unbound-method warning
      // is a false positive for every handler the card and editor bind.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    // Tests reach into private members through `as unknown as` and read
    // `CustomEvent.detail` (typed `any` by the DOM lib) on purpose, and mock
    // async HA APIs with `async` stubs that never await. The unsafe-* family
    // and require-await would flag every one of those without protecting
    // anything; the rest of the type-checked set still applies.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['eslint.config.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
