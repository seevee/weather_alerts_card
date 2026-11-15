// Build-time removal of the editor's strings from the card bundle (#394).
//
// 159 of the 216 translation keys are `editor.*`, in all eleven locales, and a
// dashboard never reads one of them: only the visual editor does, and it ships
// as its own file with every key. Dropping them here keeps the locale files
// whole in source, so a translator still edits one file per language.
//
// The rule is the key prefix. `tests/editor-split.test.ts` fails when a module
// the card bundle carries refers to an `editor.*` key.

// A locale entry is one line: `  'editor.title': 'Title',`. Values never span
// lines (the same test pins that), so a line filter is exact.
const EDITOR_ENTRY = /^\s*'editor\.[^']*':/;

/**
 * Drop every `editor.*` entry from a locale module's source.
 * @param {string} code
 * @returns {string}
 */
export function dropEditorKeys(code) {
  return code.split('\n').filter((line) => !EDITOR_ENTRY.test(line)).join('\n');
}

/** Rolldown plugin: apply dropEditorKeys to the locale files. Card build only. */
export function dropEditorKeysPlugin() {
  return {
    name: 'drop-editor-keys',
    transform: {
      filter: { id: /[\\/]src[\\/]translations[\\/](?!index\.|types\.)[^\\/]+\.ts$/ },
      handler(code) {
        const next = dropEditorKeys(code);
        return next === code ? null : { code: next };
      },
    },
  };
}
