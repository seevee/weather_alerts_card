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
}

export interface HassEntity {
  state: string;
  attributes: Record<string, unknown>;
}

export type AlertSeverity = 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown';
export type AlertProvider = 'nws' | 'bom' | 'meteoalarm' | 'pirateweather';

export interface WeatherAlertsCardConfig {
  type: string;
  entity: string;
  title?: string;
  zones?: string[];
  eventCodes?: string[];       // NWS event codes to include, e.g. ["SVR","TOR"] — empty/omitted = all
  excludeEventCodes?: string[]; // NWS event codes to exclude, e.g. ["SCY"] — empty/omitted = none excluded
  minSeverity?: AlertSeverity;
  sortOrder?: 'default' | 'onset' | 'severity';
  animations?: boolean;  // undefined: respects prefers-reduced-motion; true: always animate; false: never animate
  layout?: 'default' | 'compact';
  fontSize?: 'small' | 'default' | 'large' | 'x-large';
  colorTheme?: 'severity' | 'nws' | 'meteoalarm';
  provider?: AlertProvider;  // undefined: auto-detect from entity attributes
  deduplicate?: boolean;     // undefined/true: dedup on; false: dedup off
  deduplicateHeadlines?: boolean; // undefined/true: filter redundant headlines; false: show all verbatim
  /** @deprecated Use deduplicateHeadlines instead */
  headline?: boolean;
  hideNoAlerts?: boolean;    // undefined/false: show "No active alerts" banner; true: hide it
  showSourceLink?: boolean;  // undefined/true: show "Open Source" link; false: hide link (kiosk mode)
  timezone?: 'server' | 'browser';  // undefined/'server': HA server tz; 'browser': client tz
  _preview?: boolean;        // transient editor-only key — triggers preview mode in card
  visibility?: Record<string, unknown>[];  // HA-managed visibility conditions (set via dashboard editor)
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
  mergedCount?: number;    // Number of alerts collapsed by dedup (set only when > 1)
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

/** @deprecated Use WeatherAlertsCardConfig instead. Removed in v3. */
export type NwsAlertsCardConfig = WeatherAlertsCardConfig;

export interface AlertProgress {
  isActive: boolean;
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
