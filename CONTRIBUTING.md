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

## Commit Messages

Use conventional-style prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.

## AI-Assisted Contributions

AI coding assistants are welcome as tools, under two rules:

- **You own what you submit.** Review and understand AI-assisted code before opening a PR — you are fully responsible for it, including bugs, security issues, and licensing.
- **Disclose the tool — as a tool, not an author.** Note the assistant in a commit trailer using the Linux-kernel convention, e.g. `Assisted-by: Claude:claude-fable-5`. Do not credit an AI via `Co-authored-by:`; that trailer is reserved for human co-authors.
