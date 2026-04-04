# AGENTS.md

This file provides guidance to AI agents working with code in this repository.

## Project Overview

A standalone custom Home Assistant Lovelace card for displaying weather alerts from multiple providers. Currently supports NWS (National Weather Service, US), BoM (Bureau of Meteorology, Australia), MeteoAlarm (EUMETNET, Europe), DWD (Deutscher Wetterdienst, Germany), and PirateWeather. Built with LitElement/Lit 3, bundled with Rollup, and packaged for HACS distribution.

## Build Commands

```bash
npm run build     # Rollup bundle → dist/weather-alerts-card.js (single ES module, ~117KB minified)
npm run watch     # Rollup in watch mode
npm run lint      # TypeScript type-check (tsc --noEmit)
npm run test      # Vitest unit tests (jsdom environment)
npm run test:watch # Vitest in watch mode
```

Always run `npm run lint` and `npm run test` before committing.

## Source Architecture

| File | Purpose |
|------|---------|
| `src/weather-alerts-card.ts` | Main LitElement card class. Implements HA card contract: `setConfig()`, `hass` property, `getCardSize()`, `getStubConfig()`, `window.customCards` registration. Wraps output in `<ha-card>`. Consumes normalized `WeatherAlert` objects. Registers deprecated `<nws-alerts-card>` shim for v1 backwards compatibility (removed in v3). |
| `src/weather-alerts-card-editor.ts` | Visual configuration editor. Registers deprecated `<nws-alerts-card-editor>` shim (removed in v3). |
| `src/types.ts` | TypeScript interfaces: `WeatherAlert` (normalized, provider-agnostic), `WeatherAlertsCardConfig`, `AlertAdapter`, `NwsAlert` (raw NWS shape), `BomWarning` (raw BoM shape), `AlertProgress`. |
| `src/adapters/index.ts` | Adapter registry with auto-detection. Exports `getAdapter(provider, attributes)`. |
| `src/adapters/nws.ts` | NWS adapter: parses `attributes.Alerts` → `WeatherAlert[]`. |
| `src/adapters/bom.ts` | BoM adapter: parses `attributes.warnings` → `WeatherAlert[]`. Filters cancelled warnings, maps severity from `type` + `warning_group_type`. |
| `src/adapters/meteoalarm.ts` | MeteoAlarm adapter: parses flat `binary_sensor` attributes → single-element `WeatherAlert[]`. Maps `awareness_level` to severity. |
| `src/adapters/dwd.ts` | DWD adapter: parses `dwd_weather_warnings` sensor attributes → `WeatherAlert[]`. Detects via `warning_count` + `region_name`. |
| `src/adapters/pirateweather.ts` | PirateWeather adapter: parses Pirate Weather integration attributes → `WeatherAlert[]`. Detects via attribution string. |
| `src/localize.ts` | i18n system with 5 languages (en, fr, es, it, de). Exports `t(key, lang, params?)`. |
| `src/utils.ts` | Pure functions: icon mapping, timestamp parsing, `computeAlertProgress()`, severity normalization, zone filtering, alert sorting, `reflowAlertText()`. Operates on `WeatherAlert`. |
| `src/styles.ts` | All CSS as a Lit `css` tagged template. Severity color mappings, keyframe animations, progress bar, custom details toggle styles. |
| `rollup.config.mjs` | Rollup config: resolve + commonjs + typescript2 + terser → single `dist/weather-alerts-card.js`. |

## Key Patterns

