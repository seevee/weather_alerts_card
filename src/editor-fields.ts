import type { WeatherAlertsCardConfig } from './types';

// The visual editor's field registry: the single place a *simple* config key is
// declared. A simple key is one whose editor control is a switch or a
// dropdown, whose config value is a scalar, and whose only write rule is
// "delete the key when the value is the default, otherwise set it". Everything
// the editor knows about such a key — its default, its label, the panel it
// lives in, its options — comes from here, so adding one is a registry entry
// plus a call to the editor's render helper, not a handler and a template.
//
// Keys with any other write rule (entity/device/feed pickers, free text that is
// split into lists, `tap_action` payload spreading, the per-phase styling
// objects, `hideNoAlerts` with its visibility sync, the transient preview flag)
// stay as bespoke handlers in the editor. `PANELS` still lists them, so a
// collapsed panel can count them as customised.

export type Panel =
  | 'source'
  | 'filtering'
  | 'appearance'
  | 'details'
  | 'behavior'
  | 'dismissal'
  | 'advanced';

export type ToggleKey =
  | 'animations'
  | 'deduplicateHeadlines'
  | 'deduplicate'
  | 'showDetails'
  | 'expandDetails'
  | 'showMetadata'
  | 'showDescription'
  | 'showInstructions'
  | 'showGeometry'
  | 'showMyLocation'
  | 'showProvider'
  | 'providerColors'
  | 'showSourceLink'
  | 'hideExpired'
  | 'allowDismiss'
  | 'showDismissUndo'
  | 'reformatText'
  | 'layout';

export type SelectKey =
  | 'provider'
  | 'sortOrder'
  | 'colorTheme'
  | 'enhanceContrast'
  | 'fontSize'
  | 'timezone'
  | 'minSeverity'
  | 'unavailableBehavior'
  | 'geometryStyle'
  | 'dismissTrigger'
  | 'dismissButtonStyle'
  | 'progressFill';

export type SimpleKey = ToggleKey | SelectKey;
export type SimpleValue = string | boolean;

interface FieldBase {
  /** Translation key of the control's label. */
  label: string;
  panel: Panel;
  /** Effective value when the key is absent. Writing it deletes the key. */
  default: SimpleValue;
}

export interface ToggleField extends FieldBase {
  kind: 'toggle';
  key: ToggleKey;
  /** Value written when the switch is checked; the switch reads checked when
   *  the effective value equals it. */
  on: SimpleValue;
  /** Value written when the switch is unchecked. */
  off: SimpleValue;
}

export interface SelectField extends FieldBase {
  kind: 'select';
  key: SelectKey;
  /** Menu entries in display order; `label` is a translation key. */
  options: readonly { value: string; label: string }[];
}

export type Field = ToggleField | SelectField;

function bool(key: ToggleKey, panel: Panel, def: boolean, label: string): ToggleField {
  return { kind: 'toggle', key, panel, default: def, on: true, off: false, label };
}

function select(
  key: SelectKey,
  panel: Panel,
  def: string,
  label: string,
  options: readonly { value: string; label: string }[],
): SelectField {
  return { kind: 'select', key, panel, default: def, label, options };
}

const opts = (prefix: string, ...values: string[]) =>
  values.map(value => ({ value, label: `${prefix}${value.replace(/-/g, '_')}` }));

export const TOGGLE_FIELDS: readonly ToggleField[] = [
  bool('showProvider', 'appearance', false, 'editor.show_provider'),
  // Paint each alert in the color its issuer published (ECCC's tag,
  // MeteoAlarm's awareness colour, INMET's hex) over the colorTheme ladder.
  // Off by default so no dashboard changes on upgrade; `colorTheme: eccc`
  // always meant this, so the card treats it as on there (see
  // providerColorsEnabled in utils) and the editor normalises the config to say so.
  bool('providerColors', 'appearance', false, 'editor.provider_colors'),
  // `layout` is a two-value enum driven by one switch: checked writes
  // 'compact', unchecked writes the 'default' sentinel, which deletes the key.
  { kind: 'toggle', key: 'layout', panel: 'appearance', default: 'default', on: 'compact', off: 'default', label: 'editor.compact' },
  bool('animations', 'appearance', true, 'editor.animations'),
  bool('reformatText', 'advanced', true, 'editor.reformat_text'),
  bool('showDetails', 'details', true, 'editor.show_details'),
  bool('expandDetails', 'details', false, 'editor.expand_details'),
  bool('showMetadata', 'details', true, 'editor.show_metadata'),
  bool('showDescription', 'details', true, 'editor.show_description'),
  bool('showInstructions', 'details', true, 'editor.show_instructions'),
  bool('showGeometry', 'details', false, 'editor.show_geometry'),
  bool('showMyLocation', 'details', false, 'editor.show_my_location'),
  bool('showSourceLink', 'details', true, 'editor.show_source_link'),
  bool('deduplicate', 'advanced', true, 'editor.deduplicate'),
  bool('deduplicateHeadlines', 'advanced', true, 'editor.deduplicate_headlines'),
  bool('hideExpired', 'behavior', true, 'editor.hide_expired'),
  bool('allowDismiss', 'dismissal', false, 'editor.allow_dismiss'),
  bool('showDismissUndo', 'dismissal', true, 'editor.show_dismiss_undo'),
];

