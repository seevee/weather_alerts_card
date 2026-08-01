# Contributing

## Development Setup

```bash
npm ci
npm run build
```

See [AGENTS.md](AGENTS.md) for full architecture details and dev container instructions.

## Workflow

1. Create a feature branch from `main`
2. Make changes, run `npm run lint`, `npm run test`, and `npm run build`
3. Open a PR targeting `main`
4. PRs are squash-merged after review and passing CI

## CI Checks

All PRs must pass:
- `npm run lint` — TypeScript type-check
- `npm run test` — Vitest unit tests
- `npm run build` — Rollup bundle
- HACS validation

## Translations

User-facing strings live in `src/translations/`, one file per locale, registered
in `src/translations/index.ts`. English (`en.ts`) is the source of truth — a PR
that adds or renames a user-facing string must add the key to `en.ts`.

Other locales are best-effort and **never block a PR**. `t()` falls back to the
English string for any key a locale omits, so a lagging translation is cosmetic.
When a locale falls behind, `tests/localize.test.ts` prints the exact missing
keys and still passes:

```bash
npm run test              # drift appears as [i18n drift] notices
I18N_STRICT=1 npm run test  # promotes drift to a failure, for an audit run
```

One thing *is* enforced for every locale: it must not declare a key absent from
`en.ts`. A stale key left behind by a rename never renders, so it is dead weight
— and unlike a missing translation, it is always fixable by whoever wrote it.

New translations are welcome as standalone PRs — copy `en.ts` to
`<code>.ts`, translate the values, leave the keys untouched, and add the locale
to `index.ts`. Use the Home Assistant locale code (`nl`, `pt-BR`, `nb`, …), and
keep any `{placeholder}` tokens intact.

Script- and region-qualified codes are matched most-specific-first, and a code
with no exact entry falls back within its own language before it falls back to
English: with only `pt-BR` registered, a `pt-PT` user gets Brazilian Portuguese
rather than English. So a single variant is worth contributing even if you
cannot cover the others. Add yourself to `.github/CODEOWNERS` so
you are asked to review future edits to your file.

## Commit Messages

Use conventional-style prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.

## AI-Assisted Contributions

AI coding assistants are welcome as tools, under two rules:

- **You own what you submit.** Review and understand AI-assisted code before opening a PR — you are fully responsible for it, including bugs, security issues, and licensing.
- **Disclose the tool — as a tool, not an author.** Note the assistant in a commit trailer using the Linux-kernel convention, e.g. `Assisted-by: Claude:claude-fable-5`. Do not credit an AI via `Co-authored-by:`; that trailer is reserved for human co-authors.
