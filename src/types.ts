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
export type AlertProvider = 'nws' | 'bom';

export interface NwsAlertsCardConfig {
  type: string;
  entity: string;
  title?: string;
  zones?: string[];
  minSeverity?: AlertSeverity;
  sortOrder?: 'default' | 'onset' | 'severity';
  animations?: boolean;  // undefined: respects prefers-reduced-motion; true: always animate; false: never animate
  layout?: 'default' | 'compact';
  colorTheme?: 'severity' | 'nws';
  provider?: AlertProvider;  // undefined: auto-detect from entity attributes
}

// Normalized alert consumed by the card UI — provider-agnostic
export interface WeatherAlert {
  id: string;
  event: string;           // e.g. "Severe Thunderstorm Warning"
  severity: AlertSeverity;
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
  provider: AlertProvider;
  phase: string;           // Lifecycle phase, e.g. "New", "Update", "Final" (empty if N/A)
}

// Adapter contract: converts raw entity attributes → WeatherAlert[]
export interface AlertAdapter {
  provider: AlertProvider;
  canHandle(attributes: Record<string, unknown>): boolean;
  parseAlerts(attributes: Record<string, unknown>): WeatherAlert[];
}

// Raw NWS alert shape from the nws_alerts integration (v6.1+)
export interface NwsAlert {
  ID: string;
  Event: string;
  Severity: string;
  Certainty: string;
  Urgency: string;
  Sent: string;
  Onset: string;
  Ends: string;
  Expires: string;
  Description: string;
  Instruction: string;
  URL: string;
  Headline: string;
  AreaDesc: string;
  AffectedZones: string[];
  Geocode: {
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
