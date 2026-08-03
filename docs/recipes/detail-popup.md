# Per-alert detail pop-up

**This is the recommended way to open alerts in a pop-up.** It is built into the card,
needs no add-ons, and is genuinely per-alert for every provider.

```yaml
type: custom:weather-alerts-card
entity: sensor.nws_alerts_alerts
provider: nws
layout: compact
tap_action:
  action: details
```

`tap_action: { action: details }` opens the tapped alert in a modal instead of expanding
it in place. Works in both `layout: default` and `layout: compact`.

## Why per-alert matters

The card renders the alert object it already holds, so an **aggregate** sensor carrying
five warnings still gives you five distinct pop-ups — one per row, each showing only
that alert.

This is the part hash-based pop-up recipes cannot do. A pop-up addressed by a URL hash
is one static pop-up: every row navigates to the same one, so it can only ever show
*all* current alerts. If you want the tapped alert, you want `action: details`.

## What the pop-up shows

The **whole alert** — icon, title, headline, area, badges, progress bar, metadata, and
the full description and instructions.

Because the pop-up *is* the detail view, the description is always open inside it; there
is no "Read Details" toggle to click. The visibility options still apply:

| Option | Applies in the pop-up? |
|---|---|
| `showDetails`, `showMetadata`, `showDescription`, `showInstructions`, `showGeometry` | Yes |
| `expandDetails` | No — it governs the row only |

## Notes

- Setting any `tap_action` **replaces the inline expand affordance**: the whole row
  becomes the tap target and the compact chevron / "Read Details" toggle is removed. In
  `layout: default`, `expandDetails: true` still renders the always-on panel below the
  row.
- `details` is card-owned rather than a standard Home Assistant action — you will not
  find it in HA's action documentation.
- To open the tapped alert's own **HA entity dialog** instead, use
  `tap_action: { action: more-info }`. On per-alert providers (CAP Alerts, NSW RFS) that
  opens *that* alert's sensor; on aggregate providers it falls back to the aggregate
  sensor.

## Alternatives

The [Bubble Card pop-up](./bubble-card-popup) recipe remains available, as does
`browser_mod` via `fire-dom-event`. Prefer `action: details` unless you specifically want
their pop-up chrome.
