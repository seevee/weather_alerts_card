import { LitElement, html, svg, nothing, TemplateResult, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { Connection } from 'home-assistant-js-websocket';
import { HomeAssistant, WeatherAlertsCardConfig, WeatherAlert, AlertProgress, AlertProvider, ContrastMode, DismissalRecord, EntityRegistryDisplayEntry, HassEntity, DecoPhase, PROGRESS_DECO_DEFAULTS, ICON_BORDER_DEFAULTS } from './types';
import {
  configuredDevices,
  resolveDeviceAlertEntities,
  deviceEntityIds,
  deviceHasAnyEntity,
  subscribeEntityRegistry,
} from './registry';
// Re-export for existing test imports.
export { resolveDeviceAlertEntities, subscribeEntityRegistry } from './registry';

// A configured source that is currently dark. `name` is the entity
// friendly_name for an explicitly-listed entity, or the device registry name
// for a device — null only when no name can be resolved, in which case the
// caption falls back to a generic singular instead of naming it.
interface BrokenSource {
  name: string | null;
}
import {
  loadDismissals,
  saveDismissals,
  dismissAlert,
  undoDismiss,
  applyDismissals,
  configuredScopeTokens,
  scopeHashForConfig,
  subscribeToDismissalChanges,
} from './dismissal';
import {
  getWeatherIcon,
  getCertaintyIcon,
  computeAlertProgress,
  formatProgressTimestamp,
  formatLocalTimestamp,
  formatRelativeTime,
  formatDuration,
  sortAlerts,
  alertMatchesZones,
  deduplicateAlerts,
  haversineKm,
  resolveReferencePoint,
  formatDistance,
  toLengthUnit,
  getNwsEventColor,
  getMeteoAlarmColor,
  getEcccColor,
  getProviderColor,
  providerColorsEnabled,
  type EventColor,
  resolveContrastMode,
  sanitizeAlertHtml,
  getDisplayHeadline,
  reflowAlertText,
} from './utils';
import { getAdapter, ENTITY_NAME_PATTERNS, canHandleAny } from './adapters';
import {
  fetchGeometry,
  fetchMapTilesToken,
  mapTilesUrl,
  buildGeometrySvg,
  buildGeometryMap,
  framePointsBbox,
  markerPath,
  REFERENCE_FRAME_MAX_KM,
  Bbox,
  LonLat,
  DEFAULT_TILE_ATTRIBUTION,
  MAP_TILES_TOKEN_REFRESH_MS,
  GeoJsonGeometry,
} from './geometry';
import { handleTapAction, hasTapAction } from './actions';
import { t } from './localize';
import { cardStyles } from './styles';
import './weather-alerts-card-editor';

// Geometry miss retry policy (#258). A miss is a 404 from cap_alerts' in-memory
// polygon store: evicted under load, or empty after an HA restart until the
// next poll (300 s default). 60 s sits well under that poll and nowhere near a
// storm; ten attempts cover the restart window and then give up on a dead ref.
export const GEOMETRY_MISS_COOLDOWN_MS = 60_000;
export const GEOMETRY_MISS_MAX_ATTEMPTS = 10;

/* eslint-disable no-console */
declare const __CARD_VERSION__: string;
const CARD_VERSION = __CARD_VERSION__;
console.info(
  `%c  WEATHER-ALERTS-CARD  %c  Version ${CARD_VERSION}  `,
  'color: white; background: #555; font-weight: bold;',
  'color: white; background: #007acc; font-weight: bold;',
);
/* eslint-enable no-console */

const PROVIDER_LABELS: Record<string, string> = {
  nws: 'NWS',
  bom: 'BoM',
  meteoalarm: 'MeteoAlarm',
  dwd: 'DWD',
  meteoswiss: 'MeteoSwiss',
  eccc: 'Environment Canada',
  pirateweather: 'Pirate Weather',
  cap: 'CAP',
  nsw_rfs: 'NSW RFS',
  inmet: 'INMET',
  nina: 'NINA',
};

const PROVIDER_SHORT: Record<string, string> = {
  nws: 'NWS',
  bom: 'BoM',
  meteoalarm: 'MA',
  dwd: 'DWD',
  meteoswiss: 'MS',
  eccc: 'EC',
  pirateweather: 'PW',
  cap: 'CAP',
  nsw_rfs: 'RFS',
  inmet: 'INMET',
  nina: 'NINA',
};

// Domains whose entities issue a command rather than report data, so they are
// skipped when judging whether a device has gone dark (_brokenSources). A
// button sits at state `unknown` until the first time it is pressed — its
// healthy resting state, not a fault — and cap_alerts keeps its refresh button
// off the coordinator precisely so a failing update cannot take it away. Left
// in, an unpressed button marks every zero-alert device unavailable.
const COMMAND_DOMAINS = new Set(['button', 'scene', 'script', 'input_button']);

// Entity name patterns are now in adapters/index.ts (ENTITY_NAME_PATTERNS).
// Registry helpers (resolveDeviceAlertEntities, deviceHasAnyEntity,
// subscribeEntityRegistry) live in ./registry and are re-exported above.

function getPreviewAlerts(): WeatherAlert[] {
  const now = Date.now() / 1000;
  const HOUR = 3600;
  // Order, severity, and onset are chosen so that each sortOrder
  // option produces a visibly different arrangement:
  //   default:  Wind Watch → Heat Advisory → Frost Advisory  (array order)
  //   severity: Heat Advisory → Wind Watch → Frost Advisory   (moderate first)
  //   onset:    Frost Advisory → Heat Advisory → Wind Watch    (earliest onset first)
  return [
    {
      id: 'preview-1',
      event: 'Gentle Wind Watch',
      severity: 'minor',
      severityLabel: 'Minor',
      certainty: 'Possible',
      urgency: 'Future',
      sentTs: now - 1 * HOUR,
      onsetTs: now + 1 * HOUR,
      endsTs: now + 6 * HOUR,
      description: 'A gentle breeze may arrive later. This is sample data showing an upcoming alert.',
      instruction: '',
      url: '',
      headline: 'Gentle Wind Watch for Sampletown County',
      areaDesc: 'Sampletown County',
      zones: ['SAMPLE02'],
      eventCode: 'WIA',
      provider: 'nws' as AlertProvider,
      phase: '',
      severityInferred: true,
      certaintyInferred: false,
    },
    {
      id: 'preview-2',
      event: 'Sunshine Heat Advisory',
      severity: 'moderate',
      severityLabel: 'Moderate',
      certainty: 'Likely',
      urgency: 'Expected',
      sentTs: now - 2 * HOUR,
      onsetTs: now - 1 * HOUR,
      endsTs: now + 2 * HOUR,
      description: 'This is a sample alert demonstrating the card layout. No action required.',
      instruction: 'Enjoy the weather! This is placeholder data for the card preview.',
      url: '',
      headline: 'Sunshine Heat Advisory for Pleasantville',
      areaDesc: 'Pleasantville, USA',
      zones: ['SAMPLE01'],
      eventCode: 'HTA',
      provider: 'nws' as AlertProvider,
      phase: 'Update',
      severityInferred: false,
      certaintyInferred: false,
    },
    {
      id: 'preview-3',
      event: 'Frost Advisory',
      severity: 'minor',
      severityLabel: 'Minor',
      certainty: 'Likely',
      urgency: 'Expected',
      sentTs: now - 8 * HOUR,
      onsetTs: now - 6 * HOUR,
      endsTs: now - 2 * HOUR,
      description: 'A light frost occurred overnight. This is sample data showing an expired alert.',
      instruction: '',
      url: '',
      headline: 'Frost Advisory expired for Pleasantville',
      areaDesc: 'Pleasantville, USA',
      zones: ['SAMPLE01'],
      eventCode: 'FRA',
      provider: 'nws' as AlertProvider,
      phase: '',
      severityInferred: false,
      certaintyInferred: true,
    },
  ];
}

@customElement('weather-alerts-card')
export class WeatherAlertsCard extends LitElement {
  static styles = cardStyles;

  /** Editor-preview expanded state, keyed by entity ID. Survives element destruction/recreation. */
  private static _editorExpandedState: Map<string, Map<string, boolean>> = new Map();

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: WeatherAlertsCardConfig;
  @state() private _expandedAlerts: Map<string, boolean> = new Map();
  @state() private _forcePreview = false;
  /** Alert id whose detail pop-up is open (`tap_action: { action: details }`); null when closed. */
  @state() private _detailPopupAlertId: string | null = null;
  @state() private _dismissals: Map<string, DismissalRecord> = new Map();
  private _dismissalsScope = '';
  private _unsubscribeDismissals?: () => void;

  // Pointer-drag-to-dismiss gesture state (plain fields — requestUpdate() called manually).
  // Unifies touch swipe and mouse drag via Pointer Events; setPointerCapture takes
  // over after lock so drags that leave the card still resolve to this element.
  private _swipeState: { id: string; offset: number; locked: boolean; cardWidth: number } | null = null;
  private _swipeStartX = 0;
  private _swipeStartY = 0;
  private _swipeCurrentDx = 0;
  private _swipeRAF: number | null = null;
  private _swipePointerId: number | null = null;
  private _swipeExitTimeout: number | null = null;
  private _swipeJustDragged = false;
  @state() private _swipeExiting: string | null = null;

  // Live entity-registry copy. `null` until the WS subscription delivers;
  // resolution helpers fall back to `hass.entities` while it is null.
  private _registryEntries: EntityRegistryDisplayEntry[] | null = null;
  private _unsubscribeRegistry?: () => void;
  private _subscribedRegistryConn?: Connection;

  // cap_alerts geometry mini-map (opt-in via showGeometry). Cache maps a
  // geometry_ref → fetched geometry. A polygon that arrived is immutable for
  // its ref, so hits are never refetched. Misses (404: evicted, or the store
  // is empty after an HA restart) are temporary — the integration repopulates
  // on its next poll — so they live in a separate map with a cooldown and an
  // attempt cap (#258): retried once the cooldown passes, abandoned after
  // GEOMETRY_MISS_MAX_ATTEMPTS so a dead ref isn't polled for the whole
  // session. In-flight set dedupes concurrent fetches. All three are cleared
  // on connection swap (the backing store is per-connection ephemeral).
  @state() private _geometryCache = new Map<string, GeoJsonGeometry>();
  private _geometryMisses = new Map<string, { at: number; attempts: number }>();
  private _geometryInFlight = new Set<string>();
  private _geometryConn?: Connection;

  // Basemap access token for geometryStyle: 'map' (HA's map_tiles proxy, #259).
  // Fetched once per connection when the map style is on, refreshed on the
  // frontend's cadence (20 min interval + the connection's `ready` event) and
  // held in state so a rotation re-renders the tile hrefs. A rejected fetch
  // (core < 2026.9) stays rejected for that connection — no retry per hass
  // update — and the card draws the plain outline instead.
  @state() private _mapTilesToken: string | null = null;
  private _mapTilesConn?: Connection;
  private _mapTilesInFlight = false;
  private _mapTilesTimer: ReturnType<typeof setInterval> | null = null;
  private _onMapTilesReady = () => this._refreshMapTilesToken();

  private _motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private _onMotionChange = () => this.requestUpdate();

  connectedCallback() {
    super.connectedCallback();
    this._motionQuery.addEventListener('change', this._onMotionChange);
    // Re-prune stale records (30d TTL) on every mount.
    if (this._config) {
      this._dismissalsScope = '';
      this._reloadDismissalsIfScopeChanged();
    }
    this._maybeSubscribeRegistry();
    this._maybeAcquireMapTilesToken();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._motionQuery.removeEventListener('change', this._onMotionChange);
    this._unsubscribeDismissals?.();
    this._unsubscribeDismissals = undefined;
    this._teardownRegistrySubscription();
    this._teardownMapTilesToken();
    // Drop any in-flight geometry fetches; the cache may persist for a quick
    // remount (connection-swap detection re-validates it on next fetch).
    this._geometryInFlight.clear();
    if (this._swipeRAF !== null) {
      cancelAnimationFrame(this._swipeRAF);
      this._swipeRAF = null;
    }
    if (this._swipeExitTimeout !== null) {
      clearTimeout(this._swipeExitTimeout);
      this._swipeExitTimeout = null;
    }
    this._swipeState = null;
    this._swipeExiting = null;
    if (this._hasStateKeySources()) {
      WeatherAlertsCard._editorExpandedState.set(this._entityStateKey(), this._expandedAlerts);
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    // `hass` is set as a property after the element mounts, so the WS
    // connection typically becomes available here rather than in
    // connectedCallback. Subscribe lazily and re-subscribe if the
    // connection object swaps (e.g., after a reconnect).
    if ((changed.has('hass') || changed.has('_config')) && this.isConnected) {
      this._maybeSubscribeRegistry();
      this._maybeFetchGeometry();
      this._maybeAcquireMapTilesToken();
    }
    // The detail pop-up is reconciled after render, never during it, so
    // render() stays side-effect free:
    //   - alert churned out of the feed (or the card dropped to preview /
    //     hid itself): nothing rendered for the id, so clear the stale id.
    //   - freshly rendered: promote it to a modal. showModal() is what buys
    //     the focus trap, Esc and ::backdrop; a plain `open` attribute would
    //     render the box non-modally with none of that.
    const dialog = this._detailPopupEl;
    if (this._detailPopupAlertId && !dialog) {
      this._closeDetailPopup();
    } else if (dialog && !dialog.open) {
      // jsdom implements <dialog> but has historically shipped without
      // showModal; degrade to a non-modal open rather than throwing in tests.
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
  }

  private _maybeSubscribeRegistry(): void {
    // Only device mode reads the entity registry (to resolve per-alert child
    // sensors under a device). A plain entity/entities card never touches
    // _registryEntries, so subscribing would refetch the entire registry on
    // every entity_registry_updated event for nothing. Gate it on any device.
    if (configuredDevices(this._config).length === 0) {
      this._teardownRegistrySubscription();
      return;
    }
    const conn = this.hass?.connection;
    if (!conn || conn === this._subscribedRegistryConn) return;
    // New (or first) connection — drop any prior subscription.
    this._unsubscribeRegistry?.();
    this._unsubscribeRegistry = undefined;
    this._subscribedRegistryConn = conn;
    subscribeEntityRegistry(conn, (entries) => {
      this._registryEntries = entries;
      this.requestUpdate();
    }).then((unsub) => {
      // The connection (or our own state) may have changed while the
      // subscribe round-trip was in flight; honour that by tearing the
      // freshly-acquired subscription down rather than retaining it.
      if (this._subscribedRegistryConn !== conn) {
        unsub();
        return;
      }
      this._unsubscribeRegistry = unsub;
    }).catch(() => {
      if (this._subscribedRegistryConn === conn) {
        this._subscribedRegistryConn = undefined;
      }
    });
  }

  private _teardownRegistrySubscription(): void {
    this._unsubscribeRegistry?.();
    this._unsubscribeRegistry = undefined;
    this._subscribedRegistryConn = undefined;
  }

  // Out-of-band geometry fetch orchestration. Opt-in (showGeometry) so the
  // default config — and every non-cap provider — incurs zero network. Mirrors
  // the registry subscription's connection-swap + in-flight discipline. Runs
  // from updated(); never from render/_getAlerts/getCardSize (render purity).
  private _maybeFetchGeometry(): void {
    if (this._config?.showGeometry !== true) return;
    const conn = this.hass?.connection;
    if (!conn) return;

    // Connection swap (e.g. reconnect): the geometry store is per-connection
    // and ephemeral, so drop everything and refetch against the new socket.
    if (conn !== this._geometryConn) {
      this._geometryCache = new Map();
      this._geometryMisses.clear();
      this._geometryInFlight.clear();
      this._geometryConn = conn;
    }

    // Collect the refs of currently-filtered alerts.
    const refs = new Set<string>();
    for (const alert of this._getAlerts(false)) {
      if (alert.geometryRef) refs.add(alert.geometryRef);
    }

    // Prune cache/in-flight entries whose alert is no longer present.
    for (const ref of [...this._geometryCache.keys()]) {
      if (!refs.has(ref)) this._geometryCache.delete(ref);
    }
    for (const ref of [...this._geometryInFlight]) {
      if (!refs.has(ref)) this._geometryInFlight.delete(ref);
    }
    for (const ref of [...this._geometryMisses.keys()]) {
      if (!refs.has(ref)) this._geometryMisses.delete(ref);
    }

    // Fetch each new ref once; a hit is final, a miss is retried after the
    // cooldown until the attempt cap. Many hass updates inside the cooldown
    // must produce no request at all.
    const now = Date.now();
    for (const ref of refs) {
      if (this._geometryCache.has(ref) || this._geometryInFlight.has(ref)) continue;
      const miss = this._geometryMisses.get(ref);
      if (miss && (miss.attempts >= GEOMETRY_MISS_MAX_ATTEMPTS
        || now - miss.at < GEOMETRY_MISS_COOLDOWN_MS)) continue;
      this._geometryInFlight.add(ref);
      fetchGeometry(conn, ref).then((result) => {
        // Drop the result if the connection swapped mid-flight.
        if (conn !== this._geometryConn) return;
        this._geometryInFlight.delete(ref);
        if (result === null) {
          const prior = this._geometryMisses.get(ref);
          this._geometryMisses.set(ref, { at: Date.now(), attempts: (prior?.attempts ?? 0) + 1 });
          return;
        }
        this._geometryMisses.delete(ref);
        this._geometryCache.set(ref, result);
        this.requestUpdate();
      }).catch(() => {
        // fetchGeometry never rejects, but stay defensive.
        if (conn === this._geometryConn) this._geometryInFlight.delete(ref);
      });
    }
  }

  // Basemap token lifecycle (#259). Gated on the map style with no user tile
  // override, so every other config incurs zero WS traffic. Mirrors the
  // registry subscription's connection-swap discipline. Runs from
  // connectedCallback/updated(); never from render/_getAlerts/getCardSize.
  private _wantsMapTiles(): boolean {
    return this._config?.showGeometry === true
      && this._config?.geometryStyle === 'map'
      && !this._config?.geometryTileUrl;
  }

  private _maybeAcquireMapTilesToken(): void {
    if (!this._wantsMapTiles()) {
      this._teardownMapTilesToken();
      return;
    }
    const conn = this.hass?.connection;
    if (!conn || conn === this._mapTilesConn) return;
    // New (or first) connection — drop the old token, timer and listener.
    this._teardownMapTilesToken();
    this._mapTilesConn = conn;
    // Re-arm on reconnect (`ready`) and on the refresh interval, like the
    // frontend does. Mock connections in tests may lack the event API.
    if (typeof conn.addEventListener === 'function') {
      conn.addEventListener('ready', this._onMapTilesReady);
    }
    this._mapTilesTimer = setInterval(this._onMapTilesReady, MAP_TILES_TOKEN_REFRESH_MS);
    this._refreshMapTilesToken();
  }

  private _refreshMapTilesToken(): void {
    const conn = this._mapTilesConn;
    if (!conn || this._mapTilesInFlight) return;
    this._mapTilesInFlight = true;
    fetchMapTilesToken(conn).then((token) => {
      // Drop the result if the connection swapped (or the style was turned
      // off) mid-flight.
      if (conn !== this._mapTilesConn) return;
      this._mapTilesInFlight = false;
      // A failed refresh keeps the previous token: with two tokens live
      // server-side it stays valid for a while, and the outline is a worse
      // fallback than a briefly stale basemap.
      if (token !== null && token !== this._mapTilesToken) this._mapTilesToken = token;
    }).catch(() => {
      // fetchMapTilesToken never rejects, but stay defensive.
      if (conn === this._mapTilesConn) this._mapTilesInFlight = false;
    });
  }

  private _teardownMapTilesToken(): void {
    const conn = this._mapTilesConn;
    if (conn && typeof conn.removeEventListener === 'function') {
      conn.removeEventListener('ready', this._onMapTilesReady);
    }
    if (this._mapTilesTimer !== null) {
      clearInterval(this._mapTilesTimer);
      this._mapTilesTimer = null;
    }
    this._mapTilesConn = undefined;
    this._mapTilesInFlight = false;
    if (this._mapTilesToken !== null) this._mapTilesToken = null;
  }

  public setConfig(config: WeatherAlertsCardConfig): void {
    const hasEntity = !!config.entity || !!config.entities?.length;
    if (!hasEntity && !config.device && !config.devices?.length && !config.sources?.length) {
      throw new Error('You need to define an entity, device, or feed');
    }
    const { _preview, ...rest } = config;
    // If entity is missing but entities is set, default entity to entities[0]
    if (!rest.entity && rest.entities && rest.entities.length > 0) {
      rest.entity = rest.entities[0];
    }
    this._config = rest as WeatherAlertsCardConfig;
    this._forcePreview = !!_preview;
    const stateKey = this._entityStateKey();
    const saved = WeatherAlertsCard._editorExpandedState.get(stateKey);
    if (saved) {
      this._expandedAlerts = saved;
    }
    this._reloadDismissalsIfScopeChanged();
  }

  // Whether the config names a stable source to key the editor's expanded-state
  // carry-over on: an entity or any device. Source-only cards have no stable
  // key (their entity set churns), matching the pre-`devices` behaviour.
  private _hasStateKeySources(): boolean {
    return !!this._config?.entity || configuredDevices(this._config).length > 0;
  }

  private get _scopeHash(): string {
    // Hash the *configured* sources (entity + device ids), not the resolved
    // entity list — device-mode alerts come and go, and the dismissal scope
    // must stay stable across that churn. Shared with the editor so both
    // agree on the storage key (see scopeHashForConfig).
    return scopeHashForConfig(this._config);
  }

  private _configuredScopeTokens(): string[] {
    return configuredScopeTokens(this._config);
  }

  private _reloadDismissalsIfScopeChanged(): void {
    const scope = this._scopeHash;
    if (scope === this._dismissalsScope) return;
    this._dismissalsScope = scope;
    this._dismissals = scope ? loadDismissals(scope) : new Map();
    this._resubscribeDismissals();
  }

  private _resubscribeDismissals(): void {
    this._unsubscribeDismissals?.();
    this._unsubscribeDismissals = undefined;
    if (!this.isConnected || !this._dismissalsScope) return;
    this._unsubscribeDismissals = subscribeToDismissalChanges(
      this._dismissalsScope,
      () => {
        // Any card instance (or the editor) may have written — pick up the
        // canonical state from storage rather than trusting in-memory.
        this._dismissals = loadDismissals(this._dismissalsScope);
      },
    );
  }

  public getCardSize(): number {
    // Pass reconcile=false: this is a layout-measurement call from HA's
    // masonry engine and must not trigger localStorage writes or reactive
    // state mutations as a side effect.
    const alerts = this._getAlerts(false);
    const perAlert = this._isCompact ? 1 : 3;
    // Availability signalling never adds a row: the strip is a thin band over
    // alerts, the dot is an overlay, and the zero-alert caveat rides inside the
    // empty state — all of which the max(1, …) empty-state floor already covers.
    return Math.max(1, alerts.length * perAlert);
  }

  public static getConfigElement(): HTMLElement {
    return document.createElement('weather-alerts-card-editor');
  }

  public static getStubConfig(hass?: HomeAssistant): Record<string, unknown> {
    if (hass) {
      // Find all matching alert entities, prefer one with active alerts
      const matches = Object.keys(hass.states).filter(id =>
        ENTITY_NAME_PATTERNS.some(pattern => pattern.test(id)),
      );
      const withAlerts = matches.find(id => {
        const s = hass.states[id];
        // sensor: state is alert count; binary_sensor: 'on' means active
        return (s.state !== '0' && s.state !== 'off' && s.state !== 'unknown' && s.state !== 'unavailable');
      });
      if (withAlerts) return { entity: withAlerts };
      // No entity has active alerts → fall through to hardcoded default
      // so the placeholder preview shows instead of "No active alerts"
    }
    return { entity: 'sensor.nws_alerts_alerts' };
  }

  private _getAllEntities(): string[] {
    if (!this._config) return [];
    const primary = this._config.entity;
    const extras = this._config.entities || [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const id of [primary, ...extras]) {
      if (id && !seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
    if (this.hass) {
      // Device order is config order (`device` first, then `devices`), which is
      // what makes "first seen wins" in dedup's phase 0 a stable choice.
      for (const deviceId of configuredDevices(this._config)) {
        for (const id of resolveDeviceAlertEntities(this.hass, deviceId, this._registryEntries)) {
          if (!seen.has(id)) {
            seen.add(id);
            result.push(id);
          }
        }
      }
    }
    if (this._config.sources && this._config.sources.length > 0 && this.hass) {
      for (const id of this._resolveSourceEntities(this._config.sources)) {
        if (!seen.has(id)) {
          seen.add(id);
          result.push(id);
        }
      }
    }
    return result;
  }

  // Collect every entity whose `source` state attribute matches a configured
  // feed source (e.g. all nsw_rural_fire_service_feed geo_location incidents),
  // so per-incident providers need no hand-listed, churning entity ids. Sorted
  // for stable ordering across the live feed's add/remove churn. Guarded by
  // canHandleAny so a stray source match can't inject unparseable entities.
  private _resolveSourceEntities(sources: string[]): string[] {
    if (!this.hass) return [];
    const sourceSet = new Set(sources);
    const ids: string[] = [];
    for (const [id, state] of Object.entries(this.hass.states)) {
      const src = state.attributes?.source;
      if (typeof src === 'string' && sourceSet.has(src) && canHandleAny(state.attributes)) {
        ids.push(id);
      }
    }
    return ids.sort();
  }

  private _entityStateKey(): string {
    return [...this._configuredScopeTokens()].sort().join(',');
  }

  private _deviceHasAnyEntity(deviceId: string): boolean {
    if (!this.hass) return false;
    return deviceHasAnyEntity(this.hass, deviceId, this._registryEntries);
  }

  // Set when applyDismissals produces a changed map during render; persisted
  // out-of-band by _scheduleDismissalReconcile so render() stays free of
  // localStorage writes and reactive-state mutation.
  private _pendingDismissals: Map<string, DismissalRecord> | null = null;
  private _dismissalReconcileScheduled = false;

  private _getAlerts(reconcile = true): WeatherAlert[] {
    if (!this.hass || !this._config) return [];
    const allAlerts: WeatherAlert[] = [];
    const providerPriority: AlertProvider[] = [];
    const seenProviders = new Set<AlertProvider>();
    // Providers whose ids are upstream identifiers — dedup collapses the same
    // alert seen through two of their sources (see deduplicateAlerts phase 0).
    const stableIdProviders = new Set<AlertProvider>();
    for (const entityId of this._getAllEntities()) {
      const entity = this.hass.states[entityId];
      if (!entity) continue;
      const adapter = getAdapter(this._config.provider, entity.attributes);
      if (!seenProviders.has(adapter.provider)) {
        seenProviders.add(adapter.provider);
        providerPriority.push(adapter.provider);
        if (adapter.stableIds) stableIdProviders.add(adapter.provider);
      }
      const parsed = adapter.parseAlerts(entity.attributes);
      for (const a of parsed) a.sourceEntityId = entityId;
      allAlerts.push(...parsed);
    }
    let filtered = this._filterAndSort(allAlerts, { providerPriority, stableIdProviders });
    if (this._config.allowDismiss && !this._forcePreview && this._dismissals.size > 0) {
      const { visible, updatedMap } = applyDismissals(filtered, this._dismissals);
      // applyDismissals can change the map (un-dismiss on signature shift,
      // renew lastSeenAt). Defer the write/state-mutation out of the render &
      // measurement path so we never mutate reactive state during render() or
      // touch localStorage from getCardSize().
      if (reconcile && updatedMap !== this._dismissals) {
        this._scheduleDismissalReconcile(updatedMap);
      }
      filtered = visible;
    }
    return filtered;
  }

  private _scheduleDismissalReconcile(updatedMap: Map<string, DismissalRecord>): void {
    // Each render recomputes updatedMap against the unchanged this._dismissals,
    // so the latest snapshot is always the one to persist. Coalesce repeated
    // renders into a single microtask write.
    this._pendingDismissals = updatedMap;
    if (this._dismissalReconcileScheduled) return;
    this._dismissalReconcileScheduled = true;
    queueMicrotask(() => {
      this._dismissalReconcileScheduled = false;
      const next = this._pendingDismissals;
      this._pendingDismissals = null;
      if (!next || !this._dismissalsScope) return;
      this._dismissals = next;
      saveDismissals(this._dismissalsScope, next);
    });
  }

  private _onDismiss(alert: WeatherAlert): void {
    if (!this._dismissalsScope) return;
    const next = dismissAlert(this._dismissals, alert);
    this._dismissals = next;
    saveDismissals(this._dismissalsScope, next);
    if (this._config?.showDismissUndo !== false) {
      this._fireUndoToast(alert);
    }
  }

  private _onUndo(id: string): void {
    if (!this._dismissalsScope) return;
    const next = undoDismiss(this._dismissals, id);
    if (next === this._dismissals) return;
    this._dismissals = next;
    saveDismissals(this._dismissalsScope, next);
  }

  private _fireUndoToast(alert: WeatherAlert): void {
    const lang = this._lang;
    this.dispatchEvent(new CustomEvent('hass-notification', {
      detail: {
        message: t('card.dismissed_toast', lang, { event: alert.event }),
        duration: 4000,
        action: {
          text: t('card.dismissed_toast_undo', lang),
          action: () => this._onUndo(alert.id),
        },
      },
      bubbles: true,
      composed: true,
    }));
  }

  private _canDismiss(): boolean {
    return !!this._config?.allowDismiss && !this._forcePreview;
  }

  private _swipeEnabled(): boolean {
    return this._canDismiss()
      && (this._config?.dismissTrigger === 'swipe' || this._config?.dismissTrigger === 'both');
  }

  private _onSwipePointerDown(alert: WeatherAlert, e: PointerEvent): void {
    if (!this._swipeEnabled()) return;
    if (this._swipeState) return;
    // Primary button only — ignores right/middle click and pen barrel buttons.
    if (e.button !== 0) return;
    this._swipePointerId = e.pointerId;
    this._swipeStartX = e.clientX;
    this._swipeStartY = e.clientY;
    this._swipeCurrentDx = 0;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this._swipeState = { id: alert.id, offset: 0, locked: false, cardWidth: rect.width };
  }

  private _onSwipePointerMove(alert: WeatherAlert, e: PointerEvent): void {
    if (!this._swipeState || this._swipeState.id !== alert.id) return;
    if (e.pointerId !== this._swipePointerId) return;

    const dx = e.clientX - this._swipeStartX;
    const dy = e.clientY - this._swipeStartY;

    if (!this._swipeState.locked) {
      if (Math.abs(dy) - Math.abs(dx) > 12) {
        this._swipeState = null;
        return;
      }
      if (dx >= 0) {
        this._swipeState = null;
        return;
      }
      // Capture so the gesture survives the pointer leaving the card; the
      // rAF below schedules the lock-class + offset DOM update together on
      // the next frame — no separate requestUpdate() needed here.
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      this._swipeState = { ...this._swipeState, locked: true };
    }

    this._swipeCurrentDx = Math.min(0, dx);

    if (this._swipeRAF !== null) return;
    this._swipeRAF = requestAnimationFrame(() => {
      this._swipeRAF = null;
      if (!this._swipeState || this._swipeState.id !== alert.id) return;
      this._swipeState = { ...this._swipeState, offset: this._swipeCurrentDx };
      this.requestUpdate();
    });
  }

  private _onSwipePointerUp(alert: WeatherAlert, e: PointerEvent): void {
    if (!this._swipeState || this._swipeState.id !== alert.id) return;
    if (e.pointerId !== this._swipePointerId) return;
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    if (this._swipeRAF !== null) {
      cancelAnimationFrame(this._swipeRAF);
      this._swipeRAF = null;
    }
    const { offset, cardWidth, locked } = this._swipeState;
    this._swipeState = null;
    this._swipePointerId = null;
    if (locked) {
      // Suppress the synthesized click that follows a mouse drag, so the
      // header's @click=_toggleDetails doesn't fire after a swipe. Auto-clears
      // next tick in case the browser doesn't fire a click at all.
      this._swipeJustDragged = true;
      setTimeout(() => { this._swipeJustDragged = false; }, 0);
    }
    if (locked && offset <= -(cardWidth * 0.4)) {
      this._swipeExiting = alert.id;
      const delay = this._motionQuery.matches ? 0 : 200;
      this._swipeExitTimeout = window.setTimeout(() => {
        this._swipeExitTimeout = null;
        this._swipeExiting = null;
        this._onDismiss(alert);
      }, delay);
    } else {
      this.requestUpdate();
    }
  }

  private _onSwipePointerCancel(alert: WeatherAlert, e: PointerEvent): void {
    if (!this._swipeState || this._swipeState.id !== alert.id) return;
    if (e.pointerId !== this._swipePointerId) return;
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    if (this._swipeRAF !== null) {
      cancelAnimationFrame(this._swipeRAF);
      this._swipeRAF = null;
    }
    this._swipeState = null;
    this._swipePointerId = null;
    this.requestUpdate();
  }

  private _swipeCardStyle(alert: WeatherAlert, baseStyle: string): string {
    if (this._swipeExiting === alert.id) return baseStyle;
    if (this._swipeState?.id === alert.id) {
      const { offset, cardWidth } = this._swipeState;
      const opacity = Math.max(0, 1 + offset / cardWidth).toFixed(2);
      return `${baseStyle} transform: translateX(${offset}px); opacity: ${opacity};`;
    }
    return baseStyle;
  }

  private _swipeCardClass(alert: WeatherAlert): string {
    const classes: string[] = [];
    if (this._swipeEnabled()) classes.push('swipe-enabled');
    if (this._swipeExiting === alert.id) classes.push('swipe-exit');
    else if (this._swipeState?.id === alert.id && this._swipeState.locked) classes.push('swiping');
    return classes.join(' ');
  }

  private _isLabeledDismissActive(): boolean {
    return this._canDismiss()
      && this._config?.dismissTrigger !== 'swipe'
      && this._config?.dismissButtonStyle === 'labeled'
      && !this._isCompact;
  }

  private _renderDismissButton(alert: WeatherAlert): TemplateResult | typeof nothing {
    if (!this._canDismiss()) return nothing;
    if (this._config?.dismissTrigger === 'swipe') return nothing;
    if (this._isLabeledDismissActive()) {
      return html`
        <button
          type="button"
          class="dismiss-button labeled"
          aria-label=${t('card.dismiss', this._lang)}
          title=${t('card.dismiss', this._lang)}
          @click=${(e: Event) => { e.stopPropagation(); this._onDismiss(alert); }}
        >
          <ha-icon icon="mdi:close"></ha-icon>
          <span>${t('card.dismiss', this._lang)}</span>
        </button>
      `;
    }
    return html`
      <button
        type="button"
        class="dismiss-button"
        aria-label=${t('card.dismiss', this._lang)}
        title=${t('card.dismiss', this._lang)}
        @click=${(e: Event) => { e.stopPropagation(); this._onDismiss(alert); }}
      >
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    `;
  }

  private _filterAndSort(
    alerts: WeatherAlert[],
    opts?: { skipZones?: boolean; providerPriority?: AlertProvider[]; stableIdProviders?: Set<AlertProvider> },
  ): WeatherAlert[] {
    if (!this._config) return alerts;
    let result = alerts;

    // Radius filter runs FIRST, before dedup: distance is a per-incident
    // property, and dedup's representative keeps only group[0]'s point, so a
    // merged group would otherwise be judged by one arbitrary member's
    // location. Alerts with no point always pass — an area warning either
    // covers the reference point or it doesn't, so a radius has no meaning for
    // it (#105) and dropping one would be a safety regression. A missing/invalid
    // radius or an unresolvable reference point fails open (no filtering at
    // all). The origin is the same resolved reference point the my-location
    // marker draws, so the card never filters from somewhere it isn't showing.
    const maxKm = this._config.maxDistanceKm;
    const home = resolveReferencePoint(this.hass, this._config.myLocationEntity);
    if (typeof maxKm === 'number' && Number.isFinite(maxKm) && maxKm > 0 && home) {
      result = result.filter(a => !a.point || haversineKm(a.point[0], a.point[1], home[0], home[1]) <= maxKm);
    }

    if (this._config.deduplicate !== false) {
      result = deduplicateAlerts(result, opts?.providerPriority, opts?.stableIdProviders);
    }

    if (!opts?.skipZones && this._config.zones && this._config.zones.length > 0) {
      const zoneSet = new Set(this._config.zones.map(z => z.toUpperCase()));
      result = result.filter(a => alertMatchesZones(a, zoneSet));
    }

    if (this._config.eventCodes && this._config.eventCodes.length > 0) {
      const codeSet = new Set(this._config.eventCodes.map(c => c.toUpperCase()));
      result = result.filter(a => a.eventCode && codeSet.has(a.eventCode.toUpperCase()));
    }

    if (this._config.excludeEventCodes && this._config.excludeEventCodes.length > 0) {
      const excludeSet = new Set(this._config.excludeEventCodes.map(c => c.toUpperCase()));
      result = result.filter(a => !a.eventCode || !excludeSet.has(a.eventCode.toUpperCase()));
    }

    if (this._config.minSeverity) {
      const severityRank = {
        extreme: 0, severe: 1, moderate: 2, minor: 3, unknown: 4,
      };
      const threshold = severityRank[this._config.minSeverity] ?? 4;
      // 'unknown' means the provider couldn't classify the alert, not that
      // it's low-priority. Never silently drop it via the severity floor —
      // suppressing an unclassified weather alert is a safety hazard. Users
      // who truly want it gone can use eventCode/zone filters instead.
      result = result.filter(a => a.severity === 'unknown' || (severityRank[a.severity] ?? 4) <= threshold);
    }

    if (this._config.hideExpired !== false) {
      const nowTs = Date.now() / 1000;
      result = result.filter(a => a.endsTs === 0 || a.endsTs > nowTs);
    }

    return sortAlerts(result, this._config.sortOrder || 'default');
  }

  private get _locale() {
    if (!this.hass) {
      return { language: navigator.language || 'en', time_format: 'language' as const, date_format: 'language' as const, timeZone: undefined };
    }
    const timeZone = this._config?.timezone === 'browser'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : this.hass.config?.time_zone;
    return { ...this.hass.locale, timeZone };
  }

  private get _lang(): string {
    return this.hass?.locale?.language || 'en';
  }

  private get _animationsEnabled(): boolean {
    if (this._config?.animations === true) return true;
    if (this._config?.animations === false) return false;
    return !this._motionQuery.matches; // undefined → respect OS prefers-reduced-motion
  }
  private get _isCompact(): boolean { return this._config?.layout === 'compact'; }
  private get _colorTheme(): 'severity' | 'nws' | 'meteoalarm' | 'eccc' { return this._config?.colorTheme || 'severity'; }
  private get _providerColors(): boolean { return !!this._config && providerColorsEnabled(this._config); }
  private get _fontScale(): number | undefined {
    switch (this._config?.fontSize) {
      case 'small': return 0.85;
      case 'large': return 1.2;
      case 'x-large': return 1.4;
      default: return undefined;
    }
  }
  private get _scaleStyle(): string {
    const scale = this._fontScale;
    return scale !== undefined ? `--wac-scale: ${scale}` : '';
  }

  private _scaledPx(base: number): number {
    const scale = this._fontScale;
    return scale !== undefined ? Math.round(base * scale) : base;
  }

  private get _contrastMode(): ContrastMode {
    return resolveContrastMode(this._config?.enhanceContrast);
  }

  // Two axes. `providerColors` is a per-alert override: an alert carrying the
  // color its issuer published is painted in it. Everything else is painted
  // from the `colorTheme` ladder. The severity ladder is CSS (HA theme tokens
  // via the severity-* classes), so it resolves to no inline style; the other
  // ladders and the override resolve to a hex plus its contrast tags.
  private _resolveEventColor(alert: WeatherAlert, mode: ContrastMode): EventColor | undefined {
    if (this._providerColors) {
      const published = getProviderColor(alert, mode);
      if (published) return published;
    }
    switch (this._colorTheme) {
      case 'nws': return getNwsEventColor(alert.event, mode);
      case 'meteoalarm': return getMeteoAlarmColor(alert.severity, mode);
      case 'eccc': return getEcccColor(alert.severity, mode);
      default: return undefined;
    }
  }

  private _alertColorStyle(alert: WeatherAlert): string {
    const resolved = this._resolveEventColor(alert, this._contrastMode);
    if (!resolved) return '';
    const { color, rgb, textColorLight, textColorDark } = resolved;
    return `--color: ${color}; --color-rgb: ${rgb}; --color-on-light: ${textColorLight}; --color-on-dark: ${textColorDark};`;
  }

  // Per-alert boost classes — only emitted when a hex is in play (an agency
  // ladder or a published color). Two tiers driven by _contrastMode:
  // boost-{light,dark} darkens icon/label text, progress-boost-{light,dark}
  // darkens the progress-bar fill at a stricter tier. Mode 'off' emits
  // nothing. The severity ladder never gets classes: its colors are HA theme
  // tokens that the theme author has already tuned for their palette.
  private _alertBoostClasses(alert: WeatherAlert): string {
    const mode = this._contrastMode;
    if (mode === 'off') return '';
    const tags = this._resolveEventColor(alert, mode);
    if (!tags) return '';
    const classes: string[] = [];
    if (tags.boostLight) classes.push('boost-light');
    if (tags.boostDark) classes.push('boost-dark');
    if (tags.progressBoostLight) classes.push('progress-boost-light');
    if (tags.progressBoostDark) classes.push('progress-boost-dark');
    return classes.join(' ');
  }

  // Resolves the alert's current temporal phase, or null when expired (expired
  // is fixed dimmed-solid and takes no configurable decoration).
  private _decoPhase(progress: AlertProgress): DecoPhase | null {
    if (progress.isExpired) return null;
    if (progress.isActive) return progress.hasEndTime ? 'active' : 'ongoing';
    return 'preparation';
  }

  // Space-joined decoration classes for the alert-card root: the progress-bar
  // pattern (deco-*) and icon-ring border (icon-border-*), each resolved from
  // config for the alert's phase with a byte-identical default. Empty for
  // expired alerts, which carry neither.
  private _alertDecoClasses(progress: AlertProgress): string {
    const phase = this._decoPhase(progress);
    if (!phase) return '';
    const deco = this._config?.progressStyle?.[phase] ?? PROGRESS_DECO_DEFAULTS[phase];
    const icon = this._config?.iconBorderStyle?.[phase] ?? ICON_BORDER_DEFAULTS[phase];
    return `deco-${deco} icon-border-${icon}`;
  }

  // Resolves to 'light' or 'dark' so CSS boost rules only activate on the
  // matching side. Prefers HA's authoritative darkMode; falls back to
  // prefers-color-scheme when HA hasn't reported one yet (e.g., initial
  // render before hass is attached).
  private get _themeMode(): 'light' | 'dark' {
    const hassDark = this.hass?.themes?.darkMode;
    if (typeof hassDark === 'boolean') return hassDark ? 'dark' : 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  private _normalizeText(text: string | undefined): string {
    return (text || '').replace(/\n{2,}/g, '\n\n').trim();
  }

  private _toggleDetails(alertId: string): void {
    // A click synthesized at the end of a successful pointer drag would
    // otherwise toggle the alert that was just swiped — swallow it.
    if (this._swipeJustDragged) {
      this._swipeJustDragged = false;
      return;
    }
    const next = new Map(this._expandedAlerts);
    next.set(alertId, !next.get(alertId));
    this._expandedAlerts = next;
    if (this._hasStateKeySources()) {
      WeatherAlertsCard._editorExpandedState.set(this._entityStateKey(), next);
    }
  }

  // Fire the configured tap_action for the tapped alert row. Resolves the
  // more-info/toggle default entity per-alert: the tapped alert's own source
  // sensor, falling back to the primary config entity.
  private _onCardAction(alert: WeatherAlert): void {
    // Swallow the click synthesized at the end of a swipe-dismiss drag, exactly
    // as _toggleDetails does — the action must not fire on a swipe.
    if (this._swipeJustDragged) {
      this._swipeJustDragged = false;
      return;
    }
    const cfg = this._config?.tap_action;
    if (!cfg || cfg.action === 'none') return;
    // 'details' is card-owned: opening the pop-up needs card state and the
    // in-hand alert object, so it is intercepted here rather than added to the
    // deliberately dependency-free dispatcher (plans/per-alert-detail-popup.md, D3).
    if (cfg.action === 'details') {
      this._openDetailPopup(alert);
      return;
    }
    handleTapAction(this, this.hass, cfg, alert.sourceEntityId ?? this._config?.entity);
  }

  // The pop-up alternative to the inline expand: shows only the tapped alert's
  // expanded-details view. Scoped by the in-hand alert object rather than by a
  // re-query, so it is per-alert for aggregate providers (one sensor holding
  // many alerts) exactly as it is for per-alert-entity ones.
  // Reached only via _onCardAction, which has already swallowed a post-swipe click.
  private _openDetailPopup(alert: WeatherAlert): void {
    this._detailPopupAlertId = alert.id;
  }

  private _closeDetailPopup(): void {
    this._detailPopupAlertId = null;
  }

  private _onCardActionKeydown(alert: WeatherAlert, e: KeyboardEvent): void {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();
    this._onCardAction(alert);
  }

  private _sourceLinkLabel(alert: WeatherAlert): string {
    const label = PROVIDER_LABELS[alert.provider] || 'Alert';
    return t('card.open_source', this._lang, { provider: label });
  }

  // A resolved entity is "broken" when it is unavailable/unknown AND carries no
  // parseable alert. CAP per-alert sensors can report state "unknown" while
  // their attributes hold a fully valid alert (e.g. an NWS Beach Hazards
  // Statement) — those must still render, not be dropped as a broken source.
  private _isBroken(e: HassEntity): boolean {
    return (e.state === 'unavailable' || e.state === 'unknown')
      && getAdapter(this._config?.provider, e.attributes).parseAlerts(e.attributes).length === 0;
  }

  private _friendlyName(id: string): string {
    return (this.hass?.states[id]?.attributes?.friendly_name as string | undefined) || id;
  }

  // Display name of a device from the device registry, so 'message' mode can
  // name a dark device ("show which source"). Null when the registry or the
  // device's name is unavailable — the caller then falls back to a generic
  // singular rather than a wrong entity-derived name.
  private _deviceName(deviceId: string): string | null {
    const d = this.hass?.devices?.[deviceId];
    return (d?.name_by_user || d?.name) || null;
  }

  // The configured sources that are currently dark — drives the degraded signal.
  // A "source" is either an explicitly-listed entity or a whole device:
  //   - entity/entities: each id that is itself broken (see _isBroken), named by
  //     its friendly_name.
  //   - device/devices: ONE source EACH, dark when it is registered, yields no
  //     parseable alert across ANY of its entities, and has at least one entity
  //     in an error state. Counted per device, so two devices where one has gone
  //     dark names that one and leaves the other alone. Detection reads the
  //     UNFILTERED device entities, not the canHandle-filtered alert list
  //     (_getAllEntities): an unavailable source
  //     loses its alert attributes, so the alert list can no longer see it —
  //     the exact reason a dark cap_alerts device previously showed a false
  //     all-clear. Named from the device registry (see _deviceName) so 'message'
  //     mode can show *which* source; falls back to a generic singular only when
  //     the registry has no name for it.
  //
  // Command entities are excluded from the device scan (see COMMAND_DOMAINS):
  // they carry no data, and their idle state is `unknown`.
  private _brokenSources(): BrokenSource[] {
    if (!this.hass) return [];
    const sources: BrokenSource[] = [];

    const seen = new Set<string>();
    for (const id of [this._config?.entity, ...(this._config?.entities || [])]) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const e = this.hass.states[id];
      if (e && this._isBroken(e)) sources.push({ name: this._friendlyName(id) });
    }

    for (const deviceId of configuredDevices(this._config)) {
      let hasParseable = false;
      let hasErrored = false;
      for (const id of deviceEntityIds(this.hass, deviceId, this._registryEntries)) {
        if (COMMAND_DOMAINS.has(id.split('.', 1)[0])) continue;
        const e = this.hass.states[id];
        if (!e) continue;
        const parses = getAdapter(this._config?.provider, e.attributes).parseAlerts(e.attributes).length > 0;
        if (parses) hasParseable = true;
        else if (e.state === 'unavailable' || e.state === 'unknown') hasErrored = true;
      }
      if (!hasParseable && hasErrored) sources.push({ name: this._deviceName(deviceId) });
    }

    return sources;
  }

  // Human-readable availability caption: names the source when exactly one is
  // dark AND it has a resolvable name; otherwise counts them. Shared by the
  // strip, the dot, and the empty-state caveat so all three phrasings stay
  // identical.
  private _degradedLabel(sources: BrokenSource[]): string {
    if (sources.length === 1) {
      // One dark source: name it when we can, else a generic singular — some
      // devices have no registry name, and "1 sources unavailable" from the
      // count string reads wrong.
      return sources[0].name
        ? t('card.sources_unavailable_named', this._lang, { name: sources[0].name })
        : t('card.sources_unavailable_one', this._lang);
    }
    return t('card.sources_unavailable_count', this._lang, { count: sources.length });
  }

  // 'message' form of the availability channel: an in-flow strip above real
  // alert content. Only rendered when alerts exist to anchor it (see render());
  // with no alerts the caveat moves into the empty state instead.
  private _renderDegradedStrip(sources: BrokenSource[]): TemplateResult {
    const label = this._degradedLabel(sources);
    return html`
      <div class="degraded-badge">
        <ha-icon icon="mdi:alert-outline"></ha-icon>
        <span>${label}</span>
      </div>
    `;
  }

  // 'compact' form: a corner warning badge floating over the alert(s) at zero
  // layout cost. An overlay is an annotation on a host, so — like the strip — it
  // renders only when alerts exist. Carries the same mdi:alert-outline as the
  // strip and caveat (inverted: white glyph on the amber disc) so all three
  // forms read as one family; the label rides along as title/aria.
  private _renderDegradedDot(sources: BrokenSource[]): TemplateResult {
    const label = this._degradedLabel(sources);
    return html`
      <span class="degraded-dot" role="img" title=${label} aria-label=${label}>
        <ha-icon icon="mdi:alert-outline"></ha-icon>
      </span>
    `;
  }

  protected render(): TemplateResult {
    if (!this._config) return html``;

    if (!this.hass) {
      return this._renderPreview();
    }

    const allEntityIds = this._getAllEntities();
    const resolvedEntities = allEntityIds.map(id => this.hass.states[id]).filter(Boolean);

    // Device mode: if any configured device is registered (even when no
    // per-alert children currently exist), treat zero-resolved as "no active
    // alerts" rather than falling back to preview.
    const deviceLinked = configuredDevices(this._config).some(id => this._deviceHasAnyEntity(id));
    if ((resolvedEntities.length === 0 && !deviceLinked) || this._forcePreview) {
      return this._renderPreview();
    }

    // Availability is its own display channel, independent of the alert list.
    // unavailableBehavior governs how a dark source is surfaced, and the form
    // depends on whether there is alert content to anchor to:
    //   with alerts    → 'message': in-flow strip above them; 'compact': corner
    //                    dot floating over them at zero layout cost.
    //   without alerts → both collapse into a qualified empty state ("No active
    //                    alerts · N unavailable"). An overlay has no host and a
    //                    bare all-clear would be a false assertion, so the
    //                    caveat lives in the empty state itself.
    //   'hide'         → no availability signal in any case.
    // Signalling keeps the card visible even under hideNoAlerts, so a dark
    // source is never silently masked by the empty-state hide.
    const brokenSources = this._brokenSources();
    const behavior = this._config.unavailableBehavior || 'message';
    const signalAvailability = brokenSources.length > 0 && behavior !== 'hide';

    const alerts = this._getAlerts();
    const hasAlerts = alerts.length > 0;

    // Fully hide the card only when there is genuinely nothing to show and the
    // user opted into it: no alerts, hideNoAlerts set, and no availability
    // signal to surface. Any signal keeps the card on screen.
    if (!hasAlerts && this._config.hideNoAlerts && !signalAvailability) {
      this.style.display = 'none';
      return html``;
    }
    this.style.display = '';

    const animClass = this._animationsEnabled ? '' : 'no-animations';
    const layoutClass = this._isCompact ? 'compact' : '';
    const fillClass = this._config.progressFill === 'background' ? 'fill-mode-background' : '';

    // The strip and dot are anchored forms — they only render over real alerts.
    const strip = signalAvailability && hasAlerts && behavior === 'message';
    const dot = signalAvailability && hasAlerts && behavior === 'compact';

    return html`
      <ha-card .header=${this._config.title || ''} class="${animClass} ${layoutClass} ${fillClass}" data-theme-mode=${this._themeMode} style=${this._scaleStyle}>
        ${dot ? this._renderDegradedDot(brokenSources) : nothing}
        ${strip ? this._renderDegradedStrip(brokenSources) : nothing}
        ${hasAlerts
        ? alerts.map(alert => this._renderAlert(alert))
        : this._renderNoAlerts(signalAvailability ? brokenSources : [])}
      </ha-card>
      ${this._renderDetailPopup(alerts)}
    `;
  }

  // Card-owned per-alert detail pop-up (tap_action: { action: details }) — the
  // modal alternative to the inline expand. The body re-renders the same
  // expanded content the inline expand shows, so showDetails / showMetadata /
  // showGeometry / expandDetails all still govern it.
  //
  // Scoping is by the in-hand alert object, never a re-query, which is what
  // makes it per-alert for aggregate providers (one sensor holding many alerts)
  // exactly as it is for per-alert-entity ones.
  //
  // Deliberately a NATIVE <dialog>, not <ha-dialog>. ha-dialog's API changed
  // incompatibly in HA 2026.02 (mwc `heading` + slot="heading" → WebAwesome
  // `header-title` / headerTitle / headerNavigationIcon slots), and the card
  // supports HA versions on both sides of that line — one template cannot serve
  // both, and an unassigned slot renders nothing at all rather than failing
  // loudly. showModal() gives focus trap, Esc, ::backdrop and aria-modal from
  // the platform, so nothing here is hand-rolled a11y and nothing tracks HA's
  // component churn. (plans/per-alert-detail-popup.md R2, fallback D4(b).)
  private _renderDetailPopup(alerts: WeatherAlert[]): TemplateResult | typeof nothing {
    if (!this._detailPopupAlertId) return nothing;
    // Re-resolved every render: a live feed can drop the open alert, in which
    // case nothing renders and updated() clears the stale id.
    const alert = alerts.find(a => a.id === this._detailPopupAlertId);
    if (!alert) return nothing;

    const progress = computeAlertProgress(alert);
    const isOngoing = progress.isActive && !progress.hasEndTime;
    // The inner row re-uses .alert-card only for its token block (--color,
    // --wac-fg, --wac-progress-fg); styles.ts strips the row chrome. Mirrors
    // _renderFullAlert's class/style computation minus the row-only concerns
    // (swipe, tappable) and progressFill:background — the whole-row wash is a
    // row treatment, so the dialog always shows the ordinary progress track.
    const rowClasses = [
      'alert-card',
      `severity-${alert.severity}`,
      progress.phaseText.toLowerCase(),
      isOngoing ? 'ongoing' : '',
      this._alertDecoClasses(progress),
      this._alertBoostClasses(alert),
    ].filter(Boolean).join(' ');
    const rowStyle = `${this._alertColorStyle(alert)} --progress: ${isOngoing ? 0 : progress.progressPct}%;`;

    return html`
      <dialog
        class="detail-dialog"
        aria-label=${alert.event}
        @close=${() => this._closeDetailPopup()}
        @click=${this._onDetailPopupClick}
      >
        <div
          class="detail-dialog-body ${this._animationsEnabled ? '' : 'no-animations'}"
          data-theme-mode=${this._themeMode}
          style=${this._scaleStyle}
        >
          <div class=${rowClasses} style=${rowStyle}>
            ${this._renderAlertBody(alert, progress, { expanded: true, inPopup: true })}
          </div>
        </div>
      </dialog>
    `;
  }

  // A click whose target is the <dialog> itself landed on the ::backdrop —
  // the content sits in child elements, so it can only be the scrim.
  private _onDetailPopupClick(e: Event): void {
    if (e.target === e.currentTarget) this._dismissDetailPopup(e.currentTarget as HTMLDialogElement);
  }

  // close() fires the dialog's `close` event, so Esc, the scrim and the close
  // button all converge on the same single state-clearing path. jsdom ships
  // <dialog> without close()/showModal(), so degrade to clearing state
  // directly there rather than throwing.
  private _dismissDetailPopup(dialog?: HTMLDialogElement | null): void {
    const el = dialog ?? this._detailPopupEl;
    if (el && typeof el.close === 'function') el.close();
    else this._closeDetailPopup();
  }

  private _renderDetailPopupClose(): TemplateResult {
    const label = t('card.close', this._lang);
    return html`
      <button
        type="button"
        class="detail-dialog-close"
        aria-label=${label}
        title=${label}
        @click=${() => this._dismissDetailPopup()}
      >
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    `;
  }

  private get _detailPopupEl(): HTMLDialogElement | null {
    return this.shadowRoot?.querySelector<HTMLDialogElement>('dialog.detail-dialog') ?? null;
  }

  private _renderPreview(): TemplateResult {
    const alerts = this._filterAndSort(getPreviewAlerts(), { skipZones: true });
    const animClass = this._animationsEnabled ? '' : 'no-animations';
    const layoutClass = this._isCompact ? 'compact' : '';
    const fillClass = this._config?.progressFill === 'background' ? 'fill-mode-background' : '';

    return html`
      <ha-card .header=${this._config.title || ''} class="${animClass} ${layoutClass} ${fillClass}" data-theme-mode=${this._themeMode} style=${this._scaleStyle}>
        <div class="preview-label">${t('card.preview', this._lang)}</div>
        ${alerts.map(alert => this._renderAlert(alert))}
      </ha-card>
    `;
  }

  // The empty state. When sources is non-empty a source is dark, so the
  // all-clear is qualified by an availability caveat rather than asserted alone
  // — the zero-alert form of the availability channel (no strip, no dot).
  private _renderNoAlerts(sources: BrokenSource[] = []): TemplateResult {
    return html`
      <div class="no-alerts">
        <ha-icon icon="mdi:weather-sunny"></ha-icon><br>
        ${t('card.no_alerts', this._lang)}
        ${sources.length > 0
        ? html`<div class="no-alerts-caveat">
            <ha-icon icon="mdi:alert-outline"></ha-icon>${this._degradedLabel(sources)}
          </div>`
        : nothing}
      </div>
    `;
  }

  private _renderAlert(alert: WeatherAlert): TemplateResult {
    const className = `severity-${alert.severity}`;
    const progress = computeAlertProgress(alert);
    const phaseClass = progress.phaseText.toLowerCase();
    const expanded = this._expandedAlerts.get(alert.id) || false;

    if (this._isCompact) {
      return this._renderCompactAlert(alert, className, phaseClass, progress, expanded);
    }

    return this._renderFullAlert(alert, className, phaseClass, progress, expanded);
  }

  private _renderCompactAlert(
    alert: WeatherAlert, className: string, phaseClass: string,
    progress: AlertProgress, expanded: boolean,
  ): TemplateResult {
    const lang = this._lang;
    const isOngoing = progress.isActive && !progress.hasEndTime;
    const compactTimeLabel = progress.isExpired
      ? t('progress.compact_expired', lang, { time: formatDuration(progress.endsTs, progress.nowTs) })
      : isOngoing
        ? t('progress.compact_ongoing', lang)
        : progress.isActive
          ? t('progress.compact_active', lang, { time: formatDuration(progress.endsTs, progress.nowTs) })
          : t('progress.compact_prep', lang, { time: formatDuration(progress.onsetTs, progress.nowTs) });
    const ongoingClass = isOngoing ? 'ongoing' : '';
    const boostClasses = this._alertBoostClasses(alert);
    const decoClasses = this._alertDecoClasses(progress);
    const progressStyle = isOngoing ? '' : `--progress: ${progress.progressPct}%;`;
    const swipeClass = this._swipeCardClass(alert);
    const tapAction = hasTapAction(this._config);
    const actionable = tapAction && this._config!.tap_action!.action !== 'none';
    const cardStyle = this._swipeCardStyle(alert, `${this._alertColorStyle(alert)} ${progressStyle}`);
    return html`
      <div
        class="alert-card ${className} ${phaseClass} ${ongoingClass} ${decoClasses} ${boostClasses} ${swipeClass} ${actionable ? 'tappable' : ''}"
        style=${cardStyle}
        role=${actionable ? 'button' : nothing}
        tabindex=${actionable ? '0' : nothing}
        @pointerdown=${(e: PointerEvent) => this._onSwipePointerDown(alert, e)}
        @pointermove=${(e: PointerEvent) => this._onSwipePointerMove(alert, e)}
        @pointerup=${(e: PointerEvent) => this._onSwipePointerUp(alert, e)}
        @pointercancel=${(e: PointerEvent) => this._onSwipePointerCancel(alert, e)}
        @click=${actionable ? () => this._onCardAction(alert) : nothing}
        @keydown=${actionable ? (e: KeyboardEvent) => this._onCardActionKeydown(alert, e) : nothing}
      >
        <div
          class="alert-header-row compact-row"
          @click=${tapAction ? nothing : () => this._toggleDetails(alert.id)}
        >
          <div class="icon-box">
            <ha-icon icon=${alert.providerIcon ?? getWeatherIcon(alert.iconHint || alert.event)}></ha-icon>
          </div>
          ${this._renderProviderHint(alert)}
          <span class="alert-title">${alert.event}</span>
          <span class="compact-time">${compactTimeLabel}</span>
          ${tapAction ? nothing : html`
          <ha-icon
            icon="mdi:chevron-down"
            class="compact-chevron ${expanded ? 'expanded' : ''}"
          ></ha-icon>
          `}
          ${this._renderDismissButton(alert)}
        </div>
        ${expanded ? this._renderExpandedContent(alert, progress) : nothing}
      </div>
    `;
  }

  private _renderExpandedContent(alert: WeatherAlert, progress: AlertProgress): TemplateResult {
    return html`
      <div class="alert-expanded">
        ${this._renderHeadline(alert)}
        ${alert.areaDesc ? html`
          <div class="area-desc" title=${alert.areaDesc}>
            <ha-icon icon="mdi:map-marker"></ha-icon>
            <span class="area-desc-text">${alert.areaDesc}</span>
          </div>
        ` : nothing}
        <div class="badges-row" style="padding: 0 12px 8px;">
          ${this._renderBadgesRow(alert, progress)}
        </div>

        ${this._renderProgressSection(alert, progress)}

        ${this._config?.showDetails !== false ? (this._config?.expandDetails ? html`
        ${this._renderDetailsContent(alert, progress)}
        ` : html`
        <div class="alert-details-section">
          <div
            class="details-summary"
            @click=${() => this._toggleDetails(alert.id + '_details')}
          >
            <span>${t('card.read_details', this._lang)}</span>
            <ha-icon
              icon="mdi:chevron-down"
              class="chevron ${this._expandedAlerts.get(alert.id + '_details') ? 'expanded' : ''}"
            ></ha-icon>
          </div>
          ${this._expandedAlerts.get(alert.id + '_details')
          ? this._renderDetailsContent(alert, progress)
          : nothing}
        </div>
        `) : nothing}
      </div>
    `;
  }

  private _renderFullAlert(
    alert: WeatherAlert, className: string, phaseClass: string,
    progress: AlertProgress, expanded: boolean,
  ): TemplateResult {
    const boostClasses = this._alertBoostClasses(alert);
    const decoClasses = this._alertDecoClasses(progress);
    const swipeClass = this._swipeCardClass(alert);
    const tapAction = hasTapAction(this._config);
    const actionable = tapAction && this._config!.tap_action!.action !== 'none';
    // --progress positions the whole-row wash (progressFill:background); ongoing
    // (active, no end time) fills full-width, so pin it to 0% (left:0). Inert in
    // track mode. Mirrors the compact renderer.
    const isOngoing = progress.isActive && !progress.hasEndTime;
    const progressStyle = isOngoing ? '--progress: 0%;' : `--progress: ${progress.progressPct}%;`;
    const cardStyle = this._swipeCardStyle(alert, `${this._alertColorStyle(alert)} ${progressStyle}`);
    return html`
      <div
        class="alert-card ${className} ${phaseClass} ${decoClasses} ${boostClasses} ${swipeClass} ${actionable ? 'tappable' : ''}"
        style=${cardStyle}
        role=${actionable ? 'button' : nothing}
        tabindex=${actionable ? '0' : nothing}
        @pointerdown=${(e: PointerEvent) => this._onSwipePointerDown(alert, e)}
        @pointermove=${(e: PointerEvent) => this._onSwipePointerMove(alert, e)}
        @pointerup=${(e: PointerEvent) => this._onSwipePointerUp(alert, e)}
        @pointercancel=${(e: PointerEvent) => this._onSwipePointerCancel(alert, e)}
        @click=${actionable ? () => this._onCardAction(alert) : nothing}
        @keydown=${actionable ? (e: KeyboardEvent) => this._onCardActionKeydown(alert, e) : nothing}
      >
        ${this._renderAlertBody(alert, progress, { expanded, inPopup: false })}
      </div>
    `;
  }

  // The full alert body — header row (icon, provider hint, title, headline,
  // area, badges), progress section, details. Shared verbatim by the
  // default-layout row and the detail pop-up so the two cannot drift; the row
  // wrapper (swipe/tap/severity classes) stays with each caller.
  private _renderAlertBody(
    alert: WeatherAlert, progress: AlertProgress,
    opts: { expanded: boolean; inPopup: boolean },
  ): TemplateResult {
    const tapAction = hasTapAction(this._config);
    const showDetails = this._config?.showDetails !== false;
    return html`
      <div class="alert-header-row">
        <div class="icon-box">
          <ha-icon icon=${alert.providerIcon ?? getWeatherIcon(alert.iconHint || alert.event)}></ha-icon>
        </div>
        <div class="info-box">
          <div class="title-row">
            ${this._renderProviderHint(alert)}
            <span class="alert-title">${alert.event}</span>
          </div>
          ${this._renderHeadline(alert)}
          ${alert.areaDesc ? html`
            <div class="area-desc" title=${alert.areaDesc}>
              <ha-icon icon="mdi:map-marker"></ha-icon>
              <span class="area-desc-text">${alert.areaDesc}</span>
            </div>
          ` : nothing}
          <div class="badges-row">
            ${this._renderBadgesRow(alert, progress)}
          </div>
        </div>
        ${opts.inPopup ? this._renderDetailPopupClose() : this._renderDismissButton(alert)}
      </div>

      ${this._renderProgressSection(alert, progress)}

      ${opts.inPopup
        // The pop-up *is* the details view, so it never gates its own content
        // behind a second toggle: showDetails still suppresses the panel, but
        // expandDetails governs the row only. Opening a detail pop-up and
        // having to click "Read Details" inside it was the rough edge here.
        ? (showDetails ? this._renderDetailsContent(alert, progress) : nothing)
        : (tapAction
          ? (showDetails && this._config?.expandDetails
            ? this._renderDetailsContent(alert, progress)
            : nothing)
          : (showDetails ? (this._config?.expandDetails ? html`
      ${this._renderDetailsContent(alert, progress)}
      ` : html`
      <div class="alert-details-section">
        <div
          class="details-summary"
          @click=${() => this._toggleDetails(alert.id)}
        >
          <span>${t('card.read_details', this._lang)}</span>
          <ha-icon
            icon="mdi:chevron-down"
            class="chevron ${opts.expanded ? 'expanded' : ''}"
          ></ha-icon>
        </div>
        ${opts.expanded ? this._renderDetailsContent(alert, progress) : nothing}
      </div>
      `) : nothing))}
    `;
  }

  private _renderProviderHint(alert: WeatherAlert): TemplateResult | typeof nothing {
    if (this._config?.showProvider !== true) return nothing;
    const code = PROVIDER_SHORT[alert.provider] || alert.provider.toUpperCase();
    return html`<span class="provider-hint">${code}</span>`;
  }

  private _renderHeadline(alert: WeatherAlert): TemplateResult | typeof nothing {
    const smart = this._config?.deduplicateHeadlines !== false;
    const text = getDisplayHeadline(alert, smart);
    if (!text) return nothing;
    return html`
      <div class="alert-headline" title=${alert.headline}>
        ${text}
      </div>
    `;
  }

  private _renderBadgesRow(alert: WeatherAlert, progress: AlertProgress): TemplateResult {
    const severityText = alert.severityBadgeLabel
      ?? t('badge.severity_' + alert.severity, this._lang);
    const certText = alert.certainty
      ? t('badge.certainty_' + alert.certainty.toLowerCase(), this._lang)
      : '';
    return html`
      <span class="badge severity-badge${alert.severityInferred ? ' badge-inferred' : ''}">${severityText}</span>
      ${alert.certainty ? html`
        <span class="badge certainty-badge${alert.certaintyInferred ? ' badge-inferred' : ''}">
          <ha-icon
            icon=${getCertaintyIcon(alert.certainty)}
            style="--mdc-icon-size: ${this._scaledPx(14)}px; width: ${this._scaledPx(14)}px; height: ${this._scaledPx(14)}px;"
          ></ha-icon>
          ${certText}
        </span>
      ` : nothing}
      ${alert.phase ? html`
        <span class="badge phase-badge">${alert.phase}</span>
      ` : nothing}
      ${alert.eventCode && alert.eventCode.trim().toLowerCase() !== alert.event.trim().toLowerCase() ? html`
        <span class="badge event-code-badge">${alert.eventCode}</span>
      ` : nothing}
      ${alert.mergedCount && alert.mergedCount > 1
        ? html`<span class="badge zones-badge">${t(
          'card.zones_count', this._lang, { count: alert.mergedCount },
        )}</span>`
        : nothing}
    `;
  }

  private _renderTextBlock(label: string, text: string): TemplateResult | typeof nothing {
    if (!text) return nothing;
    return html`
      <div class="text-block">
        <div class="text-label">${label}</div>
        <div class="text-body">${unsafeHTML(sanitizeAlertHtml(text))}</div>
      </div>
    `;
  }

  // Distance from the card's reference point to a point-incident alert, for
  // the detail grid. Reads `WeatherAlert.point` only (no provider branch,
  // #205), so any source that publishes a point gets the row. Area warnings
  // have no point and get no row at all — never an "unknown" placeholder.
  // Shown whether or not `maxDistanceKm` is configured; the same reference
  // resolution as the filter (HA home, or myLocationEntity), so an unset
  // location means no row rather than a bad number.
  private _distanceFromHomeKm(alert: WeatherAlert): number | undefined {
    if (!alert.point) return undefined;
    const home = resolveReferencePoint(this.hass, this._config?.myLocationEntity);
    if (!home) return undefined;
    return haversineKm(alert.point[0], alert.point[1], home[0], home[1]);
  }

  private _renderDetailsContent(alert: WeatherAlert, progress: AlertProgress): TemplateResult {
    const reformat = this._config?.reformatText !== false;
    let desc = this._normalizeText(alert.description);
    let instr = this._normalizeText(alert.instruction);
    if (reformat) {
      desc = reflowAlertText(desc);
      instr = reflowAlertText(instr);
    }

    const lang = this._lang;
    const distanceKm = this._distanceFromHomeKm(alert);

    return html`
      <div class="details-content" @click=${(e: Event) => e.stopPropagation()}>
        ${this._config?.showMetadata !== false ? html`
        <div class="meta-grid">
          ${progress.sentTs > 100 ? html`
          <div class="meta-item">
            <span class="meta-label">${t('detail.issued', lang)}</span>
            <span class="meta-value">${formatLocalTimestamp(progress.sentTs, this._locale, lang)}</span>
          </div>
          ` : nothing}
          <div class="meta-item">
            <span class="meta-label">${t('detail.onset', lang)}</span>
            <span class="meta-value">${formatLocalTimestamp(progress.onsetTs, this._locale, lang)}</span>
            <span class="meta-relative">${formatRelativeTime(progress.onsetTs, progress.nowTs, lang)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${progress.isExpired ? t('progress.expired_label', lang) : t('detail.expires', lang)}</span>
            ${progress.hasEndTime
          ? html`<span class="meta-value">${formatLocalTimestamp(progress.endsTs, this._locale, lang)}</span>
            <span class="meta-relative">${formatRelativeTime(progress.endsTs, progress.nowTs, lang)}</span>`
          : html`<span class="meta-value">${progress.isActive ? t('progress.ongoing', lang) : t('progress.tbd', lang)}</span>`}
          </div>
          ${distanceKm !== undefined ? html`
            <div class="meta-item">
              <span class="meta-label">${t('detail.distance', lang)}</span>
              <span class="meta-value">${formatDistance(distanceKm, toLengthUnit(this.hass?.config?.unit_system?.length), lang)}</span>
            </div>
          ` : nothing}
          ${alert.areaDesc ? html`
            <div class="meta-item" style="grid-column: 1 / -1;">
              <span class="meta-label">${t('detail.area', lang)}</span>
              <span class="meta-value">${alert.areaDesc}</span>
            </div>
          ` : nothing}
        </div>
        ` : nothing}

        ${this._config?.showGeometry === true ? this._renderGeometry(alert) : nothing}

        ${this._config?.showDescription !== false ? this._renderTextBlock(t('detail.description', lang), desc) : nothing}
        ${this._config?.showInstructions !== false ? this._renderTextBlock(t('detail.instructions', lang), instr) : nothing}

        ${alert.url && this._config?.showSourceLink !== false ? html`
          <div class="footer-link">
            <a href=${alert.url} target="_blank" rel="noopener noreferrer">
              ${this._sourceLinkLabel(alert)}
              <ha-icon icon="mdi:open-in-new" style="width:${this._scaledPx(14)}px;"></ha-icon>
            </a>
          </div>
        ` : nothing}
      </div>
    `;
  }

  // Resolves the mini-map's inputs for one alert: the frame (`bbox`), the
  // incident marker (`point`) and the opt-in my-location marker. Degrade order
  // is layering, not either/or — polygon → bbox frame → point marker →
  // nothing — so a future source publishing both an outline and a precise
  // point gets both. A real bbox is the alert's own extent and is never
  // widened to fit the reference point (it just clips); only a frame the card
  // INVENTED around a point may grow, and only while the reference point is
  // close enough (REFERENCE_FRAME_MAX_KM) to keep the incident in local
  // context — past that it is dropped from framing and not drawn at all.
  // Pure: reads config + hass only.
  private _geometryPoints(alert: WeatherAlert): { bbox?: Bbox; point?: LonLat; referencePoint?: LonLat } {
    const point = alert.point;
    let referencePoint = this._config?.showMyLocation === true
      ? resolveReferencePoint(this.hass, this._config?.myLocationEntity)
      : undefined;
    let bbox: Bbox | undefined = alert.bbox;
    if (!bbox && point) {
      const near = referencePoint
        && haversineKm(point[0], point[1], referencePoint[0], referencePoint[1]) <= REFERENCE_FRAME_MAX_KM;
      if (referencePoint && !near) referencePoint = undefined;
      bbox = framePointsBbox(referencePoint ? [point, referencePoint] : [point]);
    }
    return { bbox, point, referencePoint };
  }

  // Inline SVG mini-map: the affected area (cap_alerts polygon over its bbox
  // frame) or, for point-incident sources, a marker at the incident inside a
  // synthesized frame. bbox draws an immediate frame with zero network; the
  // polygon overlays once the out-of-band fetch lands. Reads cache only —
  // purity preserved. The severity color flows in via the inherited --color
  // custom property.
  private _renderGeometry(alert: WeatherAlert): TemplateResult | typeof nothing {
    if (this._config?.showGeometry !== true) return nothing;
    const { bbox, point, referencePoint } = this._geometryPoints(alert);
    if (!bbox) return nothing;
    const geometry = alert.geometryRef ? this._geometryCache.get(alert.geometryRef) : undefined;
    if (this._config?.geometryStyle === 'map') {
      // Default basemap needs the proxy token. Until it arrives — or for good
      // on a core without map_tiles — the plain outline is the honest render:
      // a tokenless <image> would just 403 into a blank map frame.
      const override = this._config?.geometryTileUrl;
      if (override || this._mapTilesToken !== null) {
        return this._renderGeometryMap(alert, bbox, geometry, point, referencePoint);
      }
    }
    const { viewBox, polygonPaths, marker, referenceMarker } = buildGeometrySvg(bbox, geometry, point, referencePoint);
    return html`
      <svg
        class="alert-geometry${alert.bbox ? '' : ' point'}"
        viewBox=${viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label=${this._geometryLabel(alert, referenceMarker !== undefined)}
      >
        <rect class="geometry-frame" x="0" y="0" width="100%" height="100%"></rect>
        ${polygonPaths.map(d => svg`<path class="geometry-shape" d=${d}></path>`)}
        ${this._renderGeometryMarkers(marker, referenceMarker, false)}
      </svg>
    `;
  }

  // Reference marker under the incident marker: the incident is the subject.
  // The my-location ring is two stacked round-cap dots — neutral outer,
  // background-colored core — so it needs no radius math in the builder.
  private _renderGeometryMarkers(
    marker: { x: number; y: number } | undefined,
    referenceMarker: { x: number; y: number } | undefined,
    casing: boolean,
  ): TemplateResult {
    return html`
      ${referenceMarker ? svg`
        <path class="geometry-reference-ring" d=${markerPath(referenceMarker)}></path>
        <path class="geometry-reference-core" d=${markerPath(referenceMarker)}></path>
      ` : nothing}
      ${marker && casing ? svg`<path class="geometry-marker-casing" d=${markerPath(marker)}></path>` : nothing}
      ${marker ? svg`<path class="geometry-marker" d=${markerPath(marker)}></path>` : nothing}
    `;
  }

  private _geometryLabel(alert: WeatherAlert, withLocation: boolean): string {
    const area = alert.areaDesc || t('detail.area', this._lang);
    return withLocation ? t('detail.geometry_with_location', this._lang, { area }) : area;
  }

  // 'map' style: OSM raster tiles (browser-loaded <image>) behind the polygon.
  // Tiles/polygon share the Web-Mercator tile space so they align; the polygon
  // gets a white casing for legibility over busy tiles. Tile failure / offline
  // leaves the frame + polygon visible. The attribution lives in an HTML overlay
  // (CSS-positioned) rather than the SVG so it doesn't scale with the viewBox.
  // Caller guarantees either a user tile override or a live proxy token.
  private _renderGeometryMap(
    alert: WeatherAlert,
    bbox: Bbox,
    geometry?: GeoJsonGeometry,
    point?: LonLat,
    referencePoint?: LonLat,
  ): TemplateResult {
    // Default basemap is HA's proxy, which serves one (light) raster; the
    // `dark` class inverts the tile layer in CSS like HA's map. A user override
    // opts out of that inversion and of the OSM-credit assumption, so default
    // its attribution to the generic OSM credit and leave its tiles untouched.
    const override = this._config?.geometryTileUrl;
    const tileUrl = override
      || mapTilesUrl(this.hass?.auth?.data?.hassUrl, this._mapTilesToken ?? '');
    const attribution = this._config?.geometryTileAttribution
      ?? (override ? '© OpenStreetMap' : DEFAULT_TILE_ATTRIBUTION);
    const invert = !override && this._themeMode === 'dark';
    const { viewBox, aspect, tiles, polygonPaths, marker, referenceMarker } = buildGeometryMap(
      bbox,
      geometry,
      { tileUrl, attribution, point, referencePoint },
    );
    const label = this._geometryLabel(alert, referenceMarker !== undefined);
    return html`
      <div class="alert-geometry-map" style="aspect-ratio: ${aspect};">
        <svg
          class="alert-geometry map${alert.bbox ? '' : ' point'}${invert ? ' dark' : ''}"
          viewBox=${viewBox}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label=${label}
        >
          <g class="geometry-tiles">
            ${tiles.map(tile => svg`<image
              href=${tile.href}
              x=${tile.x}
              y=${tile.y}
              width=${tile.size}
              height=${tile.size}
            ></image>`)}
          </g>
          <rect class="geometry-frame" x="0" y="0" width="100%" height="100%"></rect>
          ${polygonPaths.map(d => svg`<path class="geometry-shape-casing" d=${d}></path>`)}
          ${polygonPaths.map(d => svg`<path class="geometry-shape" d=${d}></path>`)}
          ${this._renderGeometryMarkers(marker, referenceMarker, true)}
        </svg>
        <span class="geometry-attrib">${attribution}</span>
      </div>
    `;
  }

  private _renderProgressSection(_alert: WeatherAlert, progress: AlertProgress): TemplateResult {
    const { isActive, progressPct, hasEndTime, onsetTs, endsTs, nowTs } = progress;
    const lang = this._lang;

    // Ongoing positioning only (full width); the pulse animation comes from the
    // deco-pulse class on the alert-card root (default for the ongoing phase),
    // and the .no-animations rules freeze it when animations are off. No opacity
    // dim — ongoing renders at full strength like active (see ongoing-pulse).
    const fillStyle = progress.isExpired
      ? 'left: 0; right: 0;'
      : isActive && !hasEndTime
        ? 'width: 100%; left: 0;'
        : `left: ${progressPct}%; right: 0;`;

    return html`
      <div class="progress-section">
        <div class="progress-labels">
          <div class="label-left">
            <span class="label-sub">${isActive ? t('progress.start', lang) : t('progress.now', lang)}</span>
            <span>${formatProgressTimestamp(isActive ? onsetTs : nowTs, this._locale, lang)}</span>
          </div>
          <div class="label-center">
            ${!hasEndTime
        ? html`<span class="label-sub">${t('progress.ongoing', lang)}</span>`
        : progress.isExpired
          ? html`<span class="label-sub">${t('progress.expired_label', lang)}</span><span>${formatDuration(endsTs, nowTs)}</span>`
          : isActive
            ? html`<span class="label-sub">${t('progress.expires_in_label', lang)}</span><span>${formatDuration(endsTs, nowTs)}</span>`
            : html`<span class="label-sub">${t('progress.starts_in_label', lang)}</span><span>${formatDuration(onsetTs, nowTs)}</span>`}
          </div>
          <div class="label-right">
            <span class="label-sub">${t('progress.end', lang)}</span>
            <span>${hasEndTime ? formatProgressTimestamp(endsTs, this._locale, lang) : t('progress.tbd', lang)}</span>
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style=${fillStyle}></div>
        </div>
      </div>
    `;
  }
}

// Register with HA card picker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any;
w.customCards = w.customCards || [];
w.customCards.push({
  type: 'weather-alerts-card',
  name: 'Weather Alerts Card',
  preview: true,
  description: 'A card for displaying weather alerts with severity indicators, progress bars, and expandable details. Supports NWS (US), BoM (Australia), and MeteoAlarm (Europe).',
});

declare global {
  interface HTMLElementTagNameMap {
    'weather-alerts-card': WeatherAlertsCard;
  }
}
