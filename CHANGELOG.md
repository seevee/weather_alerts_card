# Changelog

### Added
- Add styled console log with card name and version at load time (#30) (c406500…)

### Fixed
- Use npx to run git-cliff in publish script (dcefd1e…)
- Remove extra blank lines between changelog entries (#29) (4cdabe2…)

### Added
- Add MeteoAlarm (Europe) adapter (#11) (6046982…)
- Rename to "Weather Alerts Card" for multi-provider support (#25) (d302d15…)
- Display affected area description on alert cards (#27) (89adc5e…)

### Fixed
- Remove push trigger from validate workflow to prevent duplicate runs (#23) (48fe454…)
- Align NwsAlert type with nws_alerts integration fields (#26) (832cbee…)

### Maintenance
- Streamline agent skills and dev workflow (#22) (f6fbc20…)
- Add meteoalarm configuration to dev container (#24) (2065f8e…)
- Release v2.0.0-alpha.1 (#28) (462ba83…)

### Added
- Add minimum severity filter configuration (#20) (068b51b…)

### Maintenance
- Release v1.10.0 (#21) (f95e06e…)

### Fixed
- Stop closed event propagation at editor container level (#15) (8cb7a1e…)
- Migrate ha-select to HA 2026.02+ WebAwesome components (#17) (16e39b0…)

### Maintenance
- Release v1.9.1 (#16) (6f780f7…)
- Release v1.9.2 (#18) (ffc8133…)

### Fixed
- Use absolute URLs for README images so they display in HACS (#9) (a8007af…)

### Maintenance
- Release v1.9.0 (#10) (b9c7345…)

### Added
- Support ha_bom_australia integration with area_id zone filtering (#7) (36f3d30…)

### Maintenance
- Release v1.9.0-alpha.3 (#8) (590fd6b…)

### Maintenance
- Release v1.9.0-alpha.2 (#6) (d63da7f…)

### Added
- Add automated screenshot utility for README images (65ffbd3…)
- Add multi-provider adapter pattern with BoM support (#1) (#4) (320fd0f…)

### Documentation
- Readme img udates, repo janitorial duties (412b879…)
- Update README for official HACS procedure (126196b…)

### Maintenance
- CI hardening, repo hygiene, and test scaffolding (#2) (bc1a46c…)
- Update release skill for branch-protected workflow (#3) (84d5c0f…)
- Release v1.9.0-alpha.1 (#5) (176e0bd…)

### Added
- Fix WCAG color contrast for severity and active badges (18bfd9d…)
- Use luminance-based badge text for NWS theme, media-query for severity (478cf49…)

### Maintenance
- Update release skill gh release create flags (9b505d6…)
- Remove obsolete docker compose version key (067c9af…)
- Release v1.8.0 (49b7a4b…)

### Added
- Sanitize alert HTML with DOMPurify before rendering (0addb50…)
- Explicit locale/timezone handling for timestamps and progress bars (0e288c7…)

### Documentation
- Update animations option docs for prefers-reduced-motion behavior (ffbcbc4…)
- Generalize / update documentation (c17f7bc…)

### Maintenance
- Add claude configuration (37787ab…)
- Release v1.7.0 (f2e1a91…)

### Documentation
- Document colorTheme, compact layout, sort order, and visual editor (3e74a9b…)

### Maintenance
- Release v1.6.0 (af441a6…)

### Added
- Add colorTheme config option for NWS official event colors (08ccf8c…)

### Maintenance
- Release v1.5.0 (e9ce2d6…)

### Changed
- Reduce repetition across utils, card, and styles (58c0b02…)

### Fixed
- Show clean in-card message when sensor is unavailable or unknown (334de9c…)

### Maintenance
- Release v1.4.1 (6c0aeee…)

### Maintenance
- Release v1.4.0 (85e104d…)

### Maintenance
- Release v1.3.1 (61ae002…)

### Documentation
- Add CHANGELOG.md and document release flow (2b0b60f…)
- Add home assistant community thread link (e4c4213…)

### Maintenance
- Release v1.3.0 (0e40447…)

### Added
- Add animations config toggle (2887e21…)

### Documentation
- Remove stale v1.yml reference (ccd386a…)

### Maintenance
- Update documentation images (ea48078…)
- Bump version to 1.2.0 (af900e2…)

### Fixed
- Respect HA date format setting (d8ef57a…)

### Fixed
- Vertically center badge text and respect HA time format (bbdaf9a…)

### Added
- Add visual configuration editor (1e34682…)

### Documentation
- Remove redundant HACS mention, add zone ommission explanation (5438ed0…)

### Maintenance
- Remove old dist files (d0e3c5d…)

### Fixed
- Add dist folder, add hacs country code (9773073…)

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
