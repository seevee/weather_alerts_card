import { AlertAdapter, AlertProvider, AlertSeverity, WeatherAlert } from '../types';
import { normalizeSeverity, parseTimestamp } from '../utils';

// NINA (BBK, Germany) surfaces one `binary_sensor` per region *per message
// slot* (CONF_MESSAGE_SLOTS). An occupied slot carries the whole warning as
// flat attributes; an empty slot is `off` with `extra_state_attributes == {}`,
// so `canHandle` rejects it and the card sees "no active alerts" rather than a
// degraded source. The per-slot `sensor.*` siblings (headline, sender,
// severity, …) are single-value diagnostics with no alert attributes of their
// own, so device-mode collection skips them for the same reason.
//
// DEPRECATION: home-assistant/core#161882 marked every attribute below except
// `id` for removal in HA 2026.11, with the per-field diagnostic sensors as the
// replacement and `nina.get_details` (core#166125) covering `description` and
// `recommended_actions`, which got no sensor. Reassembling an alert from that
// shape needs an 8-entity fan-in plus a service call from the render path, so
// it is a different adapter, not a tweak to this one. This one is correct for
// every HA release up to and including 2026.10.

// NINA is a Germany-only feed and its message bodies are German, so the
// synthesised attribution line is labelled in German to match the text it is
// appended to (same principle as the English `Label: value` lines NSW RFS
// synthesises for its English feed).
const SENDER_LABEL = 'Herausgeber';

// DWD stamps a fixed template onto the headline of every weather message it
// pushes through NINA ("Amtliche WARNUNG vor extremer HITZE"). Stripping the
// boilerplate leaves the hazard itself for the row title, while the untouched
// headline stays on as the secondary line. Anchored, so the free-text headlines
// of the non-DWD sources NINA aggregates (LHP flood, MoWaS, KATWARN, BIWAPP)
// fall through verbatim.
const DWD_HEADLINE_PREFIX = /^(?:amtliche\s+)?(?:(?:extreme\s+)?(?:unwetter)?warnung|vorabinformation)\s+(?:vor\s+)?/i;

// DWD shouts the hazard in the headline ("extremer HITZE"); the card carries
// emphasis in the severity badge, so the extracted title is normalised to
// sentence-ish case. Only applied when the template actually matched — a
// pass-through headline is another sender's prose and is left alone.
function titleCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function eventFromHeadline(headline: string): string {
  if (!DWD_HEADLINE_PREFIX.test(headline)) return headline;
  const stripped = headline.replace(DWD_HEADLINE_PREFIX, '').trim();
  return stripped ? titleCase(stripped) : headline;
}

// `sender` has no first-class WeatherAlert home but names the issuing authority,
// which is the thing that separates a DWD heat warning from a district
// evacuation order. Double-newline separation survives reflowAlertText, which
// merges single-newline lines within a paragraph.
function buildDescription(description: string, sender: string): string {
  if (!sender) return description;
  const attribution = `${SENDER_LABEL}: ${sender}`;
  return description ? `${description}\n\n${attribution}` : attribution;
}

export class NinaAdapter implements AlertAdapter {
  provider: AlertProvider = 'nina';

  canHandle(attributes: Record<string, unknown>): boolean {
    // `recommended_actions` + `affected_areas` collide with no other adapter's
    // signature, and both keys are written unconditionally for an occupied slot
    // (empty *values* are normal — BBK messages often carry no advice).
    return typeof attributes['recommended_actions'] === 'string'
      && typeof attributes['affected_areas'] === 'string'
      && typeof attributes['id'] === 'string';
  }

  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[] {
    if (!this.canHandle(attributes)) return [];

    const id = str(attributes['id']);
    if (!id) return [];

    const headline = str(attributes['headline']);
    const rawSeverity = str(attributes['severity']);
    const severity = normalizeSeverity(rawSeverity) as AlertSeverity;

    const sentTs = parseTimestamp(str(attributes['sent']));
    // `start` and `expires` are written as '' when the message omits them, so
    // an open-ended warning lands on endsTs 0 → the card's honest "ongoing".
    const onsetTs = parseTimestamp(str(attributes['start'])) || sentTs;
    const endsTs = parseTimestamp(str(attributes['expires']));

    return [{
      id,
      event: eventFromHeadline(headline) || 'Warnung',
      severity,
      severityLabel: rawSeverity
        ? rawSeverity.charAt(0).toUpperCase() + rawSeverity.slice(1).toLowerCase()
        : severity.charAt(0).toUpperCase() + severity.slice(1),
      certainty: '',
      urgency: '',
      sentTs,
      onsetTs,
      endsTs,
      description: buildDescription(str(attributes['description']), str(attributes['sender'])),
      instruction: str(attributes['recommended_actions']),
      url: httpUrl(str(attributes['web'])),
      headline,
      // Comma-joined municipality names, truncated by the integration
      // ("… und 1144 weitere."). Prose, not codes — nothing to feed `zones`.
      areaDesc: str(attributes['affected_areas']),
      zones: [],
      eventCode: '',
      provider: 'nina',
      phase: '',
      // The integration substitutes the literal 'Unknown' when the message
      // carries no severity, so the value is always provider-supplied — never
      // something this adapter derived.
      severityInferred: false,
      certaintyInferred: false,
    }];
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function httpUrl(v: string): string {
  return v.startsWith('http://') || v.startsWith('https://') ? v : '';
}
