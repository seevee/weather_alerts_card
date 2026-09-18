# Changelog

## 3.4.0 (2026-09-14)

### Added
- Show per-incident distance from home in the detail panel (#263) (closes #244)
- Collect from multiple alert devices with `devices:` (#264) (closes #256)
- Draw a marker for point-incident alerts, opt-in my-location ring (#265) (closes #206)
- Regroup the visual editor into panels that say what changed (#266)

### Internal
- Translate the eleven editor strings added by #265 and #266 (#268)

## 3.3.2 (2026-09-08)

### Added
- Add maxDistanceKm radius filter for point incidents (#254) (closes #207)

### Fixed
- Translate four Dutch editor strings left in English (#257)
- Serve the basemap from HA's map_tiles proxy, retry missed polygons (#261) (closes #259) (closes #258)

### Documentation
- Add a guide for getting alert text in your own language (#255)
- Name the dev container weather-alerts-card-ha (#260)

## 3.3.1 (2026-08-08)

### Fixed
- Stop an unpressed button from darkening a device (#252)

## 3.3.0 (2026-08-07)

### Added
- Transparency-by-default + --wac-* surface token API (#215) (#216)
- Configurable per-phase progress decoration + icon-ring border (#219)
- Bubble-style whole-row progress fill (progressFill: background) (#220)
- Configurable tap_action per alert row (replaces inline-expand) (#221)
- Per-alert detail pop-up (tap_action: { action: details }) (#224)
- Add Chinese translations (#225)
- Add a tap_action control to the visual editor (#236)
- Add a NINA adapter for German civil-protection warnings (#240)
- Add Dutch translations (#247)

### Fixed
- Stop prereleases from rewriting the changelog (#248)
- Select dropdown items by component system, not HA version (#249)

### Documentation
- Surface broken-source badge + mini-map, correct zone-filtering scope (#214)
- Commit the tap_action motion capture prototype (#228)
- Add a VitePress documentation site on GitHub Pages (#233)
- Qualify the visual-config claim with the YAML-only settings (#237)
- Fix the unusable translation-only PR template link (#242)
- List Dutch in the localized-UI blurbs (#250)

### Internal
- Remove local slash commands now tracked in dotfiles (#218)
- Split locales per-file and add parity guard (#223)
- Enforce LF line endings via .gitattributes (#226)
- Add provider request template, translation PR ergonomics, remove CODEOWNERS (#227)
- Attach storefront figures as release assets (#229)
- Untrack generated figures, keep only the six README references (#230)
- Pick the image codec per figure instead of PNG for everything (#231)
- Drop the release-asset media upload from #229 (#232)
- Add a translation request issue template (#243)

## 3.2.0 (2026-07-14)

### Added
- Add MeteoSwiss adapter for Switzerland (#186) (#192)
- Read geocodes container into zone filtering (#197)
- Opt-in unavailableBehavior for broken alert sensors (#187) (#200)
- Add NSW RFS bushfire alert provider (#178) (#208)
- Degraded-source indicator for partial multi-entity breakage (#201) (#211)

### Fixed
- Render affected-area geometry as a map basemap (#185)
- Render alerts from sensors reporting state "unknown" (#188)
- Downlevel bundle to ES2019 for old Android WebViews (#194) (#198)
- Use warning_links for source link; render open-ended warnings as Ongoing (#186) (#203)

### Documentation
- Recommend CAP Alerts as the only ECCC source (#191)
- Add AI-assisted contribution policy (tool, not author) (#195)
- Document the sources feed auto-collection config key (#209)

### Internal
- Fix flaky device-mode dismissal test via suite-wide teardown (#193)

## 3.1.0 (2026-05-31)

### Added
- Opt-in affected-area mini-map for CAP alerts (#181)

## 3.0.3 (2026-05-30)

### Fixed
- Tint preparation icon ring with severity color (#179)

## 3.0.2 (2026-05-26)

### Fixed
- Normalize hyphen/slash separators in getWeatherIcon (#176)

## 3.0.1 (2026-05-25)

### Fixed
- Suppress URN identifiers from source link (#170)
- Address audit findings (perf, render purity, filter safety, robustness) (#172)

### Documentation
- Add v3 migration guide and fix community thread URL (#169) (closes #168)

## 3.0.0 (2026-05-12)

> [!IMPORTANT]
> **Breaking**
> - Dashboards still using custom:nws-alerts-card must update to custom:weather-alerts-card.

### Added
- WCAG contrast-aware colors (off|subtle|strict) + knockouts (#150)
- Add opt-in browser-local alert dismissal with undo (#155)
- Add CAP Alerts adapter with device auto-discovery (#158)
- Add ECCC adapter for Environment Canada alerts (#160)
- Pass through provider-supplied MDI icon from CAP adapter (#162)
- Dismiss trigger + style options, pointer drag-to-dismiss (#163)

### Internal
- Use host networking with explicit DNS (#153)
- Split meteoalarm areaDesc on commas (#154)
- Remove v1 backwards-compatibility shims ahead of v3 (#156)
- Dependency update pass — TypeScript 6, drop custom-card-helpers (#164)
- Add ECCC color theme column to themes screenshot (#165)

## 2.11.1 (2026-04-18)

### Fixed
- Use OR wrapper for multi-entity hideNoAlerts visibility (#148)

### Documentation
- Add Support section to README (#147)

## 2.11.0 (2026-04-17)

### Added
- Add expandDetails option to render details inline without toggle (#137) (closes #136)
- Add cross-provider alert deduplication and provider label (#140)

### Fixed
- Default showProvider to false to avoid breaking existing setups (#142)

### Documentation
- README polish + dedup screenshot provider labels (#145)

## 2.10.0 (2026-04-08)

### Added
- Support multiple entities in a single card (#129)
- Show sample data toggle with nudge when no alerts active (#133)

### Fixed
- Preserve NWS period forecast lines and make release script resumable (#126)
- Show hint when no provider entities are found (#128)

### Changed
- Inject card version from package.json at build time (#132)

### Internal
- Update dependencies and fix rollup build (#131)

## 2.9.0 (2026-04-04)

### Added
- Add reformatText option to strip NWS hard line wraps (#119)
- Add detail section visibility toggles (#122)
- Add section dividers to group related controls (#123)

### Fixed
- Resolve HACS validate race condition and Node.js 20 deprecation (#118)
- Preserve expanded alert state across config changes (#120)

### Documentation
- Fix documentation drift and remove dead i18n keys (#121)

## 2.8.1 (2026-04-02)

### Fixed
- Use English awareness_type for MeteoAlarm icon lookup (#115)

## 2.8.0 (2026-04-01)

### Added
- Add German (de) localization (#110)
- Add DWD adapter for German weather warnings (#112)

### Internal
- Add missing Italian localization tests (#111)

## 2.7.1 (2026-04-01)

### Fixed
- Handle expired alerts and unify rendering pipelines (#106)
- Default hideExpired to true so expired alerts are hidden by default (#107)
- Extend shimmer travel range so animation resets off-screen (#108)

## 2.7.0 (2026-03-30)

### Added
- Add hideNoAlerts option to suppress empty-state banner (#97)
- Add configurable font size with fontSize option and --wac-scale CSS property (#101)
- Add severity and certainty data purity indicators (#103)

### Internal
- Revert cliff.toml to enforce conventional commits via PR titles

## 2.6.0 (2026-03-28)

### Added
- Filter entity picker to compatible alert entities (#92)
- Integrate progress bar into compact layout (#86)

### Documentation
- Refresh README with config table and theme showcase (#95)

### Internal
- Rework testing-zones script for diversity scoring (#91)
- Regenerate screenshots at release time (#93)

## 2.5.2 (2026-03-28)

### Fixed
- Allow selecting "All severities" in min severity dropdown (#88) (closes #87)

## 2.5.1 (2026-03-27)

### Fixed
- Prevent HACS validate race with release asset upload (#83)
- Restore push trigger on all main commits (#84)

## 2.5.0 (2026-03-26)

### Added
- Add excludeEventCodes config option to filter out unwanted alerts (#72)
- Display alert headlines with smart redundancy filtering (#76)
- Add showSourceLink config option to hide source links (#75) (#77)
- Rename headline config option to deduplicateHeadlines (#80)
- Add MeteoAlarm awareness level color theme (#81)

## 2.4.0 (2026-03-26)

### Added
- Internationalize card UI and editor for en/fr/es (#61) (closes #46)
- Icon-box temporal state + progress label hierarchy (#63)
- Add custom notes and new-contributor flags to publish script (#70)

### Fixed
- Make publish script idempotent for safe re-runs (#64)
- Add checkout and build steps to HACS validation workflow (#68)
- Run HACS validation on main push only, not PRs (#69)

### Documentation
- Add missing eventCodes and timezone options to README (#60)
- Update installation instructions in README.md (#67)

## 2.3.0 (2026-03-24)

### Added
- Show preview with placeholder alerts in card picker (#53)
- Add browser timezone option for traveling users (#55)
- Add NWS event code support and filtering (#57)
- Expand weather icon coverage for more event types (#58)

### Fixed
- Use NWS color-triggering keywords in placeholder alert names
- Update repo links for rename to weather_alerts_card
- Use old repo name in HACS link until default store updates
- Remove HACS button until default store reflects rename

### Internal
- Regenerate adaptive hero SVG from 2x DPR PNGs
- Cleanup README, release scripts, and build step (#54)

## 2.2.0 (2026-03-22)

### Added
- Display provider-native severity labels on badge (#48)
- Add PirateWeather adapter (#44) (#49)

### Fixed
- Generate release notes before tagging
- Use HA dark mode detection for severity badge text color (#51)

### Internal
- Add most-alerted-zones lookup script (#47)
- Stop tracking dist bundle and config dir (#50)

## 2.1.0 (2026-03-15)

### Added
- Deduplicate alerts across zones (#37)

### Fixed
- Put migration notice before changelog in release notes

### Documentation
- Add theme-aware hero images for README (#39)
- Expand last compact alert in hero screenshots (#40)
- Add adaptive hero svg
- Add adaptive hero svg generator script

### Internal
- Skip release commits from changelog

## 2.0.0 (2026-03-15)

> [!IMPORTANT]
> **Breaking**
> - Rename to "Weather Alerts Card" for multi-provider support (#25)

### Added
- Add MeteoAlarm (Europe) adapter (#11)
- Rename to "Weather Alerts Card" for multi-provider support (#25) (closes #13)
- Display affected area description on alert cards (#27)
- Add styled console log with card name and version at load time (#30)

### Fixed
- Remove push trigger from validate workflow to prevent duplicate runs (#23)
- Align NwsAlert type with nws_alerts integration fields (#26)
- Use npx to run git-cliff in publish script
- Remove extra blank lines between changelog entries (#29)
- Add version headers to changelog and fix cliff config path (#32)
- Scope release notes to correct version range (#33)
- Add migration notice to GA release notes and clarify HACS resource path (#35)

### Internal
- Streamline agent skills and dev workflow (#22)
- Add meteoalarm configuration to dev container (#24)

## 1.10.0 (2026-03-12)

### Added
- Add minimum severity filter configuration (#20)

## 1.9.2 (2026-03-10)

### Fixed
- Stop closed event propagation at editor container level (#15) (closes #14)
- Migrate ha-select to HA 2026.02+ WebAwesome components (#17) (closes #14)

## 1.9.0 (2026-03-09)

### Added
- Add automated screenshot utility for README images
- Add multi-provider adapter pattern with BoM support (#1) (#4)
- Support ha_bom_australia integration with area_id zone filtering (#7)

### Fixed
- Use absolute URLs for README images so they display in HACS (#9)

### Documentation
- Readme img udates, repo janitorial duties
- Update README for official HACS procedure

### Internal
- CI hardening, repo hygiene, and test scaffolding (#2)
- Update release skill for branch-protected workflow (#3)

## 1.8.0 (2026-02-20)

### Added
- Fix WCAG color contrast for severity and active badges
- Use luminance-based badge text for NWS theme, media-query for severity

### Internal
- Update release skill gh release create flags
- Remove obsolete docker compose version key

## 1.7.0 (2026-02-20)

### Added
- Sanitize alert HTML with DOMPurify before rendering
- Explicit locale/timezone handling for timestamps and progress bars

### Documentation
- Update animations option docs for prefers-reduced-motion behavior
- Generalize / update documentation

### Internal
- Add claude configuration

## 1.6.0 (2026-02-19)

### Documentation
- Document colorTheme, compact layout, sort order, and visual editor

## 1.5.0 (2026-02-19)

### Added
- Add colorTheme config option for NWS official event colors

## 1.4.1 (2026-02-19)

### Fixed
- Show clean in-card message when sensor is unavailable or unknown

### Changed
- Reduce repetition across utils, card, and styles

## 1.3.0 (2026-02-17)

### Documentation
- Add CHANGELOG.md and document release flow
- Add home assistant community thread link

## 1.2.0 (2026-02-17)

### Added
- Add animations config toggle

### Documentation
- Remove stale v1.yml reference

### Internal
- Update documentation images
- Bump version to 1.2.0

## 1.1.1 (2026-02-16)

### Fixed
- Respect HA date format setting

## 1.1.0 (2026-02-16)

### Fixed
- Vertically center badge text and respect HA time format

## 1.0.0 (2026-02-16)

### Added
- Add visual configuration editor

### Documentation
- Remove redundant HACS mention, add zone ommission explanation

### Internal
- Remove old dist files

## 0.0.2 (2026-02-16)

### Fixed
- Add dist folder, add hacs country code

## 0.0.1 (2026-02-15)

### Added
- Add initial project structure and files
- Set up Lovelace card template with TypeScript and LitElement
- Enable experimentalDecorators in tsconfig
- Set up homeassistant dev container
- Add basic Home Assistant configuration with default components

### Fixed
- Ensure build configuration is correct with proper output settings
- Remove unrelated Open WebUI service from docker-compose.yml
- Explicitly set project name in docker-compose.yml to avoid conflicts
- Explicitly set project name in docker-compose.yml to isolate environment
- Commit package-lock.json for reproducible CI builds
- Commit dist/nws-alerts-card.js for HACS validation

### Changed
- Implement nws alerts card - convert from manual yml

### Documentation
- Add detailed devcontainer usage instructions
- Add screenshots to README for HACS validation