- The card uses an **adapter pattern** to support multiple alert providers. Each adapter converts raw entity attributes into a normalized `WeatherAlert[]` array.
- Provider can be set explicitly via `config.provider` (`'nws'` | `'bom'` | `'meteoalarm'` | `'pirateweather'` | `'dwd'`) or auto-detected from entity attributes.
- **NWS adapter**: reads `attributes.Alerts` array (NWS Alerts integration v6.1+). Zones extracted from `AffectedZones` URLs and `Geocode.UGC`.
- **BoM adapter**: reads `attributes.warnings` array (bureau_of_meteorology or ha_bom_australia integration). Filters cancelled warnings. Maps severity from `type` string + `warning_group_type`. Uses `issue_time` as onset (BoM issues when threat is imminent). Maps `area_id` to `zones` for zone-based filtering.
- **MeteoAlarm adapter**: reads flat attributes from a `binary_sensor` entity (MeteoAlarm integration). Maps `awareness_level` (semicolon-delimited "level; color; label") to severity. Falls back to CAP `severity` attribute. Returns a single alert per entity (upstream library limitation). CAP fields (`certainty`, `urgency`, `description`, `instruction`) are passed through directly.
- The card UI only consumes normalized `WeatherAlert` objects — never raw provider data.
- Severity levels map to CSS classes: `severity-extreme`, `severity-severe`, `severity-moderate`, `severity-minor`, `severity-unknown`, each with `--color` and `--color-rgb` custom properties.
- Progress bars use inverted fill logic: the filled portion represents remaining time, positioned from the elapsed percentage.
- Details toggle uses `@state() _expandedAlerts: Map<string, boolean>` keyed by alert `id` — avoids the DOM re-render collapse problem that native `<details>` elements have with HA's state update cycle.
- Zone filtering matches against the normalized `zones` array on each `WeatherAlert` (uppercase codes).
- HA theme variables (`--primary-text-color`, `--card-background-color`, etc.) pass through Shadow DOM via CSS custom properties.
- **Deprecated element names**: `<nws-alerts-card>` and `<nws-alerts-card-editor>` are registered as thin shims that extend the primary classes. The card shim logs a deprecation console warning. Both will be removed in v3.

## Config Schema

```typescript
interface WeatherAlertsCardConfig {
  entity: string;              // required — e.g. "sensor.nws_alerts_alerts"
  title?: string;              // optional card header
  zones?: string[];            // optional zone filter — e.g. ["COC059", "COZ039"]
  eventCodes?: string[];       // event codes to include (provider-specific) — empty/omitted = all
  excludeEventCodes?: string[]; // event codes to exclude (provider-specific) — empty/omitted = none excluded
  minSeverity?: AlertSeverity; // 'all' | 'minor' | 'moderate' | 'severe' | 'extreme'
  sortOrder?: 'default' | 'onset' | 'severity';
  animations?: boolean;        // undefined: respects prefers-reduced-motion; true/false: force
  layout?: 'default' | 'compact';
  fontSize?: 'small' | 'default' | 'large' | 'x-large';
  colorTheme?: 'severity' | 'nws' | 'meteoalarm';
  provider?: AlertProvider;    // 'nws' | 'bom' | 'meteoalarm' | 'pirateweather' | 'dwd' — undefined: auto-detect
  deduplicate?: boolean;       // undefined/true: dedup on; false: off
  deduplicateHeadlines?: boolean; // undefined/true: filter redundant headlines; false: show all
  reformatText?: boolean;      // undefined/true: strip hard line wraps from alert text; false: preserve raw
  hideExpired?: boolean;       // undefined/true: hide expired alerts; false: show them (dimmed)
  hideNoAlerts?: boolean;      // undefined/false: show "No active alerts" banner; true: hide it
  showSourceLink?: boolean;    // undefined/true: show "Open Source" link; false: hide (kiosk mode)
  timezone?: 'server' | 'browser'; // undefined/'server': HA server tz; 'browser': client tz
}
```

## Development Environment

### Starting the dev container

```bash
npm run build
docker compose -f .docker/docker-compose.yml up
```

Home Assistant runs at http://localhost:8123. The built JS is volume-mounted read-only at `/config/www/weather-alerts-card.js`. Rebuild on the host and hard-refresh the browser to see changes.

### First-time dev container setup

After the HA onboarding flow:

1. **Enable advanced mode**: click your user avatar (bottom-left) → toggle Advanced Mode on.
2. **Add card resource**: Settings → Dashboards → three-dot menu → Resources → Add Resource:
   - URL: `/local/weather-alerts-card.js`
   - Type: JavaScript Module
