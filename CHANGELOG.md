# Changelog

## 2.4.0 — 2026-03-26

### Added
- Internationalize card UI and editor for en/fr/es (#61) (96dc505…)
- Icon-box temporal state + progress label hierarchy (#63) (5bb4650…)
- Add custom notes and new-contributor flags to publish script (#70) (1551b1b…)

### Documentation
- Add missing eventCodes and timezone options to README (#60) (ec120ce…)
- Update installation instructions in README.md (#67) (5db57c1…)

### Fixed
- Make publish script idempotent for safe re-runs (#64) (c5816a8…)
- Add checkout and build steps to HACS validation workflow (#68) (a4f43ff…)
- Run HACS validation on main push only, not PRs (#69) (6292274…)

## 2.3.0 — 2026-03-24

### Added
- Show preview with placeholder alerts in card picker (#53) (ab6084e…)
- Add browser timezone option for traveling users (#55) (8316432…)
- Add NWS event code support and filtering (#57) (d6b2eb9…)
- Expand weather icon coverage for more event types (#58) (8894a23…)

### Fixed
- Use NWS color-triggering keywords in placeholder alert names (861880c…)
- Update repo links for rename to weather_alerts_card (e2a2ad0…)
- Use old repo name in HACS link until default store updates (6b2e975…)
- Remove HACS button until default store reflects rename (d17bfb4…)

### Maintenance
- Regenerate adaptive hero SVG from 2x DPR PNGs (8e97cf5…)
- Cleanup README, release scripts, and build step (#54) (e19a382…)

## 2.2.0 — 2026-03-22

### Added
- Display provider-native severity labels on badge (#48) (62763a2…)
- Add PirateWeather adapter (#44) (#49) (9c5ff83…)

### Fixed
- Generate release notes before tagging (647bd73…)
- Use HA dark mode detection for severity badge text color (#51) (fa3a884…)

### Maintenance
- Add most-alerted-zones lookup script (#47) (6307349…)
- Stop tracking dist bundle and config dir (#50) (fb89323…)

## 2.1.0 — 2026-03-15

### Added
- Deduplicate alerts across zones (#37) (4332648…)

### Documentation
- Add theme-aware hero images for README (#39) (34246fb…)
- Expand last compact alert in hero screenshots (#40) (4749946…)
- Add adaptive hero svg (54b91a2…)
- Add adaptive hero svg generator script (68c867d…)

### Fixed
- Put migration notice before changelog in release notes (0ed28bd…)

### Maintenance
- Skip release commits from changelog (ea7d32f…)

## 2.0.0 — 2026-03-15

### Added
- Add MeteoAlarm (Europe) adapter (#11) (6046982…)
- Rename to "Weather Alerts Card" for multi-provider support (#25) (d302d15…)
- Display affected area description on alert cards (#27) (89adc5e…)
- Add styled console log with card name and version at load time (#30) (c406500…)

### Fixed
- Remove push trigger from validate workflow to prevent duplicate runs (#23) (48fe454…)
- Align NwsAlert type with nws_alerts integration fields (#26) (832cbee…)
- Use npx to run git-cliff in publish script (dcefd1e…)
- Remove extra blank lines between changelog entries (#29) (4cdabe2…)
- Add version headers to changelog and fix cliff config path (#32) (58e19e1…)
- Scope release notes to correct version range (#33) (bb30959…)
- Add migration notice to GA release notes and clarify HACS resource path (#35) (3687b1c…)

### Maintenance
- Streamline agent skills and dev workflow (#22) (f6fbc20…)
- Add meteoalarm configuration to dev container (#24) (2065f8e…)

## 1.10.0 — 2026-03-12

### Added
- Add minimum severity filter configuration (#20) (068b51b…)

## 1.9.2 — 2026-03-10

### Fixed
- Stop closed event propagation at editor container level (#15) (8cb7a1e…)
- Migrate ha-select to HA 2026.02+ WebAwesome components (#17) (16e39b0…)

## 1.9.0 — 2026-03-09

### Added
- Add automated screenshot utility for README images (65ffbd3…)
- Add multi-provider adapter pattern with BoM support (#1) (#4) (320fd0f…)
- Support ha_bom_australia integration with area_id zone filtering (#7) (36f3d30…)

### Documentation
- Readme img udates, repo janitorial duties (412b879…)
- Update README for official HACS procedure (126196b…)

### Fixed
- Use absolute URLs for README images so they display in HACS (#9) (a8007af…)

### Maintenance
- CI hardening, repo hygiene, and test scaffolding (#2) (bc1a46c…)
- Update release skill for branch-protected workflow (#3) (84d5c0f…)

## 1.8.0 — 2026-02-20

### Added
- Fix WCAG color contrast for severity and active badges (18bfd9d…)
- Use luminance-based badge text for NWS theme, media-query for severity (478cf49…)

### Maintenance
- Update release skill gh release create flags (9b505d6…)
- Remove obsolete docker compose version key (067c9af…)

## 1.7.0 — 2026-02-20

### Added
- Sanitize alert HTML with DOMPurify before rendering (0addb50…)
- Explicit locale/timezone handling for timestamps and progress bars (0e288c7…)

### Documentation
- Update animations option docs for prefers-reduced-motion behavior (ffbcbc4…)
- Generalize / update documentation (c17f7bc…)

### Maintenance
- Add claude configuration (37787ab…)

## 1.6.0 — 2026-02-19

### Documentation
- Document colorTheme, compact layout, sort order, and visual editor (3e74a9b…)

## 1.5.0 — 2026-02-19

### Added
- Add colorTheme config option for NWS official event colors (08ccf8c…)

## 1.4.1 — 2026-02-19

### Changed
- Reduce repetition across utils, card, and styles (58c0b02…)

### Fixed
- Show clean in-card message when sensor is unavailable or unknown (334de9c…)

## 1.3.0 — 2026-02-17

### Documentation
- Add CHANGELOG.md and document release flow (2b0b60f…)
- Add home assistant community thread link (e4c4213…)

## 1.2.0 — 2026-02-17

### Added
- Add animations config toggle (2887e21…)

### Documentation
- Remove stale v1.yml reference (ccd386a…)

### Maintenance
- Update documentation images (ea48078…)
- Bump version to 1.2.0 (af900e2…)

## 1.1.1 — 2026-02-16

### Fixed
- Respect HA date format setting (d8ef57a…)

## 1.1.0 — 2026-02-16

### Fixed
- Vertically center badge text and respect HA time format (bbdaf9a…)

## 1.0.0 — 2026-02-16

### Added
- Add visual configuration editor (1e34682…)

### Documentation
- Remove redundant HACS mention, add zone ommission explanation (5438ed0…)

### Maintenance
- Remove old dist files (d0e3c5d…)

## 0.0.2 — 2026-02-16

### Fixed
- Add dist folder, add hacs country code (9773073…)

## 0.0.1 — 2026-02-15

### Added
- Add initial project structure and files (4bac721…)
- Set up Lovelace card template with TypeScript and LitElement (972643d…)
- Enable experimentalDecorators in tsconfig (aaf62b6…)
- Set up homeassistant dev container (99f77a3…)
- Add basic Home Assistant configuration with default components (3d9668b…)

### Changed
- Implement nws alerts card - convert from manual yml (7a81243…)

### Documentation
- Add detailed devcontainer usage instructions (53a57db…)
- Add screenshots to README for HACS validation (8e86067…)

### Fixed
- Ensure build configuration is correct with proper output settings (07cd2d9…)
- Remove unrelated Open WebUI service from docker-compose.yml (b699d39…)
- Explicitly set project name in docker-compose.yml to avoid conflicts (6bb2228…)
- Explicitly set project name in docker-compose.yml to isolate environment (99f697e…)
- Commit package-lock.json for reproducible CI builds (fe11120…)
- Commit dist/nws-alerts-card.js for HACS validation (61dba0b…)

### ci
- Add HACS validation and build workflows (855387e…)
