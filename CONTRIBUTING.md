# Contributing

## Development Setup

```bash
npm ci
npm run build
```

See [AGENTS.md](AGENTS.md) for full architecture details and dev container instructions.

## Workflow

1. Create a feature branch from `main`
2. Make changes, run `npm run lint` and `npm run build`
3. Open a PR targeting `main`
4. PRs are squash-merged after review and passing CI

## CI Checks

All PRs must pass:
- `npm run lint` — TypeScript type-check
- `npm run build` — Rollup bundle
- HACS validation

## Commit Messages

Use conventional-style prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