export const SELECT_FIELDS: readonly SelectField[] = [
  // `provider` is a pure parsing *override* — it forces one adapter for every
  // resolved entity. It is deliberately decoupled from feed collection (the
  // `sources` field / feed picker), so leaving it on Auto keeps mixed-provider
  // cards auto-detecting per entity. 'auto' is a sentinel: it deletes the key.
  select('provider', 'advanced', 'auto', 'editor.provider',
    opts('editor.provider_', 'auto', 'nws', 'bom', 'meteoalarm', 'dwd', 'nina', 'meteoswiss', 'eccc', 'nsw_rfs', 'inmet', 'pirateweather', 'cap')),
  select('minSeverity', 'filtering', 'all', 'editor.min_severity',
    opts('editor.severity_', 'all', 'minor', 'moderate', 'severe', 'extreme')),
  select('colorTheme', 'appearance', 'severity', 'editor.color_theme',
    opts('editor.color_', 'severity', 'nws', 'meteoalarm', 'eccc')),
  select('enhanceContrast', 'advanced', 'subtle', 'editor.enhance_contrast',
    opts('editor.enhance_contrast_', 'off', 'subtle', 'strict')),
  select('fontSize', 'appearance', 'default', 'editor.font_size',
    opts('editor.font_size_', 'small', 'default', 'large', 'x-large')),
  select('progressFill', 'appearance', 'track', 'editor.progress_fill',
    opts('editor.progress_fill_', 'track', 'background')),
  select('geometryStyle', 'details', 'shape', 'editor.geometry_style',
    opts('editor.geometry_style_', 'shape', 'map')),
  select('sortOrder', 'behavior', 'default', 'editor.sort_order',
    opts('editor.sort_', 'default', 'onset', 'severity')),
  select('timezone', 'advanced', 'server', 'editor.timezone',
    opts('editor.tz_', 'server', 'browser')),
  select('unavailableBehavior', 'behavior', 'message', 'editor.unavailable_behavior',
    opts('editor.unavailable_', 'message', 'compact', 'hide')),
  select('dismissTrigger', 'dismissal', 'button', 'editor.dismiss_trigger',
    opts('editor.dismiss_trigger_', 'button', 'swipe', 'both')),
  select('dismissButtonStyle', 'dismissal', 'icon', 'editor.dismiss_button_style',
    opts('editor.dismiss_button_style_', 'icon', 'labeled')),
];

export const TOGGLES: Readonly<Record<ToggleKey, ToggleField>> = Object.fromEntries(
  TOGGLE_FIELDS.map(f => [f.key, f]),
) as Record<ToggleKey, ToggleField>;

export const SELECTS: Readonly<Record<SelectKey, SelectField>> = Object.fromEntries(
  SELECT_FIELDS.map(f => [f.key, f]),
) as Record<SelectKey, SelectField>;

export const FIELDS: Readonly<Record<SimpleKey, Field>> = { ...TOGGLES, ...SELECTS };

/** Every config key each panel owns — registry keys and bespoke ones alike. A
 *  panel's "changed" count is the registry keys whose effective value differs
 *  from the default plus the bespoke keys that are present. */
