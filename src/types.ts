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
  // Live WS connection — used to subscribe to entity_registry updates.
  connection?: Connection;
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
export type AlertProvider = 'nws' | 'bom' | 'meteoalarm' | 'pirateweather' | 'dwd' | 'cap' | 'eccc' | 'meteoswiss';
export type ContrastMode = 'off' | 'subtle' | 'strict';

export interface WeatherAlertsCardConfig {
  type: string;
  entity: string;
  entities?: string[];           // additional entities to merge alerts from
  device?: string;               // HA device_id — auto-discovers per-alert sensors under it. Provider-agnostic; currently only the CAP Alerts integration produces this shape.
  title?: string;
  zones?: string[];
  eventCodes?: string[];       // NWS event codes to include, e.g. ["SVR","TOR"] — empty/omitted = all
  excludeEventCodes?: string[]; // NWS event codes to exclude, e.g. ["SCY"] — empty/omitted = none excluded
  minSeverity?: AlertSeverity;
  sortOrder?: 'default' | 'onset' | 'severity';
  animations?: boolean;  // undefined: respects prefers-reduced-motion; true: always animate; false: never animate
  layout?: 'default' | 'compact';
  fontSize?: 'small' | 'default' | 'large' | 'x-large';
  colorTheme?: 'severity' | 'nws' | 'meteoalarm' | 'eccc';
  enhanceContrast?: ContrastMode;  // undefined/'subtle': two-tier WCAG boost on NWS/MeteoAlarm colors — text tier (~2:1) darkens icon/label, progress tier (~1.3:1) darkens the progress-bar fill; 'strict': tighter thresholds (text ~3:1, progress ~2:1) for WCAG-AA-style accessibility; 'off': always render raw colors. Triggered per event + per theme mode against the active card background.
  provider?: AlertProvider;  // undefined: auto-detect from entity attributes
  deduplicate?: boolean;     // undefined/true: dedup on; false: dedup off
  deduplicateHeadlines?: boolean; // undefined/true: filter redundant headlines; false: show all verbatim
  hideExpired?: boolean;     // undefined/true: hide expired alerts; false: show them (dimmed)
  hideNoAlerts?: boolean;    // undefined/false: show "No active alerts" banner; true: hide it
  unavailableBehavior?: 'message' | 'compact' | 'hide'; // how a broken alert sensor (unavailable/unknown + zero parseable alerts) is shown when EVERY resolved entity is broken. undefined/'message': full notice banner; 'compact': muted one-liner; 'hide': hide the card entirely. Has no effect on partial breakage (some but not all entities broken), which falls through to normal rendering.
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
