/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { dropEditorKeys } from '../scripts/drop-editor-keys.mjs';
import { translations } from '../src/translations';

// The build ships the editor as its own file and drops every `editor.*` string
// from the card bundle (#394). These pin the two things that rule rests on.

const sources = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });
const localeSources = Object.entries(sources).filter(([path]) =>
  /\/translations\/(?!index\.|types\.)/.test(path));

// Everything the card bundle carries: all of src/ but the editor's own modules
// and the locale files. The editor file keeps every key, so shared modules
// (utils.ts reads `time.*`) are safe on that side whatever they use.
const EDITOR_ONLY = /\/(weather-alerts-card-editor|editor-fields)\.ts$/;
const cardSources = Object.entries(sources).filter(([path]) =>
  !EDITOR_ONLY.test(path) && !path.includes('/translations/'));

describe('dropEditorKeys', () => {
  it('drops editor entries and keeps everything else', () => {
    const src = [
      'export const en: TranslationMap = {',
      '  // Card UI',
      "  'card.close': 'Close',",
      "  'editor.title': 'Title',",
      "  'editor.note': 'Has a card.close mention and a colon: here',",
      "  'time.now': 'now',",
      '};',
    ].join('\n');
    expect(dropEditorKeys(src)).toBe([
      'export const en: TranslationMap = {',
      '  // Card UI',
      "  'card.close': 'Close',",
      "  'time.now': 'now',",
      '};',
    ].join('\n'));
  });

  it('leaves a value that merely mentions an editor key alone', () => {
    const src = "  'card.hint': 'See editor.title',";
    expect(dropEditorKeys(src)).toBe(src);
  });

  it('strips exactly the editor keys from every locale file', () => {
    expect(localeSources.length).toBe(Object.keys(translations).length);
    for (const [path, code] of localeSources) {
      const out = dropEditorKeys(code);
      expect(out, path).not.toMatch(/'editor\./);
      // Nothing else goes with them: every other key is still there.
      const count = (src: string): number => (src.match(/^\s*'[a-z_]+\./gm) ?? []).length;
      const editorKeys = (code.match(/^\s*'editor\./gm) ?? []).length;
      expect(editorKeys, path).toBeGreaterThan(100);
      expect(count(out), path).toBe(count(code) - editorKeys);
    }
  });

  it('every locale file is one entry per line', () => {
    // The filter works a line at a time, so a wrapped value would leave its
    // tail behind as a syntax error in the card bundle. Every line is a whole
    // entry, a comment, blank, or the module's own scaffolding.
    const ENTRY = /^\s*'[a-z_]+\.[^']*':\s.*['"`],\s*(\/\/.*)?$/;
    const OTHER = /^\s*(\/\/.*)?$|^import |^export const \w+: TranslationMap = \{$|^\};$/;
    for (const [path, code] of localeSources) {
      const stray = code.split('\n').filter((line) => !ENTRY.test(line) && !OTHER.test(line));
      expect(stray, path).toEqual([]);
    }
  });
});

describe('card bundle sources', () => {
  it('refer to no editor.* key', () => {
    // Such a key would resolve to the raw key string on a dashboard.
    expect(cardSources.length).toBeGreaterThan(10);
    for (const [path, code] of cardSources) {
      expect(code, path).not.toMatch(/['"`]editor\.[a-z_]/);
    }
  });
});
