import type { Connection } from 'home-assistant-js-websocket';

// HA types (subset needed by card + editor)
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  locale: {
    language: string;
    time_format: 'language' | '12' | '24';
    date_format: 'language' | 'DMY' | 'MDY' | 'YMD';
  };
  config?: {
    time_zone?: string;  // IANA tz name, e.g. "America/Denver"
  };
  themes?: {
    darkMode?: boolean;
  };
  // Entity registry, keyed by entity_id. Available in HA 2023.4+.
  entities?: Record<string, EntityRegistryDisplayEntry>;
  // Device registry, keyed by device id. Used to name a dark device source
  // (message mode shows *which* source). Best-effort: absent on very old cores.
  devices?: Record<string, DeviceRegistryDisplayEntry>;
  // Live WS connection — used to subscribe to entity_registry updates.
  connection?: Connection;
  // Fire a HA service call. Present on the real hass object; typed here as the
  // subset used by tap_action dispatch (toggle / call-service).
  callService?(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: Record<string, unknown>,
  ): Promise<unknown>;
}

// Standard Home-Assistant action config accepted by `tap_action`. `assist` is
// intentionally excluded (it opens the voice-assistant dialog — meaningless on
// an alert row). The index signature carries arbitrary `fire-dom-event` payloads.
export interface ActionConfig {
  action:
    | 'more-info'
    | 'navigate'
    | 'url'
    | 'toggle'
    | 'call-service'
    | 'perform-action'
    | 'fire-dom-event'
    | 'none';
  entity?: string;
  navigation_path?: string;
  navigation_replace?: boolean;
  url_path?: string;
  service?: string;
  perform_action?: string;
  data?: Record<string, unknown>;
  service_data?: Record<string, unknown>;
  target?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DeviceRegistryDisplayEntry {
  id: string;
  name?: string | null;
  name_by_user?: string | null;
}

export interface HassEntity {
  state: string;
  attributes: Record<string, unknown>;
}

export interface EntityRegistryDisplayEntry {
  entity_id: string;
  device_id?: string | null;
  area_id?: string | null;
  hidden?: boolean;
  entity_category?: string | null;
  platform?: string;
}

export type AlertSeverity = 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown';
export type AlertProvider = 'nws' | 'bom' | 'meteoalarm' | 'pirateweather' | 'dwd' | 'cap' | 'eccc' | 'meteoswiss' | 'nsw_rfs';
export type ContrastMode = 'off' | 'subtle' | 'strict';

// Progress-bar decoration (pattern) applied to a temporal phase's fill. Direction
// is intrinsic to the phase (not chosen here) — any decoration adopts its phase's
// flow. `solid` = no texture/animation. See ProgressStyleConfig.
export type ProgressDecoration = 'solid' | 'striped' | 'shimmer' | 'pulse';

// Per-phase progress-bar decoration overrides. Every key optional; omitting a key
// keeps that phase's default (preparation: striped, active: shimmer, ongoing:
// pulse), reproducing today's rendering exactly. `expired` is not configurable
// (always a dimmed solid bar).
export interface ProgressStyleConfig {
  preparation?: ProgressDecoration; // default 'striped'
  active?: ProgressDecoration;      // default 'shimmer'
  ongoing?: ProgressDecoration;     // default 'pulse'
}

// Icon-ring border style per temporal phase. Every key optional; omitting a key
// keeps that phase's default (preparation: dashed, active: solid, ongoing: solid),
// reproducing today's rendering exactly. `expired` is not configurable (always a
// dimmed solid ring).
export type IconBorderStyle = 'dashed' | 'solid';
export interface IconBorderStyleConfig {
  preparation?: IconBorderStyle; // default 'dashed'
  active?: IconBorderStyle;      // default 'solid'
  ongoing?: IconBorderStyle;     // default 'solid'
}

// Configurable temporal phases for progress/icon decoration (expired is fixed,
// always dimmed-solid, so it is never a configurable phase).
export type DecoPhase = 'preparation' | 'active' | 'ongoing';

// Per-phase defaults reproducing today's rendering when config is omitted.
// Shared by the card (class resolution) and the editor (default detection /
// key pruning) so the two can never drift.
export const PROGRESS_DECO_DEFAULTS: Record<DecoPhase, ProgressDecoration> = {
  preparation: 'striped',
  active: 'shimmer',
  ongoing: 'pulse',
};
export const ICON_BORDER_DEFAULTS: Record<DecoPhase, IconBorderStyle> = {
  preparation: 'dashed',
  active: 'solid',
  ongoing: 'solid',
};

export interface WeatherAlertsCardConfig {
  type: string;
  entity: string;
  entities?: string[];           // additional entities to merge alerts from
  device?: string;               // HA device_id — auto-discovers per-alert sensors under it. Provider-agnostic; currently only the CAP Alerts integration produces this shape.
  sources?: string[];            // geo_location feed `source` attribute values (e.g. ["nsw_rural_fire_service_feed"]) — auto-collects EVERY entity carrying that source, so per-incident providers (NSW RFS) never need hand-listed, churning entity ids. Usually auto-filled by selecting the matching provider.
  title?: string;
  zones?: string[];
  eventCodes?: string[];       // NWS event codes to include, e.g. ["SVR","TOR"] — empty/omitted = all
  excludeEventCodes?: string[]; // NWS event codes to exclude, e.g. ["SCY"] — empty/omitted = none excluded
  minSeverity?: AlertSeverity;
  sortOrder?: 'default' | 'onset' | 'severity';
  animations?: boolean;  // undefined: respects prefers-reduced-motion; true: always animate; false: never animate
  progressStyle?: ProgressStyleConfig; // per-phase progress-bar decoration; omit for defaults (prep striped, active shimmer, ongoing pulse)
  iconBorderStyle?: IconBorderStyleConfig; // per-phase icon-ring border style; omit for defaults (prep dashed, active solid, ongoing solid)
  tap_action?: ActionConfig; // standard HA action fired when an alert row is tapped; presence replaces the inline expand/toggle affordance in both layouts. Absent = unchanged inline-expand behavior
  layout?: 'default' | 'compact';
  fontSize?: 'small' | 'default' | 'large' | 'x-large';
  progressFill?: 'track' | 'background'; // undefined/'track': thin progress bar (full) / bottom mini-bar (compact); 'background': Bubble-Card-style whole-row low-opacity wash growing to --progress, behind the content (thin track hidden, labels kept)
  colorTheme?: 'severity' | 'nws' | 'meteoalarm' | 'eccc';
  enhanceContrast?: ContrastMode;  // undefined/'subtle': two-tier WCAG boost on NWS/MeteoAlarm colors — text tier (~2:1) darkens icon/label, progress tier (~1.3:1) darkens the progress-bar fill; 'strict': tighter thresholds (text ~3:1, progress ~2:1) for WCAG-AA-style accessibility; 'off': always render raw colors. Triggered per event + per theme mode against the active card background.
  provider?: AlertProvider;  // undefined: auto-detect from entity attributes
  deduplicate?: boolean;     // undefined/true: dedup on; false: dedup off
  deduplicateHeadlines?: boolean; // undefined/true: filter redundant headlines; false: show all verbatim
  hideExpired?: boolean;     // undefined/true: hide expired alerts; false: show them (dimmed)
  hideNoAlerts?: boolean;    // undefined/false: show "No active alerts" banner; true: hide it
  unavailableBehavior?: 'message' | 'compact' | 'hide'; // how a dark source (unavailable/unknown + zero parseable alerts, for SOME or ALL resolved entities) is signalled. The form depends on whether alerts exist to anchor to: with alerts, undefined/'message' shows an in-flow strip above them (names the source, counts when >1) and 'compact' floats a corner dot over them (label retained as accessible/title text); with no alerts, both collapse into a qualified empty state ("No active alerts" + caveat) — no strip or dot. 'hide': no signal at all. Any signal keeps the card on screen even under hideNoAlerts; the card fully hides only when there are no alerts AND hideNoAlerts is set AND (unavailableBehavior is 'hide' OR nothing is broken).
  showDetails?: boolean;     // undefined/true: show expandable detail panel; false: hide entirely
  expandDetails?: boolean;   // undefined/false: details collapsed behind toggle; true: details always visible, toggle removed
  showMetadata?: boolean;    // undefined/true: show metadata grid in details; false: hide
  showDescription?: boolean; // undefined/true: show description block in details; false: hide
  showInstructions?: boolean; // undefined/true: show instructions block in details; false: hide
  showGeometry?: boolean;    // undefined/false: no geometry mini-map; true: show affected-area SVG in details (cap_alerts only)
  geometryStyle?: 'shape' | 'map'; // undefined/'shape': bare polygon outline (offline); 'map': OSM raster-tile basemap behind the polygon (opt-in, fetches tiles, online). Only applies when showGeometry is on.
  geometryTileUrl?: string;  // undefined: default CARTO basemap (theme-aware light/dark, same tiles HA's map uses); override slippy-map template ({z}/{x}/{y}[/{s}]) for self-hosted/proxied/privacy sources. Only applies when geometryStyle: 'map'.
  geometryTileAttribution?: string; // undefined: attribution for the default/override source; set to credit a custom geometryTileUrl provider. Only applies when geometryStyle: 'map'.
  showProvider?: boolean;    // undefined/false: hide provider hint; true: show provider label above title
  showSourceLink?: boolean;  // undefined/true: show "Open Source" link; false: hide link (kiosk mode)
  timezone?: 'server' | 'browser';  // undefined/'server': HA server tz; 'browser': client tz
  reformatText?: boolean;    // undefined/true: strip hard line wraps from alert text; false: preserve raw formatting
  allowDismiss?: boolean;    // undefined/false: no dismiss UI; true: per-alert × button with browser-local dismissal list
  showDismissUndo?: boolean; // undefined/true: fire HA toast on dismiss; false: silent. No effect when allowDismiss is off
  dismissTrigger?: 'button' | 'swipe' | 'both'; // undefined/'button': × button only; 'swipe': left drag/swipe only (touch + mouse via Pointer Events; no button); 'both': button + drag. Requires allowDismiss: true
  dismissButtonStyle?: 'icon' | 'labeled'; // undefined/'icon': × icon only; 'labeled': icon + "Dismiss" text pill (compact always icon-only). No effect when dismissTrigger: 'swipe'
  _preview?: boolean;        // transient editor-only key — triggers preview mode in card
  visibility?: Record<string, unknown>[];  // HA-managed visibility conditions (set via dashboard editor)
}

/**
 * Per-alert record in the browser-local dismissal list.
 * sig captures the CAP-lifecycle fields that, when changed, should
 * re-surface a dismissed alert (severity, sentTs, endsTs, phase).
 */
export interface DismissalRecord {
  sig: string;
  dismissedAt: number;  // Unix seconds
  lastSeenAt: number;   // Unix seconds — refreshed while the alert is still present
}

// Normalized alert consumed by the card UI — provider-agnostic
export interface WeatherAlert {
  id: string;
  sourceEntityId?: string; // entity_id this alert was parsed from; stamped during collection, consumed for per-alert tap_action more-info/toggle targeting
  event: string;           // e.g. "Severe Thunderstorm Warning"
  severity: AlertSeverity;
  severityLabel: string;   // Human-readable severity label from provider (e.g. "Moderate", "Major")
  certainty: string;       // e.g. "Likely", "Observed" — empty string if provider lacks this
  urgency: string;         // e.g. "Immediate" — empty string if provider lacks this
  sentTs: number;          // Unix seconds — when alert was issued (0 if unknown)
  onsetTs: number;         // Unix seconds — when alert becomes active (0 if unknown)
  endsTs: number;          // Unix seconds — when alert expires (0 if unknown)
  description: string;     // Full text (may be empty for providers without detail data)
  instruction: string;     // Actionable advice (may be empty)
  url: string;             // Link to official source (may be empty)
  headline: string;        // Short title
  areaDesc: string;        // Affected area description
  zones: string[];         // Normalized zone codes for filtering (uppercase)
  eventCode: string;       // Standardized event code, e.g. "SVR", "TOR" (empty if unavailable)
  provider: AlertProvider;
  phase: string;           // Lifecycle phase, e.g. "New", "Update", "Final" (empty if N/A)
  severityInferred: boolean;  // true if severity was synthesized/inferred, not raw from provider
  certaintyInferred: boolean; // true if certainty was synthesized/inferred, not raw from provider
  iconHint?: string;       // English keyword for icon lookup when event may be localized (e.g. MeteoAlarm)
  providerIcon?: string;   // Raw MDI icon from provider (e.g. 'mdi:weather-tornado'); bypasses dictionary when present
  mergedCount?: number;    // Number of alerts collapsed by dedup (set only when > 1)
  colorHint?: string;      // Provider-published color tag (currently only ECCC: red/orange/yellow/grey/green); consumed by getEcccColor when colorTheme: 'eccc'
  severityBadgeLabel?: string; // Optional override for the severity badge text (rendered raw, e.g. ECCC's `impact` field "High"/"Élevée"). Falls back to localized tier when absent.
  bbox?: [number, number, number, number]; // [minlon, minlat, maxlon, maxlat] (lon-first); synchronous from cap_alerts attributes. Drives the geometry mini-map frame.
  geometryRef?: string;    // Opaque handle for the out-of-band cap_alerts geometry fetch (full polygon). Empty/absent when unavailable.
}

// Adapter contract: converts raw entity attributes → WeatherAlert[]
export interface AlertAdapter {
  provider: AlertProvider;
  canHandle(attributes: Record<string, unknown>): boolean;
  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[];
  // Per-incident providers (e.g. NSW RFS) explode a feed into many
  // dynamically-named entities, each carrying a `source` state attribute. An
  // adapter lists those source values here so the card can auto-collect every
  // matching entity by source instead of relying on hand-listed entity ids.
  // Absent/empty for providers backed by a single stable sensor.
  feedSources?: string[];
}

// Raw NWS alert shape from the nws_alerts integration (v6.1+)
// The integration uses AreasAffected (not AreaDesc) and does not include
// AffectedZones, Geocode, or Urgency — all are optional for resilience.
export interface NwsAlert {
  ID: string;
  Event: string;
  Severity: string;
  Certainty?: string;
  Urgency?: string;
  NWSCode?: string;          // NWS PPS event code, e.g. "TOW", "SVW" (v6.6+)
  Sent: string;
  Onset: string;
  Ends: string;
  Expires: string;
  Description: string;
  Instruction: string;
  URL: string;
  Headline: string;
  AreaDesc?: string;          // REST sensor / future integration versions
  AreasAffected?: string;     // nws_alerts integration (v5+)
  AffectedZones?: string[];   // REST sensor / future integration versions
  Geocode?: {
    UGC?: string[];
    SAME?: string[];
  };
}

// Raw BoM warning shape from the bureau_of_meteorology integration
export interface BomWarning {
  id: string;
  area_id?: string;         // e.g. "NSW_FL049" — geographic zone identifier (ha_bom_australia)
  type: string;             // e.g. "severe_thunderstorm_warning", "flood_warning"
  title: string;            // Full warning title
  short_title: string;      // Abbreviated title
  state: string;            // Australian state code, e.g. "NSW"
  warning_group_type: string; // "major" or "minor"
  issue_time: string;       // ISO 8601 timestamp
  expiry_time: string;      // ISO 8601 timestamp
  phase: string;            // "new", "update", "renewal", "downgrade", "upgrade", "final", "cancelled"
}

// Raw ECCC alert shape published by the HACS environment_canada custom
// component (michaeldavie/environment_canada_hacs). All fields are optional
// because the integration filters None values before publishing.
export interface EcccAlert {
  title?: string;
  issued?: string;       // ISO 8601 with timezone
  expiry?: string;       // ISO 8601 with timezone
  color?: string;        // 'red' | 'orange' | 'yellow' | 'grey' | 'green'
  text?: string;         // multi-paragraph plain text
  area?: string;         // single string, e.g. "Marathon - Schreiber"
  status?: string;       // 'new' | 'continued' | 'updated' | 'cancelled' | 'ended' | …
  confidence?: string;   // 'Low' | 'Moderate' | 'High'
  impact?: string;       // 'Low' | 'Medium' | 'High'
  alert_code?: string;   // EC short code, e.g. 'RFW'
  type?: string;         // 'warning' | 'watch' | 'advisory' | 'statement' | 'ending'
  url?: string;          // optional — only present when upstream sets it
}

// Raw DWD warning shape from the dwd_weather_warnings integration (nested object at warning_N keys)
export interface DwdWarning {
  headline: string;
  description: string;
  instruction: string;
  start_time: string;     // ISO 8601 with timezone
  end_time: string;       // ISO 8601 with timezone
  event: string;          // e.g. "WINDBÖEN"
  event_code: number;     // DWD warning type ID, e.g. 31
  level: number;          // 0-4 severity level
  color: string;          // hex color, e.g. "#FFFF00"
  parameters: Record<string, string>;
}

// Raw MeteoSwiss warning shape, reconstructed per-index from the parallel
// arrays on the hass-swissweather aggregate `weather_warnings` sensor.
export interface MeteoSwissWarning {
  type: string;          // English enum name, e.g. "Wind", "Thunderstorms"
  levelLabel: string;    // e.g. "Severe hazard"
  level: number;         // WarningLevel IntEnum, 0-5
  validFrom: string | null; // ISO 8601
  validTo: string | null;   // ISO 8601
  text: string;
}

// Raw NSW RFS incident shape from the nsw_rural_fire_service_feed integration.
// The integration explodes each GeoJSON feature into one geo_location entity
// whose attributes are the fields below (the entity state is distance in km).
// All optional/defensive — a name drift degrades gracefully rather than throws.
export interface NswRfsIncident {
  external_id?: string;        // stable feed id, e.g. a GUID/URL
  category?: string;           // Australian Warning System ladder, e.g. "Advice", "Emergency Warning"
  status?: string;             // e.g. "Under control", "Being controlled", "Out of control"
  type?: string;               // e.g. "Bush Fire", "Grass Fire", "Hazard Reduction"
  location?: string;           // free-text location string
  council_area?: string;       // e.g. "Blue Mountains"
  size?: string | number;      // burnt area, e.g. "5 ha" or a bare number
  fire?: boolean;              // true when the incident is a fire
  responsible_agency?: string; // e.g. "Rural Fire Service"
  publication_date?: string;   // ISO 8601 timestamp
}

export interface AlertProgress {
  isActive: boolean;
  isExpired: boolean;
  phaseText: string;
  progressPct: number;
  remainingHours: number;
  onsetHours: number;
  onsetMinutes: number;
  onsetTs: number;
  endsTs: number;
  sentTs: number;
  nowTs: number;
  hasEndTime: boolean;
}