export const PANELS: Readonly<Record<Panel, readonly (keyof WeatherAlertsCardConfig)[]>> = {
  source: ['entity', 'entities', 'device', 'devices', 'sources', 'title'],
  filtering: ['zones', 'eventCodes', 'excludeEventCodes', 'minSeverity', 'maxDistanceKm', 'myLocationEntity'],
  appearance: ['layout', 'colorTheme', 'providerColors', 'fontSize', 'animations', 'showProvider', 'progressFill', 'progressStyle', 'iconBorderStyle'],
  details: ['showDetails', 'expandDetails', 'showMetadata', 'showDescription', 'showInstructions', 'showGeometry', 'geometryStyle', 'showMyLocation', 'showSourceLink'],
  behavior: ['tap_action', 'sortOrder', 'hideExpired', 'hideNoAlerts', 'unavailableBehavior'],
  dismissal: ['allowDismiss', 'dismissTrigger', 'dismissButtonStyle', 'showDismissUndo'],
  advanced: ['provider', 'timezone', 'reformatText', 'deduplicate', 'deduplicateHeadlines', 'enhanceContrast'],
};

/** Translation key of each panel's header, in display order. */
export const PANEL_LABELS: Readonly<Record<Panel, string>> = {
  source: 'editor.section_source',
  filtering: 'editor.section_filtering',
  appearance: 'editor.section_appearance',
  details: 'editor.section_detail_panel',
  behavior: 'editor.section_behavior',
  dismissal: 'editor.section_dismissal',
  advanced: 'editor.section_advanced',
};

/** The detail-panel sections offered as one multi-select list, in display
 *  order. Each is an ordinary toggle field; the list is a denser control over
 *  the same five keys. */
export const DETAIL_SECTIONS = [
  'showMetadata',
  'showDescription',
  'showInstructions',
  'showSourceLink',
  'showGeometry',
] as const satisfies readonly ToggleKey[];

/** The keys the nested styling group owns, for its own header count. */
export const STYLING_KEYS = ['progressFill', 'progressStyle', 'iconBorderStyle'] as const satisfies readonly (keyof WeatherAlertsCardConfig)[];

/** The value the control shows: the stored one, else the field default. */
export function effectiveValue(config: WeatherAlertsCardConfig, key: SimpleKey): SimpleValue {
  return (config[key] as SimpleValue | undefined) ?? FIELDS[key].default;
}

export function isDefault(config: WeatherAlertsCardConfig, key: SimpleKey): boolean {
  return effectiveValue(config, key) === FIELDS[key].default;
}

/** Whether a toggle's switch reads checked. */
export function isOn(config: WeatherAlertsCardConfig, field: ToggleField): boolean {
  return effectiveValue(config, field.key) === field.on;
}

/** Pure write core. Returns `config` itself when the effective value already
 *  equals `value`; otherwise a copy with the key deleted (value is the default)
 *  or set. Callers fire `config-changed` only when the identity changed, so an
 *  explicit `showDetails: true` in YAML is left alone until the user actually
 *  flips the switch. */
export function withKey(
  config: WeatherAlertsCardConfig,
  key: SimpleKey,
  value: SimpleValue,
): WeatherAlertsCardConfig {
  if (value === effectiveValue(config, key)) return config;
  const next = { ...config };
  if (value === FIELDS[key].default) {
    delete next[key];
  } else {
    (next as Record<SimpleKey, SimpleValue>)[key] = value;
  }
  return next;
}

/** Which of `keys` are customised, in the order given: registry keys whose
 *  effective value differs from the default, plus bespoke keys that are
 *  present. An explicit `showDetails: true` is not customised; a `zones: []`
 *  is. */
export function changedKeys(
  config: WeatherAlertsCardConfig,
  keys: readonly (keyof WeatherAlertsCardConfig)[],
): (keyof WeatherAlertsCardConfig)[] {
  return keys.filter(key =>
    key in FIELDS ? !isDefault(config, key as SimpleKey) : config[key] !== undefined,
  );
}

/** Whether one key is customised (see `changedKeys`). */
export function isChanged(config: WeatherAlertsCardConfig, key: keyof WeatherAlertsCardConfig): boolean {
  return changedKeys(config, [key]).length === 1;
}

/** Label keys for the bespoke keys a panel header may need to name. Registry
 *  keys carry their own label. */
export const BESPOKE_LABELS: Readonly<Partial<Record<keyof WeatherAlertsCardConfig, string>>> = {
  zones: 'editor.zones',
  eventCodes: 'editor.event_codes',
  excludeEventCodes: 'editor.exclude_event_codes',
  maxDistanceKm: 'editor.max_distance',
  myLocationEntity: 'editor.my_location_entity',
  progressStyle: 'editor.progress_style',
  iconBorderStyle: 'editor.icon_border_style',
  tap_action: 'editor.tap_action',
  hideNoAlerts: 'editor.hide_no_alerts',
};

/** A label fit for a header: the trailing parenthetical every "(optional)" or
 *  "(km)" label carries is noise there. */
export function shortLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '');
}
