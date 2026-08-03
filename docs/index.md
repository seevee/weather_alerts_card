---
layout: home

hero:
  name: Weather Alerts Card
  text: Weather alerts, done properly
  tagline: A custom Home Assistant Lovelace card for severe-weather alerts — nine providers, severity-aware colors, time progress bars and expandable details.
  image:
    src: /img/hero-adaptive.svg
    alt: The Weather Alerts Card showing several active alerts
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Configuration reference
      link: /configuration
    - theme: alt
      text: View on GitHub
      link: https://github.com/seevee/weather_alerts_card

features:
  - title: Multi-provider
    details: NWS (US), BoM (Australia), MeteoAlarm (Europe), DWD (Germany), MeteoSwiss, ECCC (Canada), NSW RFS, PirateWeather and CAP Alerts — with auto-detection from entity attributes.
  - title: Color themes
    details: Severity-based by default, or the official NWS event, MeteoAlarm awareness-level, or ECCC public-alert palettes — with per-event contrast correction.
  - title: Time progress bars
    details: Elapsed and remaining time with relative and absolute timestamps, and honest "ongoing" handling for feeds that carry no expiry.
  - title: Expandable details
    details: Sanitized description, instructions and a source link — inline, or in a per-alert modal via tap_action.
  - title: Affected-area mini-map
    details: An optional inline outline of a CAP alert's polygon, with an opt-in raster-tile basemap for geographic context.
  - title: Broken-source safety badge
    details: When a configured sensor goes unavailable, a degraded indicator names the broken source. A dead feed is never treated as proof of safety.
  - title: Themeable surfaces
    details: A small, stable set of --wac-* CSS custom properties for backgrounds, borders, corners and shadows. No card config needed.
  - title: Localized UI
    details: English, French, Spanish, Italian, German and Simplified Chinese, auto-detected from your Home Assistant locale.
  - title: Visual config
    details: Every option is available in the visual editor. No YAML editing required.
---

## What it does

The card reads an alert sensor from a weather integration and renders each active
alert with a severity color, an icon, a headline, and a progress bar showing how
much of the alert's window has elapsed. Tapping an alert expands the full
description and instructions.

Nine providers are supported through an **adapter** layer: whatever integration you
run, the card normalizes its output into one internal alert shape, so every feature
below behaves the same regardless of where the data came from. In most cases you
only have to point the card at an entity — the provider is auto-detected.

## Where to go next

| If you want to… | Read |
|---|---|
| Install the card and get a first alert on screen | [Getting Started](./getting-started) |
| Look up a config option | [Configuration](./configuration) |
| Change colors, surfaces, or translucency | [Theming](./theming) |
| Find the right integration for your region | [Providers](./providers) |
| Open alerts in a pop-up instead of expanding inline | [Recipes](./recipes/detail-popup) |
| Build the card from source | [Development](./development) |

## Beyond the basics

- **Filtering** — restrict by zone code, event code, or a minimum severity threshold.
- **Layouts** — a full card, or a `compact` one-row-per-alert list that expands on tap.
- **Dismissal** — optional per-alert dismiss by button or swipe, with undo and a
  restore-all control, stored browser-locally.
- **Deduplication** — collapse the same alert repeated across zones and providers.

## Support

If you find this card useful, tip the author at [Ko-fi](https://ko-fi.com/seeveezee),
or donate to [The Y'all Squad](https://www.theyallsquad.org/donate) — a rapid-response
program providing direct aid, chainsaws, and supplies to families affected by severe
weather events.

Questions and screenshots are welcome on the
[Home Assistant Community thread](https://community.home-assistant.io/t/weather-alerts-card).
