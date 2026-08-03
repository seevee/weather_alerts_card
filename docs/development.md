# Development

The card is a single LitElement bundled with Rollup and distributed through HACS. No
framework, no build server — clone, `npm install`, and build.

## Build commands

```bash
npm install
npm run build      # Rollup bundle → dist/weather-alerts-card.js
npm run watch      # Rollup in watch mode
npm run lint       # TypeScript type-check (tsc --noEmit)
npm run test       # Vitest unit tests (jsdom)
npm run test:watch # Vitest in watch mode
```

Run `npm run lint` and `npm run test` before committing — both are required status
checks on every PR.

The bundle is a single ES module, minified and downleveled to ES2019 so it keeps working
in the old Android WebViews some wall panels still ship
([#194](https://github.com/seevee/weather_alerts_card/issues/194)).

## Source layout

| File | Purpose |
|------|---------|
| `src/weather-alerts-card.ts` | The main card class. Implements the HA card contract (`setConfig()`, `hass`, `getCardSize()`, `getStubConfig()`, `window.customCards`) and wraps output in `<ha-card>` |
| `src/weather-alerts-card-editor.ts` | The visual configuration editor |
| `src/types.ts` | `WeatherAlert` (normalized), `WeatherAlertsCardConfig`, `AlertAdapter`, raw provider shapes |
| `src/adapters/index.ts` | Adapter registry and auto-detection — exports `getAdapter(provider, attributes)` |
| `src/adapters/*.ts` | One adapter per provider |
| `src/localize.ts` | i18n lookup — `t(key, lang, params?)`, strips the region subtag, falls back to English per key |
| `src/translations/` | One file per locale (`en`, `fr`, `es`, `it`, `de`, `zh-Hans`) |
| `src/utils.ts` | Pure functions: icon mapping, timestamp parsing, `computeAlertProgress()`, severity normalization, zone filtering, sorting, `reflowAlertText()` |
| `src/styles.ts` | All CSS, as a Lit `css` tagged template |

## The adapter pattern

Every provider is an **adapter** that converts raw entity attributes into a normalized
`WeatherAlert[]`. The card UI only ever consumes `WeatherAlert` — never raw provider
data. That is what keeps every feature working identically across nine feeds, and it is
the constraint to respect when adding a tenth.

An adapter declares how to detect itself from an attribute signature, and
`getAdapter()` resolves either an explicit `config.provider` or the first adapter that
claims the attributes. Adapters that collect per-incident entities also declare
`feedSources`, which drives the editor's live-detected feed picker via
`knownFeedSources()`.

Two conventions worth knowing:

- **Never invent data.** If a feed has no expiry, the alert gets `endsTs: 0` and the card
  shows an honest "ongoing" state rather than a fabricated countdown. If severity had to
  be guessed, it is flagged as inferred so the UI can mark it with a tilde.
- **Normalize in the adapter, not the UI.** Provider quirks stop at the adapter boundary.

## Adding a provider

1. Add `src/adapters/<name>.ts` exporting an `AlertAdapter` — a detector plus a parser
   producing `WeatherAlert[]`.
2. Register it in `src/adapters/index.ts`.
3. Add the provider to the `AlertProvider` union in `src/types.ts`.
4. Add unit tests under `tests/` covering a real captured payload.
5. Document it in [Providers](./providers), including its severity/certainty fidelity.

## Documentation site

This site is [VitePress](https://vitepress.dev), living under `docs/`.

```bash
npm run docs:media    # regenerate the figures into docs/public/img/
npm run docs:dev      # local dev server with hot reload
npm run docs:build    # production build → docs/.vitepress/dist/
npm run docs:preview  # serve the production build
```

Run `docs:media` **before** `docs:build` on a fresh clone: the figures are not committed,
and VitePress fails the build on an image it cannot resolve rather than warning.

Docs figures are generated deterministically from the screenshot harnesses in `scripts/`
and published straight into the Pages artifact, so `docs/public/img/` is gitignored. The
only committed figures are the six the README embeds.

::: warning `docs:media` leaves the tracked figures dirty
The scene content is deterministic, but the encoded bytes are not portable across
Chromium and ImageMagick versions — so the run rewrites the six storefront figures in
place. Run `git restore img/` afterwards unless you actually mean to refresh them, which
is a release-time job.
:::

The motion capture (`scripts/capture-tap-action.js`) is gated behind `DOCS_MOTION=1` and
off by default. It needs both `ffmpeg` and `ffprobe`.

Deployment is `.github/workflows/docs.yml`, which builds and publishes to GitHub Pages on
every push to `main`.

## Contributing

- Branches: `feat/<name>`, `fix/<name>`, `chore/<name>`.
- Commits: `type(scope): description` — `feat`, `fix`, `docs`, `refactor`, `test`,
  `chore`.
- `main` is protected. Everything goes through a PR with passing build, lint, test and
  HACS validation checks, and only squash merges are allowed.

See [CONTRIBUTING.md](https://github.com/seevee/weather_alerts_card/blob/main/CONTRIBUTING.md)
for the full guidelines, and
[AGENTS.md](https://github.com/seevee/weather_alerts_card/blob/main/AGENTS.md) for
repository conventions in the depth an automated contributor needs.