3. **Add card to a dashboard**: Overview → pencil icon → Add Card → search "Weather Alerts Card" or use Manual card with:
   ```yaml
   type: custom:weather-alerts-card
   entity: sensor.nws_alerts_alerts
   ```

### Installing the NWS Alerts integration in the dev container

The card needs the `sensor.nws_alerts_alerts` entity which comes from the [NWS Alerts custom integration](https://github.com/finity69x2/nws_alerts). To install it:

1. **Install HACS** (one-time):
   ```bash
   docker exec -it nws-alerts-card-ha bash
   wget -O - https://get.hacs.xyz | bash -
   ```
   Restart HA (Settings → System → Restart), then add HACS as an integration: Settings → Devices & Services → Add Integration → search "HACS" → follow the GitHub device code authorization flow. The HACS sidebar entry appears after this step.

2. **Install NWS Alerts**: HACS → Integrations → Explore & Download Repositories → search "NWS Alerts" → Download → restart HA again.

3. **Configure**: Settings → Devices & Services → Add Integration → search "NWS Alerts" → enter zone/county codes.

   **Important**: zone codes must be comma-delimited with **no spaces** (e.g. `COC059,COZ039,COZ239`). Adding spaces after commas (e.g. `COC059, COZ039`) causes the integration to silently return no alerts. Find your zone codes at https://alerts.weather.gov/.

## Agent Rules

These rules apply to all autonomous agent skills (`/explore`, `/plan`, `/implement`, `/fix`, `/review`).

### Before editing
- Read every file before referencing or modifying it
- Read `AGENTS.md` for project context and conventions
- Do not invent architecture that doesn't exist in the repository

### Modifying code
- Only modify files identified as in-scope for the task
- Never introduce unrelated refactors or fix pre-existing issues outside changed files
- Do not change public interfaces without user confirmation
- Follow dependency order: types → utilities → core logic → UI → configuration → docs

### Verification
- Run `npm run build && npm run lint && npm test` before presenting results
- Build must pass; fix any new lint errors or test failures introduced

### Git discipline
- Never auto-commit, push, or open PRs — defer to the user or `/commit-push-pr`
- Commit format: `type(scope): description` (types: feat, fix, docs, refactor, test, chore)
- Branch format: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`

### Output
- Present results directly to the user
- Do not save artifacts to disk unless the skill specifies it or the user requests it

### Skills Reference
All agent skills are defined in `.claude/commands/`. When modifying a skill, also update this documentation to reflect changes:
- `/explore` — repository discovery and context reports
- `/plan` — implementation plans (saves to `plans/<slug>.md`)
- `/implement` — code implementation from an approved plan
- `/fix` — lightweight bug fixes (skips full plan cycle)
- `/review` — code review with confidence-based filtering
- `/release` — automated release workflow

## Workflow

- `main` is protected: all changes go through PRs with required status checks (build, lint, test, HACS validation).
- Only squash merges are allowed — one commit per PR on `main`.
- Feature branches: `feat/<name>`, `fix/<name>`, `chore/<name>`, etc.
- Use the `/release` skill to perform releases (creates a release branch, PR, tag, and GitHub Release)
- New release workflow with deterministic releases:
  - Prereleases (alpha/beta/rc) auto-promote to GA versions when no new commits exist
  - Dry-run mode uses `origin/main` as base; actual releases validate strict conditions

## HACS Distribution

- `hacs.json` — HACS manifest (name, filename).
- `.github/workflows/release.yml` — on GitHub Release publish: builds and attaches `dist/weather-alerts-card.js` and `dist/nws-alerts-card.js` (backwards-compatible copy) to the release.
- To release, use the `/release` skill or follow its steps manually:
  1. Create `release/vX.Y.Z` branch from `main`.
  2. Update `CHANGELOG.md`, bump version in `package.json`, run `npm run build`.
  3. Commit, push, and open a PR to `main`.
  4. After merge: tag `main` as `vX.Y.Z`, push tag, create GitHub Release with `gh release create`.
  5. The release workflow attaches the built JS artifact.
- Users add this repo as a HACS custom repository (Frontend category).
